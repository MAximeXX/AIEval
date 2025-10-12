# -*- coding: utf-8 -*-
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.user import User
from app.services.analytics import compute_charts, compute_progress

router = APIRouter(prefix="/admin", tags=["管理员"])


@router.get("/progress", summary="收集进度面板")
async def get_progress(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    progress = await compute_progress(db)
    return {"progress": progress}


@router.get("/charts", summary="管理员图表数据")
async def get_charts(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    charts = await compute_charts(db)
    return charts
