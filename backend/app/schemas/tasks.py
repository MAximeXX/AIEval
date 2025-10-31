# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class TaskSubmissionOut(BaseModel):
    task_id: UUID
    status: Literal["pending"]


class TaskStatusOut(BaseModel):
    task_id: UUID
    status: Literal["pending", "completed", "failed"]
    message: str | None = None

