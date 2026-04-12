"""Dashboard endpointlari.

GET /api/v1/dashboard/teacher  → sinf statistikasi, pending reviews, muammoli savollar
GET /api/v1/dashboard/student  → XP, streak, aktiv kurslar, achievementlar
"""
from fastapi import APIRouter

from backend.api.deps import CurrentStudent, CurrentTeacher, DBSession
from backend.repositories.dashboard_repo import DashboardRepository
from backend.schemas.dashboard import (
    ActiveCourseResponse,
    AchievementResponse,
    ClassStatResponse,
    PendingReviewResponse,
    ProblemQuestionResponse,
    StudentDashboardResponse,
    TeacherDashboardResponse,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /dashboard/teacher
# ---------------------------------------------------------------------------

@router.get(
    "/teacher",
    response_model=TeacherDashboardResponse,
    summary="O'qituvchi dashboard (sinf statistikasi, pending reviews)",
)
async def teacher_dashboard(teacher: CurrentTeacher, db: DBSession):
    """O'qituvchi dashboardi:
    - **classes** — har bir sinf: o'quvchilar soni + aktiv vazifalar
    - **pending_reviews** — AI tekshirgan, teacher tasdiqlamagan javoblar
    - **problem_questions** — xato darajasi 60%+ savollar
    """
    repo = DashboardRepository(db)

    classes_raw    = await repo.get_teacher_classes_stats(teacher.id)
    pending_raw    = await repo.get_pending_reviews(teacher.id)
    problems_raw   = await repo.get_problem_questions(teacher.id)

    return TeacherDashboardResponse(
        classes=[ClassStatResponse(**c) for c in classes_raw],
        pending_reviews=[PendingReviewResponse(**p) for p in pending_raw],
        pending_count=len(pending_raw),
        problem_questions=[ProblemQuestionResponse(**q) for q in problems_raw],
    )


# ---------------------------------------------------------------------------
# GET /dashboard/student
# ---------------------------------------------------------------------------

@router.get(
    "/student",
    response_model=StudentDashboardResponse,
    summary="O'quvchi dashboard (XP, streak, kurslar, achievementlar)",
)
async def student_dashboard(student: CurrentStudent, db: DBSession):
    """O'quvchi dashboardi:
    - **xp / level / streak** — gamification holati
    - **active_courses** — yozilgan, tugallanmagan kurslar
    - **recent_achievements** — so'nggi 5 badge
    """
    repo = DashboardRepository(db)

    courses_raw      = await repo.get_student_active_courses(student.id)
    achievements_raw = await repo.get_recent_achievements(student.id)

    streak_date = (
        student.streak_last_date.isoformat()
        if student.streak_last_date else None
    )

    return StudentDashboardResponse(
        xp=student.xp,
        level=student.level,
        streak_count=student.streak_count,
        streak_last_date=streak_date,
        active_courses=[ActiveCourseResponse(**c) for c in courses_raw],
        active_courses_count=len(courses_raw),
        recent_achievements=[AchievementResponse(**a) for a in achievements_raw],
    )
