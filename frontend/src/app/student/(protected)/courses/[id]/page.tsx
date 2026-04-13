"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, FileText, Video } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { Course, CourseModule, Topic } from "@/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const difficultyLabels: Record<string, string> = {
  beginner: "Boshlang'ich",
  intermediate: "O'rta",
  advanced: "Yuqori",
};

function CourseDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
      <Skeleton className="h-6 w-32" />
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function StudentCourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;

  const { data: course, isLoading: courseLoading } = useQuery<Course>({
    queryKey: ["course", courseId],
    queryFn: () => api.get(`/courses/${courseId}`).then((res) => res.data),
  });

  const { data: modules, isLoading: modulesLoading } = useQuery<CourseModule[]>({
    queryKey: ["course-modules", courseId],
    queryFn: () =>
      api.get(`/courses/${courseId}/modules`).then((res) => res.data),
  });

  if (courseLoading || modulesLoading) return <CourseDetailSkeleton />;

  if (!course) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Kurs topilmadi.
      </div>
    );
  }

  const sortedModules = [...(modules ?? [])].sort(
    (a, b) => a.order_number - b.order_number
  );

  return (
    <div className="space-y-6">
      {/* Course info header */}
      <div>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline">{course.subject}</Badge>
          <Badge variant="secondary">
            {difficultyLabels[course.difficulty] ?? course.difficulty}
          </Badge>
          {course.is_ai_generated && (
            <Badge variant="secondary">AI</Badge>
          )}
        </div>
      </div>

      {/* Course description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kurs ma&apos;lumotlari</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{course.description}</p>
          {course.cover_url && (
            <img
              src={course.cover_url}
              alt={course.title}
              className="w-full max-h-64 object-cover rounded-md mt-4"
            />
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Modules */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Modullar</h2>
        {sortedModules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Bu kursda hali modullar yo&apos;q.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedModules.map((mod, idx) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                courseId={courseId}
                index={idx}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleCard({
  module,
  courseId,
  index,
}: {
  module: CourseModule;
  courseId: string;
  index: number;
}) {
  const { data: topics } = useQuery<Topic[]>({
    queryKey: ["module-topics", module.id],
    queryFn: () =>
      api.get(`/modules/${module.id}/topics`).then((res) => res.data),
  });

  const sortedTopics = [...(topics ?? [])].sort(
    (a, b) => a.order_index - b.order_index
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">
              {module.order_number}. {module.title}
            </CardTitle>
          </div>
          {!module.is_published && (
            <Badge variant="secondary" className="w-fit text-xs">
              Chop etilmagan
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Mavzular
          </h4>
          {sortedTopics.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Mavzular hali qo&apos;shilmagan.
            </p>
          ) : (
            <div className="space-y-1">
              {sortedTopics.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/student/courses/${courseId}/topics/${topic.id}`}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    {topic.video_url ? (
                      <Video className="h-4 w-4 text-purple-500" />
                    ) : (
                      <FileText className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="text-sm">{topic.title}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
