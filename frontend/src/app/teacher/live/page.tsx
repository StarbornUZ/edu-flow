"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Radio, Clock, CheckCircle, PlayCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LiveSession } from "@/types";

const GAME_TYPE_LABELS: Record<string, string> = {
  blitz: "Blitz Jang",
  lucky_card: "Omad Sinovi",
  relay: "Zanjir Savol",
  question_duel: "Savol Dueli",
  territory: "Xarita Jang",
  pyramid: "Piramida",
  puzzle: "Topishmoq",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("uz-UZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return <Badge className="bg-green-100 text-green-700 border-green-200">Faol</Badge>;
  }
  if (status === "pending") {
    return <Badge variant="outline" className="text-amber-600 border-amber-300">Kutmoqda</Badge>;
  }
  return <Badge variant="secondary">Yakunlangan</Badge>;
}

export default function TeacherLiveSessionsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<LiveSession[]>("/live-sessions/")
      .then((res) => setSessions(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const active = sessions.filter((s) => s.status === "active");
  const pending = sessions.filter((s) => s.status === "pending");
  const finished = sessions.filter((s) => s.status === "finished");

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  const SessionCard = ({ session }: { session: LiveSession }) => (
    <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Radio className="h-5 w-5 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">
                {GAME_TYPE_LABELS[session.game_type] ?? session.game_type}
              </span>
              <StatusBadge status={session.status} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {session.questions?.length ?? 0} ta savol
              {session.created_at && ` • ${formatDate(session.created_at as unknown as string)}`}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <Link href={`/teacher/live/${session.id}`}>
            <Button size="sm" variant={session.status === "finished" ? "outline" : "default"}>
              {session.status === "finished" ? "Natijalar" : "Boshqaruv"}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jonli darslar</h1>
          <p className="text-sm text-gray-500 mt-1">Barcha musobaqa sessiyalaringiz</p>
        </div>
        <Link href="/teacher/live/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Yangi musobaqa
          </Button>
        </Link>
      </div>

      {/* Active */}
      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <PlayCircle className="h-5 w-5 text-green-600" />
            <h2 className="text-base font-semibold text-gray-800">Faol ({active.length})</h2>
          </div>
          <div className="space-y-3">
            {active.map((s) => <SessionCard key={s.id} session={s} />)}
          </div>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-800">Boshlanmagan ({pending.length})</h2>
          </div>
          <div className="space-y-3">
            {pending.map((s) => <SessionCard key={s.id} session={s} />)}
          </div>
        </div>
      )}

      {/* Finished */}
      {finished.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-800">Yakunlangan ({finished.length})</h2>
          </div>
          <div className="space-y-3">
            {finished.map((s) => <SessionCard key={s.id} session={s} />)}
          </div>
        </div>
      )}

      {/* Empty */}
      {sessions.length === 0 && (
        <div className="text-center py-20">
          <Radio className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Hali musobaqalar yo&apos;q</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">Birinchi musobaqangizni yarating</p>
          <Link href="/teacher/live/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Yangi musobaqa
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
