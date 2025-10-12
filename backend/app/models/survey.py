# -*- coding: utf-8 -*-
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.user import GradeBand, User


class ResponderType(str, Enum):
    STUDENT = "student"
    PARENT = "parent"
    TEACHER_OVERRIDE = "teacher_override"


class SurveyItem(Base):
    __tablename__ = "survey_items"
    __table_args__ = (
        UniqueConstraint(
            "grade_band",
            "major_category",
            "minor_category",
            "prompt",
            name="uq_survey_item_prompt",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    grade_band: Mapped[GradeBand] = mapped_column(SAEnum(GradeBand), nullable=False)
    major_category: Mapped[str] = mapped_column(String(128), nullable=False)
    minor_category: Mapped[str] = mapped_column(String(128), nullable=False)
    prompt: Mapped[str] = mapped_column(String(512), nullable=False)
    sort_key: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    response_items: Mapped[list["SurveyResponseItem"]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
    )


class SurveyResponse(Base):
    __tablename__ = "survey_responses"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "responder_type",
            name="uq_survey_response_latest",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    responder_type: Mapped[ResponderType] = mapped_column(
        SAEnum(ResponderType), nullable=False
    )
    grade_band: Mapped[GradeBand] = mapped_column(SAEnum(GradeBand), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    student: Mapped[User] = relationship(
        back_populates="survey_responses",
        foreign_keys=[student_id],
    )
    items: Mapped[list["SurveyResponseItem"]] = relationship(
        back_populates="response",
        cascade="all, delete-orphan",
    )


class SurveyResponseItem(Base):
    __tablename__ = "survey_response_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    response_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("survey_responses.id", ondelete="CASCADE"),
        nullable=False,
    )
    survey_item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("survey_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    frequency: Mapped[str] = mapped_column(String(32), nullable=False)
    skill: Mapped[str] = mapped_column(String(32), nullable=False)
    traits: Mapped[list[str]] = mapped_column(ARRAY(String()), default=list)

    response: Mapped[SurveyResponse] = relationship(back_populates="items")
    item: Mapped[SurveyItem] = relationship(back_populates="response_items")


class CompositeResponse(Base):
    __tablename__ = "composite_responses"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "responder_type",
            name="uq_composite_response_unique",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    responder_type: Mapped[ResponderType] = mapped_column(
        SAEnum(ResponderType), nullable=False
    )
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    student: Mapped[User] = relationship(foreign_keys=[student_id])


class ParentNote(Base):
    __tablename__ = "parent_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    content: Mapped[str] = mapped_column(String(600), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    student: Mapped[User] = relationship(
        back_populates="parent_note", foreign_keys=[student_id]
    )


class TeacherReview(Base):
    __tablename__ = "teacher_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    grade_band: Mapped[GradeBand] = mapped_column(SAEnum(GradeBand), nullable=False)
    selected_traits: Mapped[list[str]] = mapped_column(ARRAY(String()), default=list)
    rendered_text: Mapped[str] = mapped_column(String(1024), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    student: Mapped[User] = relationship(
        back_populates="teacher_review", foreign_keys=[student_id]
    )
    teacher: Mapped[User | None] = relationship(foreign_keys=[teacher_id])


class StudentLock(Base):
    __tablename__ = "student_locks"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            name="uq_student_lock_student",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    student: Mapped[User] = relationship(
        back_populates="locks", foreign_keys=[student_id]
    )
    teacher: Mapped[User | None] = relationship(foreign_keys=[teacher_id])


class CompletionStatus(Base):
    __tablename__ = "completion_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    student_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    teacher_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    llm_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    student: Mapped[User] = relationship(
        back_populates="completion_status", foreign_keys=[student_id]
    )


class LlmEval(Base):
    __tablename__ = "llm_evals"
    __table_args__ = (
        UniqueConstraint("student_id", name="uq_llm_eval_student"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(String(1024), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    student: Mapped[User] = relationship()
