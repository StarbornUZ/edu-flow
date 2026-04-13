"use client";

import { use, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Eye, EyeOff, Sparkles,
  Loader2, ChevronDown, ChevronRight, Pencil, Check, X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Topic, CourseModule, Course } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";

// ── Inline topic editor ───────────────────────────────────────────────────────

interface TopicCardProps {
  topic: Topic;
  courseSubject: string;
  onUpdate: (id: string, patch: Partial<Topic>) => void;
  onDelete: (id: string) => void;
}

function TopicCard({ topic, courseSubject, onUpdate, onDelete }: TopicCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [titleDraft, setTitleDraft] = useState(topic.title);
  const [contentDraft, setContentDraft] = useState(topic.content_md ?? "");
  const [generatingContent, setGeneratingContent] = useState(false);

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft !== topic.title) {
      onUpdate(topic.id, { title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const saveContent = () => {
    onUpdate(topic.id, { content_md: contentDraft });
    setEditingContent(false);
  };

  const generateContent = async () => {
    setGeneratingContent(true);
    try {
      const { data } = await api.post<{ content_md: string }>("/ai/generate-topic", {
        topic_title: topic.title,
        subject: courseSubject,
        grade_level: 9,
      });
      setContentDraft(data.content_md);
      onUpdate(topic.id, { content_md: data.content_md });
      setExpanded(true);
      toast.success("Kontent yaratildi");
    } catch {
      toast.error("Kontent yaratishda xatolik");
    } finally {
      setGeneratingContent(false);
    }
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          >
            {expanded
              ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground font-mono w-5">{topic.order_index + 1}.</span>

            {editingTitle ? (
              <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                <Input
                  className="h-7 text-sm"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                  autoFocus
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveTitle}><Check className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTitle(false)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            ) : (
              <span className="font-medium text-sm truncate">{topic.title}</span>
            )}
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={topic.is_published ? "default" : "outline"} className="text-xs">
              {topic.is_published ? "Nashr" : "Qoralama"}
            </Badge>

            {generatingContent
              ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              : (
                <Button variant="ghost" size="icon" className="h-7 w-7" title="AI kontent yaratish" onClick={generateContent}>
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
              )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTitle(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7"
              onClick={() => onUpdate(topic.id, { is_published: !topic.is_published })}
              title={topic.is_published ? "Qoralamaga qaytarish" : "Nashr etish"}
            >
              {topic.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(topic.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4">
          {editingContent ? (
            <div className="space-y-2">
              <Textarea
                className="min-h-[300px] font-mono text-sm"
                value={contentDraft}
                onChange={(e) => setContentDraft(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveContent}>Saqlash</Button>
                <Button size="sm" variant="outline" onClick={() => { setContentDraft(topic.content_md ?? ""); setEditingContent(false); }}>
                  Bekor qilish
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative group">
              {topic.content_md ? (
                <div className="prose prose-sm max-w-none rounded-md bg-muted/30 p-3 text-sm whitespace-pre-wrap font-mono">
                  {topic.content_md.slice(0, 500)}{topic.content_md.length > 500 ? "..." : ""}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic py-3">
                  Hali kontent yo&apos;q. AI tugmasi yoki tahrirlash bilan qo&apos;shing.
                </div>
              )}
              <Button
                size="sm" variant="outline"
                className="mt-2"
                onClick={() => { setContentDraft(topic.content_md ?? ""); setEditingContent(true); }}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Tahrirlash
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Add topic form ────────────────────────────────────────────────────────────

interface AddTopicFormProps {
  moduleId: string;
  courseSubject: string;
  onAdded: () => void;
}

function AddTopicForm({ moduleId, courseSubject, onAdded }: AddTopicFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [generateAi, setGenerateAi] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      let content_md: string | null = null;

      if (generateAi) {
        const aiRes = await api.post<{ content_md: string }>("/ai/generate-topic", {
          topic_title: title.trim(),
          subject: courseSubject,
          grade_level: 9,
        });
        content_md = aiRes.data.content_md;
      }

      await api.post(`/modules/${moduleId}/topics`, {
        title: title.trim(),
        content_md,
      });

      toast.success("Mavzu qo'shildi");
      setTitle("");
      setGenerateAi(false);
      setOpen(false);
      onAdded();
    } catch {
      toast.error("Mavzu qo'shishda xatolik");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Mavzu qo&apos;shish
      </Button>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="pt-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Mavzu nomi *</Label>
          <Input
            placeholder="Masalan: Kvadrat tenglamalar"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !saving && title.trim() && handleAdd()}
            autoFocus
          />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={generateAi}
            onChange={(e) => setGenerateAi(e.target.checked)}
            className="rounded"
          />
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          AI yordamida kontent yaratish
        </label>

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={saving || !title.trim()}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            {saving ? (generateAi ? "AI yozmoqda..." : "Qo'shilmoqda...") : "Qo'shish"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setOpen(false); setTitle(""); setGenerateAi(false); }}>
            Bekor qilish
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TopicsPage() {
  const params = useParams();
  const courseId = params.id as string;
  const moduleId = params.moduleId as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: modules = [] } = useQuery<CourseModule[]>({
    queryKey: ["course-modules", courseId],
    queryFn: () => api.get<CourseModule[]>(`/courses/${courseId}/modules`).then((r) => r.data),
    enabled: !!courseId,
  });

  const { data: course } = useQuery<Course>({
    queryKey: ["course", courseId],
    queryFn: () => api.get<Course>(`/courses/${courseId}`).then((r) => r.data),
    enabled: !!courseId,
  });

  const { data: topics = [], isLoading } = useQuery<Topic[]>({
    queryKey: ["module-topics", moduleId],
    queryFn: () => api.get<Topic[]>(`/modules/${moduleId}/topics`).then((r) => r.data),
    enabled: !!moduleId,
  });

  const currentModule = modules.find((m) => m.id === moduleId);
  const courseSubject = course?.subject ?? "Umumiy fan";

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Topic> }) =>
      api.patch(`/modules/${moduleId}/topics/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["module-topics", moduleId] }),
    onError: () => toast.error("Saqlashda xatolik"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/modules/${moduleId}/topics/${id}`),
    onSuccess: () => {
      toast.success("Mavzu o'chirildi");
      queryClient.invalidateQueries({ queryKey: ["module-topics", moduleId] });
    },
    onError: () => toast.error("O'chirishda xatolik"),
  });

  const handleUpdate = (id: string, patch: Partial<Topic>) => {
    updateMutation.mutate({ id, patch });
  };

  const handleDelete = (id: string) => {
    if (confirm("Mavzuni o'chirishni tasdiqlaysizmi?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/teacher/courses/${courseId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Kursga qaytish
        </Button>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">
          {course?.title ?? "Kurs"} › {currentModule ? `${currentModule.order_number}. ${currentModule.title}` : "Modul"}
        </p>
        <h1 className="text-2xl font-bold mt-0.5">Mavzular</h1>
      </div>

      {/* Topics list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {[...topics]
            .sort((a, b) => a.order_index - b.order_index)
            .map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                courseSubject={courseSubject}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}

          {topics.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <p className="text-sm">Hali mavzular yo&apos;q.</p>
            </div>
          )}

          <AddTopicForm
            moduleId={moduleId}
            courseSubject={courseSubject}
            onAdded={() => queryClient.invalidateQueries({ queryKey: ["module-topics", moduleId] })}
          />
        </div>
      )}
    </div>
  );
}
