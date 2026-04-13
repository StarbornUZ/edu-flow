"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Trophy, Star, CheckCircle, XCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getWsUrl, api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { LiveSessionTeam } from "@/types";

type PageState = "lobby" | "question" | "answered" | "lucky_card" | "lucky_reveal" | "ended";

interface Question {
  question_text: string;
  options: string[];
  time_limit_sec: number;
}

interface CardSlot {
  slot: number;
  type: "question" | "lucky";
  question_index?: number;
  revealed: boolean;
}

interface ParticipantResult {
  student_id: string;
  student_name: string;
  team_id: string | null;
  personal_score: number;
  is_mvp: boolean;
}

interface FullResults {
  teams: LiveSessionTeam[];
  participants: ParticipantResult[];
}

interface WSMessage {
  type: string;
  user_id?: string;
  connected_count?: number;
  question?: Question;
  index?: number;
  total?: number;
  is_correct?: boolean;
  score?: number;
  teams?: LiveSessionTeam[];
  winner_team?: string;
  mvp?: { student_id: string; student_name?: string; team_name?: string | null; score: number } | null;
  // team_assigned
  team_id?: string;
  team_name?: string;
  team_color?: string;
  // lucky card
  card_count?: number;
  current_turn_team_id?: string;
  revealed_cards?: number[];
  slot?: number;
  card_type?: "lucky" | "question";
  question_index?: number;
  bonus?: number;
}

interface MyResult {
  questions: {
    index: number;
    question_text: string;
    options: string[];
    correct_index: number;
    student_answer: number | null;
    is_correct: boolean | null;
    score: number;
  }[];
  total_score: number;
  is_mvp: boolean;
}

export default function StudentLivePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const currentUser = useAuthStore((s) => s.user);

  const [state, setState] = useState<PageState>("lobby");
  const [gameType, setGameType] = useState<string | null>(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerStartTime, setAnswerStartTime] = useState<number>(0);
  const [lastResult, setLastResult] = useState<{ is_correct: boolean; score: number } | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [teams, setTeams] = useState<LiveSessionTeam[]>([]);
  const [winnerTeam, setWinnerTeam] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [myTeam, setMyTeam] = useState<{ id: string; name: string; color: string } | null>(null);
  const [myResults, setMyResults] = useState<MyResult | null>(null);
  const [fullResults, setFullResults] = useState<FullResults | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  // All participants for live score panel (student_id → {student_name, team_id, personal_score})
  const [allParticipants, setAllParticipants] = useState<ParticipantResult[]>([]);
  // Lucky card state
  const [cardGrid, setCardGrid] = useState<CardSlot[]>([]);
  const [currentTurnTeamId, setCurrentTurnTeamId] = useState<string | null>(null);
  const [pendingQuestionIndex, setPendingQuestionIndex] = useState<number | null>(null);
  const [luckyBonusTeam, setLuckyBonusTeam] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch session on mount — if already finished, show ended state immediately
  useEffect(() => {
    api.get<{ status: string; game_type: string }>(`/live-sessions/${sessionId}`)
      .then((r) => {
        setGameType(r.data.game_type);
        if (r.data.status === "finished") {
          api.get<MyResult>(`/live-sessions/${sessionId}/my-results`)
            .then((res) => setMyResults(res.data))
            .catch(() => {});
          api.get<FullResults>(`/live-sessions/${sessionId}/results`)
            .then((res) => { setFullResults(res.data); setAllParticipants(res.data.participants); })
            .catch(() => {});
          setState("ended");
        }
      })
      .catch(() => {});
  }, [sessionId]);

  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleWSMessage = useCallback((event: MessageEvent) => {
    try {
      const msg: WSMessage = JSON.parse(event.data);
      switch (msg.type) {
        case "participant_joined":
          if (typeof msg.connected_count === "number") setConnectedCount(msg.connected_count);
          break;
        case "participant_left":
          if (typeof msg.connected_count === "number") setConnectedCount(msg.connected_count);
          break;
        case "team_assigned":
          if (msg.team_id && msg.team_name) {
            setMyTeam({ id: msg.team_id, name: msg.team_name, color: msg.team_color || "#3B82F6" });
            // Load all participants for live score panel
            api.get<FullResults>(`/live-sessions/${sessionId}/results`)
              .then((r) => {
                if (r.data.participants.length > 0) setAllParticipants(r.data.participants);
                if (r.data.teams.length > 0) setTeams(r.data.teams);
              })
              .catch(() => {});
          }
          break;
        case "session_started":
          break;
        case "lucky_game_state": {
          // Initialize card grid
          const count = msg.card_count ?? 0;
          const revealed = msg.revealed_cards ?? [];
          const slots: CardSlot[] = Array.from({ length: count }, (_, i) => ({
            slot: i,
            type: "question",
            revealed: revealed.includes(i),
          }));
          setCardGrid(slots);
          setCurrentTurnTeamId(msg.current_turn_team_id ?? null);
          setState("lucky_card");
          break;
        }
        case "card_revealed": {
          const slot = msg.slot!;
          setCardGrid((prev) =>
            prev.map((c) =>
              c.slot === slot
                ? { ...c, type: msg.card_type!, question_index: msg.question_index, revealed: true }
                : c
            )
          );
          setCurrentTurnTeamId(msg.current_turn_team_id ?? null);
          if (msg.card_type === "lucky") {
            setLuckyBonusTeam(msg.team_id ?? null);
            setState("lucky_reveal");
            setTimeout(() => {
              setLuckyBonusTeam(null);
              setState("lucky_card");
            }, 2500);
          } else if (msg.card_type === "question" && msg.question) {
            setPendingQuestionIndex(msg.question_index ?? null);
            setQuestion(msg.question);
            setSelectedAnswer(null);
            setLastResult(null);
            setAnswerStartTime(Date.now());
            startTimer(msg.question.time_limit_sec ?? 30);
            setState("question");
          }
          break;
        }
        case "next_question":
          if (msg.question) {
            setQuestion(msg.question);
            setQuestionIndex(msg.index ?? 0);
            setQuestionTotal(msg.total ?? 0);
            setSelectedAnswer(null);
            setLastResult(null);
            setAnswerStartTime(Date.now());
            startTimer(msg.question.time_limit_sec ?? 30);
            setState("question");
          }
          break;
        case "answer_result":
          // Update the answering participant's score in live panel (for everyone)
          if (msg.user_id && typeof msg.score === "number" && msg.score > 0) {
            setAllParticipants((prev) =>
              prev.map((m) =>
                m.student_id === msg.user_id
                  ? { ...m, personal_score: m.personal_score + msg.score! }
                  : m
              )
            );
          }
          // Only change UI state for the student who answered
          if (msg.user_id === currentUser?.id) {
            if (timerRef.current) clearInterval(timerRef.current);
            setLastResult({ is_correct: msg.is_correct ?? false, score: msg.score ?? 0 });
            if (typeof msg.score === "number" && msg.score > 0) {
              setMyScore((prev) => prev + msg.score!);
            }
            setState("answered");
            if (gameType === "lucky_card") {
              setTimeout(() => {
                setLastResult(null);
                setState("lucky_card");
              }, 2500);
            }
          }
          break;
        case "leaderboard_update":
          if (Array.isArray(msg.teams)) setTeams(msg.teams);
          break;
        case "session_ended":
          if (timerRef.current) clearInterval(timerRef.current);
          if (Array.isArray(msg.teams)) setTeams(msg.teams);
          if (msg.winner_team) setWinnerTeam(msg.winner_team);
          setState("ended");
          api.get<MyResult>(`/live-sessions/${sessionId}/my-results`)
            .then((r) => setMyResults(r.data))
            .catch(() => {});
          api.get<FullResults>(`/live-sessions/${sessionId}/results`)
            .then((r) => {
              setFullResults(r.data);
              setAllParticipants(r.data.participants);
            })
            .catch(() => {});
          break;
        default:
          break;
      }
    } catch {
      // invalid message
    }
  }, [startTimer, sessionId, currentUser?.id, gameType]);

  useEffect(() => {
    const wsUrl = getWsUrl();
    const token = localStorage.getItem("access_token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    const ws = new WebSocket(`${wsUrl}/live-sessions/ws/${sessionId}?token=${token}`);
    ws.onopen = () => setConnected(true);
    ws.onmessage = handleWSMessage;
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    wsRef.current = ws;

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      ws.close();
    };
  }, [sessionId, handleWSMessage]);

  const submitAnswer = (answerIndex: number) => {
    if (selectedAnswer !== null || !wsRef.current) return;
    setSelectedAnswer(answerIndex);
    const timeTaken = Date.now() - answerStartTime;
    const payload: Record<string, unknown> = {
      type: "submit_answer",
      answer: answerIndex,
      time_taken_ms: timeTaken,
    };
    if (gameType === "lucky_card" && pendingQuestionIndex !== null) {
      payload.question_index = pendingQuestionIndex;
    }
    wsRef.current.send(JSON.stringify(payload));
  };

  const selectCard = (slot: number) => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "select_card", slot }));
  };

  // ── GROUP SCORE PANEL ──────────────────────────────────────────────────────
  const GroupPanel = () => {
    if (allParticipants.length === 0) return null;
    const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
    const teamsToShow = sortedTeams.length > 0 ? sortedTeams : Array.from(
      new Set(allParticipants.map((p) => p.team_id).filter(Boolean))
    ).map((tid) => ({ id: tid!, name: tid!, score: 0, color: "#3B82F6", session_id: "" }));

    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden shrink-0">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Guruhlar</span>
        </div>
        <div className="divide-y divide-gray-100">
          {teamsToShow.map((team) => {
            const members = allParticipants
              .filter((p) => p.team_id === team.id)
              .sort((a, b) => b.personal_score - a.personal_score);
            const isMyTeam = myTeam?.id === team.id;
            return (
              <div key={team.id} className={`px-3 py-2 ${isMyTeam ? "bg-blue-50/40" : ""}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: team.color || "#3B82F6" }} />
                  <span className={`text-xs font-bold flex-1 truncate ${isMyTeam ? "text-blue-800" : "text-gray-800"}`}>
                    {team.name}
                  </span>
                  <span className={`text-xs font-bold tabular-nums ${isMyTeam ? "text-blue-700" : "text-gray-700"}`}>
                    {team.score}
                  </span>
                </div>
                <div className="space-y-0.5 pl-4">
                  {members.map((m) => {
                    const isMe = m.student_id === currentUser?.id;
                    return (
                      <div key={m.student_id} className={`flex items-center justify-between text-xs py-0.5 rounded ${isMe ? "font-semibold" : ""}`}>
                        <span className={`truncate flex-1 ${isMe ? "text-blue-700" : "text-gray-600"}`}>
                          {isMe ? "● " : "· "}{m.student_name}
                        </span>
                        <span className={`ml-2 tabular-nums ${isMe ? "text-blue-700" : "text-gray-400"}`}>
                          {m.personal_score}
                        </span>
                      </div>
                    );
                  })}
                  {members.length === 0 && (
                    <p className="text-xs text-gray-400">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (state === "lobby") {
    return (
      <div className="min-h-screen bg-white p-6 flex flex-col gap-6">
        {/* Top: team badge + waiting message */}
        <div className="flex flex-col items-center gap-4 pt-8">
          {myTeam && (
            <div
              className="px-5 py-2 rounded-full text-white font-semibold text-sm shadow-sm"
              style={{ backgroundColor: myTeam.color }}
            >
              Sizning guruhingiz: {myTeam.name}
            </div>
          )}
          <div className="text-center space-y-2">
            <div className={`h-4 w-4 rounded-full mx-auto mb-2 ${connected ? "bg-green-500" : "bg-red-400"}`} />
            <h1 className="text-xl font-bold text-gray-900">Musobaqa boshlanishini kutilmoqda...</h1>
            <p className="text-gray-500 text-sm">O&apos;qituvchi musobaqani boshlaganidan so&apos;ng savollar ko&apos;rinadi</p>
            {connectedCount > 0 && (
              <p className="text-gray-400 text-sm">{connectedCount} ta ishtirokchi ulandi</p>
            )}
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-2 w-2 rounded-full bg-blue-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400">Sizning hisobingiz: {myScore} ball</p>
        </div>

        {/* Group panel — visible as soon as teams are assigned */}
        {allParticipants.length > 0 && (
          <div className="w-full max-w-xs mx-auto">
            <GroupPanel />
          </div>
        )}
      </div>
    );
  }

  // ── LUCKY CARD GRID ────────────────────────────────────────────────────────
  if (state === "lucky_card" || state === "lucky_reveal") {
    const isMyTurn = myTeam && currentTurnTeamId === myTeam.id;
    const cols = Math.ceil(Math.sqrt(cardGrid.length));
    return (
      <div className="min-h-screen bg-white p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            {myTeam && (
              <span
                className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                style={{ backgroundColor: myTeam.color }}
              >
                {myTeam.name}
              </span>
            )}
          </div>
          <span className="text-gray-400 text-sm">{myScore} ball</span>
        </div>

        <AnimatePresence>
          {state === "lucky_reveal" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="fixed inset-0 flex flex-col items-center justify-center bg-black/40 z-50"
            >
              <div className="bg-white rounded-2xl p-10 text-center shadow-2xl">
                <p className="text-7xl mb-4">🍀</p>
                <p className="text-2xl font-bold text-green-700">Omadli karta!</p>
                <p className="text-xl font-semibold text-gray-700 mt-2">+150 ball</p>
                {luckyBonusTeam && teams.find(t => t.id === luckyBonusTeam) && (
                  <p className="text-sm text-gray-500 mt-1">
                    {teams.find(t => t.id === luckyBonusTeam)?.name} jamoasiga
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center mb-4">
          {isMyTurn ? (
            <p className="text-base font-semibold text-purple-700">Sizning navbatingiz! Karta tanlang</p>
          ) : (
            <p className="text-base text-gray-500">
              Navbatda:{" "}
              <strong>{teams.find(t => t.id === currentTurnTeamId)?.name ?? "..."}</strong>
            </p>
          )}
        </div>

        <div
          className="grid gap-3 mx-auto w-full max-w-sm"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {cardGrid.map((card) => {
            const clickable = isMyTurn && !card.revealed && state === "lucky_card";
            return (
              <motion.button
                key={card.slot}
                onClick={() => clickable && selectCard(card.slot)}
                whileTap={clickable ? { scale: 0.93 } : {}}
                className={`aspect-square rounded-xl text-2xl flex items-center justify-center border-2 transition-all
                  ${card.revealed
                    ? card.type === "lucky"
                      ? "bg-green-100 border-green-400"
                      : "bg-blue-100 border-blue-300"
                    : clickable
                      ? "bg-purple-50 border-purple-400 cursor-pointer hover:bg-purple-100"
                      : "bg-gray-100 border-gray-200 cursor-default"
                  }`}
              >
                {card.revealed
                  ? card.type === "lucky" ? "🍀" : "❓"
                  : <span className="text-gray-400 font-bold text-sm">{card.slot + 1}</span>
                }
              </motion.button>
            );
          })}
        </div>

        {/* Mini leaderboard */}
        {teams.length > 0 && (
          <div className="mt-6 space-y-2 max-w-sm mx-auto w-full">
            {[...teams].sort((a, b) => b.score - a.score).map((team, idx) => {
              const medal = idx === 0 ? "🏆" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
              return (
                <div key={team.id} className="flex items-center gap-2 py-1">
                  {medal
                    ? <span className="text-lg w-7 text-center">{medal}</span>
                    : <span className="text-sm text-gray-400 w-7 text-center">#{idx + 1}</span>
                  }
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                  <span className="text-sm text-gray-700 flex-1">{team.name}</span>
                  <span className="text-sm font-bold text-gray-900">{team.score}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── ENDED ──────────────────────────────────────────────────────────────────
  if (state === "ended") {
    const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
    const displayScore = myResults ? myResults.total_score : myScore;
    return (
      <div className="min-h-screen bg-gray-50 p-6 pb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-10 mb-6"
        >
          <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Musobaqa yakunlandi!</h1>
          {winnerTeam && <p className="text-xl text-yellow-600">G&apos;olib: {winnerTeam}</p>}
          <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-full">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-gray-700">Sizning natijangiz: <strong>{displayScore} ball</strong></span>
          </div>
        </motion.div>

        {/* Unified leaderboard + team composition */}
        {sortedTeams.length > 0 && (
          <div className="max-w-md mx-auto mb-8 w-full">
            <h2 className="text-lg font-semibold mb-3 text-center text-gray-900">Guruhlar natijalari</h2>
            <div className="space-y-3">
              {sortedTeams.map((team, idx) => {
                const medal = idx === 0 ? "🏆" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                const members = (fullResults?.participants ?? allParticipants).filter((p) => p.team_id === team.id);
                return (
                  <Card key={team.id} className="border-gray-200 shadow-sm" style={{ borderLeftColor: team.color, borderLeftWidth: 4 }}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {medal
                            ? <span className="text-2xl w-8 text-center">{medal}</span>
                            : <span className="text-sm font-bold text-gray-400 w-8 text-center">#{idx + 1}</span>
                          }
                          <span className="font-semibold text-gray-800">{team.name}</span>
                        </div>
                        <span className="text-2xl font-bold text-gray-900">{team.score}</span>
                      </div>
                      {members.length > 0 && (
                        <div className="mt-2 space-y-0.5 pl-11">
                          {members.map((m) => {
                            const isMe = m.student_id === currentUser?.id;
                            return (
                              <div key={m.student_id} className="flex justify-between text-sm py-0.5">
                                <span className={`flex items-center gap-1 ${isMe ? "font-semibold text-blue-700" : "text-gray-600"}`}>
                                  {m.is_mvp && <Star className="h-3 w-3 text-yellow-500 shrink-0" />}
                                  {isMe ? "● " : "· "}{m.student_name}
                                </span>
                                <span className={`${isMe ? "text-blue-600 font-semibold" : "text-gray-400"}`}>{m.personal_score} ball</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Answer history */}
        {myResults && gameType !== "lucky_card" && (
          <div className="max-w-2xl mx-auto">
            <Button
              variant="outline"
              className="w-full mb-4"
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? "Tarixni yashirish" : "Mening javoblarim tarixi"}
            </Button>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  {myResults.questions.map((q) => {
                    const answered = q.student_answer !== null;
                    const correct = q.is_correct;
                    return (
                      <Card key={q.index} className="border-gray-200 shadow-sm">
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start gap-2 mb-3">
                            {correct === true ? (
                              <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                            ) : correct === false ? (
                              <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            ) : (
                              <Clock className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {q.index + 1}. {q.question_text}
                              </p>
                              {correct === true && q.score > 0 && (
                                <p className="text-xs text-green-600 mt-0.5">+{q.score} ball</p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                            {(q.options || []).map((opt, oi) => {
                              const isCorrectOpt = oi === q.correct_index;
                              const isStudentOpt = answered && oi === q.student_answer;
                              let cls = "text-gray-500 border-gray-200 bg-gray-50";
                              if (isCorrectOpt) cls = "text-green-700 border-green-300 bg-green-50";
                              else if (isStudentOpt && !isCorrectOpt) cls = "text-red-700 border-red-300 bg-red-50";
                              return (
                                <div key={oi} className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${cls}`}>
                                  <span className="font-bold shrink-0">{String.fromCharCode(65 + oi)})</span>
                                  <span>{opt}</span>
                                  {isCorrectOpt && <CheckCircle className="h-3 w-3 ml-auto shrink-0 text-green-500" />}
                                  {isStudentOpt && !isCorrectOpt && <XCircle className="h-3 w-3 ml-auto shrink-0 text-red-500" />}
                                </div>
                              );
                            })}
                          </div>
                          {!answered && (
                            <p className="text-xs text-gray-400 mt-2">Javob berilmadi</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }

  // ── QUESTION / ANSWERED ────────────────────────────────────────────────────
  const hasGroupPanel = allParticipants.length > 0;

  return (
    <div className="min-h-screen bg-white p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {gameType !== "lucky_card" && (
            <span className="text-sm text-gray-500">
              Savol {questionIndex + 1}{questionTotal > 0 ? ` / ${questionTotal}` : ""}
            </span>
          )}
          {myTeam && (
            <span
              className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
              style={{ backgroundColor: myTeam.color }}
            >
              {myTeam.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-amber-500" />
          <span className={`font-mono font-bold ${timeLeft <= 5 ? "text-red-500" : "text-amber-500"}`}>
            {timeLeft}s
          </span>
          <span className="text-gray-400 ml-2">{myScore} ball</span>
        </div>
      </div>

      {/* Main layout: group panel left + question right on md+ */}
      <div className={`flex-1 flex gap-4 ${hasGroupPanel ? "md:flex-row flex-col" : "flex-col"}`}>
        {/* Left: Group score panel */}
        {hasGroupPanel && (
          <div className="md:w-48 md:shrink-0">
            <GroupPanel />
          </div>
        )}

        {/* Right: Question */}
        {question && (
          <div className="flex-1 flex flex-col">
            <Card className="bg-white border-gray-200 shadow-sm mb-6">
              <CardContent className="pt-6 pb-4">
                <p className="text-lg font-semibold text-gray-900 leading-relaxed">{question.question_text}</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {question.options.map((opt, idx) => {
                const isSelected = selectedAnswer === idx;
                const disabled = selectedAnswer !== null;
                return (
                  <motion.div key={idx} whileTap={disabled ? {} : { scale: 0.97 }}>
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={() => submitAnswer(idx)}
                      className={`w-full h-auto py-4 px-4 text-left justify-start border-2 transition-colors ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 text-blue-900"
                          : "border-gray-200 bg-white text-gray-800 hover:border-blue-400 hover:bg-blue-50"
                      }`}
                    >
                      <span className="font-bold mr-3 text-lg">{String.fromCharCode(65 + idx)}</span>
                      {opt}
                    </Button>
                  </motion.div>
                );
              })}
            </div>

            <AnimatePresence>
              {state === "answered" && lastResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-6 p-4 rounded-xl border flex items-center gap-3 ${
                    lastResult.is_correct ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
                  }`}
                >
                  {lastResult.is_correct ? (
                    <CheckCircle className="h-6 w-6 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500 shrink-0" />
                  )}
                  <div>
                    <p className={`font-semibold ${lastResult.is_correct ? "text-green-800" : "text-red-800"}`}>
                      {lastResult.is_correct ? "To\u02bfg\u02bfri javob!" : "Noto\u02bfg\u02bfri javob"}
                    </p>
                    {lastResult.is_correct && lastResult.score > 0 && (
                      <p className="text-sm text-green-600">+{lastResult.score} ball</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {state === "answered" && gameType !== "lucky_card" && (
              <p className="text-center text-gray-400 text-sm mt-4">Keyingi savol kutilmoqda...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
