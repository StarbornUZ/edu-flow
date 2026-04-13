"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, Dice3, Link2, Plus, Trash2, Sparkles, Loader2,
  Users, Trophy, ChevronRight, ChevronLeft, Shuffle, CheckCircle2,
  Download, Search, Flag, Dumbbell, Grid3X3, BookOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { Class, Course } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
} from "@/components/ui/card";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import AIGenerateModal from "@/components/teacher/AIGenerateModal";

interface LiveQuestion {
  question_text: string;
  options?: string[];
  correct_index?: number;
  question_type?: "mcq" | "ordering" | "matching";
  items?: string[];
  correct_order?: number[];
  left?: string[];
  right?: string[];
  pairs?: Record<string, string>;
}

type SessionType = "class_battle" | "group_battle";

const gameTypes = [
  { value: "blitz", label: "Blitz Jang", description: "Tez savollar, tez javoblar", icon: Zap, enabled: true },
  { value: "lucky_card", label: "Omadli Kartalar", description: "Jamoa navbat bilan kartalarni tanlaydi", icon: Dice3, enabled: true },
  { value: "relay", label: "Zanjir Savol", description: "Ketma-ket savollarga javob berish", icon: Link2, enabled: false },
  { value: "detective", label: "Detektiv Sherlock", description: "Bezorini toping!", icon: Search, enabled: false },
  { value: "racing", label: "Poyga", description: "Tezlikda musobaqa", icon: Flag, enabled: false },
  { value: "tug_of_war", label: "Arqon Tortish", description: "Jamoalar kurashi", icon: Dumbbell, enabled: false },
  { value: "crossword", label: "Krossword", description: "So'z topishmoqlari", icon: Grid3X3, enabled: false },
];

export default function NewLiveSessionPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sessionType, setSessionType] = useState<SessionType>("group_battle");
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [groupCount, setGroupCount] = useState(2);

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedGameType, setSelectedGameType] = useState("blitz");
  const [courseId, setCourseId] = useState("");
  const [timeLimitMs, setTimeLimitMs] = useState("15000");

  // Lucky card config
  const [luckyA, setLuckyA] = useState(5);
  const [luckyB, setLuckyB] = useState(3);
  const [luckyC, setLuckyC] = useState(2);

  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentOptions, setCurrentOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [saving, setSaving] = useState(false);

  // Course questions import
  const [importLoading, setImportLoading] = useState(false);
  const [importQuestions, setImportQuestions] = useState<LiveQuestion[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<number>>(new Set());
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    api.get<Class[]>("/classes").then((r) => setClasses(r.data)).catch(() => {});
    api.get<Course[]>("/courses").then((r) => setCourses(r.data)).catch(() => {});
  }, []);

  const toggleClass = (classId: string) => {
    if (sessionType === "group_battle") {
      setSelectedClassIds([classId]);
    } else {
      setSelectedClassIds((prev) =>
        prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
      );
    }
  };

  const canProceedStep1 = () => {
    if (sessionType === "class_battle") return selectedClassIds.length >= 2;
    return selectedClassIds.length === 1;
  };

  const addQuestion = () => {
    if (!currentQuestion || currentOptions.some((o) => !o)) return;
    setQuestions((prev) => [
      ...prev,
      { question_text: currentQuestion, options: [...currentOptions], correct_index: correctIndex, question_type: "mcq" },
    ]);
    setCurrentQuestion("");
    setCurrentOptions(["", "", "", ""]);
    setCorrectIndex(0);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const loadImportQuestions = async () => {
    if (!courseId) return;
    setImportLoading(true);
    try {
      const res = await api.get<LiveQuestion[]>(`/live-sessions/course-questions?course_id=${courseId}`);
      setImportQuestions(res.data);
      setSelectedImportIds(new Set());
      setShowImport(true);
    } catch {
      // handle error
    } finally {
      setImportLoading(false);
    }
  };

  const addImportedQuestions = () => {
    const toAdd = importQuestions.filter((_, i) => selectedImportIds.has(i));
    setQuestions((prev) => [...prev, ...toAdd]);
    setShowImport(false);
    setSelectedImportIds(new Set());
  };

  const handleCreate = async () => {
    const isLuckyCard = selectedGameType === "lucky_card";
    if (!isLuckyCard && questions.length === 0) return;
    if (isLuckyCard && luckyA > 0 && questions.length === 0) return;

    setSaving(true);
    try {
      const config: Record<string, unknown> = { time_limit_ms: parseInt(timeLimitMs) };
      if (isLuckyCard) {
        config.a_count = luckyA;
        config.b_count = luckyB;
        config.c_count = luckyC;
      }

      const res = await api.post<{ id: string }>("/live-sessions", {
        game_type: selectedGameType,
        session_type: sessionType,
        class_ids: selectedClassIds,
        group_count: groupCount,
        grouping_method: "random",
        course_id: courseId || null,
        config,
        questions: questions.map((q) => ({
          question_text: q.question_text,
          question_type: q.question_type || "mcq",
          options: q.options,
          correct_index: q.correct_index,
          items: q.items,
          correct_order: q.correct_order,
          left: q.left,
          right: q.right,
          pairs: q.pairs,
        })),
      });
      router.push(`/teacher/live/${res.data.id}`);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  const handleAiResult = (data: unknown) => {
    let qs: unknown[] = [];
    if (Array.isArray(data)) {
      qs = data;
    } else if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      if (Array.isArray(d.questions)) qs = d.questions as unknown[];
    }

    const aiQuestions: LiveQuestion[] = qs.map((q) => {
      const raw = q as Record<string, unknown>;
      return {
        question_text: (raw.question_text as string) || "",
        question_type: "mcq",
        options: Array.isArray(raw.options_json)
          ? (raw.options_json as string[])
          : Array.isArray(raw.options)
          ? (raw.options as string[])
          : ["", "", "", ""],
        correct_index:
          typeof raw.correct_answer_json === "number"
            ? raw.correct_answer_json
            : typeof raw.correct_index === "number"
            ? raw.correct_index
            : 0,
      };
    });

    if (aiQuestions.length > 0) setQuestions((prev) => [...prev, ...aiQuestions]);
    setAiModalOpen(false);
  };

  const isLuckyCard = selectedGameType === "lucky_card";
  const canCreate = isLuckyCard
    ? (luckyA === 0 || questions.length > 0)
    : questions.length > 0;

  const getQuestionTypeLabel = (q: LiveQuestion) => {
    if (q.question_type === "ordering") return "Tartib";
    if (q.question_type === "matching") return "Juftlash";
    return "MCQ";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Jonli musobaqa yaratish</h1>
        <div className="flex gap-1 ml-auto">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${step >= s ? "w-8 bg-primary" : "w-2 bg-muted"}`}
            />
          ))}
        </div>
      </div>

      {/* ── STEP 1: Session type & class selection ── */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Musobaqa turi</CardTitle>
              <CardDescription>Sinflar o'rtasida yoki sinf ichida guruhlar o'rtasida</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {([
                {
                  value: "class_battle" as SessionType,
                  label: "Sinflar o'rtasida",
                  desc: "Ikki yoki undan ko'p sinf raqobatlashadi.",
                  icon: Trophy,
                },
                {
                  value: "group_battle" as SessionType,
                  label: "Guruhlar o'rtasida",
                  desc: "Bir sinfning o'quvchilari guruhlarga bo'linadi.",
                  icon: Users,
                },
              ] as const).map((opt) => (
                <motion.div key={opt.value} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Card
                    className={`cursor-pointer transition-colors ${
                      sessionType === opt.value ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                    }`}
                    onClick={() => { setSessionType(opt.value); setSelectedClassIds([]); }}
                  >
                    <CardContent className="pt-6 text-center space-y-2">
                      <opt.icon className={`h-8 w-8 mx-auto ${sessionType === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="font-semibold text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {sessionType === "class_battle" ? "Sinflarni tanlang (kamida 2 ta)" : "Sinfni tanlang"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Hali sinflar yaratilmagan</p>
              ) : (
                <div className="space-y-2">
                  {classes.map((cls) => {
                    const selected = selectedClassIds.includes(cls.id);
                    return (
                      <div
                        key={cls.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                        }`}
                        onClick={() => toggleClass(cls.id)}
                      >
                        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${selected ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                          {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{cls.name}</p>
                          <p className="text-xs text-muted-foreground">{cls.academic_year}</p>
                        </div>
                        {selected && <Badge className="text-xs">Tanlandi</Badge>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {sessionType === "group_battle" && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Guruh sozlamalari</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Guruhlar soni</Label>
                  <div className="flex gap-2">
                    {[2, 3, 4].map((n) => (
                      <Button key={n} variant={groupCount === n ? "default" : "outline"} size="sm" onClick={() => setGroupCount(n)}>
                        {n} guruh
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Guruhga bo&apos;lish usuli</Label>
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-primary bg-primary/5">
                    <Shuffle className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium text-sm">Tasodifiy</p>
                      <p className="text-xs text-muted-foreground">O&apos;quvchilar tasodifiy guruhlarga bo&apos;linadi</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button className="w-full" size="lg" disabled={!canProceedStep1()} onClick={() => setStep(2)}>
            Davom etish
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </motion.div>
      )}

      {/* ── STEP 2: Game type & settings ── */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">O&apos;yin turi</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {gameTypes.map((gt) => (
                  <motion.div key={gt.value} whileHover={gt.enabled ? { scale: 1.02 } : {}} whileTap={gt.enabled ? { scale: 0.98 } : {}}>
                    <Card
                      className={`transition-colors relative ${
                        gt.enabled
                          ? selectedGameType === gt.value
                            ? "cursor-pointer border-primary bg-primary/5"
                            : "cursor-pointer hover:border-muted-foreground/30"
                          : "cursor-not-allowed opacity-50"
                      }`}
                      onClick={() => gt.enabled && setSelectedGameType(gt.value)}
                    >
                      {!gt.enabled && (
                        <Badge className="absolute top-2 right-2 text-xs" variant="secondary">Tez kunda</Badge>
                      )}
                      <CardContent className="pt-6 text-center">
                        <gt.icon className={`h-8 w-8 mx-auto mb-2 ${selectedGameType === gt.value && gt.enabled ? "text-primary" : "text-muted-foreground"}`} />
                        <p className="font-medium text-sm">{gt.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{gt.description}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Sozlamalar</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Kurs (ixtiyoriy)</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kursni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-limit-ms">Har bir savol uchun vaqt (ms)</Label>
                <Input
                  id="time-limit-ms"
                  type="number"
                  value={timeLimitMs}
                  onChange={(e) => setTimeLimitMs(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {Math.round(parseInt(timeLimitMs || "0") / 1000)} soniya
                </p>
              </div>

              {/* Lucky card config */}
              {isLuckyCard && (
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-sm font-medium">Omadli Kartalar sozlamalari</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-red-600">A — Test savollar</Label>
                      <Input type="number" min={0} max={20} value={luckyA} onChange={(e) => setLuckyA(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-yellow-600">B — Omadli kartalar</Label>
                      <Input type="number" min={0} max={20} value={luckyB} onChange={(e) => setLuckyB(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">C — Omadsiz kartalar</Label>
                      <Input type="number" min={0} max={20} value={luckyC} onChange={(e) => setLuckyC(parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Jami: {luckyA + luckyB + luckyC} ta karta. A-kartalar uchun {luckyA} ta savol kerak.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Orqaga
            </Button>
            <Button className="flex-1" onClick={() => setStep(3)}>
              Davom etish
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── STEP 3: Questions ── */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Savollar ({questions.length}{isLuckyCard && luckyA > 0 ? ` / ${luckyA} kerak` : ""})
                </CardTitle>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                {courseId && (
                  <Button variant="outline" size="sm" onClick={loadImportQuestions} disabled={importLoading}>
                    {importLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BookOpen className="h-4 w-4 mr-1" />}
                    Kursdan import
                  </Button>
                )}
                <Input
                  placeholder="Mavzu (masalan: Kvadrat tenglamalar)"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={() => setAiModalOpen(true)} disabled={!aiTopic}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Import panel */}
              {showImport && importQuestions.length > 0 && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Kursdan {importQuestions.length} ta savol topildi
                      <Button variant="ghost" size="sm" className="ml-2 text-xs" onClick={() => {
                        if (selectedImportIds.size === importQuestions.length) {
                          setSelectedImportIds(new Set());
                        } else {
                          setSelectedImportIds(new Set(importQuestions.map((_, i) => i)));
                        }
                      }}>
                        {selectedImportIds.size === importQuestions.length ? "Hammasini bekor qilish" : "Hammasini tanlash"}
                      </Button>
                    </p>
                    <Button size="sm" onClick={addImportedQuestions} disabled={selectedImportIds.size === 0}>
                      <Download className="h-3 w-3 mr-1" />
                      {selectedImportIds.size} ta qo&apos;shish
                    </Button>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-auto">
                    {importQuestions.map((q, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 p-2 rounded border cursor-pointer text-sm transition-colors ${
                          selectedImportIds.has(i) ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                        }`}
                        onClick={() => {
                          setSelectedImportIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          });
                        }}
                      >
                        <div className={`h-4 w-4 rounded border shrink-0 mt-0.5 flex items-center justify-center ${selectedImportIds.has(i) ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                          {selectedImportIds.has(i) && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="line-clamp-1">{q.question_text}</span>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{getQuestionTypeLabel(q)}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing questions list */}
              {questions.length > 0 && (
                <div className="space-y-2">
                  {questions.map((q, idx) => (
                    <div key={idx} className="flex items-start justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{idx + 1}. {q.question_text}</p>
                          <Badge variant="outline" className="text-xs">{getQuestionTypeLabel(q)}</Badge>
                        </div>
                        {q.question_type === "mcq" && q.options && (
                          <div className="flex flex-wrap gap-1">
                            {q.options.map((opt, oi) => (
                              <Badge key={oi} variant={oi === q.correct_index ? "default" : "outline"} className="text-xs">
                                {String.fromCharCode(65 + oi)}) {opt}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {q.question_type === "ordering" && q.items && (
                          <p className="text-xs text-muted-foreground">{q.items.join(" → ")}</p>
                        )}
                        {q.question_type === "matching" && q.left && (
                          <p className="text-xs text-muted-foreground">{q.left.slice(0, 3).join(", ")}...</p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeQuestion(idx)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add MCQ question manually */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium">Yangi savol qo&apos;shish (MCQ)</p>
                <div className="space-y-2">
                  <Label htmlFor="live-q-text">Savol matni</Label>
                  <Textarea
                    id="live-q-text"
                    placeholder="Savolni yozing..."
                    value={currentQuestion}
                    onChange={(e) => setCurrentQuestion(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  {currentOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Badge
                        variant={idx === correctIndex ? "default" : "outline"}
                        className="cursor-pointer min-w-[28px] justify-center"
                        onClick={() => setCorrectIndex(idx)}
                      >
                        {String.fromCharCode(65 + idx)}
                      </Badge>
                      <Input
                        placeholder={`${idx + 1}-variant`}
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...currentOptions];
                          newOpts[idx] = e.target.value;
                          setCurrentOptions(newOpts);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  To&apos;g&apos;ri javobni belgilash uchun harf tugmasini bosing
                </p>
                <Button
                  variant="outline"
                  onClick={addQuestion}
                  disabled={!currentQuestion || currentOptions.some((o) => !o)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Savolni qo&apos;shish
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Orqaga
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !canCreate}
              className="flex-1"
              size="lg"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Musobaqani yaratish
            </Button>
          </div>
        </motion.div>
      )}

      <AIGenerateModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        title="AI bilan savollar yaratish"
        endpoint="/ai/generate-assignment"
        requestBody={{
          topic: aiTopic,
          course_id: courseId || null,
          question_type: "mcq",
          count: isLuckyCard ? luckyA : 5,
          game_type: selectedGameType,
        }}
        onResult={handleAiResult}
      />
    </div>
  );
}
