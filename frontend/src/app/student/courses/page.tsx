"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Course } from "@/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const difficultyLabels: Record<string, string> = {
  beginner: "Boshlang'ich",
  intermediate: "O'rta",
  advanced: "Yuqori",
};

function CoursesListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mening kurslarim</h1>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
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

export default function StudentCoursesPage() {
  const [classCode, setClassCode] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: courses, isLoading, isError } = useQuery<Course[]>({
    queryKey: ["student-courses"],
    queryFn: () => api.get("/courses/my").then((res) => res.data),
  });

  const joinMutation = useMutation({
    mutationFn: (code: string) =>
      api.post("/classes/join", { class_code: code }),
    onSuccess: () => {
      toast.success("Sinfga muvaffaqiyatli qo'shildingiz!");
      queryClient.invalidateQueries({ queryKey: ["student-courses"] });
      queryClient.invalidateQueries({ queryKey: ["student-dashboard"] });
      setClassCode("");
      setDialogOpen(false);
    },
    onError: () => {
      toast.error("Sinfga qo'shilishda xatolik yuz berdi. Kodni tekshiring.");
    },
  });

  const handleJoin = () => {
    const trimmed = classCode.trim();
    if (!trimmed) {
      toast.error("Sinf kodini kiriting");
      return;
    }
    joinMutation.mutate(trimmed);
  };

  if (isLoading) return <CoursesListSkeleton />;

  if (isError) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Kurslarni yuklashda xatolik yuz berdi.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mening kurslarim</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Sinfga qo&apos;shilish
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sinfga qo&apos;shilish</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="class-code">Sinf kodi</Label>
                <Input
                  id="class-code"
                  placeholder="Sinf kodini kiriting..."
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Bekor qilish</Button>
              </DialogClose>
              <Button
                onClick={handleJoin}
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending ? "Qo'shilmoqda..." : "Qo'shilish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!courses || courses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Hozircha kurslar yo&apos;q</p>
            <p className="text-sm">
              Sinf kodini kiritib, yangi kursga yoziling.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, idx) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Link href={`/student/courses/${course.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  {course.cover_url && (
                    <div className="relative w-full h-40">
                      <Image
                        src={course.cover_url}
                        alt={course.title}
                        fill
                        className="object-cover rounded-t-lg"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {course.subject}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {difficultyLabels[course.difficulty] ?? course.difficulty}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{course.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="line-clamp-2">
                      {course.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
