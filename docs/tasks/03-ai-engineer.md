# AI / Prompt Engineer — Vazifalar ro'yxati

**Rol:** AI / Prompt Engineer
**Texnologiyalar:** Anthropic SDK (claude-sonnet-4-6), Pydantic v2, SSE, Redis, Celery
**Asosiy model:** `claude-sonnet-4-6` (zaxira: `gpt-4o`)

> Qaramlik: AI Engineer asosan Backend bilan birgalikda ishlaydi (BE-P5).
> Promptlar va Pydantic sxemalari **Backend bilan parallel** tayyorlanishi mumkin.

---

## Phase 0 — Setup `[DARHOL, ~1 soat, Kun 1 08:00–09:00]`

> Barcha boshqa rollar bilan **parallel**.

- [ ] **AI-00-1** — `anthropic` SDK o'rnatish va tekshirish:
  ```bash
  uv add anthropic
  python -c "import anthropic; client = anthropic.Anthropic(); print('OK')"
  ```
- [ ] **AI-00-2** — API kalitini `.env` da tekshirish + `ANTHROPIC_API_KEY` validation:
  ```python
  import os
  assert os.getenv("ANTHROPIC_API_KEY", "").startswith("sk-ant-"), "API key topilmadi"
  ```
- [ ] **AI-00-3** — Async streaming wrapper yaratish (`backend/services/ai_client.py`):
  ```python
  import anthropic
  from typing import AsyncGenerator

  client = anthropic.AsyncAnthropic()
  MODEL = "claude-sonnet-4-6"

  async def stream_claude(
      system: str,
      user: str,
      max_tokens: int = 4096,
  ) -> AsyncGenerator[str, None]:
      async with client.messages.stream(
          model=MODEL,
          max_tokens=max_tokens,
          system=system,
          messages=[{"role": "user", "content": user}],
      ) as stream:
          async for text in stream.text_stream:
              yield text
  ```
- [ ] **AI-00-4** — JSON parser + retry funksiyasi:
  ```python
  import json, re

  async def get_json_response(system: str, user: str, schema_class, retries: int = 2):
      for attempt in range(retries):
          full_text = ""
          async for chunk in stream_claude(system, user):
              full_text += chunk
          try:
              # JSON extraction (code block ichida bo'lishi mumkin)
              json_match = re.search(r'\{.*\}', full_text, re.DOTALL)
              if json_match:
                  data = json.loads(json_match.group())
                  return schema_class(**data)
          except (json.JSONDecodeError, ValueError):
              if attempt == retries - 1:
                  raise
      raise ValueError("JSON parse xatosi")
  ```
- [ ] **AI-00-5** — Test: oddiy Claude chaqiruv ishlashini tekshirish
  ```python
  # python -m backend.services.ai_client (simple test script)
  ```

**Muvaffaqiyat:** Claude API ga so'rov jo'natilib, javob keladi.

---

## Phase 1 — Kurs Generatsiyasi `[~2 soat, Kun 1 14:00–16:00]`

> BE-00 (setup) tayyor bo'lgandan keyin. BE-P3 bilan **parallel** ishlanishi mumkin.

- [ ] **AI-01-1** — System prompt (kurs generatsiyasi):
  ```
  Sen tajribali o'zbek tili o'qituvchisisang va kurs ishlab chiqaruvchisisan.
  Faqat JSON formatda javob ber. Boshqa hech narsa yozma.
  Javob o'zbek tilida bo'lsin.
  Modul mazmuni (content_md) markdown formatida, kamida 200 so'z bo'lsin.
  ```
- [ ] **AI-01-2** — User prompt template:
  ```
  Fan: {subject}
  O'quvchilar darajasi: {level}  (boshlang'ich / o'rta / yuqori)
  Kurs maqsadi: {goal}
  Modullar soni: {module_count} ta (3-10 orasida)

  Quyidagi JSON strukturasini qat'iy bajaring:
  {{
    "title": "Kurs nomi",
    "description": "Kurs tavsifi (2-3 jumla)",
    "modules": [
      {{
        "title": "Modul nomi",
        "content_md": "# Sarlavha\n\nMarkdown mazmun...",
        "order": 1
      }}
    ]
  }}
  ```
- [ ] **AI-01-3** — Pydantic sxemalari (`backend/schemas/ai_responses.py`):
  ```python
  from pydantic import BaseModel, Field

  class ModuleResponse(BaseModel):
      title: str
      content_md: str = Field(min_length=50)
      order: int

  class CourseGenerationResponse(BaseModel):
      title: str
      description: str
      modules: list[ModuleResponse] = Field(min_length=1, max_length=10)
  ```
- [ ] **AI-01-4** — SSE streaming funksiyasi (`backend/services/ai_service.py`):
  ```python
  async def stream_course_generation(
      subject: str, level: str, goal: str, module_count: int
  ) -> AsyncGenerator[str, None]:
      system = COURSE_GENERATION_SYSTEM_PROMPT
      user = COURSE_GENERATION_USER_TEMPLATE.format(
          subject=sanitize_input(subject),
          level=level,
          goal=sanitize_input(goal),
          module_count=module_count,
      )
      async for chunk in stream_claude(system, user):
          yield chunk
  ```
- [ ] **AI-01-5** — Stream tugagandan keyin JSON ni parse qilib DB ga saqlash logikasi
- [ ] **AI-01-6** — Test: "Matematika, 8-sinf, Algebra" prompt bilan sinov

**Muvaffaqiyat:** Kurs generatsiyasi prompta "Matematika" yuborilsa → 5 ta modul bilan JSON keladi.

---

## Phase 2 — Vazifa Generatsiyasi (6 format) `[~3 soat, Kun 1 14:00–17:00]`

> AI-P1 bilan **parallel** yoki ketma-ket. BE-P4 bilan birgalikda.

### System prompt (barcha formatlar uchun umumiy):
```
Sen {subject} fani bo'yicha pedagogik jihatdan to'g'ri savol yaratuvchi AI sisan.
Faqat JSON formatda javob ber. Boshqa hech narsa yozma.
Barcha matnlar o'zbek tilida bo'lsin.
Savollar {difficulty} darajasiga mos bo'lsin.
```

- [ ] **AI-02-1** — **MCQ (Ko'p tanlov)** prompt + Pydantic sxema:
  ```python
  class MCQQuestion(BaseModel):
      question: str
      options: list[str] = Field(min_length=4, max_length=4)
      correct_index: int = Field(ge=0, le=3)
      explanation: str  # noto'g'ri javob uchun yo'nalish

  class MCQGenerationResponse(BaseModel):
      questions: list[MCQQuestion]

  # User prompt:
  # Mavzu: {topic}. Daraja: {difficulty}. {count} ta MCQ savol yarat.
  ```
- [ ] **AI-02-2** — **Fill-in-blank (Bo'shliq to'ldirish)** prompt + sxema:
  ```python
  class BlankItem(BaseModel):
      position: int  # jumladagi tartib raqami
      answers: list[str]  # to'g'ri javoblar (sinonimlar)

  class FillQuestion(BaseModel):
      text_with_blanks: str  # "O'simlik ___ va ___ dan foydalanadi"
      blanks: list[BlankItem]
  ```
- [ ] **AI-02-3** — **Matching (Juftlashtirish)** prompt + sxema:
  ```python
  class MatchPair(BaseModel):
      left: str
      right: str

  class MatchQuestion(BaseModel):
      pairs: list[MatchPair] = Field(min_length=3, max_length=6)
      distractors: list[str] = Field(max_length=2)  # chalg'ituvchi variantlar
  ```
- [ ] **AI-02-4** — **Ordering (Tartibga solishtirish)** prompt + sxema:
  ```python
  class OrderItem(BaseModel):
      text: str
      correct_order: int  # 1 dan boshlanadi

  class OrderQuestion(BaseModel):
      question: str  # "Quyidagilarni to'g'ri tartibga soling:"
      items: list[OrderItem] = Field(min_length=3, max_length=7)
  ```
- [ ] **AI-02-5** — **Open Answer (Ochiq savol)** prompt + sxema:
  ```python
  class RubricCriterion(BaseModel):
      name: str  # "Mazmun aniqligi"
      points: int  # maksimal ball

  class Rubric(BaseModel):
      criteria: list[RubricCriterion]
      total_points: int

  class OpenQuestion(BaseModel):
      question: str
      model_answer: str  # etalon javob
      rubric: Rubric
  ```
- [ ] **AI-02-6** — **Timed Quiz** — MCQ sxemasi bilan bir xil, faqat `time_limit` kontekst qo'shiladi:
  ```
  # User prompt ga qo'shish: "Savollar qisqa va aniq bo'lsin (vaqtli musobaqa uchun)"
  ```
- [ ] **AI-02-7** — Unified `generate_questions()` funksiyasi:
  ```python
  async def generate_questions(
      topic: str,
      difficulty: str,
      question_type: str,  # mcq/fill/match/order/open/timed
      count: int,
      subject: str,
  ) -> list[dict]:
      # question_type bo'yicha to'g'ri prompt va sxema tanlanadi
  ```
- [ ] **AI-02-8** — Har format uchun individual test (manual)

**Muvaffaqiyat:** Barcha 6 format uchun generatsiya ishlaydi, JSON to'g'ri parse bo'ladi.

---

## Phase 3 — Avtomatik Baholash `[~2 soat, Kun 2 08:00–10:00]`

> BE-P5 submission endpoint bilan **birgalikda** ishlash kerak.

- [ ] **AI-03-1** — System prompt (baholash):
  ```
  Sen o'quvchi javobini baholovchi adolatli va aniq AI sisan.
  Faqat JSON formatda javob ber.
  Noto'g'ri javobda ham to'g'ri javobni to'g'ridan-to'g'ri aytma — yo'nalish ko'rsat.
  feedback_uz doim o'zbek tilida, rag'batlantiruvchi tarzda bo'lsin.
  ```
- [ ] **AI-03-2** — User prompt template:
  ```
  Savol: {question}
  To'g'ri javob / Rubrika: {correct_answer}
  O'quvchi javobi: {student_answer}
  Maksimal ball: {max_points}

  JSON:
  {{
    "score": <0 dan max_points gacha>,
    "is_correct": <true/false>,
    "feedback_uz": "<rag'batlantiruvchi izoh>",
    "improvement_tips": "<qanday yaxshilash mumkin>",
    "xp_earned": <0 dan 50 gacha>
  }}
  ```
- [ ] **AI-03-3** — Pydantic sxema:
  ```python
  class GradeResult(BaseModel):
      score: int = Field(ge=0)
      is_correct: bool
      feedback_uz: str
      improvement_tips: str
      xp_earned: int = Field(ge=0, le=50)

      @validator('score')
      def score_within_max(cls, v, values):
          # max_points ga qarab tekshirish (context dan olish)
          return v
  ```
- [ ] **AI-03-4** — `grade_answer()` funksiyasi (async, non-streaming):
  ```python
  async def grade_answer(
      question: str,
      correct_answer: str,
      student_answer: str,
      max_points: int,
  ) -> GradeResult:
      result = await get_json_response(
          system=GRADING_SYSTEM_PROMPT,
          user=GRADING_USER_TEMPLATE.format(...),
          schema_class=GradeResult,
      )
      # XP formulasi: max(0, int((result.score / max_points) * 50))
      return result
  ```
- [ ] **AI-03-5** — Fill-in-blank uchun maxsus semantik tekshiruv:
  ```python
  # "CO2" va "karbonat angidrid" ikkisi ham to'g'ri hisoblanishi kerak
  # Claude ga: "Quyidagi javoblar semantik jihatdan to'g'rimi?"
  ```
- [ ] **AI-03-6** — Test: "Fotosintez" savoli → o'quvchi javobi → baho

**Muvaffaqiyat:** Open answer submission → 3-5 soniya ichida AI ball va izoh qaytaradi.

---

## Phase 4 — Kesh va Optimizatsiya `[~1 soat, Kun 2 13:00–14:00]`

- [ ] **AI-04-1** — Redis kesh — takroriy so'rovlar uchun:
  ```python
  import hashlib, json
  from redis.asyncio import Redis

  async def cached_generate(key_data: dict, generator_fn, ttl: int = 3600):
      cache_key = "ai:" + hashlib.sha256(
          json.dumps(key_data, sort_keys=True).encode()
      ).hexdigest()
      cached = await redis.get(cache_key)
      if cached:
          return json.loads(cached)
      result = await generator_fn()
      await redis.setex(cache_key, ttl, json.dumps(result))
      return result
  ```
- [ ] **AI-04-2** — `AILog` DB insert (har AI chaqiruvdan keyin):
  ```python
  await ai_log_repo.create({
      "user_id": current_user.id,
      "endpoint": "course_generation",
      "prompt_hash": hashlib.sha256(prompt.encode()).hexdigest(),
      "tokens_used": response.usage.total_tokens,
      "response_ms": int((end_time - start_time) * 1000),
  })
  ```
- [ ] **AI-04-3** — Celery task wrapper (kurs generatsiyasi uchun — og'ir so'rov):
  ```python
  from celery import shared_task

  @shared_task
  def generate_course_task(subject, level, goal, module_count, user_id):
      # asyncio.run() ichida stream_course_generation chaqiradi
      # Natijani Redis da saqlab, task_id qaytaradi
  ```
- [ ] **AI-04-4** — Prompt injection himoyasi:
  ```python
  import bleach, re

  def sanitize_ai_input(text: str, max_length: int = 500) -> str:
      # HTML teglarini tozalash
      clean = bleach.clean(text, tags=[], strip=True)
      # Prompt inject urinishlari filtrlash
      dangerous = ['ignore previous', 'disregard', 'system:', 'assistant:']
      for pattern in dangerous:
          clean = re.sub(pattern, '[filtered]', clean, flags=re.IGNORECASE)
      return clean[:max_length]
  ```

**Muvaffaqiyat:** Bir xil so'rov 2-marta yuborilsa → Redis dan qaytadi (< 50ms).

---

## Muhim eslatmalar

### Barcha AI javoblar o'zbek tilida:
- `feedback_uz` maydoni har doim o'zbekcha
- Kurs mazmuni `content_md` o'zbekcha
- Savollar o'zbekcha

### Noto'g'ri javobda to'g'ri javobni bermang:
```
❌ Noto'g'ri: "Javob 'B' edi, chunki..."
✅ To'g'ri: "Yaqin! Kimyo reaksiyasidagi massani saqlash qonunini ko'rib chiqing..."
```

### JSON sxema buzilsa — retry:
- 1-urinish muvaffaqiyatsiz → yangi so'rov yuboriladi
- 2-urinish ham muvaffaqiyatsiz → 500 xato + log

### Token iqtisodi:
- Kurs generatsiyasi: max_tokens=4096
- Vazifa generatsiyasi: max_tokens=2048
- Baholash: max_tokens=512

---

## Fayllar ro'yxati:

```
backend/
├── services/
│   ├── ai_client.py          ← AI-00-3,4 (Claude wrapper)
│   ├── ai_service.py         ← AI-01,02,03 (barcha AI funksiyalar)
│   └── cache_service.py      ← AI-04-1 (Redis kesh)
└── schemas/
    └── ai_responses.py       ← AI-01-3, AI-02-1..6, AI-03-3
```
