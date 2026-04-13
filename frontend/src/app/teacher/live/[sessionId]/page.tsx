"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Play, SkipForward, Square, Users, Trophy, Star, Copy, Check } from "lucide-react";
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
import LuckyCardBoard, { type LuckyCard, type LuckyCardTeam } from "@/components/live/LuckyCardBoard";

interface WSMessage {
  type: string;
  connected_count?: number;
  teams?: LiveSessionTeam[];
  winner_team?: string;
  mvp?: { student_id: string; student_name?: string; team_name?: string | null; score: number } | null;
  question?: { question_text: string; options: string[]; time_limit_sec: number };
  index?: number;
  total?: number;
  // Lucky card messages
  board?: LuckyCard[];
  current_team?: LuckyCardTeam;
  card_id?: number;
  card_type?: string;
  emotion?: "correct" | "wrong" | "lucky" | "unlucky";
  team_id?: string;
  team_name?: string;
  team_color?: string;
  score?: number;
  xp?: number;
}

export default function LiveSessionControlPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<LiveSession | null>(null);
  const [teams, setTeams] = useState<LiveSessionTeam[]>([]);
  const [connectedCount, setConnectedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [winnerTeam, setWinnerTeam] = useState<string | null>(null);
  const [mvp, setMvp] = useState<{ name: string; team: string | null } | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<WSMessage["question"] | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Lucky card state
  const [luckyBoard, setLuckyBoard] = useState<LuckyCard[]>([]);
  const [luckyCurrentTeam, setLuckyCurrentTeam] = useState<LuckyCardTeam | null>(null);
  const [luckyEmotion, setLuckyEmotion] = useState<"correct" | "wrong" | "lucky" | "unlucky" | null>(null);

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
        case "leaderboard_update":
          if (Array.isArray(msg.teams)) setTeams(msg.teams);
          break;
        case "next_question":
          if (msg.question) {
            setCurrentQuestion(msg.question);
            setCurrentQuestionIndex(msg.index ?? 0);
          }
          break;
        case "session_ended":
          setSessionEnded(true);
          if (msg.winner_team) setWinnerTeam(msg.winner_team);
          if (msg.mvp?.student_name) {
            setMvp({ name: msg.mvp.student_name, team: msg.mvp.team_name ?? null });
          }
          if (Array.isArray(msg.teams)) setTeams(msg.teams);
          break;
        case "lucky_card_init":
          if (Array.isArray(msg.board)) setLuckyBoard(msg.board);
          if (msg.current_team) setLuckyCurrentTeam(msg.current_team);
          if (Array.isArray(msg.teams)) setTeams(msg.teams);
          break;
        case "card_revealed":
          if (typeof msg.card_id === "number") {
            setLuckyBoard((prev) => prev.map((c) => c.id === msg.card_id ? { ...c, flipped: true } : c));
          }
          if (msg.emotion) {
            setLuckyEmotion(msg.emotion);
            setTimeout(() => setLuckyEmotion(null), 2500);
          }
          break;
        case "lucky_answer_result":
          if (msg.emotion) {
            setLuckyEmotion(msg.emotion);
            setTimeout(() => setLuckyEmotion(null), 2500);
          }
          break;
        case "lucky_turn":
          if (msg.team_id) setLuckyCurrentTeam({ id: msg.team_id, name: msg.team_name || "", color: msg.team_color || "#3B82F6", score: 0 });
          break;
        default:
          break;
      }
    } catch {
      // invalid message
    }
  }, []);

  useEffect(() => {
    // Fetch session data (critical) + results/teams (best-effort, independent)
    api.get<LiveSession>(`/live-sessions/${sessionId}`)
      .then((res) => {
        const s = res.data;
        setSession(s);
        if (s.status === "finished") setSessionEnded(true);
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

    // Connect WebSocket
    const wsUrl = getWsUrl();
    const token = localStorage.getItem("access_token");
    const ws = new WebSocket(`${wsUrl}/live-sessions/ws/${sessionId}?token=${token}`);
    ws.onmessage = handleWSMessage;
    ws.onclose = () => {};
    ws.onerror = () => {};
    wsRef.current = ws;

    return () => ws.close();
  }, [sessionId, handleWSMessage]);

  const handleStart = async () => {
    try {
      await api.post(`/live-sessions/${sessionId}/start`);
      setSession((prev) => (prev ? { ...prev, status: "active" } : prev));
    } catch {
      //
    }
  };

  const handleNext = async () => {
    try {
      await api.post(`/live-sessions/${sessionId}/next`);
    } catch {
      //
    }
  };

  const handleEnd = async () => {
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

  return (
    <div className="min-h-screen bg-gray-50 p-6 -m-4 md:-m-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jonli musobaqa</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="secondary">
              {({
                blitz: "Blitz Jang",
                lucky_card: "Omadli Kartalar",
                relay: "Zanjir Savol",
                question_duel: "Savol Dueli",
                territory: "Xarita Jang",
                pyramid: "Piramida",
                puzzle: "Topishmoq",
              } as Record<string, string>)[session.game_type] ?? session.game_type}
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
        <div className="flex items-center gap-2 mb-6 p-3 rounded-lg bg-white border border-gray-200 shadow-sm">
          <span className="text-xs text-gray-500 shrink-0">O&apos;quvchilar havolasi:</span>
          <span className="text-xs text-blue-600 truncate flex-1">{studentJoinUrl}</span>
          <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2" onClick={handleCopyUrl}>
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      )}

      {/* Session Ended */}
      {sessionEnded && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12 mb-6"
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

      {/* Lucky card board (teacher view — read-only) */}
      {session.game_type === "lucky_card" && luckyBoard.length > 0 && !sessionEnded && (
        <Card className="bg-white border-gray-200 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">Omadli Kartalar taxtasi</CardTitle>
          </CardHeader>
          <CardContent>
            <LuckyCardBoard
              board={luckyBoard}
              currentTeam={luckyCurrentTeam}
              teams={teams.map((t) => ({ ...t }))}
              canSelect={false}
              emotion={luckyEmotion}
            />
          </CardContent>
        </Card>
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

      {/* Leaderboard */}
      {sortedTeams.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Natijalar jadvali</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {sortedTeams.map((team, idx) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="bg-white border-gray-200 shadow-sm" style={{ borderTopColor: team.color, borderTopWidth: 4 }}>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      {idx === 0 && <Trophy className="h-6 w-6 text-yellow-500 mx-auto mb-2" />}
                      <p className="font-bold text-lg text-gray-900">{team.name}</p>
                      <p className="text-3xl font-bold mt-2" style={{ color: team.color || "#3B82F6" }}>
                        {team.score}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">ball</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
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
