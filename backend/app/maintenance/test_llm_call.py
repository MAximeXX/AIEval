from __future__ import annotations

import asyncio
from typing import Any

from app.core.config import settings
from app.services.llm import LlmConfig, LlmService
import traceback

def build_sample_payload() -> dict[str, Any]:
    """构造一份简易示例数据，模拟真实问卷提交后的结构。"""
    return {
        "survey": [
            {
                "category": "家庭劳动",
                "subcategory": "整理与收纳",
                "prompt": "整理自己的学习用品",
                "frequency": "每天",
                "skill": "熟练",
                "traits": ["勤快", "主动"],
            },
            {
                "category": "学校劳动",
                "subcategory": "校园卫生",
                "prompt": "参与教室值日打扫",
                "frequency": "经常",
                "skill": "一般",
                "traits": ["负责", "合作"],
            },
        ],
        "parent_note": "孩子在家里很主动，能够自觉完成分配的任务，也愿意帮助同学。",
        "teacher_review": "该生劳动态度认真，能带动同伴，具有较强的组织协调能力。",
        "highlights": ["家庭劳动", "学校劳动"],
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
        result = await service._invoke(payload)
        print("LLM 调用成功，示例输出：")
        print(result)
    except Exception as exc:
        print("LLM 调用失败：", exc)
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())

