# -*- coding: utf-8 -*-
from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import DefaultDict
from uuid import UUID

from starlette.websockets import WebSocket


class ConnectionManager:
    """管理教师与学生端 WebSocket 连接，支持简单的广播与点对点通知。"""

    def __init__(self) -> None:
        self._teacher_rooms: DefaultDict[str, set[WebSocket]] = defaultdict(set)
        self._student_channels: DefaultDict[UUID, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect_teacher(self, class_key: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._teacher_rooms[class_key].add(websocket)

    async def connect_student(self, student_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._student_channels[student_id].add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            for room in self._teacher_rooms.values():
                room.discard(websocket)
            for channel in self._student_channels.values():
                channel.discard(websocket)

    async def broadcast_to_teacher(
        self,
        class_key: str,
        message: dict | str,
    ) -> None:
        async with self._lock:
            sockets = list(self._teacher_rooms.get(class_key, set()))
        await self._broadcast(sockets, message)

    async def notify_student(self, student_id: UUID, message: dict | str) -> None:
        async with self._lock:
            sockets = list(self._student_channels.get(student_id, set()))
        await self._broadcast(sockets, message)

    @staticmethod
    async def _broadcast(targets: list[WebSocket], message: dict | str) -> None:
        for ws in targets:
            try:
                if isinstance(message, str):
                    await ws.send_text(message)
                else:
                    await ws.send_json(message)
            except Exception:
                await ws.close()


manager = ConnectionManager()
