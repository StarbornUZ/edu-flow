"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Flame, Star, Trophy, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { StudentDashboard } from "@/types";
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

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mening natijalarim</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function StudentDashboardPage() {
  const { data, isLoading, isError } = useQuery<StudentDashboard>({
    queryKey: ["student-dashboard"],
    queryFn: () => api.get("/dashboard/student").then((res) => res.data),
  });

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Ma&apos;lumotlarni yuklashda xatolik yuz berdi.
      </div>
    );
  }

  const xpInLevel = data.xp % XP_PER_LEVEL;
  const xpProgress = (xpInLevel / XP_PER_LEVEL) * 100;

  const stats = [
    {
      label: "Daraja",
      value: getLevelName(data.level),
      sub: `${data.level}-daraja`,
      icon: Star,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      label: "Tajriba ballari",
      value: `${data.xp} XP`,
      sub: `${xpInLevel}/${XP_PER_LEVEL} keyingi daraja`,
      icon: Trophy,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Kunlik streak",
      value: `${data.streak_count} kun`,
      sub: data.streak_last_date
        ? `Oxirgi: ${new Date(data.streak_last_date).toLocaleDateString("uz-UZ")}`
        : "Hali boshlanmagan",
      icon: Flame,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mening natijalarim</h1>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* XP Progress bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {getLevelName(data.level)} &rarr; {getLevelName(data.level + 1)}
            </span>
            <span className="text-sm text-muted-foreground">
              {xpInLevel} / {XP_PER_LEVEL} XP
            </span>
          </div>
          <Progress value={xpProgress} className="h-3" />
        </CardContent>
      </Card>

      {/* Active courses */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Faol kurslar ({data.active_courses_count})
        </h2>
        {data.active_courses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Hozircha faol kurslar yo&apos;q. Kurslar bo&apos;limidan yangi kursga yoziling.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.active_courses.map((course, idx) => (
              <motion.div
                key={course.course_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
              >
                <Link href={`/student/courses/${course.course_id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        <Badge variant="outline" className="text-xs">
                          {course.subject}
                        </Badge>
                      </div>
                      <CardTitle className="text-base">{course.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                        <span>Qiyinlik: {course.difficulty}</span>
                        <span>{course.completed_modules} modul</span>
                      </div>
                      {course.cover_url && (
                        <div className="relative w-full h-32 mt-2">
                          <Image
                            src={course.cover_url}
                            alt={course.title}
                            fill
                            className="object-cover rounded-md"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Recent achievements */}
      <div>
        <h2 className="text-lg font-semibold mb-3">So&apos;nggi yutuqlar</h2>
        {data.recent_achievements.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Hali yutuqlar yo&apos;q. Vazifalarni bajaring va yutuqlarga erishing!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {data.recent_achievements.map((achievement, idx) => (
              <motion.div
                key={`${achievement.badge_type}-${idx}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
              >
                <Card>
                  <CardContent className="pt-4 text-center">
                    <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <p className="font-medium text-sm">{achievement.badge_type}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(achievement.earned_at).toLocaleDateString("uz-UZ")}
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
