# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.survey import CompletionStatus


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
