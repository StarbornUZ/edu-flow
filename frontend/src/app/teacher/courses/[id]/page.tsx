"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  FileText,
  CheckCircle,
  Trash2,
  School,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { Course, CourseModule, Class } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const difficultyLabels: Record<string, string> = {
  beginner: "Boshlang'ich",
  intermediate: "O'rta",
  advanced: "Yuqori",
};

const statusLabels: Record<string, string> = {
  draft: "Qoralama",
  published: "Chop etilgan",
  archived: "Arxivlangan",
};

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Add module dialog
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  // Assign class dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: course, isLoading: courseLoading } = useQuery<Course>({
    queryKey: ["course", courseId],
    queryFn: () => api.get<Course>(`/courses/${courseId}`).then((r) => r.data),
    enabled: !!courseId,
  });

  const { data: modules = [], isLoading: modulesLoading } = useQuery<CourseModule[]>({
    queryKey: ["course-modules", courseId],
    queryFn: () => api.get<CourseModule[]>(`/courses/${courseId}/modules`).then((r) => r.data),
    enabled: !!courseId,
  });

  // All classes teacher can assign (teacher's own classes)
  const { data: allClasses = [] } = useQuery<Class[]>({
    queryKey: ["teacher-classes"],
    queryFn: () => api.get<Class[]>("/classes/").then((r) => r.data),
    enabled: !!user,
  });

  // Classes already assigned to this course
  const { data: assignedClasses = [], isLoading: assignedLoading } = useQuery<Class[]>({
    queryKey: ["course-classes", courseId],
    queryFn: () => api.get<Class[]>(`/courses/${courseId}/classes`).then((r) => r.data),
    enabled: !!courseId,
  });

  // ── Mutations ─────────────────────────────────────────────────────────
  const publishMutation = useMutation({
    mutationFn: () => api.post(`/courses/${courseId}/publish`),
    onSuccess: () => {
      toast.success("Kurs nashr etildi");
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
    },
    onError: () => toast.error("Nashr etishda xatolik"),
  });

  const addModuleMutation = useMutation({
    mutationFn: () =>
      api.post<CourseModule>(`/courses/${courseId}/modules`, { title: newModuleTitle }),
    onSuccess: () => {
      toast.success("Modul qo'shildi");
      queryClient.invalidateQueries({ queryKey: ["course-modules", courseId] });
      setNewModuleTitle("");
      setModuleDialogOpen(false);
    },
    onError: () => toast.error("Modul qo'shishda xatolik"),
  });

  const assignClassMutation = useMutation({
    mutationFn: (classId: string) =>
      api.post(`/classes/${classId}/enroll`, { course_id: courseId }),
    onSuccess: () => {
      toast.success("Sinf kursga biriktirildi");
      queryClient.invalidateQueries({ queryKey: ["course-classes", courseId] });
      setSelectedClassId("");
      setAssignDialogOpen(false);
    },
    onError: () => toast.error("Biriktrishda xatolik. Sinf allaqachon biriktirilgan bo'lishi mumkin."),
  });

  const removeClassMutation = useMutation({
    mutationFn: (classId: string) =>
      api.delete(`/courses/${courseId}/classes/${classId}`),
    onSuccess: () => {
      toast.success("Sinf kursdan olib tashlandi");
      queryClient.invalidateQueries({ queryKey: ["course-classes", courseId] });
    },
    onError: () => toast.error("Olib tashlashda xatolik"),
  });

  // ── Helpers ───────────────────────────────────────────────────────────
  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  // Classes not yet assigned to this course
  const assignedIds = new Set(assignedClasses.map((c) => c.id));
  const availableClasses = allClasses.filter((c) => !assignedIds.has(c.id));

  const isLoading = courseLoading || modulesLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Kurs topilmadi
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Course Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{course.title}</CardTitle>
              <CardDescription className="mt-2">
                {course.description}
              </CardDescription>
            </div>
            {course.status === "draft" && (
              <Button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
              >
                {publishMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                <CheckCircle className="h-4 w-4 mr-2" />
                Chop etish
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{course.subject}</Badge>
            <Badge variant="outline">
              {difficultyLabels[course.difficulty] || course.difficulty}
            </Badge>
            <Badge
              variant={course.status === "published" ? "default" : "outline"}
              className={
                course.status === "published"
                  ? "bg-green-100 text-green-800"
                  : ""
              }
            >
              {statusLabels[course.status] || course.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Modules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Modullar</h2>
          <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Modul qo&apos;shish
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yangi modul qo&apos;shish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="module-title">Modul nomi</Label>
                  <Input
                    id="module-title"
                    placeholder="Masalan: 1-modul: Kirish"
                    value={newModuleTitle}
                    onChange={(e) => setNewModuleTitle(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !addModuleMutation.isPending && newModuleTitle && addModuleMutation.mutate()
                    }
                  />
                </div>
                <Button
                  onClick={() => addModuleMutation.mutate()}
                  disabled={addModuleMutation.isPending || !newModuleTitle}
                  className="w-full"
                >
                  {addModuleMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Qo&apos;shish
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {modules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Hali modullar yo&apos;q. Yangi modul qo&apos;shing.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {[...modules]
              .sort((a, b) => a.order_number - b.order_number)
              .map((mod) => (
                <Card key={mod.id}>
                  <CardHeader
                    className="cursor-pointer py-4"
                    onClick={() => toggleModule(mod.id)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedModules.has(mod.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <CardTitle className="text-base">
                        {mod.order_number}. {mod.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <AnimatePresence>
                    {expandedModules.has(mod.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <CardContent className="pt-0">
                          <Link
                            href={`/teacher/courses/${courseId}/topics/${mod.id}`}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                          >
                            <FileText className="h-4 w-4" />
                            Mavzularni boshqarish
                          </Link>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              ))}
          </div>
        )}
      </div>

      {/* Assigned Classes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Biriktirilgan sinflar</CardTitle>
              <CardDescription>
                Bu kursni o&apos;qiyotgan sinflar
              </CardDescription>
            </div>
            <Dialog open={assignDialogOpen} onOpenChange={(v) => { setAssignDialogOpen(v); setSelectedClassId(""); }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={availableClasses.length === 0 && !assignedLoading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Sinf biriktirish
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Kursga sinf biriktirish</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {availableClasses.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Barcha sinflar allaqachon biriktirilgan
                    </p>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <Label>Sinf tanlang</Label>
                        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sinf tanlang" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableClasses.map((cls) => (
                              <SelectItem key={cls.id} value={cls.id}>
                                {cls.name}
                                {cls.academic_year ? ` (${cls.academic_year})` : ""}
                                {cls.grade_level ? ` — ${cls.grade_level}-sinf` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => assignClassMutation.mutate(selectedClassId)}
                        disabled={assignClassMutation.isPending || !selectedClassId}
                      >
                        {assignClassMutation.isPending && (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        )}
                        Biriktirish
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {assignedLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : assignedClasses.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <School className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Hali sinf biriktirilmagan</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignedClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-sm">{cls.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cls.academic_year}
                      {cls.grade_level ? ` · ${cls.grade_level}-sinf` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeClassMutation.mutate(cls.id)}
                    disabled={removeClassMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
