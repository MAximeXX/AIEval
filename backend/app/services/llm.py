# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from openai import OpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.survey import (
    LlmEval,
    ParentNote,
    SurveyResponse,
    SurveyResponseItem,
    TeacherReview,
)
from app.models.user import User


@dataclass
class LlmConfig:
    api_base: Optional[str] = None
    api_key: Optional[str] = None
    model: str = "qwen-max"

    def normalized_base_url(self) -> Optional[str]:
        if not self.api_base:
            return None
        base = self.api_base.rstrip("/")
        if not base.endswith("/v1"):
            base = f"{base}/v1"
        return base


class LlmService:
    """封装 LLM 评估逻辑，可对接外部 Qwen 服务；若未配置则使用本地启发式生成。"""

    def __init__(self, config: Optional[LlmConfig] = None) -> None:
        cfg = config or LlmConfig(
            api_base=settings.qwen_api_base or os.getenv("QWEN_API_BASE"),
            api_key=settings.qwen_api_key or os.getenv("QWEN_API_KEY"),
            model=settings.qwen_model or os.getenv("QWEN_MODEL"),
        )
        self.config = cfg
        self._client: OpenAI | None = None
        if cfg.api_key:
            base_url = cfg.normalized_base_url()
            if base_url:
                self._client = OpenAI(base_url=base_url, api_key=cfg.api_key)
            else:
                self._client = OpenAI(api_key=cfg.api_key)

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
        if self._client:
            return await self._call_remote(payload)
        return self._heuristic_response(payload)

    async def _call_remote(self, payload: Dict[str, Any]) -> str:
        if not self._client:
            raise RuntimeError("LLM client 未配置，无法调用远程接口")
        prompt = self._build_prompt(payload)
        response = await asyncio.to_thread(
            self._client.chat.completions.create,
            model=self.config.model,
            messages=[
                {"role": "system", "content": "你是彩小蝶，用中文回答。"},
                {"role": "user", "content": prompt},
            ],
        )
        choice = response.choices[0]
        if hasattr(choice.message, "content"):
            return choice.message.content or ""
        if isinstance(choice.message, dict):
            return choice.message.get("content", "")
        return str(choice.message)

    def _heuristic_response(self, payload: Dict[str, Any]) -> str:
        highlights = payload.get("highlights", [])
        highlight_text = "、".join(highlights) if highlights else "多种劳动实践"
        return (
            "亲爱的小彩蝶：\n"
            "             在家里你能主动分担家务劳动，在学校认真完成班级劳动、校园劳动，还积极参加社会实践，"
            "培养了坚毅担责、勤劳诚实、合作智慧的美好品格。"
            f"你特别擅长{highlight_text}，希望你能保持这份热爱劳动的精神，继续探索自己真正向往的未来方向。"
        )

    def _build_prompt(self, payload: Dict[str, Any]) -> str:
        base_instruction = (
            "【角色】你是“彩小蝶”，请根据学生经过彩蝶劳动计划获得的成长和擅长的劳动项目做职业推荐。\n"
            "【任务】只补全{}中的内容：{1} 概括学生擅长的劳动“类别”（≤3）；"
            "{2} 推荐未来职业（≤3）。\n"
            "【输出模板】\n"
            "亲爱的小彩蝶：\n"
            "             在家里你能主动分担家务劳动，在学校认真完成班级劳动、校园劳动，还积极参加社会实践，培养了坚毅担责、勤劳诚实、合作智慧的美好品格。你特别擅长{1}，希望你能继续发挥这一优势，未来朝着成为一名优秀的{2}而努力。\n"
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
            "frequency": item.frequency or "",
            "skill": item.skill or "",
            "traits": item.traits,
        }
        for item in survey.items
    ]
    highlights = extract_highlights(survey.items)
    return {
        "survey": survey_data,
        "parent_note": parent_note.content,
        "teacher_review": teacher_review.rendered_text,
        "highlights": highlights,
    }
