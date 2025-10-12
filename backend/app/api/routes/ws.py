# -*- coding: utf-8 -*-
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.realtime import manager

router = APIRouter()


@router.websocket("/ws/teacher/{class_key}")
async def teacher_ws(websocket: WebSocket, class_key: str) -> None:
    await manager.connect_teacher(class_key, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)


@router.websocket("/ws/student/{student_id}")
async def student_ws(websocket: WebSocket, student_id: UUID) -> None:
    await manager.connect_student(student_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
