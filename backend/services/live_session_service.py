import uuid
import json
from typing import Any
from fastapi import WebSocket
from collections import defaultdict


class ConnectionManager:
    """In-memory WebSocket room boshqaruvchi."""

    def __init__(self):
        # session_id → {user_id: WebSocket}
        self.rooms: dict[str, dict[str, WebSocket]] = defaultdict(dict)

    async def connect(self, session_id: str, user_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms[session_id][user_id] = ws

    def disconnect(self, session_id: str, user_id: str):
        self.rooms[session_id].pop(user_id, None)
        if not self.rooms.get(session_id):
            self.rooms.pop(session_id, None)

    async def send_to(self, session_id: str, user_id: str, data: dict):
        """Bitta foydalanuvchiga yuborish."""
        ws = self.rooms[session_id].get(user_id)
        if ws:
            await ws.send_json(data)

    async def broadcast(self, session_id: str, data: dict, exclude: str | None = None):
        """Barcha qatnashchilarga yuborish."""
        for uid, ws in list(self.rooms.get(session_id, {}).items()):
            if uid != exclude:
                try:
                    await ws.send_json(data)
                except Exception:
                    pass

    def get_connected_count(self, session_id: str) -> int:
        return len(self.rooms.get(session_id, {}))


# Global instance
manager = ConnectionManager()


class GameEngine:
    """Har bir musobaqa turi uchun logika."""

    @staticmethod
    def calculate_blitz_score(is_correct: bool, time_taken_ms: int, time_limit_ms: int) -> int:
        """Blitz Jang: tez javob = ko'proq ball."""
        if not is_correct:
            return 0
        max_score = 1000
        min_score = 200
        ratio = max(0, 1 - time_taken_ms / max(time_limit_ms, 1))
        return int(min_score + (max_score - min_score) * ratio)

    @staticmethod
    def calculate_relay_score(is_correct: bool, is_steal: bool) -> int:
        """Zanjir Savol: steal uchun bonus."""
        if not is_correct:
            return 0
        return 15 if is_steal else 10

    @staticmethod
    def calculate_lucky_card_score(card_type: str, is_correct: bool = False) -> tuple[int, int]:
        """Omadli Kartalar: (score, xp) juftligini qaytaradi.

        card_type:
          "a" — test savoli: to'g'ri=+10pts/+10xp, noto'g'ri=0/0
          "b" — omadli karta: +12pts/+2xp (savolsiz)
          "c" — omadsiz karta: 0/0 (savolsiz)
        """
        if card_type == "b":
            return (12, 2)
        elif card_type == "a" and is_correct:
            return (10, 10)
        return (0, 0)

    @staticmethod
    def calculate_pyramid_score(level: int, is_correct: bool) -> int:
        """Piramida: yuqori daraja = ko'proq ball, noto'g'ri = ball ayiriladi."""
        points = [1, 2, 5, 10, 20][min(level, 4)]
        if is_correct:
            return points
        return -points // 2

    @staticmethod
    def determine_mvp(participants: list[dict]) -> str | None:
        """Eng ko'p personal_score to'plagan o'quvchi."""
        if not participants:
            return None
        return max(participants, key=lambda p: p.get("personal_score", 0)).get("student_id")
