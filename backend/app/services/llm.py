# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
import json
import os
import random
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.survey import (
    LlmEval,
    ParentNote,
    SurveyResponse,
    TeacherReview,
    CompositeResponse,
)
from app.models.user import GradeBand, User


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


FREQUENCY_SCORES = {"每天": 3, "经常": 2, "偶尔": 1}
SKILL_SCORES = {"熟练": 3, "一般": 2, "不会": 1}


def _normalize_minor_category(
    major: str | None,
    minor: str | None,
    grade_band: GradeBand | None,
) -> str:
    major = (major or "").strip()
    minor = (minor or "").strip()
    if not minor:
        return major or "综合劳动"
    if grade_band in (GradeBand.MID, GradeBand.HIGH):
        if minor in {"家用器具使用与维护", "电器使用与维护"}:
            return "电器使用与维护"
        if minor in {"农业生产劳动", "种植劳动"}:
            return "农业劳动"
    return minor


def _compute_category_statistics(
    survey: SurveyResponse,
) -> tuple[dict[str, float], dict[str, list[str]]]:
    grade_band = survey.grade_band
    scores_by_category: dict[str, list[float]] = defaultdict(list)
    traits_by_category: dict[str, list[str]] = defaultdict(list)
    for response_item in survey.items:
        survey_item = response_item.item
        if not survey_item:
            continue
        category = _normalize_minor_category(
            survey_item.major_category, survey_item.minor_category, grade_band
        )
        freq_score = FREQUENCY_SCORES.get((response_item.frequency or "").strip(), 0)
        skill_score = SKILL_SCORES.get((response_item.skill or "").strip(), 0)
        score = (freq_score * 0.5) + (skill_score * 0.5)
        scores_by_category[category].append(score)
        if response_item.traits:
            traits_by_category[category].extend(
                [trait.strip() for trait in response_item.traits if trait.strip()]
            )
    averages = {
        category: round(sum(scores) / len(scores), 2) if scores else 0.0
        for category, scores in scores_by_category.items()
    }
    return averages, traits_by_category


def _select_top_labels(
    score_map: dict[str, float], top_n: int, rng: random.Random
) -> list[str]:
    if not score_map:
        return []
    grouped: dict[float, list[str]] = defaultdict(list)
    for label, score in score_map.items():
        grouped[score].append(label)
    selected: list[str] = []
    for score in sorted(grouped.keys(), reverse=True):
        candidates = sorted(set(grouped[score]))
        need = top_n - len(selected)
        if need <= 0:
            break
        if len(candidates) <= need:
            selected.extend(candidates)
        else:
            selected.extend(rng.sample(candidates, need))
    return selected[:top_n]


def _extract_stage_order(label: str) -> int:
    digits = "".join(ch for ch in str(label) if ch.isdigit())
    return int(digits) if digits else 0


def _extract_composite_summary(composite: Optional[CompositeResponse]) -> dict[str, Any]:
    if not composite or not isinstance(composite.payload, dict):
        return {"stage": None, "scores": {}}
    q3 = composite.payload.get("q3")
    if not isinstance(q3, dict) or not q3:
        return {"stage": None, "scores": {}}
    stage = max(q3.keys(), key=_extract_stage_order)
    stage_scores = q3.get(stage) or {}
    cleaned = {
        key: value
        for key, value in stage_scores.items()
        if value is not None
    }
    return {"stage": stage, "scores": cleaned}


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

        raw_response = await self._invoke(payload)
        final_message, careers = self._build_output_message(payload, raw_response)
        stored_payload = dict(payload)
        stored_payload["recommended_careers"] = careers
        stored_payload["llm_raw_response"] = raw_response

        stmt = insert(LlmEval).values(
            student_id=student.id,
            content=final_message,
            payload=stored_payload,
            generated_at=datetime.now(timezone.utc),
        )
        await db.execute(
            stmt.on_conflict_do_update(
                index_elements=[LlmEval.student_id],
                set_={
                    "content": final_message,
                    "payload": stored_payload,
                    "generated_at": datetime.now(timezone.utc),
                },
            )
        )
        await db.flush()
        refreshed_result = await db.execute(
            select(LlmEval).where(LlmEval.student_id == student.id)
        )
        return refreshed_result.scalar_one()

    async def _invoke(self, payload: Dict[str, Any]) -> str:
        if not self._client:
            raise RuntimeError("LLM client 未配置，无法调用远程接口")
        return await self._call_remote(payload)

    async def _call_remote(self, payload: Dict[str, Any]) -> str:
        if not self._client:
            raise RuntimeError("LLM client 未配置，无法调用远程接口")
        prompt = self._build_prompt(payload)
        def _sync_call() -> str:
            stream = self._client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": "你是彩小蝶，你会根据提供的劳动表现信息，为学生推荐1-3个未来可以发展的职业。用中文回答。"},
                    {"role": "user", "content": prompt},
                ],
                stream=True,
            )
            chunks: list[str] = []
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = getattr(chunk.choices[0], "delta", None)
                content = getattr(delta, "content", None) if delta else None
                if content:
                    chunks.append(content)
            return "".join(chunks)

        return await asyncio.to_thread(_sync_call)

    def _parse_careers(self, raw_response: str) -> list[str]:
        try:
            data = json.loads(raw_response)
            if isinstance(data, dict) and isinstance(data.get("careers"), list):
                return [
                    str(item).strip()
                    for item in data["careers"]
                    if str(item).strip()
                ][:3]
            if isinstance(data, list):
                return [str(item).strip() for item in data if str(item).strip()][:3]
        except json.JSONDecodeError:
            pass
        tokens = [token.strip() for token in raw_response.replace("\n", "，").split("，")]
        return [token for token in tokens if token][:3]

    def _build_output_message(
        self,
        payload: Dict[str, Any],
        raw_response: str,
    ) -> tuple[str, list[str]]:
        categories = payload.get("selected_categories") or []
        category_text = "、".join(categories) if categories else "多种劳动实践"
        careers = self._parse_careers(raw_response)
        if not careers:
            careers = ["劳动教育推广者"]
        career_text = "、".join(careers)
        message = (
            "😊亲爱的蝶宝：\n"
            "      在家里你能主动分担家务劳动，在学校认真完成班级劳动、校园劳动，还积极参加社会实践😲👍，培养了坚毅担责、勤劳诚实、合作智慧的美好品格🤩；"
            f"你特别擅长{category_text}，希望你能继续发挥这一优势，未来也许能够成为一名优秀的{career_text}哦🥳！"
        )
        return message, careers

    def _build_prompt(self, payload: Dict[str, Any]) -> str:
        context = {
            "selected_categories": payload.get("selected_categories", []),
            "selected_traits": payload.get("selected_traits", []),
            "composite_scores": payload.get("composite_scores", {}),
            "parent_note": payload.get("parent_note", ""),
            "teacher_review_text": payload.get("teacher_review_text", ""),
            "grade_band": payload.get("grade_band"),
        }
        instruction = (
            "你会根据提供的劳动表现信息，为学生推荐1-3个未来可以发展的职业。\n"
            "请综合考虑学生擅长的劳动类别、品格提升、综合品质得分、家长寄语和教师评价，输出最契合的具体职业。\n"
            "输出必须是 JSON 对象，格式示例：{\"careers\": [\"职业1\", \"职业2\"]}，不要包含其他文字。"
        )
        return instruction + "\n【参考信息】\n" + json.dumps(context, ensure_ascii=False, indent=2)


def build_llm_payload(
    survey: SurveyResponse,
    parent_note: ParentNote | None,
    teacher_review: TeacherReview,
    composite: Optional[CompositeResponse],
) -> Dict[str, Any]:
    rng = random.Random(str(survey.student_id))
    category_scores, category_traits = _compute_category_statistics(survey)
    selected_categories = _select_top_labels(category_scores, 3, rng)

    trait_counter: Counter[str] = Counter()
    for category in selected_categories:
        trait_counter.update(category_traits.get(category, []))

    selected_traits = _select_top_labels(
        {name: float(count) for name, count in trait_counter.items()},
        3,
        rng,
    )

    composite_summary = _extract_composite_summary(composite)

    return {
        "selected_categories": selected_categories,
        "selected_traits": selected_traits,
        "composite_scores": composite_summary,
        "parent_note": parent_note.content if parent_note else "",
        "teacher_review_text": teacher_review.rendered_text,
        "grade_band": survey.grade_band.value if survey.grade_band else None,
    }
