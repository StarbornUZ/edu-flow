"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  FileText,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
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

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set()
  );

  // Add module dialog
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addingModule, setAddingModule] = useState(false);

  // Assign class
  const [selectedClassId, setSelectedClassId] = useState("");
  const [assigningClass, setAssigningClass] = useState(false);

  // Publishing
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [courseRes, modulesRes, classesRes] = await Promise.all([
          api.get<Course>(`/courses/${courseId}`),
          api.get<CourseModule[]>(`/courses/${courseId}/modules`),
          api.get<Class[]>("/classes/"),
        ]);
        setCourse(courseRes.data);
        setModules(modulesRes.data);
        setClasses(classesRes.data);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [courseId]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await api.post(`/courses/${courseId}/publish`);
      setCourse((prev) => (prev ? { ...prev, status: "published" } : prev));
    } catch {
      // handle error
    } finally {
      setPublishing(false);
    }
  };

  const handleAddModule = async () => {
    if (!newModuleTitle) return;
    setAddingModule(true);
    try {
      const res = await api.post<CourseModule>(`/courses/${courseId}/modules`, {
        title: newModuleTitle,
      });
      setModules((prev) => [...prev, res.data]);
      setNewModuleTitle("");
      setModuleDialogOpen(false);
    } catch {
      // handle error
    } finally {
      setAddingModule(false);
    }
  };

  const handleAssignClass = async () => {
    if (!selectedClassId) return;
    setAssigningClass(true);
    try {
      await api.post(`/classes/${selectedClassId}/enroll`, { course_id: courseId });
      setSelectedClassId("");
    } catch {
      // handle error
    } finally {
      setAssigningClass(false);
    }
  };

  if (loading) {
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
              <Button onClick={handlePublish} disabled={publishing}>
                {publishing && (
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
                  />
                </div>
                <Button
                  onClick={handleAddModule}
                  disabled={addingModule || !newModuleTitle}
                  className="w-full"
                >
                  {addingModule && (
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
            {modules
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

      {/* Assign Class */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sinf biriktirish</CardTitle>
          <CardDescription>
            Kursni sinflarga biriktiring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sinf tanlang" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name} - {cls.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAssignClass}
              disabled={assigningClass || !selectedClassId}
            >
              {assigningClass && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Biriktirish
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
