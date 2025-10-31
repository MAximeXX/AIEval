# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)


class TaskQueueStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


TASK_QUEUE_KEY = "butterfly:queue:student-survey"
STATUS_KEY_PREFIX = "butterfly:task-status:"
STATUS_TTL_SECONDS = 3600

_redis_lock = asyncio.Lock()
_redis_client: Redis | None = None


def _status_key(task_id: str) -> str:
    return f"{STATUS_KEY_PREFIX}{task_id}"


async def get_redis_client() -> Redis:
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    async with _redis_lock:
        if _redis_client is None:
            _redis_client = Redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
    return _redis_client


async def enqueue_student_survey_task(
    student_id: UUID,
    payload: dict[str, Any],
) -> str:
    task_id = str(uuid4())
    client = await get_redis_client()
    status_key = _status_key(task_id)
    task_payload = {
        "id": task_id,
        "type": "student_survey_save",
        "student_id": str(student_id),
        "payload": payload,
    }
    await client.hset(
        status_key,
        mapping={
            "status": TaskQueueStatus.PENDING.value,
            "student_id": str(student_id),
        },
    )
    await client.expire(status_key, STATUS_TTL_SECONDS)
    await client.lpush(TASK_QUEUE_KEY, json.dumps(task_payload, ensure_ascii=False))
    return task_id


async def get_task_status(task_id: str) -> dict[str, Any] | None:
    client = await get_redis_client()
    status_key = _status_key(task_id)
    data = await client.hgetall(status_key)
    if not data:
        return None
    return data


async def update_task_status(
    task_id: str,
    status: TaskQueueStatus,
    *,
    message: str | None = None,
) -> None:
    client = await get_redis_client()
    status_key = _status_key(task_id)
    mapping: dict[str, str] = {"status": status.value}
    if message is not None:
        mapping["message"] = message
    await client.hset(status_key, mapping=mapping)
    await client.expire(status_key, STATUS_TTL_SECONDS)


@dataclass
class QueueTask:
    id: str
    type: str
    student_id: str
    payload: dict[str, Any]


async def pop_task(timeout: int = 5) -> QueueTask | None:
    client = await get_redis_client()
    result = await client.brpop(TASK_QUEUE_KEY, timeout=timeout)
    if not result:
        return None
    _, raw_payload = result
    data = json.loads(raw_payload)
    return QueueTask(
        id=data["id"],
        type=data["type"],
        student_id=data["student_id"],
        payload=data.get("payload") or {},
    )


async def close_redis_client() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None

