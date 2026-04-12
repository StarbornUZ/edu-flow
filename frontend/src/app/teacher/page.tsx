"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ClipboardCheck, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { TeacherDashboard } from "@/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export default function TeacherDashboardPage() {
  const [data, setData] = useState<TeacherDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<TeacherDashboard>("/dashboard/teacher")
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Boshqaruv paneli</h1>
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
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Ma&apos;lumotlarni yuklashda xatolik yuz berdi.
      </div>
    );
  }

  const stats = [
    {
      label: "Sinflar soni",
      value: data.classes.length,
      icon: BookOpen,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Kutilayotgan tekshiruvlar",
      value: data.pending_count,
      icon: ClipboardCheck,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "Muammoli savollar",
      value: data.problem_questions.length,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Boshqaruv paneli</h1>

      {/* Stats */}
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
                <p className="text-3xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pending Reviews */}
      {data.pending_reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Kutilayotgan tekshiruvlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>O&apos;quvchi</TableHead>
                  <TableHead>Vazifa</TableHead>
                  <TableHead>Urinish</TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pending_reviews.map((review) => (
                  <TableRow key={review.submission_id}>
                    <TableCell className="font-medium">
                      {review.student_name}
                    </TableCell>
                    <TableCell>{review.assignment_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">#{review.attempt_num}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(review.submitted_at).toLocaleDateString(
                        "uz-UZ"
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/teacher/assignments/${review.assignment_id}/submissions/${review.submission_id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Ko&apos;rish
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Problem Questions */}
      {data.problem_questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Muammoli savollar</CardTitle>
            <CardDescription>
              O&apos;quvchilar ko&apos;p xato qiladigan savollar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.problem_questions.map((q) => (
                <div
                  key={q.question_id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <p className="text-sm flex-1 mr-4 line-clamp-2">
                    {q.question_text}
                  </p>
                  <Badge variant="destructive">
                    {Math.round(q.error_rate * 100)}% xato
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
