"use client";

import { Users, GraduationCap, School, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { Class, User } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrgDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const orgId = user?.org_id;

  const { data: classes, isLoading: classesLoading } = useQuery<Class[]>({
    queryKey: ["org-classes"],
    queryFn: () => api.get<Class[]>("/classes/").then((r) => r.data),
    enabled: !!orgId,
  });

  const { data: members, isLoading: membersLoading } = useQuery<User[]>({
    queryKey: ["org-members", orgId],
    queryFn: () =>
      api.get<User[]>(`/organizations/${orgId}/members`).then((r) => r.data),
    enabled: !!orgId,
  });

  const isLoading = classesLoading || membersLoading;

  const teacherCount = members?.filter((m) => m.role === "teacher").length ?? 0;
  const studentCount = members?.filter((m) => m.role === "student").length ?? 0;

  const stats = [
    {
      label: "O'qituvchilar",
      value: teacherCount,
      icon: Users,
      color: "text-blue-600 bg-blue-100",
    },
    {
      label: "O'quvchilar",
      value: studentCount,
      icon: GraduationCap,
      color: "text-green-600 bg-green-100",
    },
    {
      label: "Sinflar",
      value: classes?.length ?? 0,
      icon: School,
      color: "text-purple-600 bg-purple-100",
    },
    {
      label: "Kurslar",
      value: 0,
      icon: BookOpen,
      color: "text-orange-600 bg-orange-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tashkilot boshqaruvi</h1>
        {user && (
          <p className="text-muted-foreground mt-1">
            Xush kelibsiz, {user.full_name}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </CardTitle>
                    <div className={`rounded-full p-2 ${stat.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stat.value}</p>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
