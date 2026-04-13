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
import LuckyCardBoard, { type LuckyCard, type LuckyCardTeam, type LuckyCardQuestion } from "@/components/live/LuckyCardBoard";

type PageState = "lobby" | "question" | "answered" | "ended" | "lucky_card";

interface Question {
  question_text: string;
  options: string[];
  time_limit_sec: number;
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
  xp?: number;
  teams?: LiveSessionTeam[];
  winner_team?: string;
  mvp?: { student_id: string; student_name?: string; team_name?: string | null; score: number } | null;
  team_id?: string;
  team_name?: string;
  team_color?: string;
  // Lucky card
  board?: LuckyCard[];
  current_team?: LuckyCardTeam;
  card_id?: number;
  card_type?: string;
  emotion?: "correct" | "wrong" | "lucky" | "unlucky";
  game_type?: string;
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
  const [showHistory, setShowHistory] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lucky card state
  const [luckyBoard, setLuckyBoard] = useState<LuckyCard[]>([]);
  const [luckyCurrentTeam, setLuckyCurrentTeam] = useState<LuckyCardTeam | null>(null);
  const [luckyAllTeams, setLuckyAllTeams] = useState<LuckyCardTeam[]>([]);
  const [luckyPendingQuestion, setLuckyPendingQuestion] = useState<LuckyCardQuestion | null>(null);
  const [luckyPendingCardId, setLuckyPendingCardId] = useState<number | null>(null);
  const [luckyEmotion, setLuckyEmotion] = useState<"correct" | "wrong" | "lucky" | "unlucky" | null>(null);
  const [sessionXp, setSessionXp] = useState(0);
  const [isLuckyCardGame, setIsLuckyCardGame] = useState(false);

  // Fetch session on mount — check game type and status
  useEffect(() => {
    api.get<{ status: string; game_type: string }>(`/live-sessions/${sessionId}`)
      .then((r) => {
        if (r.data.game_type === "lucky_card") {
          setIsLuckyCardGame(true);
        }
        if (r.data.status === "finished") {
          api.get<MyResult>(`/live-sessions/${sessionId}/my-results`)
            .then((res) => setMyResults(res.data))
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
          }
          break;
        case "session_started":
          if (msg.game_type === "lucky_card") {
            setIsLuckyCardGame(true);
            setState("lucky_card");
          }
          break;
        case "lucky_card_init":
          if (Array.isArray(msg.board)) setLuckyBoard(msg.board);
          if (msg.current_team) setLuckyCurrentTeam(msg.current_team);
          if (Array.isArray(msg.teams)) setLuckyAllTeams(msg.teams);
          setState("lucky_card");
          break;
        case "card_revealed":
          if (typeof msg.card_id === "number") {
            setLuckyBoard((prev) => prev.map((c) => c.id === msg.card_id ? { ...c, flipped: true } : c));
            setLuckyPendingCardId(msg.card_id);
          }
          if (msg.card_type === "a" && (msg as Record<string, unknown>).question) {
            setLuckyPendingQuestion((msg as Record<string, unknown>).question as LuckyCardQuestion);
          }
          if (msg.emotion) {
            setLuckyEmotion(msg.emotion);
            setTimeout(() => setLuckyEmotion(null), 2500);
          }
          break;
        case "lucky_answer_result":
          setLuckyPendingQuestion(null);
          setLuckyPendingCardId(null);
          if (msg.user_id === currentUser?.id && msg.xp && msg.xp > 0) {
            setSessionXp((prev) => prev + (msg.xp || 0));
          }
          if (msg.user_id === currentUser?.id && msg.score && msg.score > 0) {
            setMyScore((prev) => prev + (msg.score || 0));
          }
          if (msg.emotion) {
            setLuckyEmotion(msg.emotion);
            setTimeout(() => setLuckyEmotion(null), 2500);
          }
          break;
        case "lucky_turn":
          if (msg.team_id) {
            setLuckyCurrentTeam({ id: msg.team_id, name: msg.team_name || "", color: msg.team_color || "#3B82F6", score: 0 });
          }
          break;
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
          if (timerRef.current) clearInterval(timerRef.current);
          setLastResult({ is_correct: msg.is_correct ?? false, score: msg.score ?? 0 });
          // Only update MY score when this result is for me
          if (msg.user_id === currentUser?.id && msg.score && msg.score > 0) {
            setMyScore((prev) => prev + msg.score!);
          }
          setState("answered");
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
          break;
        default:
          break;
      }
    } catch {
      // invalid message
    }
  }, [startTimer, sessionId, currentUser?.id]);

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
    wsRef.current.send(JSON.stringify({ type: "submit_answer", answer: answerIndex, time_taken_ms: timeTaken }));
  };

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (state === "lobby") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6 p-6">
        {/* Team badge */}
        {myTeam && (
          <div
            className="px-5 py-2 rounded-full text-white font-semibold text-sm shadow-sm"
            style={{ backgroundColor: myTeam.color }}
          >
            Sizning guruhingiz: {myTeam.name}
          </div>
        )}

        <div className="text-center space-y-3">
          <div className={`h-4 w-4 rounded-full mx-auto mb-4 ${connected ? "bg-green-500" : "bg-red-400"}`} />
          <h1 className="text-2xl font-bold text-gray-900">Musobaqa boshlanishini kutilmoqda...</h1>
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

        {sortedTeams.length > 0 && (
          <div className="max-w-md mx-auto space-y-3 mb-8">
            <h2 className="text-lg font-semibold mb-3 text-center text-gray-900">Jamoalar reytingi</h2>
            {sortedTeams.map((team, idx) => (
              <Card key={team.id} className="border-gray-200 shadow-sm" style={{ borderLeftColor: team.color, borderLeftWidth: 4 }}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-gray-400">#{idx + 1}</span>
                    {idx === 0 && <Trophy className="h-5 w-5 text-yellow-500" />}
                    <span className="font-semibold text-gray-800">{team.name}</span>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{team.score}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Answer history */}
        {myResults && (
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

  // ── LUCKY CARD GAME ────────────────────────────────────────────────────────
  if (state === "lucky_card" || (isLuckyCardGame && state === "lobby")) {
    const isMyTurn = luckyCurrentTeam?.id === myTeam?.id;
    const canSelect = isMyTurn && !luckyPendingQuestion;

    const allTeamsWithScore = luckyAllTeams.map((t) => ({
      ...t,
      score: teams.find((tt) => tt.id === t.id)?.score ?? t.score,
    }));

    return (
      <div className="min-h-screen bg-white p-4">
        {/* Team badge */}
        {myTeam && (
          <div className="flex items-center justify-between mb-4">
            <div
              className="px-4 py-1.5 rounded-full text-white text-sm font-semibold"
              style={{ backgroundColor: myTeam.color }}
            >
              {myTeam.name} jamoasi
            </div>
            <div className="text-sm text-gray-500">
              <span className="font-bold text-gray-900">{myScore}</span> ball
              {sessionXp > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">({sessionXp} XP)</span>
              )}
            </div>
          </div>
        )}

        {luckyBoard.length === 0 ? (
          <div className="text-center py-20">
            <div className="flex gap-1 justify-center mb-4">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} className="h-2 w-2 rounded-full bg-blue-500"
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </div>
            <p className="text-gray-500">O&apos;qituvchi o&apos;yinni boshlaganini kutilmoqda...</p>
          </div>
        ) : (
          <LuckyCardBoard
            board={luckyBoard}
            currentTeam={luckyCurrentTeam}
            teams={allTeamsWithScore}
            myTeamId={myTeam?.id}
            canSelect={canSelect}
            pendingQuestion={luckyPendingQuestion}
            pendingCardId={luckyPendingCardId}
            emotion={luckyEmotion}
            sessionXp={sessionXp}
            onSelectCard={(cardId) => {
              wsRef.current?.send(JSON.stringify({ type: "select_card", card_id: cardId }));
            }}
            onSubmitAnswer={(answer) => {
              wsRef.current?.send(JSON.stringify({
                type: "submit_lucky_answer",
                answer,
                card_id: luckyPendingCardId,
              }));
            }}
          />
        )}
      </div>
    );
  }

  // ── QUESTION / ANSWERED ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Savol {questionIndex + 1}{questionTotal > 0 ? ` / ${questionTotal}` : ""}
          </span>
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

      {/* Question */}
      {question && (
        <div className="flex-1 flex flex-col">
          <Card className="bg-white border-gray-200 shadow-sm mb-6">
            <CardContent className="pt-6 pb-4">
              <p className="text-lg font-semibold text-gray-900 leading-relaxed">{question.question_text}</p>
            </CardContent>
          </Card>

          {/* Options */}
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

          {/* Answer result feedback */}
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

          {state === "answered" && (
            <p className="text-center text-gray-400 text-sm mt-4">Keyingi savol kutilmoqda...</p>
          )}
        </div>
      )}
    </div>
  );
}
