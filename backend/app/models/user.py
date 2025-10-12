# -*- coding: utf-8 -*-
from __future__ import annotations

import uuid
from enum import Enum

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.survey import (
        CompletionStatus,
        ParentNote,
        StudentLock,
        SurveyResponse,
        TeacherReview,
    )


class UserRole(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class GradeBand(str, Enum):
    LOW = "low"
    MID = "mid"
    HIGH = "high"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("username", name="uq_users_username"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False)

    school_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    class_no: Mapped[str | None] = mapped_column(String(32), nullable=True)
    grade: Mapped[int | None] = mapped_column(Integer, nullable=True)
    grade_band: Mapped[GradeBand | None] = mapped_column(
        SAEnum(GradeBand), nullable=True
    )
    student_no: Mapped[str | None] = mapped_column(String(32), nullable=True)
    student_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    teacher_name: Mapped[str | None] = mapped_column(String(64), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    active_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # relationships
    survey_responses: Mapped[list["SurveyResponse"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
        foreign_keys="SurveyResponse.student_id",
    )
    parent_note: Mapped["ParentNote"] = relationship(
        back_populates="student",
        uselist=False,
        cascade="all, delete-orphan",
        foreign_keys="ParentNote.student_id",
    )
    teacher_review: Mapped["TeacherReview"] = relationship(
        back_populates="student",
        uselist=False,
        cascade="all, delete-orphan",
        foreign_keys="TeacherReview.student_id",
    )
    completion_status: Mapped["CompletionStatus"] = relationship(
        back_populates="student",
        uselist=False,
        cascade="all, delete-orphan",
        foreign_keys="CompletionStatus.student_id",
    )
    locks: Mapped[list["StudentLock"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
        foreign_keys="StudentLock.student_id",
    )

    # For teachers (owner of class)
    homeroom_students: Mapped[list["TeacherClassMembership"]] = relationship(
        back_populates="teacher",
        cascade="all, delete-orphan",
        foreign_keys="TeacherClassMembership.teacher_id",
    )


class TeacherClassMembership(Base):
    __tablename__ = "teacher_class_memberships"
    __table_args__ = (
        UniqueConstraint(
            "teacher_id", "student_id", name="uq_teacher_student_membership"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    teacher: Mapped["User"] = relationship(
        back_populates="homeroom_students",
        foreign_keys=[teacher_id],
    )
    student: Mapped["User"] = relationship(
        foreign_keys=[student_id],
    )
