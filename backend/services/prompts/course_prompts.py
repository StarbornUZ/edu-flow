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
              "type": "mcq",
              "questions": [
                {{
                  "question": "Savol matni",
                  "options": ["A variant", "B variant", "C variant", "D variant"],
                  "correct_index": 0,
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
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "correct_answer": "...",
      "rubric": "Baholash mezonlari",
      "explanation": "To'g'ri javob izohi",
      "points": 10
    }}
  ]
}}
"""
