# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Dict, List

from app.models.user import GradeBand

GRADE_TRAITS: Dict[GradeBand, List[str]] = {
    GradeBand.LOW: ["坚持", "主动", "勤快", "真诚", "互助", "乐学"],
    GradeBand.MID: ["坚强", "负责", "勤俭", "诚恳", "协作", "探究"],
    GradeBand.HIGH: ["坚韧", "担当", "勤奋", "诚信", "团结", "创新"],
}

REVIEW_TEMPLATE = (
    "☺️亲爱的蝶宝：\n"
    "    在劳动中，老师看到了你的{traits}👍，希望你再接再厉✊，成长为坚毅担责、勤劳诚实、合作智慧的“小彩蝶”🤗！"
)


def render_review_text(grade_band: GradeBand, traits: List[str]) -> str:
    available = set(GRADE_TRAITS.get(grade_band, []))
    chosen = [trait for trait in traits if trait in available]
    if not chosen:
        raise ValueError("至少选择一个与年级对应的品质")
    return REVIEW_TEMPLATE.format(traits="、".join(chosen))


def get_grade_traits(grade_band: GradeBand) -> List[str]:
    return GRADE_TRAITS.get(grade_band, [])
