from __future__ import annotations

import asyncio
from typing import Any

import httpx

from app.core.config import settings
from app.services.llm import LlmConfig


async def ping_remote(cfg: LlmConfig) -> bool:
    base_url = cfg.normalized_base_url()
    if not base_url or not cfg.api_key:
        return False
    url = f"{base_url.rstrip('/')}/models"
    headers = {"Authorization": f"Bearer {cfg.api_key}"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=headers)
        return resp.status_code < 500
    except Exception:
        return False


async def run() -> dict[str, Any]:
    cfg = LlmConfig(
        api_base=settings.qwen_api_base,
        api_key=settings.qwen_api_key,
        model=settings.qwen_model,
    )
    reachable = await ping_remote(cfg)
    return {
        "api_base": cfg.api_base or "",
        "api_key_present": bool(cfg.api_key),
        "model": cfg.model,
        "remote_reachable": reachable,
    }


def main() -> None:
    result = asyncio.run(run())
    print("LLM configuration status:")
    for key, value in result.items():
        print(f"- {key}: {value}")


if __name__ == "__main__":
    main()
