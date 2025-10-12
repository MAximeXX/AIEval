# -*- coding: utf-8 -*-
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, auth, config, students, teachers, ws
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    openapi_url=f"{settings.api_prefix}/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(config.router, prefix=settings.api_prefix)
app.include_router(students.router, prefix=settings.api_prefix)
app.include_router(teachers.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)
app.include_router(ws.router)


@app.get("/health", tags=["健康检查"])
async def health_check() -> dict:
    return {"status": "ok"}
