# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_student
from app.db.session import get_db
from app.models.survey import (
    CompositeResponse,
    ParentNote,
    ResponderType,
    StudentLock,
    SurveyItem,
    SurveyResponse,
    SurveyResponseItem,
    TeacherReview,
)
from app.models.user import User
from app.schemas.survey import (
    CompositeResponseIn,
    CompositeResponseOut,
    LlmEvalOut,
    ParentNoteIn,
    ParentNoteOut,
    SurveyResponseIn,
    SurveyResponseOut,
)
from app.services.completion import is_student_submission_complete, touch_completion
from app.services.llm import LlmService, build_llm_payload
from app.services.realtime import manager

router = APIRouter(prefix="/students/me", tags=["学生端"])


def _class_key(user: User) -> str:
    grade_part = str(user.grade) if user.grade is not None else ""
    return f"{user.school_name or ''}-{grade_part}-{user.class_no or ''}"


def _serialize_response(
    response: SurveyResponse | None,
    user: User,
) -> dict:
    if not response:
        return {
            "id": None,
            "responder_type": ResponderType.STUDENT.value,
            "grade_band": user.grade_band.value if user.grade_band else None,
            "submitted_at": None,
            "updated_at": None,
            "items": [],
        }
    return {
        "id": response.id,
        "responder_type": response.responder_type.value,
        "grade_band": response.grade_band.value,
        "submitted_at": response.submitted_at,
        "updated_at": response.updated_at,
        "items": [
            {
                "id": item.id,
                "survey_item_id": item.survey_item_id,
                "frequency": item.frequency,
                "skill": item.skill,
                "traits": item.traits,
            }
            for item in response.items
        ],
    }


async def _ensure_unlocked(db: AsyncSession, student: User) -> None:
    stmt = select(StudentLock).where(StudentLock.student_id == student.id)
    result = await db.execute(stmt)
    lock = result.scalar_one_or_none()
    if lock and lock.is_locked:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="表格数据已被锁定，无法更改",
        )


@router.get("/survey", response_model=dict, summary="获取我的问卷")
async def get_my_survey(
    current_user: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> SurveyResponseOut | dict[str, list]:
    stmt = (
        select(SurveyResponse)
        .where(
            SurveyResponse.student_id == current_user.id,
            SurveyResponse.responder_type == ResponderType.STUDENT,
        )
        .options(
            selectinload(SurveyResponse.items).selectinload(SurveyResponseItem.item)
        )
    )
    result = await db.execute(stmt)
    response = result.scalar_one_or_none()
    data = _serialize_response(response, current_user)
    lock_result = await db.execute(
        select(StudentLock).where(StudentLock.student_id == current_user.id)
    )
    lock = lock_result.scalar_one_or_none()
    data["is_locked"] = bool(lock and lock.is_locked)
    return data


@router.put("/survey", response_model=SurveyResponseOut, summary="保存我的问卷")
async def put_my_survey(
    payload: SurveyResponseIn,
    current_user: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> SurveyResponseOut:
    await _ensure_unlocked(db, current_user)

    stmt = select(SurveyResponse).where(
        SurveyResponse.student_id == current_user.id,
        SurveyResponse.responder_type == ResponderType.STUDENT,
    ).options(selectinload(SurveyResponse.items))
    result = await db.execute(stmt)
    response = result.scalar_one_or_none()
    if not response:
        response = SurveyResponse(
            student_id=current_user.id,
            responder_type=ResponderType.STUDENT,
            grade_band=current_user.grade_band,
        )
        db.add(response)
        await db.flush()

    await db.execute(
        delete(SurveyResponseItem).where(
            SurveyResponseItem.response_id == response.id
        )
    )

    if payload.items:
        items_map = await _fetch_items_map(db, payload.items)
        new_items: list[SurveyResponseItem] = []
        for item_payload in payload.items:
            survey_item = items_map.get(item_payload.survey_item_id)
            if not survey_item:
                raise HTTPException(status_code=404, detail="题目不存在")
            new_items.append(
                SurveyResponseItem(
                    response_id=response.id,
                    survey_item_id=survey_item.id,
                    frequency=item_payload.frequency or "",
                    skill=item_payload.skill or "",
                    traits=item_payload.traits,
                )
            )
        db.add_all(new_items)

    response.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(response, attribute_names=["items"])
    student_completed = await is_student_submission_complete(db, current_user)
    await touch_completion(db, current_user.id, student_submitted=student_completed)
    await db.commit()

    await manager.broadcast_to_teacher(
        _class_key(current_user),
        {
            "event": "survey_updated",
            "student_id": str(current_user.id),
        },
    )

    result_data = _serialize_response(response, current_user)
    result_data["is_locked"] = False
    return result_data


async def _fetch_items_map(
    db: AsyncSession, items: list[Any]
) -> dict[int, SurveyItem]:
    ids = {item.survey_item_id for item in items}
    if not ids:
        return {}
    stmt = select(SurveyItem).where(SurveyItem.id.in_(ids))
    result = await db.execute(stmt)
    return {item.id: item for item in result.scalars().all()}


@router.put(
    "/composite",
    response_model=CompositeResponseOut,
    summary="保存综合题答案",
)
async def put_composite(
    payload: CompositeResponseIn,
    current_user: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> CompositeResponseOut:
    await _ensure_unlocked(db, current_user)
    stmt = select(CompositeResponse).where(
        CompositeResponse.student_id == current_user.id,
        CompositeResponse.responder_type == ResponderType.STUDENT,
    )
    result = await db.execute(stmt)
    composite = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if not composite:
        composite = CompositeResponse(
            student_id=current_user.id,
            responder_type=ResponderType.STUDENT,
            payload=payload.model_dump(),
            submitted_at=now,
            updated_at=now,
        )
        db.add(composite)
    else:
        composite.payload = payload.model_dump()
        composite.updated_at = now
    await db.flush()
    student_completed = await is_student_submission_complete(db, current_user)
    await touch_completion(db, current_user.id, student_submitted=student_completed)
    await db.commit()

    await manager.broadcast_to_teacher(
        _class_key(current_user),
        {
            "event": "composite_updated",
            "student_id": str(current_user.id),
        },
    )

    return CompositeResponseOut(
        **composite.payload,
        submitted_at=composite.submitted_at,
        updated_at=composite.updated_at,
    )


@router.get(
    "/composite",
    summary="获取综合题答案",
)
async def get_composite(
    current_user: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(CompositeResponse).where(
        CompositeResponse.student_id == current_user.id,
        CompositeResponse.responder_type == ResponderType.STUDENT,
    )
    result = await db.execute(stmt)
    composite = result.scalar_one_or_none()
    if not composite:
        return {
            "q1": {"原来": "", "现在": ""},
            "q2": {"原来": "", "现在": ""},
            "q3": {},
        }
    return {
        **composite.payload,
        "submitted_at": composite.submitted_at,
        "updated_at": composite.updated_at,
    }


@router.put(
    "/parent-note",
    response_model=ParentNoteOut,
    summary="提交家长寄语",
)
async def put_parent_note(
    payload: ParentNoteIn,
    current_user: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> ParentNoteOut:
    if len(payload.content) > 300:
        raise HTTPException(status_code=400, detail="家长寄语需在300字以内")
    stmt = select(ParentNote).where(ParentNote.student_id == current_user.id)
    result = await db.execute(stmt)
    note = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if not note:
        note = ParentNote(
            student_id=current_user.id,
            content=payload.content,
            submitted_at=now,
            updated_at=now,
        )
        db.add(note)
    else:
        note.content = payload.content
        note.updated_at = now
    await db.flush()
    await touch_completion(db, current_user.id, parent_submitted=True)
    await db.commit()

    await manager.broadcast_to_teacher(
        _class_key(current_user),
        {
            "event": "parent_note_updated",
            "student_id": str(current_user.id),
        },
    )

    return ParentNoteOut(
        content=note.content,
        submitted_at=note.submitted_at,
        updated_at=note.updated_at,
    )


@router.get(
    "/parent-note",
    response_model=ParentNoteOut | dict,
    summary="获取家长寄语",
)
async def get_parent_note(
    current_user: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> ParentNoteOut | dict:
    stmt = select(ParentNote).where(ParentNote.student_id == current_user.id)
    result = await db.execute(stmt)
    note = result.scalar_one_or_none()
    if not note:
        return {"content": "", "submitted_at": None, "updated_at": None}
    return ParentNoteOut(
        content=note.content,
        submitted_at=note.submitted_at,
        updated_at=note.updated_at,
    )


@router.get(
    "/teacher-review",
    response_model=dict,
    summary="查看老师评价",
)
async def get_teacher_review(
    current_user: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(TeacherReview).where(TeacherReview.student_id == current_user.id)
    result = await db.execute(stmt)
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="老师还未对你做出评价哦，请耐心等待~",
        )
    return {
        "selected_traits": review.selected_traits,
        "rendered_text": review.rendered_text,
        "submitted_at": review.submitted_at,
        "updated_at": review.updated_at,
    }


@router.post(
    "/llm-eval",
    response_model=LlmEvalOut,
    summary="生成或获取彩小蝶的综合评语",
)
async def post_llm_eval(
    current_user: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> LlmEvalOut:
    survey = await _get_response(
        db,
        current_user.id,
        ResponderType.STUDENT,
        with_items=True,
    )
    if not survey or not survey.items:
        raise HTTPException(status_code=400, detail="请先完成问卷提交")

    expected_items_stmt = await db.execute(
        select(func.count(SurveyItem.id)).where(
            SurveyItem.grade_band == survey.grade_band
        )
    )
    expected_items = expected_items_stmt.scalar_one()
    answered_items = len(survey.items)
    if answered_items != expected_items:
        raise HTTPException(status_code=400, detail="请完整填写全部问卷题目后再生成评价")
    if any(not item.frequency or not item.skill for item in survey.items):
        raise HTTPException(status_code=400, detail="请完整填写全部问卷题目后再生成评价")

    parent_note = await _get_parent_note(db, current_user.id)
    if not parent_note:
        raise HTTPException(status_code=400, detail="请先提交家长寄语")

    review = await _get_teacher_review(db, current_user.id)
    if not review:
        raise HTTPException(status_code=400, detail="老师还未对你做出评价哦，请耐心等待~")

    composite = await _get_composite_response(db, current_user.id)
    if not composite or not composite.payload:
        raise HTTPException(status_code=400, detail="请先完善综合问题信息")

    payload = build_llm_payload(survey, parent_note, review, composite)
    llm_service = LlmService()
    llm_eval = await llm_service.generate_once(
        db,
        current_user,
        survey,
        parent_note,
        review,
        payload,
        force_refresh=False,
    )
    await touch_completion(db, current_user.id, llm_generated=True)
    await db.commit()
    return LlmEvalOut(content=llm_eval.content, generated_at=llm_eval.generated_at)


async def _get_response(
    db: AsyncSession,
    student_id,
    responder: ResponderType,
    with_items: bool = False,
) -> SurveyResponse | None:
    stmt = select(SurveyResponse).where(
        SurveyResponse.student_id == student_id,
        SurveyResponse.responder_type == responder,
    )
    if with_items:
        stmt = stmt.options(
            selectinload(SurveyResponse.items).selectinload(SurveyResponseItem.item)
        )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _get_parent_note(db: AsyncSession, student_id) -> ParentNote | None:
    result = await db.execute(
        select(ParentNote).where(ParentNote.student_id == student_id)
    )
    return result.scalar_one_or_none()


async def _get_teacher_review(db: AsyncSession, student_id) -> TeacherReview | None:
    result = await db.execute(
        select(TeacherReview).where(TeacherReview.student_id == student_id)
    )
    return result.scalar_one_or_none()


async def _get_composite_response(
    db: AsyncSession, student_id
) -> CompositeResponse | None:
    result = await db.execute(
        select(CompositeResponse).where(
            CompositeResponse.student_id == student_id,
            CompositeResponse.responder_type == ResponderType.STUDENT,
        )
    )
    return result.scalar_one_or_none()
