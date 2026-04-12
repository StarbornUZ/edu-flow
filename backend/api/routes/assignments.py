"""Assignments va submissions endpointlari."""
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from backend.api.deps import CurrentStudent, CurrentTeacher, CurrentUser, DBSession
from backend.db.models.submission import SubmissionStatus
from backend.db.models.user import UserRole
from backend.repositories.assignment_repo import AssignmentRepository
from backend.repositories.course_repo import CourseRepository
from backend.schemas.assignment import (
    AssignmentCreate,
    AssignmentDetailResponse,
    AssignmentDetailTeacherResponse,
    AssignmentResponse,
    ConfirmRequest,
    QuestionResponse,
    QuestionResponseWithAnswer,
    SubmissionResponse,
    SubmissionResultResponse,
    SubmitRequest,
)
from backend.schemas.dashboard import GamificationResult
from backend.services.ai_grading_service import PendingGradeItem, grade_pending_results
from backend.services.gamification_service import GamificationService
from backend.services.grading_service import grade_submission

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _repo(db: DBSession) -> AssignmentRepository:
    return AssignmentRepository(db)


async def _get_assignment_or_404(repo: AssignmentRepository, assignment_id: uuid.UUID):
    assignment = await repo.get_by_id(assignment_id)
    if not assignment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vazifa topilmadi")
    return assignment


async def _check_assignment_access(
    course_repo: CourseRepository,
    assignment,
    user,
) -> None:
    """Vazifaga kirish huquqini tekshiradi.

    Admin   → hamma
    Teacher → faqat o'z vazifasi (course egasi)
    Student → faqat enrolled bo'lgan course ning vazifasi
    """
    if user.role == UserRole.admin:
        return

    if user.role == UserRole.teacher:
        if assignment.teacher_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu vazifa sizga tegishli emas")
        return

    # Student — kursga yozilganmi?
    enrolled = await course_repo.is_enrolled(assignment.course_id, user.id)
    if not enrolled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Siz bu kursga yozilmagansiz")


# ---------------------------------------------------------------------------
# POST /assignments  — vazifa yaratish (teacher)
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yangi vazifa yaratish (teacher)",
)
async def create_assignment(data: AssignmentCreate, teacher: CurrentTeacher, db: DBSession):
    course_repo = CourseRepository(db)
    course = await course_repo.get_by_id(data.course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kurs topilmadi")
    if course.teacher_id != teacher.id and teacher.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu kurs sizga tegishli emas")

    questions_data = [q.model_dump() for q in data.questions]
    assignment = await _repo(db).create(
        teacher_id=teacher.id,
        questions_data=questions_data,
        course_id=data.course_id,
        module_id=data.module_id,
        title=data.title,
        instructions=data.instructions,
        question_type=data.question_type,
        time_limit_sec=data.time_limit_sec,
        max_attempts=data.max_attempts,
        deadline=data.deadline,
        is_ai_generated=data.is_ai_generated,
    )
    return AssignmentResponse.model_validate(assignment)


# ---------------------------------------------------------------------------
# GET /assignments/{id}  — vazifa + savollar (rol bo'yicha)
# ---------------------------------------------------------------------------

@router.get(
    "/{assignment_id}",
    summary="Vazifa ma'lumotlari (teacher: javob bilan, student: javovsiz)",
)
async def get_assignment(assignment_id: uuid.UUID, user: CurrentUser, db: DBSession):
    repo = _repo(db)
    course_repo = CourseRepository(db)
    assignment = await _get_assignment_or_404(repo, assignment_id)
    await _check_assignment_access(course_repo, assignment, user)

    questions = await repo.get_questions(assignment_id)

    if user.role in (UserRole.teacher, UserRole.admin):
        return AssignmentDetailTeacherResponse(
            **AssignmentResponse.model_validate(assignment).model_dump(),
            questions=[QuestionResponseWithAnswer.model_validate(q) for q in questions],
        )

    # Student — to'g'ri javoblar ko'rinmaydi
    return AssignmentDetailResponse(
        **AssignmentResponse.model_validate(assignment).model_dump(),
        questions=[QuestionResponse.model_validate(q) for q in questions],
    )


# ---------------------------------------------------------------------------
# POST /assignments/{id}/submit  — javob yuborish (student)
# ---------------------------------------------------------------------------

@router.post(
    "/{assignment_id}/submit",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Vazifaga javob yuborish (student)",
)
async def submit_assignment(
    assignment_id: uuid.UUID,
    data: SubmitRequest,
    student: CurrentStudent,
    db: DBSession,
    background_tasks: BackgroundTasks,
):
    repo = _repo(db)
    course_repo = CourseRepository(db)
    assignment = await _get_assignment_or_404(repo, assignment_id)

    # Kursga yozilganmi?
    enrolled = await course_repo.is_enrolled(assignment.course_id, student.id)
    if not enrolled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Siz bu kursga yozilmagansiz")

    # Urinishlar soni
    attempt_count = await repo.get_attempt_count(assignment_id, student.id)
    if attempt_count >= assignment.max_attempts:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Urinishlar soni tugadi (max: {assignment.max_attempts})",
        )

    # Deadline tekshiruvi
    if assignment.deadline:
        from datetime import datetime, timezone
        if datetime.now(timezone.utc) > assignment.deadline:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vazifa muddati o'tgan")

    # answers_json = {str(question_id): answer}
    answers_map = {str(a.question_id): a.answer for a in data.answers}

    submission = await repo.create_submission(
        assignment_id=assignment_id,
        student_id=student.id,
        answers_json=answers_map,
        attempt_num=attempt_count + 1,
    )

    # Savollarni yuklash va deterministic auto-grade
    questions = list(await repo.get_questions(assignment_id))
    grade_results = grade_submission(questions, answers_map)

    # is_correct=None bo'lgan barcha savollar AI ga boradi:
    #   - open_answer  → har doim
    #   - fill         → correct_answer_json bo'sh/None bo'lganda
    questions_by_id = {str(q.id): q for q in questions}
    pending_items: list[PendingGradeItem] = []
    has_pending = any(r["is_correct"] is None for r in grade_results)

    for r in grade_results:
        result_obj = await repo.create_result(
            submission_id=submission.id,
            question_id=r["question_id"],
            student_answer=r["student_answer"],
            is_correct=r["is_correct"],
            ai_score=r["ai_score"],
            xp_earned=r["xp_earned"],
            ai_feedback=r["ai_feedback"],
        )

        if r["is_correct"] is None:
            q = questions_by_id.get(str(r["question_id"]))
            if q:
                pending_items.append(PendingGradeItem(
                    result_id=result_obj.id,
                    question_text=q.question_text,
                    model_answer=str(q.correct_answer_json or ""),
                    student_answer=str(r["student_answer"] or ""),
                    max_pts=float(q.points_max),
                    question_type=q.question_type.value,
                ))

    new_status = (
        SubmissionStatus.pending if has_pending
        else SubmissionStatus.ai_reviewed
    )
    await repo.update_submission_status(submission, new_status)

    # Background da AI baholash (open_answer + fill-no-answer)
    if pending_items:
        background_tasks.add_task(grade_pending_results, submission.id, pending_items)

    # Gamification: XP + streak + achievement
    results_list = await repo.get_results(submission.id)
    gami = await GamificationService(db).process_submission(
        submission, results_list, attempt_num=attempt_count + 1
    )

    return {
        **SubmissionResponse(
            id=submission.id,
            assignment_id=submission.assignment_id,
            student_id=submission.student_id,
            attempt_num=submission.attempt_num,
            status=submission.status.value,
            submitted_at=submission.created_at,
            results=[SubmissionResultResponse.model_validate(r) for r in results_list],
        ).model_dump(),
        "gamification": GamificationResult(**gami).model_dump(),
    }


# ---------------------------------------------------------------------------
# GET /assignments/{id}/results — natijalar (rol bo'yicha)
# ---------------------------------------------------------------------------

@router.get(
    "/{assignment_id}/results",
    summary="Natijalar (teacher: barcha, student: faqat o'zi)",
)
async def get_results(assignment_id: uuid.UUID, user: CurrentUser, db: DBSession):
    repo = _repo(db)
    course_repo = CourseRepository(db)
    assignment = await _get_assignment_or_404(repo, assignment_id)
    await _check_assignment_access(course_repo, assignment, user)

    if user.role in (UserRole.teacher, UserRole.admin):
        submissions = await repo.get_all_submissions(assignment_id)
    else:
        submissions = await repo.get_student_submissions(assignment_id, user.id)

    out = []
    for sub in submissions:
        results = await repo.get_results(sub.id)
        out.append(SubmissionResponse(
            id=sub.id,
            assignment_id=sub.assignment_id,
            student_id=sub.student_id,
            attempt_num=sub.attempt_num,
            status=sub.status.value,
            submitted_at=sub.created_at,
            results=[SubmissionResultResponse.model_validate(r) for r in results],
        ))
    return out


# ---------------------------------------------------------------------------
# POST /submissions/{id}/confirm  — ochiq javobni tasdiqlash (teacher)
# ---------------------------------------------------------------------------

@router.post(
    "/submissions/{submission_result_id}/confirm",
    response_model=SubmissionResultResponse,
    summary="Ochiq javobni baholash (teacher)",
)
async def confirm_result(
    submission_result_id: uuid.UUID,
    data: ConfirmRequest,
    teacher: CurrentTeacher,
    db: DBSession,
):
    repo = _repo(db)
    result = await repo.get_result(submission_result_id)
    if not result:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Natija topilmadi")

    # Submission orqali assignment ni tekshirish
    submission = await repo.get_submission(result.submission_id)
    if not submission:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission topilmadi")

    assignment = await _get_assignment_or_404(repo, submission.assignment_id)

    if assignment.teacher_id != teacher.id and teacher.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu vazifa sizga tegishli emas")

    confirmed = await repo.confirm_result(result, data.teacher_score, data.teacher_note)

    # Barcha natijalar tasdiqlangach — submission statusini yangilash
    all_results = await repo.get_results(submission.id)
    all_confirmed = all(r.teacher_score is not None or r.is_correct is not None for r in all_results)
    if all_confirmed:
        await repo.update_submission_status(submission, SubmissionStatus.teacher_confirmed)
        # O'quvchiga teacher_score bo'yicha XP berish
        xp = int(data.teacher_score or 0)
        if xp > 0:
            await GamificationService(db).award_xp_for_confirmed(
                submission.student_id, xp
            )

    return SubmissionResultResponse.model_validate(confirmed)
