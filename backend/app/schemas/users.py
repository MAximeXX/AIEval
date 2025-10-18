# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class UserSummary(BaseModel):
    id: UUID
    username: str
    role: str
    school_name: Optional[str] = None
    student_name: Optional[str] = None
    teacher_name: Optional[str] = None
    class_no: Optional[str] = None
    grade: Optional[int] = None
    grade_band: Optional[str] = None


class StudentDashboardItem(BaseModel):
    student_id: UUID
    student_no: Optional[str] = None
    student_name: str
    class_no: str
    grade: int
    grade_band: str
    survey_completed: bool
    parent_submitted: bool
    teacher_submitted: bool
    info_completed: bool
    selected_traits: list[str]
