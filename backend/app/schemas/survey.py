# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


FrequencyLiteral = Literal["每天", "经常", "偶尔", "从不"]
SkillLiteral = Literal["熟练", "一般", "不会"]
HabitLiteral = Literal["完全同意", "比较同意", "部分同意", "不同意"]


class SurveyItemSchema(BaseModel):
    id: int
    grade_band: str
    major_category: str
    minor_category: str
    prompt: str
    sort_key: int


class SurveyResponseItemIn(BaseModel):
    survey_item_id: int
    frequency: FrequencyLiteral
    skill: SkillLiteral
    traits: list[str] = Field(default_factory=list, max_length=3)


class SurveyResponseIn(BaseModel):
    items: list[SurveyResponseItemIn]


class SurveyResponseItemOut(SurveyResponseItemIn):
    id: int


class SurveyResponseOut(BaseModel):
    id: UUID
    responder_type: str
    grade_band: str
    submitted_at: datetime
    updated_at: datetime
    items: list[SurveyResponseItemOut]


class CompositeScoreQuestion(BaseModel):
    question: str
    rows: list[str]
    columns: list[str]
    scale: list[int]
    rows_alias: list[str] | None = None


class CompositeResponseIn(BaseModel):
    q1: dict[str, str]
    q2: dict[str, str]
    q3: dict[str, dict[str, int | None]]


class CompositeResponseOut(CompositeResponseIn):
    submitted_at: datetime
    updated_at: datetime


class ParentNoteIn(BaseModel):
    content: str = Field(max_length=300, min_length=1)


class ParentNoteOut(ParentNoteIn):
    submitted_at: datetime
    updated_at: datetime


class TeacherReviewIn(BaseModel):
    selected_traits: list[str] = Field(default_factory=list, min_length=1, max_length=6)


class TeacherReviewOut(BaseModel):
    selected_traits: list[str]
    rendered_text: str
    submitted_at: datetime
    updated_at: datetime


class LockStatusIn(BaseModel):
    is_locked: bool


class LockStatusOut(BaseModel):
    is_locked: bool
    updated_at: datetime


class CompletionStatusOut(BaseModel):
    student_submitted: bool
    parent_submitted: bool
    teacher_submitted: bool
    llm_generated: bool
    updated_at: datetime


class LlmEvalOut(BaseModel):
    content: str
    generated_at: datetime
