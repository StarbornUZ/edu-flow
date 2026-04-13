"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, CheckCircle, ChevronDown, ChevronRight, Pencil, Check, X } from "lucide-react";
import { api, BASE_URL } from "@/lib/api";
import type { Subject } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AiTopic {
  title: string;
  content_md: string;
}

interface AiModule {
  title: string;
  description: string;
  topics: AiTopic[] | null; // null = pending generation
}

interface AiCourse {
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  subject: string;
  grade_level: number;
  modules: AiModule[];
}

type GenPhase = "idle" | "modules" | "topics" | "done" | "error";

const difficultyLabels: Record<string, string> = {
  beginner: "Boshlang'ich",
  intermediate: "O'rta",
  advanced: "Yuqori",
};

// ── Inline editable field ─────────────────────────────────────────────────────

function EditableText({
  value, onChange, multiline = false, className = "",
}: { value: string; onChange: (v: string) => void; multiline?: boolean; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    return (
      <div className="space-y-1">
        {multiline
          ? <Textarea className={`text-sm ${className}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} autoFocus />
          : <Input className={`text-sm ${className}`} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }} />}
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={save}><Check className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={cancel}><X className="h-3 w-3" /></Button>
        </div>
      </div>
    );
  }

  return (
    <span
      className={`group cursor-pointer rounded px-0.5 hover:bg-muted transition-colors ${className}`}
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      {value}
      <Pencil className="inline h-3 w-3 ml-1 opacity-0 group-hover:opacity-40 transition-opacity" />
    </span>
  );
}

// ── Course preview with editable fields ──────────────────────────────────────

function CoursePreview({
  course, onChange,
}: { course: AiCourse; onChange: (c: AiCourse) => void }) {
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set([0]));

  const updateModule = (mi: number, patch: Partial<AiModule>) =>
    onChange({ ...course, modules: course.modules.map((m, i) => i === mi ? { ...m, ...patch } : m) });

  const updateTopic = (mi: number, ti: number, patch: Partial<AiTopic>) =>
    onChange({
      ...course,
      modules: course.modules.map((m, i) =>
        i === mi
          ? { ...m, topics: (m.topics ?? []).map((t, j) => j === ti ? { ...t, ...patch } : t) }
          : m
      ),
    });

  const toggleModule = (i: number) =>
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <div className="space-y-4">
      {/* Course header */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Kurs nomi</p>
            <h2 className="text-lg font-bold">
              <EditableText value={course.title} onChange={(v) => onChange({ ...course, title: v })} />
            </h2>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Tavsif</p>
            <p className="text-sm">
              <EditableText value={course.description} onChange={(v) => onChange({ ...course, description: v })} multiline />
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary">{course.subject}</Badge>
            <Badge variant="outline">{difficultyLabels[course.difficulty] ?? course.difficulty}</Badge>
            <Badge variant="outline">{course.grade_level}-sinf</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Modules */}
      {course.modules.map((mod, mi) => (
        <Card key={mi} className={mod.topics === null ? "opacity-60" : ""}>
          <CardHeader
            className="py-3 px-4 cursor-pointer"
            onClick={() => toggleModule(mi)}
          >
            <div className="flex items-center gap-2">
              {expandedModules.has(mi)
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span className="text-xs text-muted-foreground font-mono w-5">{mi + 1}.</span>
              <CardTitle className="text-sm font-semibold flex-1">
                <span onClick={(e) => e.stopPropagation()}>
                  <EditableText value={mod.title} onChange={(v) => updateModule(mi, { title: v })} />
                </span>
              </CardTitle>
              {mod.topics === null && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {mod.topics !== null && (
                <Badge variant="outline" className="text-xs">{mod.topics.length} mavzu</Badge>
              )}
            </div>
          </CardHeader>

          {expandedModules.has(mi) && mod.topics !== null && (
            <CardContent className="pt-0 px-4 pb-4 space-y-2">
              <p className="text-xs text-muted-foreground italic">
                <EditableText value={mod.description} onChange={(v) => updateModule(mi, { description: v })} multiline />
              </p>
              {mod.topics.map((topic, ti) => (
                <div key={ti} className="rounded-lg border bg-muted/20 px-3 py-2">
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground mr-1 font-mono text-xs">{ti + 1}.</span>
                    <EditableText
                      value={topic.title}
                      onChange={(v) => updateTopic(mi, ti, { title: v })}
                    />
                  </p>
                  {topic.content_md && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {topic.content_md.replace(/[#*`]/g, "").slice(0, 120)}...
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Phase progress indicator ──────────────────────────────────────────────────

function PhaseIndicator({
  phase, currentModuleIndex, totalModules, message,
}: { phase: GenPhase; currentModuleIndex: number; totalModules: number; message: string }) {
  const steps = [
    { key: "modules", label: "Modullar" },
    { key: "topics", label: "Mavzular" },
    { key: "done", label: "Tayyor" },
  ];

  const activeIdx = phase === "modules" ? 0 : phase === "topics" ? 1 : phase === "done" ? 2 : -1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center gap-1">
            <div className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium transition-colors ${
              i < activeIdx ? "bg-green-500 text-white"
              : i === activeIdx ? "bg-blue-500 text-white animate-pulse"
              : "bg-muted text-muted-foreground"
            }`}>
              {i < activeIdx ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs ${i === activeIdx ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {step.label}
            </span>
            {i < steps.length - 1 && <div className="h-px w-6 bg-border mx-1" />}
          </div>
        ))}
      </div>
      {phase === "topics" && totalModules > 0 && (
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${(currentModuleIndex / totalModules) * 100}%` }}
          />
        </div>
      )}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewCoursePage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [saving, setSaving] = useState(false);

  // Manual form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [difficulty, setDifficulty] = useState("");

  // AI form inputs
  const [aiSubject, setAiSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [goal, setGoal] = useState("");
  const [moduleCount, setModuleCount] = useState("3");
  const [contextText, setContextText] = useState("");
  const [showContext, setShowContext] = useState(false);

  // AI generation state
  const [phase, setPhase] = useState<GenPhase>("idle");
  const [phaseMessage, setPhaseMessage] = useState("");
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [aiCourse, setAiCourse] = useState<AiCourse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.get<Subject[]>("/subjects/").then((r) => setSubjects(r.data)).catch(() => {});
  }, []);

  // ── Manual submit ──────────────────────────────────────────────────────────

  const handleManualSubmit = async () => {
    if (!title || !subjectId || !difficulty) return;
    setSaving(true);
    try {
      await api.post("/courses", { title, description, subject_id: subjectId, difficulty });
      router.push("/teacher/courses");
    } catch {
      toast.error("Kurs yaratishda xatolik");
    } finally {
      setSaving(false);
    }
  };

  // ── AI generation ──────────────────────────────────────────────────────────

  const handleAiGenerate = async () => {
    if (!aiSubject || !gradeLevel || !goal) return;

    abortRef.current = new AbortController();
    setPhase("modules");
    setPhaseMessage("Kurs strukturasi va modullar yaratilmoqda...");
    setAiCourse(null);
    setCurrentModuleIndex(0);

    try {
      const response = await fetch(`${BASE_URL}/ai/generate-course-v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          subject: aiSubject,
          grade_level: parseInt(gradeLevel),
          goal,
          module_count: parseInt(moduleCount),
          context_text: contextText,
        }),
        signal: abortRef.current.signal,
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          try {
            const ev = JSON.parse(payload);
            handleEvent(ev);
          } catch {
            // skip malformed line
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "AbortError") {
        setPhase("error");
        setPhaseMessage("Xatolik yuz berdi. Qaytadan urinib ko'ring.");
        toast.error("Generatsiyada xatolik");
      }
    }
  };

  const handleEvent = (ev: Record<string, unknown>) => {
    switch (ev.type) {
      case "phase":
        setPhaseMessage(ev.message as string ?? "");
        if (ev.phase === "topics") {
          setCurrentModuleIndex((ev.module_index as number) + 1);
        }
        break;

      case "modules_done": {
        const modules = (ev.modules as { title: string; description: string }[]).map((m) => ({
          ...m,
          topics: null as AiTopic[] | null,
        }));
        setAiCourse({
          title: ev.course_title as string,
          description: ev.course_description as string,
          difficulty: ev.difficulty as AiCourse["difficulty"],
          subject: aiSubject,
          grade_level: parseInt(gradeLevel),
          modules,
        });
        setPhase("topics");
        break;
      }

      case "topics_done": {
        const mi = ev.module_index as number;
        const topics = ev.topics as AiTopic[];
        setAiCourse((prev) => {
          if (!prev) return prev;
          const modules = prev.modules.map((m, i) =>
            i === mi ? { ...m, topics } : m
          );
          return { ...prev, modules };
        });
        break;
      }

      case "done":
        setPhase("done");
        setPhaseMessage("Kurs tayyor! Ko'rib chiqing va saqlang.");
        break;

      case "error":
        setPhase("error");
        setPhaseMessage(ev.message as string ?? "Noma'lum xatolik");
        break;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setPhase("idle");
  };

  // ── Save AI course ─────────────────────────────────────────────────────────

  const handleSaveAiCourse = async () => {
    if (!aiCourse) return;
    setSaving(true);
    try {
      // 1. Create course
      const courseRes = await api.post<{ id: string }>("/courses", {
        title: aiCourse.title,
        description: aiCourse.description,
        subject: aiCourse.subject,
        difficulty: aiCourse.difficulty,
        is_ai_generated: true,
      });
      const courseId = courseRes.data.id;

      // 2. Create modules then topics sequentially
      for (const mod of aiCourse.modules) {
        const moduleRes = await api.post<{ id: string }>(`/courses/${courseId}/modules`, {
          title: mod.title,
        });
        const moduleId = moduleRes.data.id;

        for (const topic of mod.topics ?? []) {
          await api.post(`/modules/${moduleId}/topics`, {
            title: topic.title,
            content_md: topic.content_md || null,
          });
        }
      }

      toast.success("Kurs muvaffaqiyatli saqlandi!");
      router.push(`/teacher/courses/${courseId}`);
    } catch {
      toast.error("Kursni saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  };

  const canGenerate = !!aiSubject && !!gradeLevel && !!goal;
  const isGenerating = phase === "modules" || phase === "topics";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Yangi kurs yaratish</h1>

      <Tabs defaultValue="ai">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Qo&apos;lda yaratish</TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="h-4 w-4 mr-2" />
            AI bilan yaratish
          </TabsTrigger>
        </TabsList>

        {/* ── Manual Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="manual">
          <Card>
            <CardHeader><CardTitle>Kurs ma&apos;lumotlari</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Kurs nomi</Label>
                <Input placeholder="Masalan: Matematika asoslari" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tavsif</Label>
                <Textarea placeholder="Kurs haqida..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Fan</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger><SelectValue placeholder="Fanni tanlang" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Qiyinlik darajasi</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue placeholder="Darajani tanlang" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Boshlang&apos;ich</SelectItem>
                    <SelectItem value="intermediate">O&apos;rta</SelectItem>
                    <SelectItem value="advanced">Yuqori</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleManualSubmit} disabled={saving || !title || !subjectId || !difficulty} className="w-full">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Kursni yaratish
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AI Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="ai">
          <div className="space-y-4">
            {/* Inputs — hidden while generating */}
            {!isGenerating && phase !== "done" && (
              <Card>
                <CardHeader><CardTitle>AI yordamida kurs yaratish</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Fan nomi *</Label>
                    <Input placeholder="Masalan: Matematika" value={aiSubject} onChange={(e) => setAiSubject(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Sinf darajasi *</Label>
                      <Select value={gradeLevel} onValueChange={setGradeLevel}>
                        <SelectTrigger><SelectValue placeholder="Sinf" /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                            <SelectItem key={g} value={g.toString()}>{g}-sinf</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Modullar soni</Label>
                      <Select value={moduleCount} onValueChange={setModuleCount}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[2, 3, 4, 5, 6].map((n) => (
                            <SelectItem key={n} value={n.toString()}>{n} ta modul</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>O&apos;quv maqsadi *</Label>
                    <Textarea placeholder="Bu kursda o'quvchilar nima o'rganadi?" value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} />
                  </div>

                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setShowContext((v) => !v)}
                  >
                    {showContext ? "Kontekstni yopish" : "+ Darslik/qo'llanma matni qo'shish (ixtiyoriy)"}
                  </button>
                  {showContext && (
                    <Textarea
                      placeholder="Darslik yoki qo'llanmadan matn kiriting — AI ushbu kontekst asosida kurs yaratadi..."
                      value={contextText}
                      onChange={(e) => setContextText(e.target.value)}
                      rows={5}
                      className="font-mono text-xs"
                    />
                  )}

                  <Button onClick={handleAiGenerate} disabled={!canGenerate} className="w-full">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Yaratishni boshlash
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Generation progress */}
            {isGenerating && (
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <PhaseIndicator
                    phase={phase}
                    currentModuleIndex={currentModuleIndex}
                    totalModules={aiCourse?.modules.length ?? parseInt(moduleCount)}
                    message={phaseMessage}
                  />
                  <Button variant="outline" size="sm" onClick={handleStop}>
                    To&apos;xtatish
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Live course preview (shown during topics phase and after done) */}
            {aiCourse && (
              <>
                {(phase === "topics" || phase === "done") && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Kurs ko&apos;rinishi
                      </h2>
                      <p className="text-xs text-muted-foreground italic">
                        Sarlavha yoki tavsifni bosib tahrirlash mumkin
                      </p>
                    </div>
                    <CoursePreview course={aiCourse} onChange={setAiCourse} />
                  </div>
                )}

                {phase === "done" && (
                  <div className="flex gap-3">
                    <Button
                      className="flex-1"
                      onClick={handleSaveAiCourse}
                      disabled={saving}
                    >
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saqlanmoqda...</> : "Kursni saqlash"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setPhase("idle"); setAiCourse(null); }}
                    >
                      Qaytadan yaratish
                    </Button>
                  </div>
                )}
              </>
            )}

            {phase === "error" && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-4">
                  <p className="text-sm text-red-700">{phaseMessage}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setPhase("idle")}>
                    Qaytadan urinish
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
