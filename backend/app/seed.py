# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.db.session import Base, async_session_maker, engine
from app.models.survey import SurveyItem
from app.models.user import GradeBand, User, UserRole
from app.services.questionnaire import load_questionnaire


@dataclass
class SampleStudent:
    username: str
    password: str
    student_name: str
    grade: int
    class_no: str
    student_no: str


@dataclass
class SampleTeacher:
    username: str
    password: str
    teacher_name: str
    grade: int
    class_no: str


def grade_to_band(grade: int) -> GradeBand:
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


def generate_samples() -> tuple[list[SampleTeacher], list[SampleStudent]]:
    teachers: list[SampleTeacher] = []
    students: list[SampleStudent] = []
    school_name = "earon小学"

    student_passwords = [f"test{index:02d}" for index in range(1, 19)]
    student_pwd_iter = iter(student_passwords)

    for grade in range(1, 7):
        class_no = f"{grade}1"
        teacher_username = f"T-earon{grade}1"
        teacher_password = f"test{grade}1"
        teacher = SampleTeacher(
            username=teacher_username,
            password=teacher_password,
            teacher_name=f"教师{grade}年级",
            grade=grade,
            class_no=class_no,
        )
        teachers.append(teacher)
        for idx in range(1, 4):
            username = f"earon{grade}1{idx:02d}"
            students.append(
                SampleStudent(
                    username=username,
                    password=next(student_pwd_iter),
                    student_name=f"学生{grade}-{idx}",
                    grade=grade,
                    class_no=class_no,
                    student_no=f"{idx:02d}",
                )
            )
    return teachers, students


async def seed_users(session: AsyncSession) -> None:
    teachers, students = generate_samples()

    admin_exists = await session.scalar(
        select(User).where(User.username == "admin123")
    )
    if not admin_exists:
        session.add(
            User(
                username="admin123",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.ADMIN,
                school_name="earon小学",
                teacher_name="管理员",
                class_no="管理员",
            )
        )

    for teacher in teachers:
        exists = await session.scalar(
            select(User).where(User.username == teacher.username)
        )
        if exists:
            continue
        session.add(
            User(
                username=teacher.username,
                hashed_password=get_password_hash(teacher.password),
                role=UserRole.TEACHER,
                school_name="earon小学",
                class_no=teacher.class_no,
                grade=teacher.grade,
                grade_band=grade_to_band(teacher.grade),
                teacher_name=teacher.teacher_name,
            )
        )

    for student in students:
        exists = await session.scalar(
            select(User).where(User.username == student.username)
        )
        if exists:
            continue
        session.add(
            User(
                username=student.username,
                hashed_password=get_password_hash(student.password),
                role=UserRole.STUDENT,
                school_name="earon小学",
                class_no=student.class_no,
                grade=student.grade,
                grade_band=grade_to_band(student.grade),
                student_name=student.student_name,
                student_no=student.student_no,
            )
        )


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
