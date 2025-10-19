# -*- coding: utf-8 -*-
from __future__ import annotations

from collections import defaultdict
from typing import Dict
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.survey import CompositeResponse, CompletionStatus, ResponderType
from app.models.user import GradeBand, User, UserRole


async def compute_progress(db: AsyncSession) -> list[dict]:
    stmt = (
        select(
            User.school_name,
            User.grade,
            User.class_no,
            func.count(User.id).label("total"),
            func.sum(
                case(
                    (
                        CompletionStatus.student_submitted
                        & CompletionStatus.parent_submitted
                        & CompletionStatus.teacher_submitted,
                        1,
                    ),
                    else_=0,
                )
            ).label("completed"),
        )
        .outerjoin(
            CompletionStatus,
            CompletionStatus.student_id == User.id,
        )
        .where(User.role == UserRole.STUDENT)
        .group_by(User.school_name, User.grade, User.class_no)
        .order_by(User.grade, User.class_no)
    )
    result = await db.execute(stmt)
    items: list[dict] = []
    for row in result:
        items.append(
            {
                "school_name": row.school_name,
                "grade": row.grade,
                "class_no": row.class_no,
                "total": row.total,
                "completed": int(row.completed or 0),
            }
        )
    return items


SCORE_MAPPING = {
    "每天": 100,
    "经常": 66,
    "偶尔": 33,
    "从不": 0,
    "完全同意": 100,
    "比较同意": 66,
    "部分同意": 33,
    "不同意": 0,
}


async def compute_charts(db: AsyncSession) -> dict:
    stmt = (
        select(CompositeResponse, User.grade, User.grade_band)
        .join(User, User.id == CompositeResponse.student_id)
        .where(CompositeResponse.responder_type == ResponderType.STUDENT)
    )
    result = await db.execute(stmt)
    records = result.all()

    chart_a: Dict[str, Dict[str, list[float]]] = {
        "坚毅担责": defaultdict(list),
        "勤劳诚实": defaultdict(list),
        "合作智慧": defaultdict(list),
    }
    chart_b: Dict[str, Dict[str, float]] = defaultdict(dict)
    chart_c: Dict[str, Dict[str, float]] = defaultdict(dict)

    counters_b: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    counters_c: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    total_b: Dict[str, float] = defaultdict(float)
    total_c: Dict[str, float] = defaultdict(float)
    total_counters_b: Dict[str, int] = defaultdict(int)
    total_counters_c: Dict[str, int] = defaultdict(int)
    for composite, grade, grade_band in records:
        payload = composite.payload or {}
        band_key = (grade_band.value if grade_band else "low")
        q1 = payload.get("q1", {})
        q2 = payload.get("q2", {})
        q3 = payload.get("q3", {})

        for phase in ("原来", "现在"):
            label = q1.get(phase)
            if label in SCORE_MAPPING:
                counters_b[band_key][phase] += 1
                chart_b.setdefault(band_key, {})
                chart_b[band_key][phase] = chart_b[band_key].get(phase, 0.0) + SCORE_MAPPING[label]
                total_b[phase] += SCORE_MAPPING[label]
                total_counters_b[phase] += 1

        for phase in ("原来", "现在"):
            label = q2.get(phase)
            if label in SCORE_MAPPING:
                counters_c[band_key][phase] += 1
                chart_c.setdefault(band_key, {})
                chart_c[band_key][phase] = chart_c[band_key].get(phase, 0.0) + SCORE_MAPPING[label]
                total_c[phase] += SCORE_MAPPING[label]
                total_counters_c[phase] += 1

        for stage, metrics in q3.items():
            for metric_name in ("坚毅担责", "勤劳诚实", "合作智慧"):
                score = metrics.get(metric_name)
                if score is None:
                    continue
                chart_a.setdefault(metric_name, {})
                chart_a[metric_name].setdefault(band_key, [])
                chart_a[metric_name].setdefault(stage, {})
                chart_a[metric_name][band_key].append((stage, score))

    formatted_a: Dict[str, dict] = {}
    for metric, band_data in chart_a.items():
        stage_scores: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
        stage_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for band_key in ("low", "mid", "high"):
            for stage, score in [
                item for item in band_data.get(band_key, []) if isinstance(item, tuple)
            ]:
                stage_scores[band_key][stage] += score
                stage_counts[band_key][stage] += 1
        stages = sorted(
            {
                stage
                for band in stage_scores.values()
                for stage in band.keys()
            }
        )
        formatted_a[metric] = {
            "stages": stages,
            "series": {
                band: [
                    round(
                        stage_scores[band].get(stage, 0)
                        / stage_counts[band].get(stage, 1),
                        2,
                    )
                    for stage in stages
                ]
                for band in ("low", "mid", "high")
            },
        }

    def finalize_line(data: Dict[str, Dict[str, float]], counter_dict):
        formatted = {}
        for band_key in ("low", "mid", "high"):
            phase_scores = data.get(band_key, {})
            formatted[band_key] = {
                phase: round(
                    score / max(counter_dict[band_key][phase], 1), 2
                )
                for phase, score in phase_scores.items()
            }
        return formatted

    chart_b_final = finalize_line(chart_b, counters_b)
    chart_c_final = finalize_line(chart_c, counters_c)

    overall_b = {
        phase: round(total_b[phase] / max(total_counters_b[phase], 1), 2)
        for phase in ("原来", "现在")
    }
    overall_c = {
        phase: round(total_c[phase] / max(total_counters_c[phase], 1), 2)
        for phase in ("原来", "现在")
    }

    return {
        "chart_a": formatted_a,
        "chart_b": chart_b_final,
        "chart_c": chart_c_final,
        "overall_b": overall_b,
        "overall_c": overall_c,
    }
