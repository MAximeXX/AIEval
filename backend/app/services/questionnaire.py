# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from functools import lru_cache

from app.core.config import settings


@lru_cache
def load_questionnaire() -> dict:
    with settings.question_bank_path.open("r", encoding="utf-8") as fp:
        return json.load(fp)
