"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Trophy, Star, CheckCircle, XCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getWsUrl, api } from "@/lib/api";
import type { LiveSessionTeam } from "@/types";

type PageState = "lobby" | "question" | "answered" | "ended";

interface Question {
  question_text: string;
  options: string[];
  time_limit_sec: number;
}

interface WSMessage {
  type: string;
  connected_count?: number;
  question?: Question;
  index?: number;
  total?: number;
  is_correct?: boolean;
  score?: number;
  teams?: LiveSessionTeam[];
  winner_team?: string;
  mvp?: { student_id: string; score: number } | null;
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
  const [myResults, setMyResults] = useState<MyResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        case "session_started":
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
          if (msg.score && msg.score > 0) setMyScore((prev) => prev + msg.score!);
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
          // Natijalarni yuklash
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
  }, [startTimer, sessionId]);

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
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-center space-y-3">
          <div className={`h-4 w-4 rounded-full mx-auto mb-4 ${connected ? "bg-green-400" : "bg-red-400"}`} />
          <h1 className="text-2xl font-bold">Musobaqa boshlanishini kutilmoqda...</h1>
          <p className="text-gray-400 text-sm">O&apos;qituvchi musobaqani boshlaganidan so&apos;ng savollar ko&apos;rinadi</p>
          {connectedCount > 0 && (
            <p className="text-gray-500 text-sm">{connectedCount} ta ishtirokchi ulandi</p>
          )}
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-blue-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600">Sizning hisobingiz: {myScore} ball</p>
        </div>
      </div>
    );
  }

  // ── ENDED ──────────────────────────────────────────────────────────────────
  if (state === "ended") {
    const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 pb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-10 mb-6"
        >
          <Trophy className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Musobaqa yakunlandi!</h1>
          {winnerTeam && <p className="text-xl text-yellow-400">G&apos;olib: {winnerTeam}</p>}
          <div className="mt-3 inline-flex items-center gap-2 bg-blue-900/40 border border-blue-700 px-4 py-2 rounded-full">
            <Star className="h-4 w-4 text-yellow-400" />
            <span className="text-sm">Sizning natijangiz: <strong>{myScore} ball</strong></span>
          </div>
        </motion.div>

        {sortedTeams.length > 0 && (
          <div className="max-w-md mx-auto space-y-3 mb-8">
            <h2 className="text-lg font-semibold mb-3 text-center">Jamoalar reytingi</h2>
            {sortedTeams.map((team, idx) => (
              <Card key={team.id} className="border-gray-700" style={{ backgroundColor: team.color ? `${team.color}20` : "#1f2937" }}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-gray-400">#{idx + 1}</span>
                    {idx === 0 && <Trophy className="h-5 w-5 text-yellow-400" />}
                    <span className="font-semibold" style={{ color: team.color || "#fff" }}>{team.name}</span>
                  </div>
                  <span className="text-2xl font-bold text-white">{team.score}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Answer history section */}
        {myResults && (
          <div className="max-w-2xl mx-auto">
            <Button
              variant="outline"
              className="w-full mb-4 border-gray-600 text-gray-300 hover:bg-gray-800"
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
                      <Card key={q.index} className="border-gray-700 bg-gray-800/50">
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start gap-2 mb-3">
                            {correct === true ? (
                              <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                            ) : correct === false ? (
                              <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                            ) : (
                              <Clock className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-white">
                                {q.index + 1}. {q.question_text}
                              </p>
                              {correct === true && q.score > 0 && (
                                <p className="text-xs text-green-400 mt-0.5">+{q.score} ball</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                            {(q.options || []).map((opt, oi) => {
                              const isCorrectOpt = oi === q.correct_index;
                              const isStudentOpt = answered && oi === q.student_answer;
                              let cls = "text-gray-400 border-gray-700 bg-gray-800";
                              if (isCorrectOpt) cls = "text-green-300 border-green-700 bg-green-900/30";
                              else if (isStudentOpt && !isCorrectOpt) cls = "text-red-300 border-red-700 bg-red-900/30";

                              return (
                                <div key={oi} className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${cls}`}>
                                  <span className="font-bold shrink-0">{String.fromCharCode(65 + oi)})</span>
                                  <span>{opt}</span>
                                  {isCorrectOpt && <CheckCircle className="h-3 w-3 ml-auto shrink-0 text-green-400" />}
                                  {isStudentOpt && !isCorrectOpt && <XCircle className="h-3 w-3 ml-auto shrink-0 text-red-400" />}
                                </div>
                              );
                            })}
                          </div>

                          {!answered && (
                            <p className="text-xs text-gray-500 mt-2">Javob berilmadi</p>
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
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">
          Savol {questionIndex + 1}{questionTotal > 0 ? ` / ${questionTotal}` : ""}
        </span>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-yellow-400" />
          <span className={`font-mono font-bold ${timeLeft <= 5 ? "text-red-400" : "text-yellow-400"}`}>
            {timeLeft}s
          </span>
          <span className="text-gray-500 ml-2">{myScore} ball</span>
        </div>
      </div>

      {/* Question */}
      {question && (
        <div className="flex-1 flex flex-col">
          <Card className="bg-gray-800 border-gray-700 mb-6">
            <CardContent className="pt-6 pb-4">
              <p className="text-lg font-semibold text-white leading-relaxed">{question.question_text}</p>
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
                        ? "border-blue-500 bg-blue-900/30 text-white"
                        : "border-gray-600 bg-gray-800 text-gray-200 hover:border-blue-400 hover:bg-gray-700"
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
                  lastResult.is_correct ? "bg-green-900/40 border-green-600" : "bg-red-900/40 border-red-600"
                }`}
              >
                {lastResult.is_correct ? (
                  <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-400 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {lastResult.is_correct ? "To\u02bfg\u02bfri javob!" : "Noto\u02bfg\u02bfri javob"}
                  </p>
                  {lastResult.is_correct && lastResult.score > 0 && (
                    <p className="text-sm text-green-300">+{lastResult.score} ball</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {state === "answered" && (
            <p className="text-center text-gray-500 text-sm mt-4">Keyingi savol kutilmoqda...</p>
          )}
        </div>
      )}
    </div>
  );
}
