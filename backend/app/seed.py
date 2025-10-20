# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
import csv
from pathlib import Path
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.db.session import Base, async_session_maker, engine
from app.models.survey import SurveyItem
from app.models.user import GradeBand, User, UserRole
from app.services.questionnaire import load_questionnaire


CSV_USER_PATH = Path(__file__).resolve().parents[2] / "test.csv"
DEFAULT_SCHOOL_NAME = "测试学校"
CHINESE_DIGIT_MAP = {
    "零": 0,
    "〇": 0,
    "○": 0,
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
}


def grade_to_band(grade: Optional[int]) -> Optional[GradeBand]:
    if grade is None:
        return None
    if grade <= 2:
        return GradeBand.LOW
    if grade <= 4:
        return GradeBand.MID
    return GradeBand.HIGH


async def create_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed_questionnaire(session: AsyncSession) -> None:
    data = load_questionnaire()
    existing = await session.execute(select(SurveyItem.id))
    if existing.first():
        return
    for grade_band_key, grade_data in data["grade_bands"].items():
        band = GradeBand(grade_band_key)
        sort_index = 1
        for section in grade_data["sections"]:
            major = section["major_category"]
            minor = section["minor_category"]
            for prompt in section["items"]:
                session.add(
                    SurveyItem(
                        grade_band=band,
                        major_category=major,
                        minor_category=minor,
                        prompt=prompt,
                        sort_key=sort_index,
                    )
                )
                sort_index += 1


def _normalize_text(value: Optional[str]) -> str:
    return (value or "").strip()


def _parse_grade(value: Optional[str]) -> Optional[int]:
    text = _normalize_text(value)
    if not text:
        return None
    for suffix in ("年级", "年", "级"):
        text = text.replace(suffix, "")
    if text.isdigit():
        return int(text)
    return CHINESE_DIGIT_MAP.get(text)


def _parse_class(value: Optional[str]) -> Optional[str]:
    text = _normalize_text(value)
    for suffix in ("班级", "班"):
        text = text.replace(suffix, "")
    return text or None


def _parse_student_no(value: Optional[str]) -> Optional[str]:
    text = _normalize_text(value)
    digits = "".join(ch for ch in text if ch.isdigit())
    if digits:
        return digits.zfill(2)
    return None


def _load_users_from_csv() -> list[dict]:
    if not CSV_USER_PATH.exists():
        return []

    users: list[dict] = []
    with CSV_USER_PATH.open("r", encoding="utf-8") as fp:
        reader = csv.DictReader(fp)
        for row in reader:
            username = _normalize_text(row.get("account"))
            password = _normalize_text(row.get("password"))
            if not username or not password:
                continue

            name = _normalize_text(row.get("name"))
            grade = _parse_grade(row.get("grade"))
            class_no = _parse_class(row.get("class"))
            hashed_password = get_password_hash(password)

            base_payload = dict(
                username=username,
                hashed_password=hashed_password,
                grade=grade,
                class_no=class_no,
                grade_band=grade_to_band(grade),
                school_name=DEFAULT_SCHOOL_NAME,
                is_active=True,
            )

            if username.startswith("T"):
                users.append(
                    dict(
                        **base_payload,
                        role=UserRole.TEACHER,
                        teacher_name=name or None,
                    )
                )
            else:
                student_no = _parse_student_no(row.get("number"))
                users.append(
                    dict(
                        **base_payload,
                        role=UserRole.STUDENT,
                        student_name=name or None,
                        student_no=student_no,
                    )
                )
    return users


async def seed_users(session: AsyncSession) -> None:
    await session.execute(delete(User).where(User.role != UserRole.ADMIN))

    admin_exists = await session.scalar(
        select(User).where(User.username == "admin123")
    )
    if not admin_exists:
        session.add(
            User(
                username="admin123",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.ADMIN,
                school_name=DEFAULT_SCHOOL_NAME,
                teacher_name="管理员",
                class_no="管理员",
            )
        )

    for payload in _load_users_from_csv():
        session.add(User(**payload))


async def seed() -> None:
    await create_schema()
    async with async_session_maker() as session:
        async with session.begin():
            await seed_questionnaire(session)
            await seed_users(session)


def run() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    run()
