# -*- coding: utf-8 -*-
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.survey import SurveyItem
from app.models.user import GradeBand
from app.services.questionnaire import load_questionnaire

router = APIRouter(prefix="/config", tags=["配置"])


@router.get("/survey", summary="获取问卷题库配置")
async def get_survey_config(
    grade_band: str = Query(..., pattern="^(low|mid|high)$"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    data = load_questionnaire()
    grade_data = data["grade_bands"].get(grade_band)
    if not grade_data:
        raise HTTPException(status_code=404, detail="问卷配置不存在")
    band_enum = GradeBand(grade_band)
    stmt = select(SurveyItem).where(SurveyItem.grade_band == band_enum).order_by(
        SurveyItem.sort_key
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    index_map = {
        (item.major_category, item.minor_category, item.prompt): item for item in items
    }
    sections = []
    for section in grade_data["sections"]:
        rendered_items = []
        for prompt in section["items"]:
            db_item = index_map.get(
                (section["major_category"], section["minor_category"], prompt)
            )
            if not db_item:
                continue
            rendered_items.append(
                {
                    "id": db_item.id,
                    "prompt": db_item.prompt,
                }
            )
        sections.append(
            {
                "major_category": section["major_category"],
                "minor_category": section["minor_category"],
                "items": rendered_items,
            }
        )
    return {
        "description": data["description"],
        "grade_band": grade_band,
        "traits": grade_data["traits"],
        "sections": sections,
        "composite_questions": data["composite_questions"],
    }
