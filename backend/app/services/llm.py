# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.survey import LlmEval, ParentNote, SurveyResponse, SurveyResponseItem, TeacherReview
from app.models.user import User


@dataclass
class LlmConfig:
    api_base: Optional[str] = None
    api_key: Optional[str] = None
    model: str = "qwen-max"


class LlmService:
    """封装 LLM 评估逻辑，可对接外部 Qwen 服务；若未配置则使用本地启发式生成。"""

    def __init__(self, config: Optional[LlmConfig] = None) -> None:
        cfg = config or LlmConfig(
            api_base=os.getenv("QWEN_API_BASE"),
            api_key=os.getenv("QWEN_API_KEY"),
            model=os.getenv("QWEN_MODEL", "qwen-max"),
        )
        self.config = cfg

    async def generate_once(
        self,
        db: AsyncSession,
        student: User,
        survey: SurveyResponse,
        parent_note: ParentNote,
        teacher_review: TeacherReview,
        payload: Dict[str, Any],
        *,
        force_refresh: bool = False,
    ) -> LlmEval:
        from sqlalchemy import select, update

        result = await db.execute(
            select(LlmEval).where(LlmEval.student_id == student.id)
        )
        existing: LlmEval | None = result.scalar_one_or_none()
        if existing and not force_refresh:
            return existing

        content = await self._invoke(payload)

        if existing:
            await db.execute(
                update(LlmEval)
                .where(LlmEval.student_id == student.id)
                .values(
                    content=content,
                    payload=payload,
                    generated_at=datetime.now(timezone.utc),
                )
            )
        else:
            db.add(
                LlmEval(
                    student_id=student.id,
                    content=content,
                    payload=payload,
                )
            )
        await db.flush()
        refreshed_result = await db.execute(
            select(LlmEval).where(LlmEval.student_id == student.id)
        )
        return refreshed_result.scalar_one()

    async def _invoke(self, payload: Dict[str, Any]) -> str:
        if self.config.api_base and self.config.api_key:
            return await self._call_remote(payload)
        return self._heuristic_response(payload)

    async def _call_remote(self, payload: Dict[str, Any]) -> str:
        url = f"{self.config.api_base.rstrip('/')}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }
        prompt = self._build_prompt(payload)
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                url,
                headers=headers,
                json={
                    "model": self.config.model,
                    "messages": [
                        {"role": "system", "content": "你是彩小蝶，用中文回答。"},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    def _heuristic_response(self, payload: Dict[str, Any]) -> str:
        highlights = payload.get("highlights", [])
        careers = payload.get("careers", [])
        highlight_text = "、".join(highlights) if highlights else "多种劳动实践"
        career_text = "、".join(careers) if careers else "劳动教育推广者"
        return (
            "亲爱的小彩蝶：\n"
            "             在家里你能主动分担家务劳动，在学校认真完成班级劳动、校园劳动，还积极参加社会实践，"
            "培养了坚毅担责、勤劳诚实、合作智慧的美好品格。"
            f"你特别擅长{highlight_text}，希望你能继续发挥这一优势，未来朝着成为一名优秀的{career_text}而努力。"
        )

    def _build_prompt(self, payload: Dict[str, Any]) -> str:
        base_instruction = (
            "【角色】你是“彩小蝶”，用于评价学生经过彩蝶劳动计划的品质与成长。\n"
            "【任务】只补全{}中的内容：{1} 概括学生擅长的劳动“类别”（≤3）；"
            "{2} 推荐未来职业（≤3）。\n"
            "【输出模板】\n"
            "亲爱的小彩蝶：\n"
            "             在家里你能主动分担家务劳动，在学校认真完成班级劳动、校园劳动，还积极参加社会实践，"
            "培养了坚毅担责、勤劳诚实、合作智慧的美好品格。你特别擅长{1}，"
            "希望你能继续发挥这一优势，未来朝着成为一名优秀的{2}而努力。\n"
            "【参考信息】"
        )
        return base_instruction + json.dumps(payload, ensure_ascii=False)


def extract_highlights(
    survey_items: Iterable[SurveyResponseItem],
) -> List[str]:
    counter: Dict[str, int] = {}
    for item in survey_items:
        cat = item.item.major_category if item.item else "综合劳动"
        score = {"每天": 3, "经常": 2, "偶尔": 1}.get(item.frequency, 0)
        counter[cat] = counter.get(cat, 0) + score
    sorted_cats = sorted(counter.items(), key=lambda kv: kv[1], reverse=True)
    return [name for name, _ in sorted_cats[:3]]


def suggest_careers(highlights: List[str]) -> List[str]:
    mapping = {
        "家庭劳动": ["家政服务师", "生活规划师"],
        "家庭劳动（烹饪与营养）": ["厨师", "营养师"],
        "家庭劳动（整理与收纳）": ["空间整理师"],
        "家庭劳动（传统工艺制作）": ["手工艺设计师"],
        "学校劳动": ["校园管理者", "班级组织者"],
        "社会劳动": ["社区志愿者", "社会工作者"],
    }
    careers: List[str] = []
    for highlight in highlights:
        matched = False
        for key, values in mapping.items():
            if key in highlight:
                careers.extend(values[:2])
                matched = True
        if not matched and not careers:
            careers.extend(["社会实践者", "教育工作者"])
    return careers[:3]


def build_llm_payload(
    survey: SurveyResponse,
    parent_note: ParentNote,
    teacher_review: TeacherReview,
) -> Dict[str, Any]:
    survey_data = [
        {
            "item_id": item.survey_item_id,
            "category": item.item.major_category if item.item else "",
            "subcategory": item.item.minor_category if item.item else "",
            "prompt": item.item.prompt if item.item else "",
            "frequency": item.frequency,
            "skill": item.skill,
            "traits": item.traits,
        }
        for item in survey.items
    ]
    highlights = extract_highlights(survey.items)
    careers = suggest_careers(highlights)
    return {
        "survey": survey_data,
        "parent_note": parent_note.content,
        "teacher_review": teacher_review.rendered_text,
        "highlights": highlights,
        "careers": careers,
    }
