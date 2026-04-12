"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Flame,
  Star,
  Trophy,
  BookOpen,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { User, StudentDashboard } from "@/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

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

interface ChildData {
  student: User;
  dashboard: StudentDashboard;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Farzandlarim</h1>
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ChildCard({ child }: { child: ChildData }) {
  const [expanded, setExpanded] = useState(false);
  const { student, dashboard } = child;

  const xpInLevel = dashboard.xp % XP_PER_LEVEL;
  const xpProgress = (xpInLevel / XP_PER_LEVEL) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="overflow-hidden">
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={student.avatar_url ?? undefined} />
                <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                  {getInitials(student.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{student.full_name}</CardTitle>
                <CardDescription className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-yellow-500" />
                    {getLevelName(dashboard.level)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5 text-purple-500" />
                    {dashboard.xp} XP
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                    {dashboard.streak_count} kun
                  </span>
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="hidden sm:flex gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {dashboard.active_courses_count} faol kurs
              </Badge>
              {expanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>

        {/* Summary stats row */}
        <CardContent className="pt-0 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Star className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Daraja</p>
                <p className="text-sm font-semibold">
                  {getLevelName(dashboard.level)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-50">
                <Trophy className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tajriba ballari</p>
                <p className="text-sm font-semibold">{dashboard.xp} XP</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-50">
                <Flame className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kunlik streak</p>
                <p className="text-sm font-semibold">
                  {dashboard.streak_count} kun
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50">
                <BookOpen className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Faol kurslar</p>
                <p className="text-sm font-semibold">
                  {dashboard.active_courses_count}
                </p>
              </div>
            </div>
          </div>

          {/* XP progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                {getLevelName(dashboard.level)} &rarr;{" "}
                {getLevelName(dashboard.level + 1)}
              </span>
              <span className="text-xs text-muted-foreground">
                {xpInLevel} / {XP_PER_LEVEL} XP
              </span>
            </div>
            <Progress value={xpProgress} className="h-2" />
          </div>
        </CardContent>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <Separator />
              <CardContent className="pt-4 space-y-6">
                {/* Active courses */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    Faol kurslar
                  </h3>
                  {dashboard.active_courses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Hozircha faol kurslar yo&apos;q.
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {dashboard.active_courses.map((course) => (
                        <Card key={course.course_id} className="border-dashed">
                          <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {course.subject}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {course.difficulty}
                              </Badge>
                            </div>
                            <p className="font-medium text-sm mt-2">
                              {course.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {course.completed_modules} modul tugatilgan
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent achievements */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    So&apos;nggi yutuqlar
                  </h3>
                  {dashboard.recent_achievements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Hali yutuqlar yo&apos;q.
                    </p>
                  ) : (
                    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {dashboard.recent_achievements.map(
                        (achievement, idx) => (
                          <div
                            key={`${achievement.badge_type}-${idx}`}
                            className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50"
                          >
                            <Trophy className="h-5 w-5 text-yellow-500 shrink-0" />
                            <div>
                              <p className="text-xs font-medium">
                                {achievement.badge_type}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(
                                  achievement.earned_at
                                ).toLocaleDateString("uz-UZ")}
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export default function ParentDashboardPage() {
  const { data, isLoading, isError } = useQuery<ChildData[]>({
    queryKey: ["parent-children"],
    queryFn: () => api.get("/parent/children").then((res) => res.data),
  });

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Ma&apos;lumotlarni yuklashda xatolik yuz berdi.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50">
          <Users className="h-5 w-5 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold">Farzandlarim</h1>
        <Badge variant="secondary" className="text-sm">
          {data.length}
        </Badge>
      </div>

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Hozircha bog&apos;langan farzandlar yo&apos;q.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.map((child) => (
            <ChildCard key={child.student.id} child={child} />
          ))}
        </div>
      )}
    </div>
  );
}
