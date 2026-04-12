"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { Course } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CourseCard from "@/components/teacher/CourseCard";

export default function CoursesListPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Course[]>("/courses")
      .then((res) => setCourses(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kurslar</h1>
        <div className="flex gap-2">
          <Link href="/teacher/courses/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Yangi kurs yaratish
            </Button>
          </Link>
          <Link href="/teacher/courses/new">
            <Button variant="outline">
              <Sparkles className="h-4 w-4 mr-2" />
              AI bilan yaratish
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg border p-6 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Hali kurslar yo&apos;q</h3>
          <p className="text-muted-foreground mb-4">
            Birinchi kursingizni yarating va o&apos;quvchilaringizga bilim bering
          </p>
          <Link href="/teacher/courses/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Kurs yaratish
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, idx) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <CourseCard course={course} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
