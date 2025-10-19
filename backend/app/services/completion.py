# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.survey import (
    CompletionStatus,
    CompositeResponse,
    ResponderType,
    SurveyItem,
    SurveyResponse,
)
from app.models.user import GradeBand, User
from app.services.questionnaire import load_questionnaire


async def get_or_create_completion(
    db: AsyncSession,
    student_id: UUID,
) -> CompletionStatus:
    stmt = select(CompletionStatus).where(CompletionStatus.student_id == student_id)
    result = await db.execute(stmt)
    status = result.scalar_one_or_none()
    if status:
        return status
    status = CompletionStatus(student_id=student_id)
    db.add(status)
    await db.flush()
    return status


async def touch_completion(
    db: AsyncSession,
    student_id: UUID,
    *,
    student_submitted: bool | None = None,
    parent_submitted: bool | None = None,
    teacher_submitted: bool | None = None,
    llm_generated: bool | None = None,
) -> CompletionStatus:
    status = await get_or_create_completion(db, student_id)
    if student_submitted is not None:
        status.student_submitted = student_submitted
    if parent_submitted is not None:
        status.parent_submitted = parent_submitted
    if teacher_submitted is not None:
        status.teacher_submitted = teacher_submitted
    if llm_generated is not None:
        status.llm_generated = llm_generated
    status.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return status


async def is_student_submission_complete(
    db: AsyncSession,
    student: User,
) -> bool:
    """判断学生自评和综合题是否全部完成。"""
    grade_band = student.grade_band
    if grade_band is None:
        return False

    survey_stmt = (
        select(SurveyResponse)
        .where(
            SurveyResponse.student_id == student.id,
            SurveyResponse.responder_type == ResponderType.STUDENT,
        )
        .options(selectinload(SurveyResponse.items))
    )
    survey_result = await db.execute(survey_stmt)
    survey: SurveyResponse | None = survey_result.scalar_one_or_none()
    if not survey:
        return False

    target_band = survey.grade_band or grade_band
    expected_count_stmt = await db.execute(
        select(func.count(SurveyItem.id)).where(SurveyItem.grade_band == target_band)
    )
    expected_total = expected_count_stmt.scalar_one() or 0
    items = list(survey.items or [])
    if expected_total == 0 or len(items) != expected_total:
        return False

    if any(
        not (item.frequency or "").strip() or not (item.skill or "").strip()
        for item in items
    ):
        return False

    composite_stmt = await db.execute(
        select(CompositeResponse).where(
            CompositeResponse.student_id == student.id,
            CompositeResponse.responder_type == ResponderType.STUDENT,
        )
    )
    composite = composite_stmt.scalar_one_or_none()
    if not composite:
        return False

    payload = composite.payload or {}
    q1 = payload.get("q1") or {}
    q2 = payload.get("q2") or {}
    if not (q1.get("原来") and q1.get("现在")):
        return False
    if not (q2.get("原来") and q2.get("现在")):
        return False

    questionnaire = load_questionnaire()
    q3_config = next(
        (item for item in questionnaire.get("composite_questions", []) if item.get("key") == "q3"),
        None,
    )
    grade_key = str(student.grade) if student.grade is not None else ""
    stages: list[str] = []
    if q3_config:
        rows_by_grade = q3_config.get("rows_by_grade", {})
        stages = rows_by_grade.get(grade_key, [])
        if not stages and grade_band in (GradeBand.MID, GradeBand.HIGH):
            # 若缺少具体年级映射，则按学段要求阶段
            fallback = {
                GradeBand.LOW: [],
                GradeBand.MID: rows_by_grade.get("3", []),
                GradeBand.HIGH: rows_by_grade.get("5", []),
            }
            stages = fallback.get(grade_band, [])

    if stages:
        q3_payload = payload.get("q3")
        if not isinstance(q3_payload, dict):
            return False
        metrics = q3_config.get("columns", []) if q3_config else []
        for stage in stages:
            metric_values = q3_payload.get(stage)
            if not isinstance(metric_values, dict):
                return False
            for metric in metrics:
                value = metric_values.get(metric)
                if value is None or not isinstance(value, (int, float)):
                    return False
    return True
