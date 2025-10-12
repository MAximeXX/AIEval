# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.users import UserSummary


class LoginRequest(BaseModel):
    identity: Literal["student", "teacher"] = Field(
        description="登录身份：学生与家长/教师"
    )
    username: str = Field(description="账号")
    password: str = Field(description="密码")


class Token(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    role: str
    session_id: UUID
    user: UserSummary


class TokenPayload(BaseModel):
    sub: str
    role: str
    sid: UUID
    exp: datetime
