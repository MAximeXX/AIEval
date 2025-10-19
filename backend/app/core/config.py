# -*- coding: utf-8 -*-
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用运行参数配置，支持通过环境变量覆盖。"""

    app_name: str = "小彩蝶劳动益美行评测"
    api_prefix: str = "/api"
    backend_cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
        ]
    )

    database_url: str = Field(
        default="postgresql+asyncpg://butterfly:butterfly@localhost:5432/butterfly"
    )
    redis_url: str = Field(default="redis://localhost:6379/0")
    access_token_expire_minutes: int = 120
    jwt_secret_key: str = Field(default="change-me-to-a-long-secret")
    jwt_algorithm: Literal["HS256"] = "HS256"

    question_bank_path: Path = Field(
        default=Path(__file__).resolve().parents[1] / "data" / "questionnaire.json"
    )
    qwen_api_base: str | None = Field(default=None)
    qwen_api_key: str | None = Field(default=None)
    qwen_model: str = Field(default="qwen-max")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
