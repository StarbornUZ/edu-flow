"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Play, SkipForward, Square, Users, Trophy, Star, Copy, Check, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { api, getWsUrl } from "@/lib/api";
import type { LiveSession, LiveSessionTeam } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

interface ParticipantResult {
  student_id: string;
  student_name: string;
  team_id: string | null;
  personal_score: number;
  is_mvp: boolean;
}

interface ConnectedStudent {
  id: string;
  name: string;
  team_name: string | null;
}

interface WSMessage {
  type: string;
  user_id?: string;
  student_name?: string;
  team_name?: string;
  connected_count?: number;
  teams?: LiveSessionTeam[];
  winner_team?: string;
  mvp?: { student_id: string; student_name?: string; team_name?: string | null; score: number } | null;
  question?: { question_text: string; options: string[]; time_limit_sec: number };
  index?: number;
  total?: number;
  question_index?: number;
}

export default function LiveSessionControlPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<LiveSession | null>(null);
  const [teams, setTeams] = useState<LiveSessionTeam[]>([]);
  const [participants, setParticipants] = useState<ParticipantResult[]>([]);
  const [connectedCount, setConnectedCount] = useState(0);
  const [connectedStudents, setConnectedStudents] = useState<ConnectedStudent[]>([]);
  const [showStudentList, setShowStudentList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [winnerTeam, setWinnerTeam] = useState<string | null>(null);
  const [mvp, setMvp] = useState<{ name: string; team: string | null } | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<WSMessage["question"] | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  // Blitz auto-advance
  const [blitzTimeLeft, setBlitzTimeLeft] = useState(0);
  const blitzTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const gameTypeRef = useRef<string | null>(null);

  const stopBlitzTimer = useCallback(() => {
    if (blitzTimerRef.current) {
      clearInterval(blitzTimerRef.current);
      blitzTimerRef.current = null;
    }
    setBlitzTimeLeft(0);
  }, []);

  const handleNext = useCallback(async () => {
    stopBlitzTimer();
    try {
      await api.post(`/live-sessions/${sessionId}/next`);
    } catch {
      //
    }
  }, [sessionId, stopBlitzTimer]);

  const startBlitzTimer = useCallback((seconds: number) => {
    stopBlitzTimer();
    setBlitzTimeLeft(seconds);
    blitzTimerRef.current = setInterval(() => {
      setBlitzTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(blitzTimerRef.current!);
          blitzTimerRef.current = null;
          handleNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopBlitzTimer, handleNext]);

  const handleWSMessage = useCallback((event: MessageEvent) => {
    try {
      const msg: WSMessage = JSON.parse(event.data);
      switch (msg.type) {
        case "participant_joined":
          if (typeof msg.connected_count === "number") setConnectedCount(msg.connected_count);
          if (msg.user_id && msg.student_name) {
            setConnectedStudents((prev) =>
              prev.some((s) => s.id === msg.user_id)
                ? prev
                : [...prev, { id: msg.user_id!, name: msg.student_name!, team_name: msg.team_name ?? null }]
            );
          }
          break;
        case "participant_left":
          if (typeof msg.connected_count === "number") setConnectedCount(msg.connected_count);
          if (msg.user_id) {
            setConnectedStudents((prev) => prev.filter((s) => s.id !== msg.user_id));
          }
          break;
        case "leaderboard_update":
          if (Array.isArray(msg.teams)) setTeams(msg.teams);
          break;
        case "next_question":
          if (msg.question) {
            setCurrentQuestion(msg.question);
            setCurrentQuestionIndex(msg.index ?? 0);
            if (gameTypeRef.current === "blitz") {
              startBlitzTimer(msg.question.time_limit_sec ?? 30);
            }
          }
          break;
        case "all_answered":
          // All students answered — advance immediately
          stopBlitzTimer();
          handleNext();
          break;
        case "session_ended":
          stopBlitzTimer();
          setSessionEnded(true);
          if (msg.winner_team) setWinnerTeam(msg.winner_team);
          if (msg.mvp?.student_name) {
            setMvp({ name: msg.mvp.student_name, team: msg.mvp.team_name ?? null });
          }
          if (Array.isArray(msg.teams)) setTeams(msg.teams);
          // Fetch full results with participant names
          api.get<{ teams: LiveSessionTeam[]; participants: ParticipantResult[] }>(
            `/live-sessions/${sessionId}/results`
          ).then((res) => {
            if (res.data.participants.length) setParticipants(res.data.participants);
          }).catch(() => {});
          break;
        default:
          break;
      }
    } catch {
      // invalid message
    }
  }, [startBlitzTimer, stopBlitzTimer, handleNext, sessionId]);

  useEffect(() => {
    api.get<LiveSession>(`/live-sessions/${sessionId}`)
      .then((res) => {
        const s = res.data;
        setSession(s);
        gameTypeRef.current = s.game_type;
        if (s.status === "finished") {
          setSessionEnded(true);
          api.get<{ teams: LiveSessionTeam[]; participants: ParticipantResult[] }>(
            `/live-sessions/${sessionId}/results`
          ).then((r) => {
            if (r.data.teams.length) setTeams(r.data.teams);
            if (r.data.participants.length) setParticipants(r.data.participants);
          }).catch(() => {});
        }
        if (s.questions && s.questions.length > 0) {
          const idx = s.current_question_index ?? 0;
          const q = s.questions[idx] as Record<string, unknown>;
          setCurrentQuestion({
            question_text: q.question_text as string,
            options: q.options as string[],
            time_limit_sec: 30,
          });
          setCurrentQuestionIndex(idx);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get<{ teams: LiveSessionTeam[] }>(`/live-sessions/${sessionId}/results`)
      .then((res) => {
        if (Array.isArray(res.data.teams) && res.data.teams.length > 0) {
          setTeams(res.data.teams);
        }
      })
      .catch(() => {});

    const wsUrl = getWsUrl();
    const token = localStorage.getItem("access_token");
    const ws = new WebSocket(`${wsUrl}/live-sessions/ws/${sessionId}?token=${token}`);
    ws.onmessage = handleWSMessage;
    ws.onclose = () => {};
    ws.onerror = () => {};
    wsRef.current = ws;

    return () => {
      ws.close();
      stopBlitzTimer();
    };
  }, [sessionId, handleWSMessage, stopBlitzTimer]);

  const handleStart = async () => {
    try {
      await api.post(`/live-sessions/${sessionId}/start`);
      setSession((prev) => (prev ? { ...prev, status: "active" } : prev));
    } catch {
      //
    }
  };

  const handleEnd = async () => {
    stopBlitzTimer();
    try {
      await api.post(`/live-sessions/${sessionId}/end`);
      setSession((prev) => (prev ? { ...prev, status: "finished" } : prev));
      setSessionEnded(true);
    } catch {
      //
    }
  };

  const studentJoinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/student/live/${sessionId}`
    : `/student/live/${sessionId}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(studentJoinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Sessiya topilmadi</p>
      </div>
    );
  }

  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const isBlitz = session.game_type === "blitz";

  return (
    <div className="min-h-screen bg-gray-50 p-6 -m-4 md:-m-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jonli musobaqa</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="secondary">
              {session.game_type === "blitz"
                ? "Blitz Jang"
                : session.game_type === "lucky_card"
                ? "Omad Sinovi"
                : "Zanjir Savol"}
            </Badge>
            <div className="flex items-center gap-1 text-gray-500">
              <Users className="h-4 w-4" />
              <span className="text-sm">{connectedCount} ta o&apos;quvchi</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {session.status === "pending" && (
            <Button onClick={handleStart} className="bg-green-600 hover:bg-green-700">
              <Play className="h-4 w-4 mr-2" />
              Musobaqani boshlash
            </Button>
          )}
          {session.status === "active" && (
            <>
              {session.game_type !== "lucky_card" && (
                <Button onClick={handleNext} variant="outline">
                  <SkipForward className="h-4 w-4 mr-2" />
                  Keyingi savol
                  {isBlitz && blitzTimeLeft > 0 && (
                    <span className={`ml-2 font-mono font-bold ${blitzTimeLeft <= 5 ? "text-red-500" : "text-amber-500"}`}>
                      {blitzTimeLeft}s
                    </span>
                  )}
                </Button>
              )}
              <Button onClick={handleEnd} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                Yakunlash
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Student join URL */}
      {!sessionEnded && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-white border border-gray-200 shadow-sm">
          <span className="text-xs text-gray-500 shrink-0">O&apos;quvchilar havolasi:</span>
          <span className="text-xs text-blue-600 truncate flex-1">{studentJoinUrl}</span>
          <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2" onClick={handleCopyUrl}>
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      )}

      {/* Connected students panel */}
      {connectedStudents.length > 0 && !sessionEnded && (
        <Card className="mb-4 bg-white border-gray-200 shadow-sm">
          <CardHeader
            className="py-3 cursor-pointer"
            onClick={() => setShowStudentList((v) => !v)}
          >
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                Ulangan o&apos;quvchilar ({connectedStudents.length})
              </span>
              <ChevronRight
                className={`h-4 w-4 transition-transform ${showStudentList ? "rotate-90" : ""}`}
              />
            </CardTitle>
          </CardHeader>
          {showStudentList && (
            <CardContent className="pb-3 max-h-48 overflow-y-auto space-y-1">
              {connectedStudents.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm py-1">
                  <span className="text-gray-700">{s.name}</span>
                  {s.team_name && (
                    <Badge variant="outline" className="text-xs">{s.team_name}</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Session Ended */}
      {sessionEnded && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-10 mb-6"
        >
          <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Musobaqa yakunlandi!</h2>
          {winnerTeam && <p className="text-xl text-yellow-600">G&apos;olib: {winnerTeam}</p>}
          {mvp && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <p className="text-gray-600">
                MVP: <strong>{mvp.name}</strong>
                {mvp.team && <span className="text-gray-400"> ({mvp.team})</span>}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Current Question */}
      {currentQuestion && !sessionEnded && session.game_type !== "lucky_card" && (
        <Card className="bg-white border-gray-200 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">
              Savol {currentQuestionIndex + 1}{session.questions && ` / ${session.questions.length}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium text-gray-900">{currentQuestion.question_text}</p>
            {Array.isArray(currentQuestion.options) && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {currentQuestion.options.map((opt, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-gray-100 text-gray-700">
                    <span className="font-medium mr-2">{String.fromCharCode(65 + idx)})</span>
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leaderboard (vertical medal list) */}
      {sortedTeams.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Natijalar jadvali</h2>
          <div className="space-y-2">
            {sortedTeams.map((team, idx) => {
              const medal = idx === 0 ? "🏆" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
              return (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="bg-white border-gray-200 shadow-sm" style={{ borderLeftColor: team.color, borderLeftWidth: 4 }}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {medal
                          ? <span className="text-2xl w-9 text-center">{medal}</span>
                          : <span className="text-sm font-bold text-gray-400 w-9 text-center">#{idx + 1}</span>
                        }
                        <span className="font-semibold text-gray-800">{team.name}</span>
                      </div>
                      <span className="text-2xl font-bold text-gray-900">{team.score}</span>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team member composition (shown after session ends) */}
      {sessionEnded && participants.length > 0 && sortedTeams.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Jamoa a&apos;zolari</h2>
          <div className="space-y-3">
            {sortedTeams.map((team) => {
              const members = participants.filter((p) => p.team_id === team.id);
              return (
                <Card key={team.id} className="bg-white border-gray-200 shadow-sm" style={{ borderLeftColor: team.color, borderLeftWidth: 4 }}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                      <h3 className="font-semibold text-sm text-gray-800">{team.name}</h3>
                      <span className="text-sm text-gray-400 ml-auto">{team.score} ball</span>
                    </div>
                    {members.map((m) => (
                      <div key={m.student_id} className="flex justify-between text-sm py-0.5 pl-5">
                        <span className="text-gray-700 flex items-center gap-1">
                          {m.is_mvp && <Star className="h-3 w-3 text-yellow-500 shrink-0" />}
                          {m.student_name}
                        </span>
                        <span className="text-gray-400">{m.personal_score} ball</span>
                      </div>
                    ))}
                    {members.length === 0 && (
                      <p className="text-xs text-gray-400 pl-5">A&apos;zolar ma&apos;lumoti yo&apos;q</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {sortedTeams.length === 0 && !sessionEnded && (
        <Card className="bg-white border-gray-200">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">O&apos;quvchilar qo&apos;shilishini kutilmoqda...</p>
            <p className="text-sm text-gray-400 mt-2">
              O&apos;quvchilar qo&apos;shilganida natijalar bu yerda ko&apos;rinadi
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
