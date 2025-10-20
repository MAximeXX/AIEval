from __future__ import annotations

import asyncio
from typing import Any

from app.core.config import settings
from app.services.llm import LlmConfig, LlmService
import traceback

def build_sample_payload() -> dict[str, Any]:
    """构造一份简易示例数据，模拟真实问卷提交后的结构。"""
    return {
        "selected_categories": ["整理与收纳", "电器使用与维护", "校园卫生"],
        "category_details": [
            {"name": "整理与收纳", "score": 2.8},
            {"name": "电器使用与维护", "score": 2.5},
            {"name": "校园卫生", "score": 2.3},
            {"name": "社会实践", "score": 2.0},
        ],
        "selected_traits": ["勤快", "负责", "合作"],
        "trait_details": [
            {"name": "勤快", "count": 3},
            {"name": "负责", "count": 2},
            {"name": "合作", "count": 2},
            {"name": "主动", "count": 1},
        ],
        "composite_scores": {
            "stage": "阶段3",
            "scores": {
                "坚毅担责": 86,
                "勤劳诚实": 88,
                "合作智慧": 90,
            },
        },
        "parent_note": "孩子在家里很主动，能够自觉完成分配的任务，也愿意帮助同学。",
        "teacher_traits": ["勤快", "负责", "合作"],
        # 教师端仅勾选品格评价时，review text 可能为空
        "teacher_review_text": "",
        "grade_band": "mid",
    }


async def main() -> None:
    cfg = LlmConfig(
        api_base=settings.qwen_api_base,
        api_key=settings.qwen_api_key,
        model=settings.qwen_model,
    )
    service = LlmService(config=cfg)

    payload = build_sample_payload()
    try:
        raw = await service._invoke(payload)
        message, careers = service._build_output_message(payload, raw)
        print("LLM 原始响应：")
        print(raw)
        print("职业推荐：", careers)
        print("\n最终评语：")
        print(message)
    except Exception as exc:
        print("LLM 调用失败：", exc)
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())

