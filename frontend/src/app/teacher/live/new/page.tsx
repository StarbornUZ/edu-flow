"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Dice3, Link2, Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { Course } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import AIGenerateModal from "@/components/teacher/AIGenerateModal";

interface LiveQuestion {
  question_text: string;
  options: string[];
  correct_index: number;
}

const gameTypes = [
  {
    value: "blitz",
    label: "Blitz Jang",
    description: "Tez savollar, tez javoblar",
    icon: Zap,
  },
  {
    value: "lucky_card",
    label: "Omad Sinovi",
    description: "Tasodifiy savollar bilan musobaqa",
    icon: Dice3,
  },
  {
    value: "relay",
    label: "Zanjir Savol",
    description: "Ketma-ket savollarga javob berish",
    icon: Link2,
  },
];

export default function NewLiveSessionPage() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedGameType, setSelectedGameType] = useState("blitz");
  const [courseId, setCourseId] = useState("");
  const [timeLimitMs, setTimeLimitMs] = useState("15000");
  const [saving, setSaving] = useState(false);

  // Questions
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentOptions, setCurrentOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);

  // AI modal
  const [aiModalOpen, setAiModalOpen] = useState(false);

  useEffect(() => {
    api
      .get<Course[]>("/courses")
      .then((res) => setCourses(res.data))
      .catch(() => {});
  }, []);

  const addQuestion = () => {
    if (!currentQuestion || currentOptions.some((o) => !o)) return;
    setQuestions((prev) => [
      ...prev,
      {
        question_text: currentQuestion,
        options: [...currentOptions],
        correct_index: correctIndex,
      },
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
      const aiQuestions: LiveQuestion[] = data.map(
        (q: Record<string, unknown>) => ({
          question_text: (q.question_text as string) || "",
          options: Array.isArray(q.options)
            ? (q.options as string[])
            : ["", "", "", ""],
          correct_index:
            typeof q.correct_index === "number" ? q.correct_index : 0,
        })
      );
      setQuestions((prev) => [...prev, ...aiQuestions]);
    }
    setAiModalOpen(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Jonli musobaqa yaratish</h1>

      {/* Game Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">O&apos;yin turi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {gameTypes.map((gt) => (
              <motion.div
                key={gt.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  className={`cursor-pointer transition-colors ${
                    selectedGameType === gt.value
                      ? "border-primary bg-primary/5"
                      : "hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setSelectedGameType(gt.value)}
                >
                  <CardContent className="pt-6 text-center">
                    <gt.icon
                      className={`h-8 w-8 mx-auto mb-2 ${
                        selectedGameType === gt.value
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                    <p className="font-medium text-sm">{gt.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {gt.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Config */}
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
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time-limit-ms">
              Har bir savol uchun vaqt (millisekundda)
            </Label>
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

      {/* Questions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Savollar ({questions.length})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiModalOpen(true)}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI bilan yaratish
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Questions list */}
          {questions.length > 0 && (
            <div className="space-y-2">
              {questions.map((q, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between p-3 rounded-lg border"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {idx + 1}. {q.question_text}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {q.options.map((opt, oi) => (
                        <Badge
                          key={oi}
                          variant={
                            oi === q.correct_index ? "default" : "outline"
                          }
                          className="text-xs"
                        >
                          {String.fromCharCode(65 + oi)}) {opt}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(idx)}
                  >
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

      {/* Create */}
      <Button
        onClick={handleCreate}
        disabled={saving || questions.length === 0}
        className="w-full"
        size="lg"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Musobaqani yaratish
      </Button>

      {/* AI Modal */}
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
