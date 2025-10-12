# -*- coding: utf-8 -*-
from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login")


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="用户不存在",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
    except JWTError as exc:
        raise credentials_exception from exc

    user_id = payload.get("sub")
    session_id = payload.get("sid")
    if user_id is None or session_id is None:
        raise credentials_exception

    try:
        user_uuid = uuid.UUID(user_id)
        session_uuid = uuid.UUID(session_id)
    except ValueError as exc:
        raise credentials_exception from exc

    user = await db.get(User, user_uuid)
    if user is None or not user.is_active:
        raise credentials_exception

    if not user.active_session_id or user.active_session_id != session_uuid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="检测到您在其他设备登陆，请重新登录",
        )
    return user


async def get_current_student(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问")
    return user


async def get_current_teacher(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问")
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问")
    return user
