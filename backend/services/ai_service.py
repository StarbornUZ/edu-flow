"""AI servis — GPT-4o asosiy, Claude Sonnet zaxira (fallback).

Qo'llab-quvvatlanadigan tillar:
  "uz" — O'zbek tili (standart)
  "ru" — Rus tili
  "en" — Ingliz tili

Uchta asosiy funksiya:
  stream_course_generation     → kurs strukturasini SSE orqali generatsiya qiladi
  stream_assignment_generation → vazifa savollarini SSE orqali generatsiya qiladi
  grade_open_answer            → ochiq javobni AI bilan baholaydi
"""
from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Literal

import anthropic
import bleach
import openai
from anthropic.types import TextBlock
from openai.types.chat.chat_completion_stream_options_param import ChatCompletionStreamOptionsParam

from backend.core.config import ANTHROPIC_API_KEY, OPENAI_API_KEY

# ---------------------------------------------------------------------------
# Til sozlamalari
# ---------------------------------------------------------------------------

Language = Literal["uz", "ru", "en"]

_LANG_INSTRUCTION: dict[str, str] = {
    "uz": "Barcha matnlarni O'ZBEK tilida yoz.",
    "ru": "Весь текст пиши на РУССКОМ языке.",
    "en": "Write all text in ENGLISH.",
}

_LANG_LEVEL_LABELS: dict[str, dict[str, str]] = {
    "uz": {"beginner": "boshlang'ich", "intermediate": "o'rta", "advanced": "yuqori"},
    "ru": {"beginner": "начальный", "intermediate": "средний", "advanced": "продвинутый"},
    "en": {"beginner": "beginner", "intermediate": "intermediate", "advanced": "advanced"},
}


def lang_instruction(lang: Language) -> str:
    return _LANG_INSTRUCTION.get(lang, _LANG_INSTRUCTION["uz"])


# ---------------------------------------------------------------------------
# OpenAI client (lazy singleton)
# ---------------------------------------------------------------------------

_openai_client: openai.AsyncOpenAI | None = None


def _get_openai() -> openai.AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
    assert _openai_client is not None
    return _openai_client


# ---------------------------------------------------------------------------
# Anthropic client (lazy singleton) — fallback
# ---------------------------------------------------------------------------

_anthropic_client: anthropic.AsyncAnthropic | None = None


def _get_anthropic() -> anthropic.AsyncAnthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    assert _anthropic_client is not None
    return _anthropic_client


# ---------------------------------------------------------------------------
# Prompt sanitizatsiya
# ---------------------------------------------------------------------------

def sanitize_input(text: str, max_length: int = 2000) -> str:
    """HTML taglar va prompt injection urinishlarini tozalaydi."""
    cleaned = bleach.clean(str(text), tags=[], strip=True)
    return cleaned[:max_length]


def _prompt_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Grading result
# ---------------------------------------------------------------------------

@dataclass
class GradeResult:
    score: float
    is_correct: bool
    feedback: str      # Tanlangan tilda feedback
    xp_earned: int


# ---------------------------------------------------------------------------
# Internal streaming helpers
# ---------------------------------------------------------------------------

async def _openai_stream(
    system: str,
    user: str,
    max_tokens: int = 4096,
) -> AsyncGenerator[tuple[str, int, int], None]:
    """GPT-4o dan stream qilib chunk, tokens, ms qaytaradi.

    Yields (chunk_text, tokens_used, elapsed_ms).
    tokens_used faqat oxirgi chunkda nol bo'lmaydi.
    """
    start_ms = int(time.time() * 1000)
    total_tokens = 0

    _msgs: list[Any] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    stream = await _get_openai().chat.completions.create(
        model="gpt-4o",
        max_tokens=max_tokens,
        stream=True,
        stream_options=ChatCompletionStreamOptionsParam(include_usage=True),
        messages=_msgs,
    )

    async for chunk in stream:
        choices = chunk.choices
        if choices:
            text = choices[0].delta.content
            if text:
                yield text, 0, 0
        if chunk.usage:
            total_tokens = chunk.usage.total_tokens

    elapsed_ms = int(time.time() * 1000) - start_ms
    yield "", total_tokens, elapsed_ms


async def _anthropic_stream(
    system: str,
    user: str,
    max_tokens: int = 4096,
) -> AsyncGenerator[tuple[str, int, int], None]:
    """Claude Sonnet dan stream qilib chunk, tokens, ms qaytaradi."""
    start_ms = int(time.time() * 1000)
    total_tokens = 0

    _msgs: list[Any] = [{"role": "user", "content": user}]
    async with _get_anthropic().messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        system=system,
        messages=_msgs,
    ) as stream:
        async for text in stream.text_stream:
            yield text, 0, 0
        final = await stream.get_final_message()
        total_tokens = final.usage.input_tokens + final.usage.output_tokens

    elapsed_ms = int(time.time() * 1000) - start_ms
    yield "", total_tokens, elapsed_ms


async def _stream_with_fallback(
    system: str,
    user: str,
    max_tokens: int = 4096,
) -> AsyncGenerator[tuple[str, int, int], None]:
    """GPT-4o bilan stream; xatolik bo'lsa Claude ga o'tadi.

    Yields (chunk_text, tokens_used, elapsed_ms).
    """
    if not OPENAI_API_KEY:
        # OpenAI kaliti yo'q — to'g'ridan Claude ishlatilsin
        async for item in _anthropic_stream(system, user, max_tokens):
            yield item
        return

    try:
        async for item in _openai_stream(system, user, max_tokens):
            yield item
    except (openai.APIError, openai.APIConnectionError, openai.RateLimitError):
        # GPT-4o xatolik — Claude ga fallback
        async for item in _anthropic_stream(system, user, max_tokens):
            yield item


# ---------------------------------------------------------------------------
# Public streaming wrapper (yields SSE-ready chunks + [DONE] + [META])
# ---------------------------------------------------------------------------

async def _public_stream(
    system: str,
    user: str,
    max_tokens: int = 4096,
) -> AsyncGenerator[str, None]:
    """_stream_with_fallback ni SSE-ready formatga o'giradi.

    Yields:
        text_chunk — oddiy matn
        "[DONE]"   — stream tugadi
        "[META]hash:tokens:ms" — caller uchun AILog ma'lumoti
    """
    total_tokens = 0
    elapsed_ms = 0
    ph = _prompt_hash(system + user)

    async for chunk, tok, ms in _stream_with_fallback(system, user, max_tokens):
        if chunk:
            yield chunk
        if tok:
            total_tokens = tok
        if ms:
            elapsed_ms = ms

    yield "[DONE]"
    yield f"[META]{ph}:{total_tokens}:{elapsed_ms}"


# ---------------------------------------------------------------------------
# Course generation
# ---------------------------------------------------------------------------

_COURSE_SYSTEM = """\
You are an experienced curriculum designer for schools and universities.
Generate a course structure in JSON format.
{lang_instruction}

RESPONSE FORMAT (JSON only, no other text):
{{
  "title": "Course title",
  "description": "Course description (2-3 sentences)",
  "modules": [
    {{
      "title": "Module title",
      "description": "Brief module description",
      "order_num": 1
    }}
  ]
}}"""


async def stream_course_generation(
    subject: str,
    level: str,
    goal: str,
    module_count: int,
    language: Language = "uz",
) -> AsyncGenerator[str, None]:
    """Kurs strukturasini token-token stream qilib qaytaradi."""
    subject = sanitize_input(subject)
    level = sanitize_input(level)
    goal = sanitize_input(goal)

    system = _COURSE_SYSTEM.format(lang_instruction=lang_instruction(language))

    user = (
        f"Subject: {subject}\n"
        f"Level: {level}\n"
        f"Goal: {goal}\n"
        f"Number of modules: {module_count}\n\n"
        "Create the course structure in JSON format. JSON only, no markdown."
    )

    async for chunk in _public_stream(system, user, max_tokens=2048):
        yield chunk


# ---------------------------------------------------------------------------
# Assignment generation
# ---------------------------------------------------------------------------

_ASSIGNMENT_SYSTEMS: dict[str, str] = {
    "mcq": """\
You are an expert quiz creator. Generate multiple-choice questions in JSON format.
{lang_instruction}

RESPONSE FORMAT (JSON only):
{{
  "questions": [
    {{
      "question_text": "Question text",
      "options_json": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer_json": "Exact text of the correct option",
      "explanation": "Why this is correct"
    }}
  ]
}}""",

    "fill": """\
You are an expert at creating fill-in-the-blank exercises. JSON format.
{lang_instruction}

RESPONSE FORMAT (JSON only):
{{
  "questions": [
    {{
      "question_text": "Sentence with {{{{___}}}} blank.",
      "options_json": null,
      "correct_answer_json": ["correct answer", "accepted variant"],
      "explanation": "Explanation"
    }}
  ]
}}""",

    "matching": """\
You are an expert at creating matching exercises. JSON format.
{lang_instruction}

RESPONSE FORMAT (JSON only):
{{
  "questions": [
    {{
      "question_text": "Match the items",
      "options_json": {{"left": ["A", "B", "C"], "right": ["1", "2", "3"]}},
      "correct_answer_json": {{"A": "1", "B": "2", "C": "3"}},
      "explanation": "Explanation"
    }}
  ]
}}""",

    "ordering": """\
You are an expert at creating sequencing/ordering exercises. JSON format.
{lang_instruction}

RESPONSE FORMAT (JSON only):
{{
  "questions": [
    {{
      "question_text": "Put the steps in the correct order",
      "options_json": ["Step 3", "Step 1", "Step 2"],
      "correct_answer_json": ["Step 1", "Step 2", "Step 3"],
      "explanation": "Explanation"
    }}
  ]
}}""",

    "open_answer": """\
You are an expert at creating open-ended questions. JSON format.
{lang_instruction}

RESPONSE FORMAT (JSON only):
{{
  "questions": [
    {{
      "question_text": "Question text",
      "options_json": null,
      "correct_answer_json": "Full model answer",
      "rubric_json": {{"criteria": [{{"name": "Understanding", "points": 5}}, {{"name": "Example", "points": 5}}]}},
      "explanation": "Grading criteria"
    }}
  ]
}}""",
}

# timed = mcq bilan bir xil format
_ASSIGNMENT_SYSTEMS["timed"] = _ASSIGNMENT_SYSTEMS["mcq"]


async def stream_assignment_generation(
    topic: str,
    difficulty: str,
    question_type: str,
    count: int,
    language: Language = "uz",
) -> AsyncGenerator[str, None]:
    """Vazifa savollarini token-token stream qilib qaytaradi."""
    topic = sanitize_input(topic)
    difficulty = sanitize_input(difficulty)

    q_type = question_type if question_type in _ASSIGNMENT_SYSTEMS else "mcq"
    system = _ASSIGNMENT_SYSTEMS[q_type].format(lang_instruction=lang_instruction(language))

    user = (
        f"Topic: {topic}\n"
        f"Difficulty: {difficulty}\n"
        f"Number of questions: {count}\n\n"
        "Return JSON only. No markdown fences, no extra text."
    )

    async for chunk in _public_stream(system, user, max_tokens=4096):
        yield chunk


# ---------------------------------------------------------------------------
# Open answer grading
# ---------------------------------------------------------------------------

_GRADING_SYSTEM = """\
You are a fair teacher grading a student's open-ended answer.
{lang_instruction}

Return the grading result as JSON only (no markdown):
{{
  "score": 7.5,
  "is_correct": true,
  "feedback": "Constructive feedback in 1-3 sentences."
}}

Rules:
- score must be between 0.0 and max_points (inclusive)
- is_correct is true when score >= max_points * 0.6
- feedback must be in the language specified above, constructive and specific"""


async def grade_open_answer(
    question_text: str,
    model_answer: str,
    student_answer: str,
    max_points: float,
    language: Language = "uz",
) -> GradeResult:
    """Ochiq javobni AI yordamida baholaydi (GPT-4o, fallback → Claude)."""
    import json

    question_text = sanitize_input(question_text, 1000)
    model_answer = sanitize_input(model_answer, 1000)
    student_answer = sanitize_input(student_answer, 1000)

    system = _GRADING_SYSTEM.format(lang_instruction=lang_instruction(language))
    user = (
        f"Question: {question_text}\n"
        f"Model answer: {model_answer}\n"
        f"Student answer: {student_answer}\n"
        f"Max points: {max_points}\n\n"
        "Return grading JSON only."
    )

    raw_text = ""

    _oai_msgs: list[Any] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

    # GPT-4o birinchi urinish
    if OPENAI_API_KEY:
        try:
            response = await _get_openai().chat.completions.create(
                model="gpt-4o",
                max_tokens=512,
                messages=_oai_msgs,
            )
            raw_text = response.choices[0].message.content or ""
        except (openai.APIError, openai.APIConnectionError, openai.RateLimitError):
            raw_text = ""

    # Fallback → Claude
    if not raw_text:
        _ant_msgs: list[Any] = [{"role": "user", "content": user}]
        message = await _get_anthropic().messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            system=system,
            messages=_ant_msgs,
        )
        first_block = message.content[0] if message.content else None
        raw_text = first_block.text if isinstance(first_block, TextBlock) else ""

    # JSON parse
    try:
        raw = raw_text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        score = float(data.get("score", 0))
        score = max(0.0, min(score, max_points))
        is_correct = bool(data.get("is_correct", score >= max_points * 0.6))
        feedback = str(data.get("feedback", ""))
    except (json.JSONDecodeError, KeyError, ValueError):
        score = 0.0
        is_correct = False
        feedback = {
            "uz": "Javob baholanmadi. O'qituvchi ko'rib chiqadi.",
            "ru": "Ответ не оценён. Преподаватель проверит.",
            "en": "Answer could not be graded. Teacher will review.",
        }.get(language, "Grading failed.")

    xp = int((score / max_points) * 50) if max_points > 0 else 0
    return GradeResult(
        score=round(score, 2),
        is_correct=is_correct,
        feedback=feedback,
        xp_earned=xp,
    )


# ---------------------------------------------------------------------------
# Helpers for callers
# ---------------------------------------------------------------------------

def make_prompt_hash(text: str) -> str:
    return _prompt_hash(text)


# ---------------------------------------------------------------------------
# Phase 4: New AI functions (Claude Sonnet 4.6 direct)
# ---------------------------------------------------------------------------

MODEL_CLAUDE = "claude-sonnet-4-6"


async def stream_claude(
    system: str,
    user_message: str,
    max_tokens: int = 4096,
    db=None,
    org_id=None,
    user_id=None,
    endpoint: str = "unknown",
):
    """
    Claude Sonnet 4.6 bilan SSE streaming.
    db + org_id berilsa — token limit tekshiriladi va log yoziladi.
    """
    import time
    import hashlib
    from sqlalchemy import update as sql_update

    # Org budget tekshiruvi
    if db and org_id:
        from backend.db.models.organization import Organization
        org = await db.get(Organization, org_id)
        if org and org.ai_token_limit and org.ai_tokens_used >= org.ai_token_limit:
            raise Exception("AI token limiti tugadi. Org-admin bilan bog'laning.")

    start = time.time()
    full_text = ""
    input_tokens = 0
    output_tokens = 0

    client = _get_anthropic()
    async with client.messages.stream(
        model=MODEL_CLAUDE,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        async for text in stream.text_stream:
            full_text += text
            yield text

        final_msg = await stream.get_final_message()
        input_tokens = final_msg.usage.input_tokens
        output_tokens = final_msg.usage.output_tokens

    # Log yozish
    if db and user_id:
        from backend.db.models.submission import AILog
        log = AILog(
            user_id=user_id,
            endpoint=endpoint,
            prompt_hash=hashlib.sha256(user_message.encode()).hexdigest(),
            tokens_used=input_tokens + output_tokens,
            response_ms=int((time.time() - start) * 1000),
        )
        db.add(log)

        if org_id:
            from sqlalchemy import update as _update
            from backend.db.models.organization import Organization
            await db.execute(
                _update(Organization)
                .where(Organization.id == org_id)
                .values(ai_tokens_used=Organization.ai_tokens_used + input_tokens + output_tokens)
            )
        await db.commit()


async def get_json_from_claude(
    system: str, user_message: str, max_tokens: int = 4096
) -> dict | list:
    """Claude dan JSON javob olish (streaming emas)."""
    import json
    import re
    client = _get_anthropic()
    message = await client.messages.create(
        model=MODEL_CLAUDE,
        max_tokens=max_tokens,
        system=system + "\n\nFaqat JSON format bilan javob ber. Hech qanday izoh yozma.",
        messages=[{"role": "user", "content": user_message}],
    )
    text = message.content[0].text
    match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    return json.loads(text)


async def generate_topic_content(
    topic_title: str, subject: str, grade_level: int
) -> str:
    """Mavzu uchun Markdown kontent yaratish."""
    from backend.services.prompts.course_prompts import TOPIC_CONTENT_SYSTEM, topic_content_user
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
    """Ochiq javobni AI bilan baholash — JSON dict qaytaradi."""
    from backend.services.prompts.grading_prompts import GRADING_SYSTEM, grading_user
    return await get_json_from_claude(
        system=GRADING_SYSTEM,
        user_message=grading_user(question, model_answer, student_answer, max_points, rubric),
        max_tokens=1000,
    )


async def analyze_stats(stats_data: dict) -> str:
    """Statistika tahlili — matn qaytaradi."""
    from backend.services.prompts.grading_prompts import STATS_ANALYSIS_SYSTEM, stats_analysis_user
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
    from backend.services.prompts.grading_prompts import GROUP_SPLIT_SYSTEM, group_split_user
    return await get_json_from_claude(
        system=GROUP_SPLIT_SYSTEM,
        user_message=group_split_user(students, n_groups),
        max_tokens=2000,
    )
