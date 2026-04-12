"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Course, CourseModule, Topic } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
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

interface ManualQuestion {
  question_text: string;
  question_type: string;
  options: string[];
  correct_index: number;
  rubric: string;
}

export default function NewAssignmentPage() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [saving, setSaving] = useState(false);

  // Form
  const [courseId, setCourseId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [questionType, setQuestionType] = useState("mcq");
  const [timeLimitSec, setTimeLimitSec] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [deadline, setDeadline] = useState("");

  // Questions
  const [questions, setQuestions] = useState<ManualQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentOptions, setCurrentOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [currentRubric, setCurrentRubric] = useState("");

  // AI modal
  const [aiModalOpen, setAiModalOpen] = useState(false);

  useEffect(() => {
    api
      .get<Course[]>("/courses")
      .then((res) => setCourses(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!courseId) {
      setModules([]);
      setTopics([]);
      return;
    }
    api
      .get<CourseModule[]>(`/courses/${courseId}/modules`)
      .then(async (res) => {
        setModules(res.data);
        // Fetch all topics from all modules
        const allTopics: Topic[] = [];
        for (const mod of res.data) {
          try {
            const topicRes = await api.get<Topic[]>(
              `/courses/${courseId}/modules/${mod.id}/topics`
            );
            allTopics.push(...topicRes.data);
          } catch {
            // skip
          }
        }
        setTopics(allTopics);
      })
      .catch(() => {});
  }, [courseId]);

  const addQuestion = () => {
    if (!currentQuestion) return;
    const q: ManualQuestion = {
      question_text: currentQuestion,
      question_type: questionType,
      options: questionType === "mcq" ? [...currentOptions] : [],
      correct_index: questionType === "mcq" ? correctIndex : 0,
      rubric: questionType === "open_answer" ? currentRubric : "",
    };
    setQuestions((prev) => [...prev, q]);
    setCurrentQuestion("");
    setCurrentOptions(["", "", "", ""]);
    setCorrectIndex(0);
    setCurrentRubric("");
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!courseId || !title || questions.length === 0) return;
    setSaving(true);
    try {
      await api.post("/assignments", {
        course_id: courseId,
        topic_id: topicId || null,
        title,
        instructions: instructions || null,
        question_type: questionType,
        time_limit_sec: timeLimitSec ? parseInt(timeLimitSec) : null,
        max_attempts: parseInt(maxAttempts),
        deadline: deadline || null,
        questions: questions.map((q, idx) => ({
          question_text: q.question_text,
          question_type: q.question_type,
          options_json:
            q.question_type === "mcq" ? { options: q.options } : null,
          correct_answer_json:
            q.question_type === "mcq"
              ? { correct_index: q.correct_index }
              : null,
          rubric_json:
            q.question_type === "open_answer" ? { rubric: q.rubric } : null,
          points_max: 10,
          order_number: idx + 1,
        })),
      });
      router.push("/teacher");
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  const handleAiResult = (data: unknown) => {
    if (Array.isArray(data)) {
      const aiQuestions = data.map(
        (q: Record<string, unknown>, idx: number) => ({
          question_text: (q.question_text as string) || "",
          question_type: questionType,
          options: Array.isArray(q.options) ? (q.options as string[]) : ["", "", "", ""],
          correct_index: typeof q.correct_index === "number" ? q.correct_index : 0,
          rubric: (q.rubric as string) || "",
        })
      );
      setQuestions((prev) => [...prev, ...aiQuestions]);
    }
    setAiModalOpen(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Yangi vazifa yaratish</h1>

      {/* Course & Topic Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kurs va mavzu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Kurs</Label>
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

          {topics.length > 0 && (
            <div className="space-y-2">
              <Label>Mavzu (ixtiyoriy)</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger>
                  <SelectValue placeholder="Mavzuni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vazifa ma&apos;lumotlari</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assign-title">Sarlavha</Label>
            <Input
              id="assign-title"
              placeholder="Vazifa nomi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assign-instructions">Ko&apos;rsatmalar</Label>
            <Textarea
              id="assign-instructions"
              placeholder="Vazifa bo'yicha ko'rsatmalar..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Savol turi</Label>
              <Select value={questionType} onValueChange={setQuestionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Test (MCQ)</SelectItem>
                  <SelectItem value="fill">Bo&apos;sh joy to&apos;ldirish</SelectItem>
                  <SelectItem value="open_answer">Ochiq javob</SelectItem>
                  <SelectItem value="timed">Vaqtli test</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-attempts">Maksimal urinishlar</Label>
              <Input
                id="max-attempts"
                type="number"
                min="1"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
              />
            </div>
          </div>

          {(questionType === "timed") && (
            <div className="space-y-2">
              <Label htmlFor="time-limit">Vaqt chegarasi (soniya)</Label>
              <Input
                id="time-limit"
                type="number"
                placeholder="Masalan: 300"
                value={timeLimitSec}
                onChange={(e) => setTimeLimitSec(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="deadline">Muddat</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Savollar</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiModalOpen(true)}
              disabled={!courseId}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI bilan yaratish
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing questions */}
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
                    {q.question_type === "mcq" && q.options.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {q.options.map((opt, oi) => (
                          <p
                            key={oi}
                            className={`text-xs ${
                              oi === q.correct_index
                                ? "text-green-600 font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            {String.fromCharCode(65 + oi)}) {opt}
                          </p>
                        ))}
                      </div>
                    )}
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

          {/* Add question form */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">Yangi savol qo&apos;shish</p>

            <div className="space-y-2">
              <Label htmlFor="q-text">Savol matni</Label>
              <Textarea
                id="q-text"
                placeholder="Savolni yozing..."
                value={currentQuestion}
                onChange={(e) => setCurrentQuestion(e.target.value)}
                rows={2}
              />
            </div>

            {questionType === "mcq" && (
              <>
                <div className="space-y-2">
                  {currentOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Badge
                        variant={
                          idx === correctIndex ? "default" : "outline"
                        }
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
              </>
            )}

            {questionType === "open_answer" && (
              <div className="space-y-2">
                <Label htmlFor="rubric">Baholash mezonlari</Label>
                <Textarea
                  id="rubric"
                  placeholder="Baholash mezonlarini yozing..."
                  value={currentRubric}
                  onChange={(e) => setCurrentRubric(e.target.value)}
                  rows={2}
                />
              </div>
            )}

            <Button
              variant="outline"
              onClick={addQuestion}
              disabled={!currentQuestion}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Savolni qo&apos;shish
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saving || !courseId || !title || questions.length === 0}
        className="w-full"
        size="lg"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Vazifani saqlash
      </Button>

      {/* AI Modal */}
      <AIGenerateModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        title="AI bilan savollar yaratish"
        endpoint="/ai/generate-assignment"
        requestBody={{
          course_id: courseId,
          topic_id: topicId || null,
          question_type: questionType,
          count: 5,
        }}
        onResult={handleAiResult}
      />
    </div>
  );
}
