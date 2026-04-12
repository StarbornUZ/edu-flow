"""Deterministik auto-grading servisi.

JAVOB FORMATLARI (schemas/assignment.py QuestionCreate bilan mos):

  mcq:
    options_json        = ["Paris", "London", "Berlin"]
    correct_answer_json = "Paris"              # bitta to'g'ri javob
                       | ["Paris", "London"]   # bir nechta to'g'ri javob
    student_answer      = "Paris"              # yoki ["Paris", "London"]
    → matn qiymati taqqoslanadi; frontend shuffle qilsa ham xavfsiz

  fill:
    options_json        = null
    correct_answer_json = ["fotosintez", "photosynthesis"]  # qabul qilinadigan matnlar
    student_answer      = "Fotosintez"
    → kichik harflar + bo'shliqsiz taqqoslash

  matching:
    options_json        = {"left": ["A","B","C"], "right": ["1","2","3"]}
    correct_answer_json = {"A": "1", "B": "2", "C": "3"}   # matn → matn
    student_answer      = {"A": "1", "B": "2", "C": "3"}
    → partial grading: har to'g'ri juft uchun qisman ball

  ordering:
    options_json        = ["3-qadam", "1-qadam", "2-qadam"]   # aralashtirilgan (display)
    correct_answer_json = ["1-qadam", "2-qadam", "3-qadam"]   # to'g'ri tartib (matn)
    student_answer      = ["1-qadam", "2-qadam", "3-qadam"]   # student tartibi (matn)
    → indeks YO'Q; matn qiymatlari taqqoslanadi; partial grading

  timed:   mcq bilan bir xil format, vaqt chegarasi frontend da

  open_answer:
    is_correct=None qaytaradi → ai_grading_service.grade_pending_results() baholaydi

  fill (correct_answer_json=None):
    is_correct=None qaytaradi → open_answer kabi AI ga boradi
    fill (correct_answer_json to'ldirilgan): deterministik baholanadi
"""
from typing import Any

from backend.db.models.assignment import Question, QuestionType

# Bir urinishda to'g'ri javob uchun XP
XP_PER_CORRECT = {
    QuestionType.mcq: 10,
    QuestionType.fill: 15,
    QuestionType.matching: 20,
    QuestionType.ordering: 20,
    QuestionType.timed: 12,
    QuestionType.open_answer: 0,
}


def grade_question(
    question: Question,
    student_answer: Any,
) -> tuple[bool | None, float, int, str | None]:
    """Bitta savolni baholaydi.

    Returns:
        (is_correct, score, xp_earned, feedback)
        is_correct = None → manual/AI review kerak
    """
    q_type = question.question_type
    correct = question.correct_answer_json
    max_pts = float(question.points_max)

    if q_type in (QuestionType.mcq, QuestionType.timed):
        return _grade_mcq(student_answer, correct, max_pts, q_type)
    if q_type == QuestionType.fill:
        return _grade_fill(student_answer, correct, max_pts)
    if q_type == QuestionType.matching:
        return _grade_matching(student_answer, correct, max_pts)
    if q_type == QuestionType.ordering:
        return _grade_ordering(student_answer, correct, max_pts)
    if q_type == QuestionType.open_answer:
        return None, 0.0, 0, "AI baholash kutilmoqda"

    return None, 0.0, 0, None


def grade_submission(
    questions: list[Question],
    answers: dict[str, Any],
) -> list[dict]:
    """Butun submissionni baholaydi.

    answers format: {str(question_id): student_answer}
    """
    results = []
    for question in questions:
        student_answer = answers.get(str(question.id))
        if student_answer is None:
            results.append({
                "question_id": question.id,
                "student_answer": None,
                "is_correct": False,
                "ai_score": 0.0,
                "xp_earned": 0,
                "ai_feedback": "Javob berilmadi",
            })
            continue

        is_correct, score, xp, feedback = grade_question(question, student_answer)
        results.append({
            "question_id": question.id,
            "student_answer": student_answer,
            "is_correct": is_correct,
            "ai_score": score,
            "xp_earned": xp,
            "ai_feedback": feedback,
        })
    return results


# ---------------------------------------------------------------------------
# MCQ — matn qiymati taqqoslash (indeks emas), multi-answer qo'llab-quvvatlash
# ---------------------------------------------------------------------------

def _normalize_mcq(value: Any) -> set[str]:
    """MCQ javobni normallashtiradi: str yoki list[str] → set[str]."""
    if isinstance(value, list):
        return {str(v).strip() for v in value}
    return {str(value).strip()}


def _grade_mcq(
    student_answer: Any,
    correct: Any,
    max_pts: float,
    q_type: QuestionType,
) -> tuple[bool, float, int, None]:
    """
    Bir yoki bir nechta to'g'ri javob.
    correct_answer_json = "Paris"           (bitta)
                        | ["Paris","Rome"]  (bir nechta)
    student_answer      = "Paris"           (bitta)
                        | ["Paris","Rome"]  (bir nechta)
    Taqqoslash: set ekvivalentligi (tartib muhim emas, matn muhim).
    """
    correct_set = _normalize_mcq(correct)
    student_set = _normalize_mcq(student_answer)
    is_correct = student_set == correct_set
    score = max_pts if is_correct else 0.0
    xp = XP_PER_CORRECT[q_type] if is_correct else 0
    return is_correct, score, xp, None


# ---------------------------------------------------------------------------
# Fill — matn ro'yxati taqqoslash
# ---------------------------------------------------------------------------

def _grade_fill(
    student_answer: Any,
    correct: Any,
    max_pts: float,
) -> tuple[bool | None, float, int, str | None]:
    """
    correct_answer_json = ["fotosintez", "photosynthesis"]  ← matn ro'yxati
    student_answer      = "Fotosintez"
    Taqqoslash: kichik harf + strip; ro'yxatdan birortasiga mos kelsa to'g'ri.
    """
    if correct is None:
        return None, 0.0, 0, "AI baholash kutilmoqda"

    student_norm = str(student_answer).lower().strip()

    if isinstance(correct, list):
        accepted = [str(a).lower().strip() for a in correct]
    else:
        accepted = [str(correct).lower().strip()]

    is_correct = student_norm in accepted
    score = max_pts if is_correct else 0.0
    xp = XP_PER_CORRECT[QuestionType.fill] if is_correct else 0
    return is_correct, score, xp, None


# ---------------------------------------------------------------------------
# Matching — dict taqqoslash, partial grading
# ---------------------------------------------------------------------------

def _grade_matching(
    student_answer: Any,
    correct: Any,
    max_pts: float,
) -> tuple[bool, float, int, None]:
    """
    correct_answer_json = {"A": "1", "B": "2", "C": "3"}
    student_answer      = {"A": "1", "B": "x", "C": "3"}
    Partial grading: har to'g'ri juft uchun max_pts / len(correct) ball.
    """
    if not isinstance(student_answer, dict) or not isinstance(correct, dict):
        return False, 0.0, 0, None
    if not correct:
        return False, 0.0, 0, None

    correct_count = sum(
        1 for k, v in correct.items()
        if str(student_answer.get(k, "")).strip().lower() == str(v).strip().lower()
    )
    ratio = correct_count / len(correct)
    is_correct = correct_count == len(correct)
    score = round(max_pts * ratio, 2)
    xp = int(XP_PER_CORRECT[QuestionType.matching] * ratio)
    return is_correct, score, xp, None


# ---------------------------------------------------------------------------
# Ordering — matn qiymati taqqoslash (indeks emas), partial grading
# ---------------------------------------------------------------------------

def _grade_ordering(
    student_answer: Any,
    correct: Any,
    max_pts: float,
) -> tuple[bool, float, int, None]:
    """
    options_json        = ["3-qadam", "1-qadam", "2-qadam"]   ← display (aralashtirilgan)
    correct_answer_json = ["1-qadam", "2-qadam", "3-qadam"]   ← to'g'ri tartib (MATN)
    student_answer      = ["1-qadam", "2-qadam", "3-qadam"]   ← student tartibi (MATN)

    Indeks ISHLATILMAYDI — frontend shuffle qilganda ham xavfsiz.
    Partial grading: har to'g'ri pozitsiya uchun qisman ball.
    """
    if not isinstance(student_answer, list) or not isinstance(correct, list):
        return False, 0.0, 0, None
    if len(student_answer) != len(correct):
        return False, 0.0, 0, None

    correct_positions = sum(
        1 for s, c in zip(student_answer, correct)
        if str(s).strip().lower() == str(c).strip().lower()
    )
    ratio = correct_positions / len(correct)
    is_correct = correct_positions == len(correct)
    score = round(max_pts * ratio, 2)
    xp = int(XP_PER_CORRECT[QuestionType.ordering] * ratio)
    return is_correct, score, xp, None
