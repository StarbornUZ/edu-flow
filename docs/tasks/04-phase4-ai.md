# Faza 4 — AI Integration
> **Mas'ul:** Akramov Oybek + Muxtorov Javohirbek
> **Vaqt:** Kun 1 · 14:00–19:00 (~5 soat, Faza 3 bilan parallel)
> **Kerak:** Faza 1 tugagan; Faza 3 kurs/topic endpoint lari tayyor bo'lgach integratsiya
> **Bloklovchi:** Faza 6 (AI kurs generatsiyasi UI)

---

## Kontekst

EduFlow da AI 5 ta asosiy vazifani bajaradi:

| # | Funksiya | Trigger | Model |
|---|----------|---------|-------|
| 1 | **Kurs generatsiyasi** | Teacher so'rovi | Claude Sonnet 4.6 (SSE) |
| 2 | **Mavzu kontenti** | Teacher so'rovi | Claude Sonnet 4.6 |
| 3 | **Vazifa generatsiyasi** | Teacher so'rovi | Claude Sonnet 4.6 |
| 4 | **Avtomatik baholash** | Student submission | Claude Sonnet 4.6 |
| 5 | **Statistika tahlili** | Dashboard yuklaganda | Claude Sonnet 4.6 |
| 6 | **Guruh ajratish** | Musobaqa yaratishda | Claude Sonnet 4.6 |

**Xarajat nazorati:**
- Per-request token logging (`AILog` jadvaliga)
- Per-org monthly limit tekshiruvi
- Rate limit: 20 AI req/min/user

---

## 4.1 — AI Client (mavjud, yangilash)

**Fayl:** `backend/services/ai_service.py`

Mavjud wrapper ga token logging va org budget check qo'shish:

```python
import anthropic
import hashlib
import time
from typing import AsyncGenerator, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.db.models.organization import Organization
from backend.db.models.submission import AILog

MODEL = "claude-sonnet-4-6"
FALLBACK_MODEL_OPENAI = "gpt-4o"  # Budget oshganda

client = anthropic.AsyncAnthropic()


async def stream_claude(
    system: str,
    user_message: str,
    max_tokens: int = 4096,
    db: AsyncSession | None = None,
    org_id: str | None = None,
    user_id: str | None = None,
    endpoint: str = "unknown",
) -> AsyncGenerator[str, None]:
    """
    Claude Sonnet 4.6 bilan SSE streaming.
    db + org_id berilsa — token limit tekshiriladi va log yoziladi.
    """
    # Org budget tekshiruvi
    if db and org_id:
        org = await db.get(Organization, org_id)
        if org and org.ai_token_limit and org.ai_tokens_used >= org.ai_token_limit:
            raise Exception("AI token limiti tugadi. Org-admin bilan bog'laning.")

    start = time.time()
    full_text = ""
    input_tokens = 0
    output_tokens = 0

    async with client.messages.stream(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        async for text in stream.text_stream:
            full_text += text
            yield text

        # Token hisob
        usage = stream.get_final_message().usage
        input_tokens = usage.input_tokens
        output_tokens = usage.output_tokens

    # Log yozish
    if db and user_id:
        log = AILog(
            user_id=user_id,
            endpoint=endpoint,
            prompt_hash=hashlib.sha256(user_message.encode()).hexdigest(),
            tokens_used=input_tokens + output_tokens,
            response_ms=int((time.time() - start) * 1000),
        )
        db.add(log)

        # Org token counter yangilash
        if org_id:
            from sqlalchemy import update
            await db.execute(
                update(Organization)
                .where(Organization.id == org_id)
                .values(ai_tokens_used=Organization.ai_tokens_used + input_tokens + output_tokens)
            )
        await db.commit()


async def get_json_from_claude(
    system: str, user_message: str, max_tokens: int = 4096
) -> dict | list:
    """JSON javob olish (streaming emas)."""
    import json, re
    message = await client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system + "\n\nFaqat JSON format bilan javob ber. Hech qanday izoh yozma.",
        messages=[{"role": "user", "content": user_message}],
    )
    text = message.content[0].text
    # JSON extraction
    match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    return json.loads(text)
```

---

## 4.2 — Kurs Generatsiyasi Prompts

**Fayl:** `backend/services/prompts/course_prompts.py`

```python
COURSE_GENERATION_SYSTEM = """Sen tajribali o'zbek tilida ta'lim beruvchi AI assistantsan.
Berilgan fan va sinf darajasi uchun strukturalangan kurs yaratasan.
Barcha kontent o'zbek tilida bo'lishi shart.
JSON formatida javob ber."""


def course_generation_user(subject: str, grade_level: int, goal: str, module_count: int) -> str:
    return f"""
Fan: {subject}
Sinf darajasi: {grade_level}-sinf
O'quv maqsadi: {goal}
Modullar soni: {module_count}

Quyidagi JSON strukturasida kurs yarat:
{{
  "title": "Kurs nomi",
  "description": "Kurs haqida qisqacha tavsif (2-3 gap)",
  "modules": [
    {{
      "title": "Modul nomi",
      "topics": [
        {{
          "title": "Mavzu nomi",
          "content_md": "Mavzu mazmuni (Markdown formatida, kamida 200 so'z)",
          "assignments": [
            {{
              "title": "Vazifa nomi",
              "type": "mcq",  // mcq | fill | open_answer | timed
              "questions": [
                {{
                  "question": "Savol matni",
                  "options": ["A variant", "B variant", "C variant", "D variant"],  // mcq uchun
                  "correct_index": 0,  // 0-based, mcq uchun
                  "explanation": "Nima uchun bu to'g'ri javob"
                }}
              ]
            }}
          ]
        }}
      ]
    }}
  ]
}}

Har modulda kamida 2 ta mavzu, har mavzuda kamida 3 ta vazifa bo'lsin.
Qiyinlik asta-sekin oshib borsin.
"""


TOPIC_CONTENT_SYSTEM = """Sen tajribali o'qituvchisan. Berilgan mavzu uchun
o'quvchilarga tushunarli, qiziqarli kontent yozasan.
Markdown formatidan foydalanasan. Misollar, sxemalar, formulalar kiritasan."""


def topic_content_user(topic_title: str, subject: str, grade_level: int) -> str:
    return f"""
Fan: {subject}, {grade_level}-sinf
Mavzu: {topic_title}

Quyidagi qismlarni o'z ichiga olgan kontent yoz:
1. ## Kirish — mavzu qisqacha tavsifi (2-3 gap)
2. ## Asosiy tushunchalar — asosiy atamalar va ta'riflar (ro'yxat yoki jadval)
3. ## Misollar — 2-3 ta ko'rsatilgan misol
4. ## Amaliy qo'llanilishi — kundalik hayotda qo'llanilishi
5. ## Xulosa — asosiy fikrlar (3-5 ta bullet point)

Formulalar uchun LaTeX dan foydalan: $$formula$$
Rasmlar uchun: [Rasm tavsifi]
Kamida 500 so'z.
"""


ASSIGNMENT_GENERATION_SYSTEM = """Sen pedagogika va didaktika bo'yicha mutaxassissan.
Berilgan mavzu uchun ta'limiy samarali vazifalar yaratasaн.
Savollar qiyinlik bo'yicha gradatsiyalangan bo'lsin.
JSON formatida javob ber."""


def assignment_generation_user(
    topic: str, subject: str, grade_level: int,
    question_type: str, count: int
) -> str:
    return f"""
Fan: {subject}, {grade_level}-sinf
Mavzu: {topic}
Savol turi: {question_type}
Savollar soni: {count}

JSON formatida vazifa yarat:
{{
  "title": "Vazifa nomi",
  "instructions": "Vazifa bo'yicha ko'rsatma",
  "questions": [
    {{
      "question": "Savol matni",
      "options": ["A", "B", "C", "D"],  // faqat mcq va timed uchun
      "correct_index": 0,               // faqat mcq va timed uchun
      "correct_answer": "...",          // fill va open_answer uchun
      "rubric": "Baholash mezonlari",   // open_answer uchun
      "explanation": "To'g'ri javob izohi",
      "points": 10
    }}
  ]
}}
"""
```

---

## 4.3 — AI Grading Prompts

**Fayl:** `backend/services/prompts/grading_prompts.py`

```python
GRADING_SYSTEM = """Sen tajribali o'qituvchisan. O'quvchi javobini obyektiv baholaysan.
Ball berish mezonlariga qat'iy amal qilasan.
JSON formatida javob ber."""


def grading_user(
    question: str,
    model_answer: str,
    student_answer: str,
    max_points: int,
    rubric: str | None = None,
) -> str:
    rubric_text = f"\nBaholash mezoni: {rubric}" if rubric else ""
    return f"""
Savol: {question}
Model javob: {model_answer}{rubric_text}
O'quvchi javobi: {student_answer}
Maksimal ball: {max_points}

Quyidagi JSON formatida baho ber:
{{
  "score": <0 dan {max_points} gacha>,
  "percentage": <0.0 dan 100.0 gacha>,
  "is_correct": <true yoki false>,
  "feedback": "O'quvchiga shaxsiy izoh (1-2 gap, o'zbek tilida)",
  "strengths": "Yaxshi tomonlari",
  "improvements": "Yaxshilash kerak bo'lgan joylar",
  "explanation": "To'g'ri javobning batafsil izohi"
}}
"""


STATS_ANALYSIS_SYSTEM = """Sen ta'lim tahlilchisisаn. Statistik ma'lumotlarni
oddiy, tushunarli tilda izohlaysan. O'zbek tilida yozasan."""


def stats_analysis_user(stats_data: dict) -> str:
    return f"""
Quyidagi ta'lim statistikasini tahlil qil va o'qituvchiga foydali insights ber:

{stats_data}

Quyidagilarni aytib ber:
1. Eng yaxshi ko'rsatkichlar (2-3 ta)
2. Diqqat talab qiluvchi muammolar (2-3 ta)
3. Tavsiyalar (3-5 ta amaliy tavsiya)
4. Umumiy baho (1-10 ball)

Oddiy, tushunarli tilda yoz. Texnik atamalardan qoching.
"""


GROUP_SPLIT_SYSTEM = """Sen sport va ta'lim musobaqalarini tashkil qiluvchi mutaxassissan.
O'quvchilarni adolatli guruhlarga bo'lasan.
JSON formatida javob ber."""


def group_split_user(students: list[dict], n_groups: int) -> str:
    return f"""
O'quvchilar ma'lumotlari (XP, oxirgi natijalar):
{students}

{n_groups} ta raqobatbardosh guruh tuz.
Har guruhda kuchli, o'rta va zaif o'quvchilar teng bo'lsin.

JSON formatida:
{{
  "groups": [
    {{
      "name": "Guruh 1",
      "color": "#FF5733",
      "members": ["student_id1", "student_id2", ...],
      "reasoning": "Nima uchun bu tarkib adolatli"
    }}
  ]
}}
"""
```

---

## 4.4 — AI Service funksiyalari

**Fayl:** `backend/services/ai_service.py` ga qo'shimcha:

```python
from backend.services.prompts.course_prompts import (
    COURSE_GENERATION_SYSTEM, course_generation_user,
    TOPIC_CONTENT_SYSTEM, topic_content_user,
    ASSIGNMENT_GENERATION_SYSTEM, assignment_generation_user,
)
from backend.services.prompts.grading_prompts import (
    GRADING_SYSTEM, grading_user,
    STATS_ANALYSIS_SYSTEM, stats_analysis_user,
    GROUP_SPLIT_SYSTEM, group_split_user,
)


async def stream_course_generation(
    subject: str, grade_level: int, goal: str, module_count: int = 3,
    **kwargs
) -> AsyncGenerator[str, None]:
    async for chunk in stream_claude(
        system=COURSE_GENERATION_SYSTEM,
        user_message=course_generation_user(subject, grade_level, goal, module_count),
        max_tokens=8000,
        endpoint="generate_course",
        **kwargs,
    ):
        yield chunk


async def generate_topic_content(
    topic_title: str, subject: str, grade_level: int
) -> str:
    """Mavzu uchun Markdown kontent yaratish (streaming emas)."""
    result = []
    async for chunk in stream_claude(
        system=TOPIC_CONTENT_SYSTEM,
        user_message=topic_content_user(topic_title, subject, grade_level),
        max_tokens=3000,
        endpoint="generate_topic",
    ):
        result.append(chunk)
    return "".join(result)


async def grade_submission(
    question: str, model_answer: str, student_answer: str,
    max_points: int, rubric: str | None = None
) -> dict:
    """Ochiq javobni AI bilan baholash."""
    return await get_json_from_claude(
        system=GRADING_SYSTEM,
        user_message=grading_user(question, model_answer, student_answer, max_points, rubric),
        max_tokens=1000,
    )


async def analyze_stats(stats_data: dict) -> str:
    """Statistika tahlili."""
    result = []
    async for chunk in stream_claude(
        system=STATS_ANALYSIS_SYSTEM,
        user_message=stats_analysis_user(stats_data),
        max_tokens=1500,
        endpoint="analyze_stats",
    ):
        result.append(chunk)
    return "".join(result)


async def split_into_groups(students: list[dict], n_groups: int) -> dict:
    """O'quvchilarni adolatli guruhlarga bo'lish."""
    return await get_json_from_claude(
        system=GROUP_SPLIT_SYSTEM,
        user_message=group_split_user(students, n_groups),
        max_tokens=2000,
    )
```

---

## 4.5 — AI Routes

**Mavjud:** `backend/api/routes/ai.py` — yangilash kerak

```python
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from backend.api.deps import get_db, get_current_user, require_teacher
from backend.db.models.user import User
from backend.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


# ─── Kurs Generatsiyasi ────────────────────────────────────────────────────────

class CourseGenerateRequest(BaseModel):
    subject: str
    grade_level: int
    goal: str
    module_count: int = 3


@router.post("/generate-course")
async def generate_course(
    body: CourseGenerateRequest,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """AI bilan to'liq kurs generatsiyasi (SSE streaming)."""
    async def event_generator():
        try:
            async for chunk in ai_service.stream_course_generation(
                subject=body.subject,
                grade_level=body.grade_level,
                goal=body.goal,
                module_count=body.module_count,
                db=db,
                org_id=str(current_user.org_id) if current_user.org_id else None,
                user_id=str(current_user.id),
            ):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ─── Mavzu kontenti ────────────────────────────────────────────────────────────

class TopicGenerateRequest(BaseModel):
    topic_title: str
    subject: str
    grade_level: int


@router.post("/generate-topic")
async def generate_topic_content(
    body: TopicGenerateRequest,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """AI bilan mavzu kontenti yaratish."""
    content = await ai_service.generate_topic_content(
        topic_title=body.topic_title,
        subject=body.subject,
        grade_level=body.grade_level,
    )
    return {"content_md": content}


# ─── Vazifa generatsiyasi ─────────────────────────────────────────────────────

class AssignmentGenerateRequest(BaseModel):
    topic: str
    subject: str
    grade_level: int
    question_type: str = "mcq"
    count: int = 5


@router.post("/generate-assignment")
async def generate_assignment(
    body: AssignmentGenerateRequest,
    current_user: User = Depends(require_teacher),
):
    """AI bilan vazifa generatsiyasi."""
    result = await ai_service.get_json_from_claude(
        system=ai_service.ASSIGNMENT_GENERATION_SYSTEM if hasattr(ai_service, 'ASSIGNMENT_GENERATION_SYSTEM') else "",
        user_message=str(body.model_dump()),
    )
    return result


# ─── Baholash ─────────────────────────────────────────────────────────────────

class GradeRequest(BaseModel):
    submission_id: uuid.UUID
    question: str
    model_answer: str
    student_answer: str
    max_points: int
    rubric: str | None = None


@router.post("/grade")
async def grade_submission(
    body: GradeRequest,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Ochiq javobni AI bilan baholash."""
    result = await ai_service.grade_submission(
        question=body.question,
        model_answer=body.model_answer,
        student_answer=body.student_answer,
        max_points=body.max_points,
        rubric=body.rubric,
    )
    return result


# ─── Statistika tahlili ────────────────────────────────────────────────────────

class StatsAnalysisRequest(BaseModel):
    stats_data: dict


@router.post("/analyze-stats")
async def analyze_stats(
    body: StatsAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard uchun AI tahlil."""
    analysis = await ai_service.analyze_stats(body.stats_data)
    return {"analysis": analysis}


# ─── Guruh ajratish ────────────────────────────────────────────────────────────

class GroupSplitRequest(BaseModel):
    session_id: uuid.UUID | None = None
    class_ids: list[uuid.UUID]   # Qatnashuvchi sinflar
    n_groups: int = 3


@router.post("/split-groups")
async def split_groups(
    body: GroupSplitRequest,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """O'quvchilarni musobaqa uchun adolatli guruhlarga bo'lish."""
    from sqlalchemy import select
    from backend.db.models.class_ import ClassEnrollment
    from backend.db.models.user import User as UserModel

    # O'quvchilar ma'lumotlarini to'plash
    students = []
    for class_id in body.class_ids:
        result = await db.execute(
            select(UserModel).join(
                ClassEnrollment, ClassEnrollment.student_id == UserModel.id
            ).where(ClassEnrollment.class_id == class_id, ClassEnrollment.status == "active")
        )
        for student in result.scalars().all():
            students.append({
                "id": str(student.id),
                "name": student.full_name,
                "xp": student.xp,
                "level": student.level,
            })

    if len(students) < body.n_groups:
        raise HTTPException(400, f"O'quvchilar soni ({len(students)}) guruhlar sonidan ({body.n_groups}) kam")

    groups = await ai_service.split_into_groups(students, body.n_groups)
    return groups
```

---

## 4.6 — Submission dan avtomatik AI grading trigger

`backend/api/routes/assignments.py` da submit bo'lganda:

```python
@router.post("/{assignment_id}/submit")
async def submit_assignment(
    assignment_id: uuid.UUID,
    body: SubmissionCreate,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    # ... submission save qilish ...

    # Ochiq javoblar uchun AI grading trigger
    from backend.db.models.assignment import QuestionType
    if assignment.question_type == QuestionType.open_answer:
        # Background task sifatida ishga tushirish
        import asyncio
        asyncio.create_task(
            _auto_grade_open_answer(submission.id, db)
        )

    # XP berish (MCQ uchun darhol)
    if assignment.question_type in (QuestionType.mcq, QuestionType.timed):
        from backend.services.gamification_service import update_xp_and_streak
        await update_xp_and_streak(current_user.id, xp_delta=20, db=db)

    return submission


async def _auto_grade_open_answer(submission_id: uuid.UUID, db: AsyncSession):
    """Background: Ochiq javobni AI bilan baholash."""
    try:
        from backend.db.models.submission import Submission, SubmissionResult
        from backend.services.ai_service import grade_submission

        submission = await db.get(Submission, submission_id)
        # ... question va model_answer ni olish ...
        # ... grade_submission chaqirish ...
        # ... SubmissionResult yangilash ...
        pass
    except Exception as e:
        print(f"AI grading error: {e}")
```

---

## Muvaffaqiyat mezoni

- [ ] `POST /api/v1/ai/generate-course` → SSE stream JSON kurs strukturasi qaytaradi
- [ ] `POST /api/v1/ai/generate-topic` → Markdown kontent qaytaradi (kamida 500 so'z)
- [ ] `POST /api/v1/ai/generate-assignment` → JSON vazifalar ro'yxati
- [ ] `POST /api/v1/ai/grade` → `{score, feedback, is_correct}` qaytaradi
- [ ] `POST /api/v1/ai/split-groups` → `{groups: [{name, members, reasoning}]}`
- [ ] `AILog` jadvalga har AI call dan keyin yozuv tushadi
- [ ] Org token limit oshganda `400` xato
- [ ] Rate limit: 20 req/min/user oshsa `429` xato
