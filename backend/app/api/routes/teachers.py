# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_teacher
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
from app.models.user import GradeBand, User, UserRole
from app.schemas.survey import (
    LockStatusIn,
    LockStatusOut,
    ParentNoteOut,
    SurveyResponseIn,
    SurveyResponseOut,
    TeacherReviewIn,
    TeacherReviewOut,
)
from app.schemas.users import StudentDashboardItem
from app.services.completion import touch_completion
from app.services.realtime import manager
from app.services.teacher_review import get_grade_traits, render_review_text

router = APIRouter(prefix="/teacher", tags=["教师端"])


def _class_key(user: User) -> str:
    return f"{user.school_name or ''}-{user.class_no or ''}"


async def _ensure_same_class(teacher: User, student: User) -> None:
    if teacher.role == UserRole.ADMIN:
        return
    if (
        teacher.school_name != student.school_name
        or teacher.class_no != student.class_no
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问该学生")


@router.get("/class/students", response_model=list[StudentDashboardItem], summary="班级学生列表")
async def list_students(
    current_user: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> list[StudentDashboardItem]:
    stmt = (
        select(User)
        .where(User.role == UserRole.STUDENT)
        .where(User.school_name == current_user.school_name)
        .where(User.class_no == current_user.class_no)
        .options(selectinload(User.completion_status))
        .order_by(User.student_no)
    )
    if current_user.role == UserRole.ADMIN:
        stmt = select(User).where(User.role == UserRole.STUDENT).options(
            selectinload(User.completion_status)
        )
    result = await db.execute(stmt)
    students = result.scalars().all()
    items: list[StudentDashboardItem] = []
    for stu in students:
        completion = stu.completion_status
        items.append(
            StudentDashboardItem(
                student_id=stu.id,
                student_name=stu.student_name or stu.username,
                class_no=stu.class_no or "",
                grade=stu.grade or 0,
                grade_band=stu.grade_band.value if stu.grade_band else "",
                completion_status=bool(
                    completion
                    and completion.student_submitted
                    and completion.parent_submitted
                    and completion.teacher_submitted
                ),
            )
        )
    return items


@router.get(
    "/students/{student_id}",
    summary="查看学生详情",
)
async def get_student_detail(
    student_id: UUID = Path(...),
    current_user: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> dict:
    student = await db.get(User, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="用户不存在")
    await _ensure_same_class(current_user, student)

    survey = await _fetch_survey(db, student.id)
    parent_note = await _fetch_parent_note(db, student.id)
    composite = await _fetch_composite(db, student.id)
    review = await _fetch_review(db, student.id)
    lock_status = await _get_lock(db, student.id)

    return {
        "student": {
            "id": str(student.id),
            "student_name": student.student_name,
            "class_no": student.class_no,
            "grade": student.grade,
            "grade_band": student.grade_band.value if student.grade_band else None,
        },
        "survey": survey,
        "parent_note": parent_note,
        "composite": composite,
        "teacher_review": review,
        "lock": lock_status,
    }


async def _fetch_survey(db: AsyncSession, student_id: UUID) -> SurveyResponseOut | None:
    stmt = (
        select(SurveyResponse)
        .where(
            SurveyResponse.student_id == student_id,
            SurveyResponse.responder_type == ResponderType.STUDENT,
        )
        .options(
            selectinload(SurveyResponse.items).selectinload(SurveyResponseItem.item)
        )
    )
    result = await db.execute(stmt)
    response = result.scalar_one_or_none()
    if not response:
        return None
    return SurveyResponseOut(
        id=response.id,
        responder_type=response.responder_type.value,
        grade_band=response.grade_band.value,
        submitted_at=response.submitted_at,
        updated_at=response.updated_at,
        items=[
            {
                "id": item.id,
                "survey_item_id": item.survey_item_id,
                "frequency": item.frequency,
                "skill": item.skill,
                "traits": item.traits,
            }
            for item in response.items
        ],
    )


async def _fetch_parent_note(
    db: AsyncSession,
    student_id: UUID,
) -> ParentNoteOut | None:
    result = await db.execute(
        select(ParentNote).where(ParentNote.student_id == student_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        return None
    return ParentNoteOut(
        content=note.content,
        submitted_at=note.submitted_at,
        updated_at=note.updated_at,
    )


async def _fetch_composite(
    db: AsyncSession,
    student_id: UUID,
) -> dict | None:
    result = await db.execute(
        select(CompositeResponse).where(
            CompositeResponse.student_id == student_id,
            CompositeResponse.responder_type == ResponderType.STUDENT,
        )
    )
    composite = result.scalar_one_or_none()
    if not composite:
        return None
    return {
        **composite.payload,
        "submitted_at": composite.submitted_at,
        "updated_at": composite.updated_at,
    }


async def _fetch_review(
    db: AsyncSession,
    student_id: UUID,
) -> TeacherReviewOut | None:
    result = await db.execute(
        select(TeacherReview).where(TeacherReview.student_id == student_id)
    )
    review = result.scalar_one_or_none()
    if not review:
        return None
    return TeacherReviewOut(
        selected_traits=review.selected_traits,
        rendered_text=review.rendered_text,
        submitted_at=review.submitted_at,
        updated_at=review.updated_at,
    )


async def _get_lock(db: AsyncSession, student_id: UUID) -> LockStatusOut:
    result = await db.execute(
        select(StudentLock).where(StudentLock.student_id == student_id)
    )
    lock = result.scalar_one_or_none()
    if not lock:
        return LockStatusOut(
            is_locked=False,
            updated_at=datetime.now(timezone.utc),
        )
    return LockStatusOut(is_locked=lock.is_locked, updated_at=lock.updated_at)


@router.put(
    "/students/{student_id}/survey",
    response_model=SurveyResponseOut,
    summary="教师改写学生问卷",
)
async def teacher_override_survey(
    student_id: UUID,
    payload: SurveyResponseIn,
    current_user: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> SurveyResponseOut:
    student = await db.get(User, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="用户不存在")
    await _ensure_same_class(current_user, student)

    existing_stmt = (
        select(SurveyResponse)
        .where(
            SurveyResponse.student_id == student_id,
            SurveyResponse.responder_type == ResponderType.STUDENT,
        )
        .options(selectinload(SurveyResponse.items))
    )
    result = await db.execute(existing_stmt)
    response = result.scalar_one_or_none()
    if not response:
        response = SurveyResponse(
            student_id=student_id,
            responder_type=ResponderType.STUDENT,
            grade_band=student.grade_band or GradeBand.LOW,
        )
        db.add(response)
        await db.flush()

    await db.execute(
        delete(SurveyResponseItem).where(SurveyResponseItem.response_id == response.id)
    )

    ids = [item.survey_item_id for item in payload.items]
    stmt_items = select(SurveyItem).where(SurveyItem.id.in_(ids))
    result_items = await db.execute(stmt_items)
    items_map = {item.id: item for item in result_items.scalars().all()}
    for item in payload.items:
        survey_item = items_map.get(item.survey_item_id)
        if not survey_item:
            continue
        response.items.append(
            SurveyResponseItem(
                survey_item_id=survey_item.id,
                frequency=item.frequency,
                skill=item.skill,
                traits=item.traits,
            )
        )
    response.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await touch_completion(db, student_id, student_submitted=bool(response.items))
    await db.commit()

    await manager.notify_student(
        student_id,
        {"event": "survey_overridden", "by": str(current_user.id)},
    )
    return SurveyResponseOut(
        id=response.id,
        responder_type=response.responder_type.value,
        grade_band=response.grade_band.value,
        submitted_at=response.submitted_at,
        updated_at=response.updated_at,
        items=[
            {
                "id": item.id,
                "survey_item_id": item.survey_item_id,
                "frequency": item.frequency,
                "skill": item.skill,
                "traits": item.traits,
            }
            for item in response.items
        ],
    )


@router.put(
    "/students/{student_id}/lock",
    response_model=LockStatusOut,
    summary="锁定或解锁学生信息",
)
async def toggle_lock(
    student_id: UUID,
    lock: LockStatusIn,
    current_user: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> LockStatusOut:
    student = await db.get(User, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="用户不存在")
    await _ensure_same_class(current_user, student)
    result = await db.execute(
        select(StudentLock).where(StudentLock.student_id == student_id)
    )
    record = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if not record:
        record = StudentLock(
            student_id=student_id,
            teacher_id=current_user.id,
            is_locked=lock.is_locked,
            updated_at=now,
        )
        db.add(record)
    else:
        record.is_locked = lock.is_locked
        record.teacher_id = current_user.id
        record.updated_at = now
    await db.flush()
    await db.commit()
    await manager.broadcast_to_teacher(
        _class_key(current_user),
        {"event": "lock_changed", "student_id": str(student_id), "is_locked": lock.is_locked},
    )
    await manager.notify_student(
        student_id,
        {
            "event": "lock_changed",
            "is_locked": lock.is_locked,
            "message": "表格数据已被锁定，无法更改" if lock.is_locked else "解锁成功",
        },
    )
    return LockStatusOut(is_locked=record.is_locked, updated_at=record.updated_at)


@router.post(
    "/students/{student_id}/review",
    response_model=TeacherReviewOut,
    summary="提交教师评价",
)
async def submit_review(
    student_id: UUID,
    payload: TeacherReviewIn,
    current_user: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> TeacherReviewOut:
    student = await db.get(User, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="用户不存在")
    await _ensure_same_class(current_user, student)
    grade_band = student.grade_band or GradeBand.LOW
    allowed = get_grade_traits(grade_band)
    if any(trait not in allowed for trait in payload.selected_traits):
        raise HTTPException(status_code=400, detail="请选择与学段匹配的关键词")
    rendered_text = render_review_text(grade_band, payload.selected_traits)
    result = await db.execute(
        select(TeacherReview).where(TeacherReview.student_id == student_id)
    )
    review = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if not review:
        review = TeacherReview(
            student_id=student_id,
            teacher_id=current_user.id,
            grade_band=grade_band,
            selected_traits=payload.selected_traits,
            rendered_text=rendered_text,
            submitted_at=now,
            updated_at=now,
        )
        db.add(review)
    else:
        review.teacher_id = current_user.id
        review.selected_traits = payload.selected_traits
        review.rendered_text = rendered_text
        review.updated_at = now
    await db.flush()
    await touch_completion(db, student_id, teacher_submitted=True)
    await db.commit()
    await manager.notify_student(
        student_id,
        {"event": "teacher_review_ready"},
    )
    return TeacherReviewOut(
        selected_traits=review.selected_traits,
        rendered_text=review.rendered_text,
        submitted_at=review.submitted_at,
        updated_at=review.updated_at,
    )
