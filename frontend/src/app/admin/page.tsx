"use client";

import { Users, Building2, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Organization, OrgRequest } from "@/types";

interface AdminStats {
  total_users: number;
  total_organizations: number;
  pending_requests: number;
}

export default function AdminDashboardPage() {
  const { data: orgs, isLoading: orgsLoading, isError: orgsError } = useQuery<Organization[]>({
    queryKey: ["admin", "organizations"],
    queryFn: async () => {
      const res = await api.get<Organization[]>("/organizations/");
      return res.data;
    },
  });

  const { data: requests, isLoading: requestsLoading, isError: requestsError } = useQuery<OrgRequest[]>({
    queryKey: ["admin", "org-requests"],
    queryFn: async () => {
      const res = await api.get<OrgRequest[]>("/organizations/requests");
      return res.data;
    },
  });

  const isLoading = orgsLoading || requestsLoading;
  const isError = orgsError || requestsError;

  const data: AdminStats | null =
    orgs && requests
      ? {
          total_users: 0,
          total_organizations: orgs.length,
          pending_requests: requests.filter((r) => r.status === "pending").length,
        }
      : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Boshqaruv paneli</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Ma&apos;lumotlarni yuklashda xatolik yuz berdi.
      </div>
    );
  }

  const stats = [
    {
      label: "Foydalanuvchilar",
      value: data.total_users,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Tashkilotlar",
      value: data.total_organizations,
      icon: Building2,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Kutilayotgan so'rovlar",
      value: data.pending_requests,
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Boshqaruv paneli</h1>

      {/* Statistika */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Kutilayotgan so'rovlar haqida xabar */}
      {data.pending_requests > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Diqqat</CardTitle>
            <CardDescription>
              {data.pending_requests} ta tashkilot so&apos;rovi ko&apos;rib chiqilishini kutmoqda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="/admin/requests"
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              So&apos;rovlarni ko&apos;rish →
            </a>
          </CardContent>
        </Card>
      )}

      {/* Umumiy ma'lumot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Platforma haqida</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Jami foydalanuvchilar</p>
                <p className="text-lg font-semibold">{data.total_users}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Jami tashkilotlar</p>
                <p className="text-lg font-semibold">{data.total_organizations}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Kutilayotgan</p>
                <p className="text-lg font-semibold">
                  <Badge variant={data.pending_requests > 0 ? "destructive" : "secondary"}>
                    {data.pending_requests}
                  </Badge>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
