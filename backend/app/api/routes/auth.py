# -*- coding: utf-8 -*-
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.security import create_access_token, create_session_id, verify_password
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, Token
from app.schemas.users import UserSummary

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", response_model=Token, summary="登录并颁发访问令牌")
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> Token:
    stmt = select(User).where(User.username == payload.username)
    result = await db.execute(stmt)
    user: User | None = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    if payload.identity == "teacher" and user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问")
    if payload.identity == "student" and user.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问")

    session_id = create_session_id()
    user.active_session_id = session_id
    await db.commit()

    user_summary = UserSummary(
        id=user.id,
        username=user.username,
        role=user.role.value,
        school_name=user.school_name,
        student_name=user.student_name,
        teacher_name=user.teacher_name,
        class_no=user.class_no,
        grade=user.grade,
        grade_band=user.grade_band.value if user.grade_band else None,
    )

    token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
        session_id=session_id,
    )
    return Token(
        access_token=token,
        role=user.role.value,
        session_id=session_id,
        user=user_summary,
    )


@router.post("/logout", summary="退出登录")
async def logout(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    current_user.active_session_id = uuid.uuid4()
    await db.commit()
    return {"message": "退出系统"}
