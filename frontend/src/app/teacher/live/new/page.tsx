"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, Dice3, Link2, Plus, Trash2, Sparkles, Loader2,
  Users, Trophy, ChevronRight, ChevronLeft, Brain, Shuffle, CheckCircle2,
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
  options: string[];
  correct_index: number;
}

type SessionType = "class_battle" | "group_battle";
type GroupingMethod = "random" | "ai";

const gameTypes = [
  { value: "blitz", label: "Blitz Jang", description: "Tez savollar, tez javoblar", icon: Zap },
  { value: "lucky_card", label: "Omad Sinovi", description: "Tasodifiy savollar bilan musobaqa", icon: Dice3 },
  { value: "relay", label: "Zanjir Savol", description: "Ketma-ket savollarga javob berish", icon: Link2 },
];

export default function NewLiveSessionPage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Session type step
  const [sessionType, setSessionType] = useState<SessionType>("group_battle");
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [groupCount, setGroupCount] = useState(2);
  const [groupingMethod, setGroupingMethod] = useState<GroupingMethod>("random");

  // Game settings step
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedGameType, setSelectedGameType] = useState("blitz");
  const [courseId, setCourseId] = useState("");
  const [timeLimitMs, setTimeLimitMs] = useState("15000");

  // Questions step
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentOptions, setCurrentOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
      { question_text: currentQuestion, options: [...currentOptions], correct_index: correctIndex },
    ]);
    setCurrentQuestion("");
    setCurrentOptions(["", "", "", ""]);
    setCorrectIndex(0);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (questions.length === 0) return;
    setSaving(true);
    try {
      const res = await api.post<{ id: string }>("/live-sessions", {
        game_type: selectedGameType,
        session_type: sessionType,
        class_ids: selectedClassIds,
        group_count: groupCount,
        grouping_method: groupingMethod,
        course_id: courseId || null,
        config: { time_limit_ms: parseInt(timeLimitMs) },
        questions: questions.map((q) => ({
          question_text: q.question_text,
          options: q.options,
          correct_index: q.correct_index,
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
    if (Array.isArray(data)) {
      const aiQuestions: LiveQuestion[] = data.map((q: Record<string, unknown>) => ({
        question_text: (q.question_text as string) || "",
        options: Array.isArray(q.options) ? (q.options as string[]) : ["", "", "", ""],
        correct_index: typeof q.correct_index === "number" ? q.correct_index : 0,
      }));
      setQuestions((prev) => [...prev, ...aiQuestions]);
    }
    setAiModalOpen(false);
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
          {/* Session type */}
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
                  desc: "Ikki yoki undan ko'p sinf raqobatlashadi. Har bir sinf — alohida jamoa.",
                  icon: Trophy,
                },
                {
                  value: "group_battle" as SessionType,
                  label: "Guruhlar o'rtasida",
                  desc: "Bir sinfning o'quvchilari tasodifiy yoki AI asosida guruhlarga bo'linadi.",
                  icon: Users,
                },
              ] as const).map((opt) => (
                <motion.div key={opt.value} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Card
                    className={`cursor-pointer transition-colors ${
                      sessionType === opt.value ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                    }`}
                    onClick={() => {
                      setSessionType(opt.value);
                      setSelectedClassIds([]);
                    }}
                  >
                    <CardContent className="pt-6 text-center space-y-2">
                      <opt.icon
                        className={`h-8 w-8 mx-auto ${sessionType === opt.value ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <p className="font-semibold text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          {/* Class selection */}
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

          {/* Group battle options */}
          {sessionType === "group_battle" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Guruh sozlamalari</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Guruhlar soni</Label>
                  <div className="flex gap-2">
                    {[2, 3, 4].map((n) => (
                      <Button
                        key={n}
                        variant={groupCount === n ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGroupCount(n)}
                      >
                        {n} guruh
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Guruhga bo'lish usuli</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {([
                      {
                        value: "random" as GroupingMethod,
                        label: "Tasodifiy",
                        desc: "O'quvchilar tasodifiy guruhlarga bo'linadi",
                        icon: Shuffle,
                      },
                      {
                        value: "ai" as GroupingMethod,
                        label: "AI asosida",
                        desc: "AI o'quvchi natijalarini tahlil qilib balanced guruhlar tuzadi",
                        icon: Brain,
                      },
                    ] as const).map((opt) => (
                      <div
                        key={opt.value}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          groupingMethod === opt.value ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                        }`}
                        onClick={() => setGroupingMethod(opt.value)}
                      >
                        <opt.icon
                          className={`h-5 w-5 mt-0.5 shrink-0 ${groupingMethod === opt.value ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <div>
                          <p className="font-medium text-sm">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={!canProceedStep1()}
            onClick={() => setStep(2)}
          >
            Davom etish
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </motion.div>
      )}

      {/* ── STEP 2: Game type & settings ── */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          {/* Game type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">O&apos;yin turi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {gameTypes.map((gt) => (
                  <motion.div key={gt.value} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Card
                      className={`cursor-pointer transition-colors ${
                        selectedGameType === gt.value ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                      }`}
                      onClick={() => setSelectedGameType(gt.value)}
                    >
                      <CardContent className="pt-6 text-center">
                        <gt.icon
                          className={`h-8 w-8 mx-auto mb-2 ${selectedGameType === gt.value ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <p className="font-medium text-sm">{gt.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{gt.description}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sozlamalar</CardTitle>
            </CardHeader>
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
                <CardTitle className="text-lg">Savollar ({questions.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setAiModalOpen(true)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI bilan yaratish
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.length > 0 && (
                <div className="space-y-2">
                  {questions.map((q, idx) => (
                    <div key={idx} className="flex items-start justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{idx + 1}. {q.question_text}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {q.options.map((opt, oi) => (
                            <Badge key={oi} variant={oi === q.correct_index ? "default" : "outline"} className="text-xs">
                              {String.fromCharCode(65 + oi)}) {opt}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeQuestion(idx)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add question */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium">Yangi savol qo&apos;shish</p>
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
              disabled={saving || questions.length === 0}
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
          course_id: courseId || null,
          question_type: "mcq",
          count: 5,
          game_type: selectedGameType,
        }}
        onResult={handleAiResult}
      />
    </div>
  );
}
