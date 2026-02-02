from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import List


def _split_csv(value: str | None, *, fallback: List[str]) -> List[str]:
    if not value:
        return fallback
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str
    api_prefix: str
    cors_origins: List[str]


@lru_cache
def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "Starter API"),
        api_prefix=os.getenv("API_PREFIX", "/api"),
        cors_origins=_split_csv(
            os.getenv("CORS_ORIGINS"), fallback=["http://localhost:5173"]
        ),
    )
