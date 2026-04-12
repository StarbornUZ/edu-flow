# Faza 5 — Live Sessions (WebSocket + 7 ta Musobaqa)
> **Mas'ul:** Akramov Oybek (Backend WS) + Amonov Aminjon (Frontend UI)
> **Vaqt:** Kun 2 · 08:00–12:00 (~4 soat)
> **Kerak:** Faza 1 (DB: LiveSession modeli), Faza 3 (kurslar mavjud)
> **MVP Prioritet:** Avval Blitz Jang (sodda), keyin qolganlar

---

## Kontekst

Interaktiv darslar — EduFlow ning eng katta differensiatsiyasi (Kahoot dan farqi: o'zbek tili + AI guruh ajratish + 7 tur).

**WebSocket arxitekturasi:**
```
Teacher browser ─── WS connect (/ws/live/{session_id}) ───► FastAPI
Student browsers ─── WS connect (/ws/live/{session_id}) ───► FastAPI
                                                              │
                                                           In-memory
                                                           room manager
                                                           (dict)
```

> MVP uchun in-memory (dict) ishlatiladi. Production uchun Redis Pub/Sub kerak.

---

## 5.1 — WebSocket Room Manager

**Fayl:** `backend/services/live_session_service.py`

```python
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
        if not self.rooms[session_id]:
            del self.rooms[session_id]

    async def send_to(self, session_id: str, user_id: str, data: dict):
        """Bitta foydalanuvchiga yuborish."""
        ws = self.rooms[session_id].get(user_id)
        if ws:
            await ws.send_json(data)

    async def broadcast(self, session_id: str, data: dict, exclude: str | None = None):
        """Barcha qatnashchilarga yuborish."""
        for uid, ws in list(self.rooms[session_id].items()):
            if uid != exclude:
                try:
                    await ws.send_json(data)
                except Exception:
                    pass

    def get_connected_count(self, session_id: str) -> int:
        return len(self.rooms.get(session_id, {}))


# Global instance (FastAPI startup da yaratiladi)
manager = ConnectionManager()


# ─── O'yin logikasi ─────────────────────────────────────────────────────────


class GameEngine:
    """Har bir musobaqa turi uchun logika."""

    @staticmethod
    def calculate_blitz_score(is_correct: bool, time_taken_ms: int, time_limit_ms: int) -> int:
        """Blitz Jang: tez javob = ko'proq ball."""
        if not is_correct:
            return 0
        max_score = 1000
        min_score = 200
        ratio = max(0, 1 - time_taken_ms / time_limit_ms)
        return int(min_score + (max_score - min_score) * ratio)

    @staticmethod
    def calculate_relay_score(is_correct: bool, is_steal: bool) -> int:
        """Zanjir Savol: steal uchun bonus."""
        if not is_correct:
            return 0
        return 15 if is_steal else 10

    @staticmethod
    def calculate_lucky_card_score(card_type: str, is_correct: bool = False) -> int:
        """Omad Sinovi."""
        if card_type == "lucky":
            return 10
        elif card_type == "question" and is_correct:
            return 10
        return 0

    @staticmethod
    def calculate_pyramid_score(level: int, is_correct: bool) -> int:
        """Piramida: yuqori daraja = ko'proq ball, lekin noto'g'ri javob ball olib ketadi."""
        points = [1, 2, 5, 10, 20][min(level, 4)]
        if is_correct:
            return points
        return -points // 2  # Noto'g'ri: yarim ball ayiriladi

    @staticmethod
    def determine_mvp(participants: list[dict]) -> str | None:
        """Eng ko'p personal_score to'plagan o'quvchi."""
        if not participants:
            return None
        return max(participants, key=lambda p: p.get("personal_score", 0)).get("student_id")
```

---

## 5.2 — Live Session Backend Routes

**Fayl:** `backend/api/routes/live_sessions.py`

```python
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from backend.api.deps import get_db, get_current_user, require_teacher
from backend.db.models.user import User
from backend.db.models.live_session import (
    LiveSession, LiveSessionTeam, LiveSessionParticipant,
    GameType, SessionStatus
)
from backend.services.live_session_service import manager, GameEngine

router = APIRouter(prefix="/live-sessions", tags=["live-sessions"])


class SessionCreate(BaseModel):
    game_type: GameType
    course_id: uuid.UUID | None = None
    config: dict = {}              # O'yin sozlamalari
    questions: list[dict] = []     # Savollar massivi


class SessionResponse(BaseModel):
    id: uuid.UUID
    game_type: str
    status: str
    config: dict
    model_config = {"from_attributes": True}


# ─── REST endpoints ────────────────────────────────────────────────────────────

@router.post("/", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreate,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Yangi musobaqa sessiyasi yaratish."""
    session = LiveSession(
        teacher_id=current_user.id,
        course_id=body.course_id,
        game_type=body.game_type,
        config=body.config,
        questions=body.questions,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/{session_id}/teams")
async def create_teams(
    session_id: uuid.UUID,
    teams: list[dict],  # [{"name": "Guruh 1", "color": "#FF5733", "member_ids": [...]}]
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Guruhlarni belgilash (AI split natijasidan)."""
    session = await db.get(LiveSession, session_id)
    if not session:
        raise HTTPException(404, "Sessiya topilmadi")

    team_objects = []
    for t in teams:
        team = LiveSessionTeam(
            session_id=session_id,
            name=t["name"],
            color=t.get("color", "#3B82F6"),
        )
        db.add(team)
        await db.flush()

        # A'zolarni qo'shish
        for member_id in t.get("member_ids", []):
            participant = LiveSessionParticipant(
                session_id=session_id,
                student_id=uuid.UUID(member_id),
                team_id=team.id,
            )
            db.add(participant)
        team_objects.append(team)

    await db.commit()
    return {"teams": [{"id": str(t.id), "name": t.name} for t in team_objects]}


@router.post("/{session_id}/start")
async def start_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Musobaqani boshlash."""
    await db.execute(
        update(LiveSession)
        .where(LiveSession.id == session_id)
        .values(status=SessionStatus.active)
    )
    await db.commit()

    # Barcha qatnashchilarga signal
    await manager.broadcast(str(session_id), {
        "type": "session_started",
        "session_id": str(session_id),
    })
    return {"status": "started"}


@router.post("/{session_id}/next")
async def next_question(
    session_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Keyingi savolga o'tish (teacher boshqaradi)."""
    session = await db.get(LiveSession, session_id)
    if not session:
        raise HTTPException(404, "Sessiya topilmadi")

    new_index = session.current_question_index + 1
    if new_index >= len(session.questions):
        # O'yin tugadi
        return await end_session(session_id, current_user, db)

    await db.execute(
        update(LiveSession)
        .where(LiveSession.id == session_id)
        .values(current_question_index=new_index)
    )
    await db.commit()

    question = session.questions[new_index]
    await manager.broadcast(str(session_id), {
        "type": "next_question",
        "index": new_index,
        "question": question,
        "total": len(session.questions),
    })
    return {"index": new_index}


@router.post("/{session_id}/end")
async def end_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Musobaqani yakunlash."""
    # Natijalarni hisoblash
    teams = await db.execute(
        select(LiveSessionTeam).where(LiveSessionTeam.session_id == session_id)
        .order_by(LiveSessionTeam.score.desc())
    )
    teams_list = teams.scalars().all()

    participants = await db.execute(
        select(LiveSessionParticipant).where(
            LiveSessionParticipant.session_id == session_id
        ).order_by(LiveSessionParticipant.personal_score.desc())
    )
    participants_list = participants.scalars().all()

    # MVP belgilash
    if participants_list:
        mvp = participants_list[0]
        await db.execute(
            update(LiveSessionParticipant)
            .where(LiveSessionParticipant.id == mvp.id)
            .values(is_mvp=True)
        )

    # Sessiyani tugatish
    await db.execute(
        update(LiveSession)
        .where(LiveSession.id == session_id)
        .values(status=SessionStatus.finished)
    )
    await db.commit()

    results = {
        "type": "session_ended",
        "winner_team": teams_list[0].name if teams_list else None,
        "teams": [
            {"name": t.name, "score": t.score, "color": t.color}
            for t in teams_list
        ],
        "mvp": {
            "student_id": str(participants_list[0].student_id),
            "score": participants_list[0].personal_score
        } if participants_list else None,
    }

    await manager.broadcast(str(session_id), results)
    return results


@router.get("/{session_id}/results")
async def get_results(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Musobaqa natijalarini ko'rish."""
    teams = await db.execute(
        select(LiveSessionTeam).where(LiveSessionTeam.session_id == session_id)
        .order_by(LiveSessionTeam.score.desc())
    )
    participants = await db.execute(
        select(LiveSessionParticipant).where(
            LiveSessionParticipant.session_id == session_id
        ).order_by(LiveSessionParticipant.personal_score.desc())
    )
    return {
        "teams": teams.scalars().all(),
        "participants": participants.scalars().all(),
    }


# ─── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    session_id: str,
    ws: WebSocket,
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket orqali musobaqaga ulash.
    Token header yoki query param orqali autentifikatsiya.
    """
    # Token olish (query param: ?token=...)
    token = ws.query_params.get("token")
    if not token:
        await ws.close(code=4001, reason="Token kerak")
        return

    # Token decode qilish
    try:
        from backend.core.security import decode_access_token
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await ws.close(code=4001, reason="Noto'g'ri token")
            return
    except Exception:
        await ws.close(code=4001, reason="Token xato")
        return

    await manager.connect(session_id, user_id, ws)

    try:
        # Ulanganlar sonini broadcast qilish
        await manager.broadcast(session_id, {
            "type": "participant_joined",
            "user_id": user_id,
            "connected_count": manager.get_connected_count(session_id),
        })

        while True:
            data = await ws.receive_json()
            await _handle_ws_message(session_id, user_id, data, db)

    except WebSocketDisconnect:
        manager.disconnect(session_id, user_id)
        await manager.broadcast(session_id, {
            "type": "participant_left",
            "user_id": user_id,
            "connected_count": manager.get_connected_count(session_id),
        })


async def _handle_ws_message(
    session_id: str, user_id: str, data: dict, db: AsyncSession
):
    """WebSocket orqali kelgan xabarni qayta ishlash."""
    msg_type = data.get("type")

    if msg_type == "submit_answer":
        await _process_answer(session_id, user_id, data, db)
    elif msg_type == "ping":
        ws = manager.rooms[session_id].get(user_id)
        if ws:
            await ws.send_json({"type": "pong"})


async def _process_answer(session_id: str, user_id: str, data: dict, db: AsyncSession):
    """Javobni qayta ishlash va ball hisoblash."""
    session = await db.get(LiveSession, uuid.UUID(session_id))
    if not session or session.status != SessionStatus.active:
        return

    # Joriy savol
    if session.current_question_index >= len(session.questions):
        return
    question = session.questions[session.current_question_index]

    # To'g'ri/noto'g'ri tekshirish
    student_answer = data.get("answer")
    correct_answer = question.get("correct_index") if "correct_index" in question else question.get("correct_answer")
    is_correct = str(student_answer) == str(correct_answer)

    # O'yin turiga qarab ball hisoblash
    time_taken = data.get("time_taken_ms", 0)
    time_limit = session.config.get("time_limit_ms", 30000)
    score = 0

    if session.game_type == GameType.blitz:
        score = GameEngine.calculate_blitz_score(is_correct, time_taken, time_limit)
    elif session.game_type == GameType.relay:
        score = GameEngine.calculate_relay_score(is_correct, data.get("is_steal", False))
    elif session.game_type == GameType.lucky_card:
        score = GameEngine.calculate_lucky_card_score(
            data.get("card_type", "question"), is_correct
        )
    elif session.game_type == GameType.pyramid:
        score = GameEngine.calculate_pyramid_score(
            data.get("level", 0), is_correct
        )
    else:
        score = 10 if is_correct else 0

    # Participant va team score yangilash
    from sqlalchemy import update as sql_update
    participant = await db.execute(
        select(LiveSessionParticipant).where(
            LiveSessionParticipant.session_id == uuid.UUID(session_id),
            LiveSessionParticipant.student_id == uuid.UUID(user_id),
        )
    )
    participant = participant.scalar_one_or_none()

    if participant:
        new_personal = participant.personal_score + max(0, score)
        await db.execute(
            sql_update(LiveSessionParticipant)
            .where(LiveSessionParticipant.id == participant.id)
            .values(personal_score=new_personal)
        )
        if participant.team_id and score != 0:
            await db.execute(
                sql_update(LiveSessionTeam)
                .where(LiveSessionTeam.id == participant.team_id)
                .values(score=LiveSessionTeam.score + max(0, score))
            )
        await db.commit()

    # Barcha qatnashchilarga natija yuborish
    await manager.broadcast(session_id, {
        "type": "answer_result",
        "user_id": user_id,
        "is_correct": is_correct,
        "score": score,
        "answer": student_answer,
    })

    # Leaderboard yangilash (har javobdan keyin)
    teams_result = await db.execute(
        select(LiveSessionTeam).where(LiveSessionTeam.session_id == uuid.UUID(session_id))
        .order_by(LiveSessionTeam.score.desc())
    )
    await manager.broadcast(session_id, {
        "type": "leaderboard_update",
        "teams": [
            {"name": t.name, "score": t.score, "color": t.color}
            for t in teams_result.scalars().all()
        ]
    })
```

---

## 5.3 — WebSocket xabar protokoli

Frontend va Backend o'rtasidagi WS xabarlar:

```typescript
// Client → Server xabarlar:
{type: "submit_answer", answer: 0, time_taken_ms: 5000, is_steal: false}
{type: "ping"}

// Server → Client xabarlar:
{type: "participant_joined", user_id: "...", connected_count: 15}
{type: "session_started", session_id: "..."}
{type: "next_question", index: 0, question: {...}, total: 10}
{type: "answer_result", user_id: "...", is_correct: true, score: 850}
{type: "leaderboard_update", teams: [{name: "Guruh 1", score: 120, color: "#FF5733"}]}
{type: "session_ended", winner_team: "Guruh 1", teams: [...], mvp: {...}}
{type: "pong"}
```

---

## 5.4 — Frontend: Live Session UI

**Fayl:** `frontend/src/app/teacher/live/[sessionId]/page.tsx`

Teacher boshqaruv paneli:

```tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Team {
  name: string;
  score: number;
  color: string;
}

export default function TeacherLivePage({ params }: { params: { sessionId: string } }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [status, setStatus] = useState<"waiting" | "active" | "ended">("waiting");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}/api/v1/live-sessions/ws/${params.sessionId}?token=${token}`
    );
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "participant_joined") setConnectedCount(data.connected_count);
      if (data.type === "leaderboard_update") setTeams(data.teams);
      if (data.type === "next_question") setCurrentQuestion(data.question);
      if (data.type === "session_ended") setStatus("ended");
    };

    return () => ws.close();
  }, [params.sessionId]);

  const startSession = async () => {
    await fetch(`/api/v1/live-sessions/${params.sessionId}/start`, { method: "POST" });
    setStatus("active");
  };

  const nextQuestion = async () => {
    await fetch(`/api/v1/live-sessions/${params.sessionId}/next`, { method: "POST" });
  };

  const endSession = async () => {
    await fetch(`/api/v1/live-sessions/${params.sessionId}/end`, { method: "POST" });
    setStatus("ended");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">🎮 Jonli Musobaqa</h1>
          <Badge variant="outline" className="text-green-400">
            {connectedCount} o'quvchi ulangan
          </Badge>
        </div>

        {/* Leaderboard */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {teams.map((team, i) => (
            <Card key={team.name} className="p-4 text-center"
              style={{ borderColor: team.color }}>
              <div className="text-2xl font-bold" style={{ color: team.color }}>
                #{i + 1}
              </div>
              <div className="font-semibold">{team.name}</div>
              <div className="text-3xl font-bold mt-2">{team.score}</div>
              <div className="text-sm text-gray-400">ball</div>
            </Card>
          ))}
        </div>

        {/* Joriy savol */}
        {currentQuestion && (
          <Card className="p-6 mb-8 bg-gray-800">
            <p className="text-xl mb-4">{currentQuestion.question}</p>
            {currentQuestion.options && (
              <div className="grid grid-cols-2 gap-3">
                {currentQuestion.options.map((opt: string, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-gray-700">
                    {["A", "B", "C", "D"][i]}. {opt}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Boshqaruv tugmalari */}
        <div className="flex gap-4 justify-center">
          {status === "waiting" && (
            <Button size="lg" onClick={startSession}
              className="bg-green-500 hover:bg-green-600">
              ▶ Musobaqani Boshlash
            </Button>
          )}
          {status === "active" && (
            <>
              <Button size="lg" onClick={nextQuestion} variant="outline">
                Keyingi savol →
              </Button>
              <Button size="lg" onClick={endSession} variant="destructive">
                Yakunlash
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Fayl:** `frontend/src/app/student/live/[sessionId]/page.tsx`

O'quvchi musobaqa sahifasi:

```tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";

export default function StudentLivePage({ params }: { params: { sessionId: string } }) {
  const [question, setQuestion] = useState<any>(null);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; score: number } | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [sessionEnded, setSessionEnded] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const answerTimeRef = useRef<number>(0);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}/api/v1/live-sessions/ws/${params.sessionId}?token=${token}`
    );
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "next_question") {
        setQuestion(data.question);
        setAnswered(false);
        setResult(null);
        setTimeLeft(30);
        answerTimeRef.current = Date.now();
        // Countdown
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current!); return 0; } return t - 1; });
        }, 1000);
      }
      if (data.type === "answer_result" && data.user_id === getCurrentUserId()) {
        setResult({ correct: data.is_correct, score: data.score });
      }
      if (data.type === "leaderboard_update") setTeams(data.teams);
      if (data.type === "session_ended") setSessionEnded(true);
    };

    return () => { ws.close(); clearInterval(timerRef.current); };
  }, [params.sessionId]);

  const submitAnswer = (answerIndex: number) => {
    if (answered || !wsRef.current) return;
    setAnswered(true);
    clearInterval(timerRef.current);
    wsRef.current.send(JSON.stringify({
      type: "submit_answer",
      answer: answerIndex,
      time_taken_ms: Date.now() - answerTimeRef.current,
    }));
  };

  const getCurrentUserId = () => {
    // JWT dan decode qilish
    const token = localStorage.getItem("access_token") || "";
    try {
      return JSON.parse(atob(token.split(".")[1])).sub;
    } catch { return ""; }
  };

  const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500"];

  if (sessionEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-3xl font-bold mb-4">Musobaqa Tugadi!</h1>
          <div className="space-y-3">
            {teams.map((t, i) => (
              <div key={t.name} className="flex justify-between items-center p-3 rounded-lg bg-gray-800">
                <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {t.name}</span>
                <span className="font-bold">{t.score} ball</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-xl">O'qituvchi musobaqani boshlashini kuting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        {/* Timer */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span>Vaqt</span>
            <span className={timeLeft <= 5 ? "text-red-400 font-bold" : ""}>{timeLeft} sek</span>
          </div>
          <Progress value={(timeLeft / 30) * 100}
            className={timeLeft <= 5 ? "bg-red-900" : ""} />
        </div>

        {/* Savol */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <p className="text-xl font-semibold text-center">{question.question}</p>
        </div>

        {/* Variantlar */}
        <div className="grid grid-cols-2 gap-4">
          {question.options?.map((opt: string, i: number) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.95 }}
              onClick={() => submitAnswer(i)}
              disabled={answered}
              className={`p-4 rounded-xl font-semibold text-white transition-all
                ${answered
                  ? result
                    ? i === question.correct_index
                      ? "bg-green-500"
                      : "bg-gray-600 opacity-50"
                    : "bg-gray-600 opacity-50"
                  : colors[i] + " hover:opacity-90 cursor-pointer"
                }`}
            >
              {["A", "B", "C", "D"][i]}. {opt}
            </motion.button>
          ))}
        </div>

        {/* Natija */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-6 p-4 rounded-xl text-center text-xl font-bold
                ${result.correct ? "bg-green-500" : "bg-red-500"}`}
            >
              {result.correct ? `✅ To'g'ri! +${result.score} ball` : "❌ Noto'g'ri"}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

---

## 5.5 — `main.py` ga qo'shish

```python
from backend.api.routes import live_sessions
app.include_router(live_sessions.router, prefix="/api/v1")
```

---

## MVP Prioritet (vaqt yetmasa)

**Faqat shu 1 tur ishlasa yetadi:**
- **Blitz Jang** — eng sodda, Kahoot ga o'xshash
- Game type: `blitz`
- WS xabarlar: `next_question` → student javob beradi → `answer_result` + `leaderboard_update`

**Vaqt bo'lsa qo'shish:**
1. Omad Sinovi (teacher kartani aniqlaydi)
2. Zanjir Savol (guruh navbatini server boshqaradi)

---

## Muvaffaqiyat mezoni

- [ ] `POST /api/v1/live-sessions/` — sessiya yaratiladi
- [ ] `POST /api/v1/live-sessions/{id}/teams` — guruhlar belgilanadi
- [ ] `POST /api/v1/live-sessions/{id}/start` → WS broadcast `session_started`
- [ ] `WS /api/v1/live-sessions/ws/{id}` — o'quvchi ulanadi
- [ ] Student javob yuboradi → `answer_result` broadcast
- [ ] Leaderboard real-time yangilanadi
- [ ] `POST /api/v1/live-sessions/{id}/end` → `session_ended` broadcast + MVP aniqlanadi
- [ ] Teacher sahifasi: guruhlar, savol, "Keyingi" tugmasi ishlaydi
- [ ] Student sahifasi: savol, variantlar, timer, natija ishlaydi
