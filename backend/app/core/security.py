# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from uuid import UUID, uuid4

from jose import jwt
from passlib.context import CryptContext

from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_session_id() -> UUID:
    return uuid4()


def create_access_token(
    subject: str,
    role: str,
    session_id: UUID,
    expires_delta: timedelta | None = None,
) -> str:
    """签发 JWT，内含会话标识（用于多端强制下线）。"""
    expire = datetime.now(tz=timezone.utc) + (
        expires_delta
        if expires_delta
        else timedelta(minutes=settings.access_token_expire_minutes)
    )

    to_encode: Dict[str, Any] = {
        "sub": subject,
        "role": role,
        "sid": str(session_id),
        "exp": expire,
    }
    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
        options={"verify_aud": False},
    )
