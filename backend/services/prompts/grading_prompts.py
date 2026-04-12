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


STATS_ANALYSIS_SYSTEM = """Sen ta'lim tahlilchisisan. Statistik ma'lumotlarni
oddiy, tushunarli tilda izohlaysan. O'zbek tilida yozasan."""


def stats_analysis_user(stats_data: dict) -> str:
    import json
    return f"""
Quyidagi ta'lim statistikasini tahlil qil va o'qituvchiga foydali insights ber:

{json.dumps(stats_data, ensure_ascii=False, indent=2)}

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
    import json
    return f"""
O'quvchilar ma'lumotlari (XP, oxirgi natijalar):
{json.dumps(students, ensure_ascii=False, indent=2)}

{n_groups} ta raqobatbardosh guruh tuz.
Har guruhda kuchli, o'rta va zaif o'quvchilar teng bo'lsin.

JSON formatida:
{{
  "groups": [
    {{
      "name": "Guruh 1",
      "color": "#FF5733",
      "members": ["student_id1", "student_id2"],
      "reasoning": "Nima uchun bu tarkib adolatli"
    }}
  ]
}}
"""
