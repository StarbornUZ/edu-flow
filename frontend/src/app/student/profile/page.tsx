"use client";

import { useQuery } from "@tanstack/react-query";
import { Star, Flame, Trophy, Award } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { Badge as BadgeType } from "@/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

const LEVEL_NAMES = [
  "Boshlang'ich",
  "O'rganuvchi",
  "Bilimdon",
  "Ustoz",
  "Mutaxassis",
  "Grandmaster",
];

const XP_PER_LEVEL = 1000;

function getLevelName(level: number) {
  return LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length - 1)] ?? LEVEL_NAMES[0];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Mening profilim</h1>
      <Card>
        <CardContent className="pt-6 flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-24 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function StudentProfilePage() {
  const user = useAuthStore((s) => s.user);

  const { data: badges, isLoading: badgesLoading } = useQuery<BadgeType[]>({
    queryKey: ["student-badges"],
    queryFn: () => api.get("/student/badges").then((res) => res.data),
  });

  if (!user) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Foydalanuvchi ma&apos;lumotlari topilmadi.
      </div>
    );
  }

  const xpInLevel = user.xp % XP_PER_LEVEL;
  const xpProgress = (xpInLevel / XP_PER_LEVEL) * 100;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Mening profilim</h1>

      {/* User info card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.avatar_url ?? undefined} />
                <AvatarFallback className="text-lg">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">{user.full_name}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.phone && (
                  <p className="text-sm text-muted-foreground">{user.phone}</p>
                )}
                <Badge variant="secondary" className="mt-1">
                  {getLevelName(user.level)} ({user.level}-daraja)
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="pt-6 text-center">
              <Star className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{user.xp}</p>
              <p className="text-sm text-muted-foreground">Tajriba ballari</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="pt-6 text-center">
              <Trophy className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{getLevelName(user.level)}</p>
              <p className="text-sm text-muted-foreground">Daraja</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="pt-6 text-center">
              <Flame className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{user.streak_count} kun</p>
              <p className="text-sm text-muted-foreground">Kunlik streak</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* XP Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {getLevelName(user.level)} &rarr; {getLevelName(user.level + 1)}
            </span>
            <span className="text-sm text-muted-foreground">
              {xpInLevel} / {XP_PER_LEVEL} XP
            </span>
          </div>
          <Progress value={xpProgress} className="h-3" />
        </CardContent>
      </Card>

      <Separator />

      {/* Badges / Achievements */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Nishonlar</h2>
        {badgesLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-10 w-10 rounded-full mx-auto" />
                  <Skeleton className="h-4 w-24 mx-auto mt-2" />
                  <Skeleton className="h-3 w-32 mx-auto mt-1" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !badges || badges.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Hali nishonlar yo&apos;q.</p>
              <p className="text-sm mt-1">
                Vazifalarni bajaring va nishonlarga ega bo&apos;ling!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {badges.map((badge, idx) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card>
                  <CardContent className="pt-6 text-center">
                    <span className="text-3xl block mb-2">
                      {badge.icon || "🏆"}
                    </span>
                    <p className="font-medium text-sm">{badge.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {badge.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
