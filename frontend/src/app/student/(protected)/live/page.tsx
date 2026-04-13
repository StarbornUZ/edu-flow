"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Dice3, Link2, Trophy, Clock, ChevronRight, Swords } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { LiveSession } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const gameTypeInfo: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  blitz: { label: "Blitz Jang", icon: Zap, color: "text-yellow-500" },
  lucky_card: { label: "Omad Sinovi", icon: Dice3, color: "text-purple-500" },
  relay: { label: "Zanjir Savol", icon: Link2, color: "text-blue-500" },
  question_duel: { label: "Savol Dueli", icon: Swords, color: "text-red-500" },
  territory: { label: "Xarita Jang", icon: Trophy, color: "text-green-500" },
  pyramid: { label: "Piramida", icon: Trophy, color: "text-orange-500" },
  puzzle: { label: "Topishmoq", icon: Trophy, color: "text-pink-500" },
};

interface SessionWithTeacher extends LiveSession {
  teacher_name?: string;
  my_score?: number;
}

export default function StudentLiveSessionsPage() {
  const [active, setActive] = useState<SessionWithTeacher[]>([]);
  const [past, setPast] = useState<SessionWithTeacher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<SessionWithTeacher[]>("/live-sessions")
      .then((res) => {
        const all = res.data;
        setActive(all.filter((s) => s.status !== "finished"));
        setPast(all.filter((s) => s.status === "finished"));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Jonli darslar</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Jonli darslar</h1>

      {/* Active / Upcoming */}
      {active.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Faol musobaqalar
          </h2>
          <div className="space-y-3">
            {active.map((s, i) => (
              <SessionCard key={s.id} session={s} index={i} isActive />
            ))}
          </div>
        </section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            O&apos;tgan musobaqalar
          </h2>
          <div className="space-y-3">
            {past.map((s, i) => (
              <SessionCard key={s.id} session={s} index={i} isActive={false} />
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && past.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Swords className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Hozircha musobaqalar yo&apos;q</p>
          <p className="text-sm mt-1">O&apos;qituvchi musobaqa yaratgandan so&apos;ng bu yerda ko&apos;rinadi</p>
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  index,
  isActive,
}: {
  session: SessionWithTeacher;
  index: number;
  isActive: boolean;
}) {
  const info = gameTypeInfo[session.game_type] ?? { label: session.game_type, icon: Swords, color: "text-gray-500" };
  const Icon = info.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="py-4 px-5 flex items-center gap-4">
          <div className={`${info.color} shrink-0`}>
            <Icon className="h-8 w-8" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{info.label}</span>
              <StatusBadge status={session.status} />
            </div>
            {session.teacher_name && (
              <p className="text-sm text-muted-foreground mt-0.5">
                O&apos;qituvchi: {session.teacher_name}
              </p>
            )}
            {session.status === "finished" && typeof session.my_score === "number" && (
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                Natija: <span className="font-semibold text-foreground">{session.my_score} ball</span>
              </p>
            )}
          </div>

          <Button asChild variant={isActive ? "default" : "outline"} size="sm" className="shrink-0">
            <Link href={`/student/live/${session.id}`}>
              {isActive ? "Kirish" : "Ko'rish"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1 animate-pulse inline-block" />
        Jonli
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="outline" className="text-xs flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Kutilmoqda
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      Yakunlangan
    </Badge>
  );
}
