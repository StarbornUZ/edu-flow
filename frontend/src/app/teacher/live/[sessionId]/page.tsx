"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Play, SkipForward, Square, Users, Trophy, Star } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
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

interface WSMessage {
  type: string;
  data?: Record<string, unknown>;
}

export default function LiveSessionControlPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<LiveSession | null>(null);
  const [teams, setTeams] = useState<LiveSessionTeam[]>([]);
  const [connectedCount, setConnectedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [winner, setWinner] = useState<LiveSessionTeam | null>(null);
  const [mvp, setMvp] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const handleWSMessage = useCallback((event: MessageEvent) => {
    try {
      const msg: WSMessage = JSON.parse(event.data);
      switch (msg.type) {
        case "player_joined":
          setConnectedCount((prev) => prev + 1);
          break;
        case "player_left":
          setConnectedCount((prev) => Math.max(0, prev - 1));
          break;
        case "leaderboard_update":
          if (msg.data && Array.isArray(msg.data.teams)) {
            setTeams(msg.data.teams as LiveSessionTeam[]);
          }
          break;
        case "connected_count":
          if (msg.data && typeof msg.data.count === "number") {
            setConnectedCount(msg.data.count);
          }
          break;
        case "session_ended":
          setSessionEnded(true);
          if (msg.data) {
            if (msg.data.winner) {
              setWinner(msg.data.winner as LiveSessionTeam);
            }
            if (typeof msg.data.mvp === "string") {
              setMvp(msg.data.mvp);
            }
          }
          break;
        case "question_changed":
          if (msg.data && typeof msg.data.current_question_index === "number") {
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    current_question_index:
                      msg.data!.current_question_index as number,
                  }
                : prev
            );
          }
          break;
        default:
          break;
      }
    } catch {
      // invalid message
    }
  }, []);

  useEffect(() => {
    // Fetch session data
    api
      .get<LiveSession>(`/live-sessions/${sessionId}`)
      .then((res) => {
        setSession(res.data);
        if (res.data.status === "finished") {
          setSessionEnded(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Connect WebSocket
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1";
    const token = localStorage.getItem("access_token");
    const ws = new WebSocket(
      `${wsUrl}/live-sessions/ws/${sessionId}?token=${token}`
    );

    ws.onmessage = handleWSMessage;
    ws.onclose = () => {};
    ws.onerror = () => {};

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [sessionId, handleWSMessage]);

  const handleStart = async () => {
    try {
      await api.post(`/live-sessions/${sessionId}/start`);
      setSession((prev) => (prev ? { ...prev, status: "active" } : prev));
    } catch {
      // handle error
    }
  };

  const handleNext = async () => {
    try {
      await api.post(`/live-sessions/${sessionId}/next`);
    } catch {
      // handle error
    }
  };

  const handleEnd = async () => {
    try {
      await api.post(`/live-sessions/${sessionId}/end`);
      setSession((prev) => (prev ? { ...prev, status: "finished" } : prev));
      setSessionEnded(true);
    } catch {
      // handle error
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
        <Skeleton className="h-8 w-48 bg-gray-700" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 bg-gray-700" />
          ))}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">Sessiya topilmadi</p>
      </div>
    );
  }

  const currentQ =
    session.questions && session.questions[session.current_question_index];

  // Sort teams by score descending
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 -m-4 md:-m-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Jonli musobaqa</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="outline" className="text-white border-gray-600">
              {session.game_type === "blitz"
                ? "Blitz Jang"
                : session.game_type === "lucky_card"
                ? "Omad Sinovi"
                : "Zanjir Savol"}
            </Badge>
            <div className="flex items-center gap-1 text-gray-400">
              <Users className="h-4 w-4" />
              <span className="text-sm">
                {connectedCount} ta o&apos;quvchi
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {session.status === "pending" && (
            <Button
              onClick={handleStart}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Musobaqani boshlash
            </Button>
          )}
          {session.status === "active" && (
            <>
              <Button
                onClick={handleNext}
                variant="outline"
                className="border-gray-600 text-white hover:bg-gray-800"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Keyingi savol
              </Button>
              <Button
                onClick={handleEnd}
                variant="destructive"
              >
                <Square className="h-4 w-4 mr-2" />
                Yakunlash
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Session Ended */}
      {sessionEnded && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12 mb-6"
        >
          <Trophy className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2">Musobaqa yakunlandi!</h2>
          {winner && (
            <p className="text-xl text-yellow-400">
              G&apos;olib: {winner.name} ({winner.score} ball)
            </p>
          )}
          {mvp && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <Star className="h-5 w-5 text-yellow-400" />
              <p className="text-gray-300">MVP: {mvp}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Current Question */}
      {currentQ && !sessionEnded && (
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white text-sm text-gray-400">
              Savol {session.current_question_index + 1} /{" "}
              {session.questions.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium text-white">
              {(currentQ as Record<string, unknown>).question_text as string}
            </p>
            {Array.isArray(
              (currentQ as Record<string, unknown>).options
            ) && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {(
                  (currentQ as Record<string, unknown>).options as string[]
                ).map((opt, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-gray-700 text-gray-200"
                  >
                    <span className="font-medium mr-2">
                      {String.fromCharCode(65 + idx)})
                    </span>
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
          <h2 className="text-lg font-semibold mb-4">Natijalar jadvali</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {sortedTeams.map((team, idx) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card
                  className="border-gray-700"
                  style={{
                    backgroundColor: team.color
                      ? `${team.color}20`
                      : "#1f2937",
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="text-center">
                      {idx === 0 && (
                        <Trophy className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                      )}
                      <p
                        className="font-bold text-lg"
                        style={{ color: team.color || "#fff" }}
                      >
                        {team.name}
                      </p>
                      <p className="text-3xl font-bold text-white mt-2">
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

      {/* Empty state when no teams yet */}
      {sortedTeams.length === 0 && !sessionEnded && (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">
              O&apos;quvchilar qo&apos;shilishini kutilmoqda...
            </p>
            <p className="text-sm text-gray-500 mt-2">
              O&apos;quvchilar qo&apos;shilganida natijalar bu yerda ko&apos;rinadi
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
