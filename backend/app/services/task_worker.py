# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.models.user import User
from app.schemas.survey import (
    CompositeResponseIn,
    SurveyResponseIn,
    SurveyResponseItemIn,
)
from app.services.task_queue import (
    QueueTask,
    TaskQueueStatus,
    close_redis_client,
    pop_task,
    update_task_status,
)

logger = logging.getLogger(__name__)

_worker_task: asyncio.Task | None = None


async def _load_student(session: AsyncSession, student_id: UUID) -> User | None:
    return await session.get(User, student_id)


async def _handle_student_survey(task: QueueTask) -> None:
    async with async_session_maker() as session:
        student = await _load_student(session, UUID(task.student_id))
        if not student:
            await update_task_status(
                task.id, TaskQueueStatus.FAILED, message="用户不存在"
            )
            return
        try:
            from app.api.routes import students as student_routes

            survey_payload = SurveyResponseIn(
                items=[
                    SurveyResponseItemIn(**item)
                    for item in task.payload.get("items", [])
                ]
            )
            composite_raw = task.payload.get("composite") or {}
            composite_payload = CompositeResponseIn(
                q1=composite_raw.get("q1") or {"原来": "", "现在": ""},
                q2=composite_raw.get("q2") or {"原来": "", "现在": ""},
                q3=composite_raw.get("q3") or {},
            )
            await student_routes.put_my_survey(
                payload=survey_payload,
                current_user=student,
                db=session,
            )
            await student_routes.put_composite(
                payload=composite_payload,
                current_user=student,
                db=session,
            )
            await update_task_status(task.id, TaskQueueStatus.COMPLETED)
        except HTTPException as exc:
            await update_task_status(task.id, TaskQueueStatus.FAILED, message=exc.detail)
        except Exception as exc:  # pragma: no cover
            logger.exception("处理问卷队列任务失败: %s", exc)
            await update_task_status(
                task.id,
                TaskQueueStatus.FAILED,
                message="保存失败，请稍后重试",
            )


async def _worker_loop() -> None:
    logger.info("启动学生问卷队列处理任务")
    while True:
        try:
            task = await pop_task(timeout=5)
            if task is None:
                await asyncio.sleep(0.1)
                continue
            if task.type == "student_survey_save":
                await _handle_student_survey(task)
            else:
                logger.warning("未知的任务类型: %s", task.type)
                await update_task_status(
                    task.id,
                    TaskQueueStatus.FAILED,
                    message="未知的任务类型",
                )
        except asyncio.CancelledError:
            logger.info("问卷队列处理任务已停止")
            break
        except Exception as exc:  # pragma: no cover
            logger.exception("问卷队列处理异常: %s", exc)
            await asyncio.sleep(1)


async def start_queue_worker() -> None:
    global _worker_task
    if _worker_task is not None:
        return
    _worker_task = asyncio.create_task(_worker_loop())


async def stop_queue_worker() -> None:
    global _worker_task
    if _worker_task is None:
        await close_redis_client()
        return
    _worker_task.cancel()
    with suppress(asyncio.CancelledError):
        await _worker_task
    _worker_task = None
    await close_redis_client()
