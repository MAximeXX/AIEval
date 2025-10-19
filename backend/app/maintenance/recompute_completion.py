from __future__ import annotations

import asyncio
from typing import Sequence

from sqlalchemy import select

from app.db.session import async_session_maker
from app.models.user import User, UserRole
from app.services.completion import (
    is_student_submission_complete,
    touch_completion,
)


async def _recompute() -> None:
    async with async_session_maker() as session:
        result = await session.execute(
            select(User).where(User.role == UserRole.STUDENT)
        )
        students: Sequence[User] = result.scalars().all()
        for student in students:
            completed = await is_student_submission_complete(session, student)
            await touch_completion(session, student.id, student_submitted=completed)
        await session.commit()


def run() -> None:
    asyncio.run(_recompute())


if __name__ == "__main__":
    run()
