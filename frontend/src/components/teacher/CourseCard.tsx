"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Course } from "@/types";

interface CourseCardProps {
  course: Course;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Qoralama", variant: "outline" },
  published: { label: "Chop etilgan", variant: "default" },
  archived: { label: "Arxivlangan", variant: "destructive" },
};

const difficultyLabels: Record<string, string> = {
  beginner: "Boshlang'ich",
  intermediate: "O'rta",
  advanced: "Yuqori",
};

export default function CourseCard({ course }: CourseCardProps) {
  const status = statusConfig[course.status] || statusConfig.draft;

  return (
    <Link href={`/teacher/courses/${course.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg line-clamp-2">
              {course.title}
            </CardTitle>
            <Badge
              variant={status.variant}
              className={
                course.status === "published"
                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                  : ""
              }
            >
              {status.label}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2">
            {course.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{course.subject}</Badge>
            <Badge variant="outline">
              {difficultyLabels[course.difficulty] || course.difficulty}
            </Badge>
          </div>
          <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {new Date(course.created_at).toLocaleDateString("uz-UZ")}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
