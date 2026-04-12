"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, CheckCircle, XCircle, Trophy, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Assignment, Question, GamificationResult } from "@/types";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface SubmitResponse {
  submission_id: string;
  results: {
    question_id: string;
    is_correct: boolean | null;
    ai_score: number | null;
    ai_feedback: string | null;
    xp_earned: number;
  }[];
  gamification: GamificationResult;
}

function AssignmentSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Skeleton className="h-8 w-64" />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </CardContent>
      </Card>
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function StudentAssignmentPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const assignmentId = params.assignmentId as string;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);

  const { data: assignment, isLoading: assignmentLoading } = useQuery<Assignment>({
    queryKey: ["assignment", assignmentId],
    queryFn: () =>
      api.get(`/assignments/${assignmentId}`).then((res) => res.data),
  });

  const { data: questions, isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["assignment-questions", assignmentId],
    queryFn: () =>
      api
        .get(`/assignments/${assignmentId}/questions`)
        .then((res) => res.data),
  });

  const submitRef = useRef<(() => void) | null>(null);

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post<SubmitResponse>(`/assignments/${assignmentId}/submit`, {
        answers_json: answers,
      }),
    onSuccess: (res) => {
      setSubmitted(true);
      setResult(res.data);
      toast.success("Javoblar muvaffaqiyatli yuborildi!");
    },
    onError: () => {
      toast.error("Javoblarni yuborishda xatolik yuz berdi.");
    },
  });

  const doSubmit = () => {
    if (!submitMutation.isPending && !submitted) {
      submitMutation.mutate();
    }
  };

  // Keep a stable ref to the latest doSubmit for the timer
  submitRef.current = doSubmit;

  // Timer setup
  useEffect(() => {
    if (assignment?.time_limit_sec && !submitted) {
      setTimeLeft(assignment.time_limit_sec);
    }
  }, [assignment?.time_limit_sec, submitted]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitted) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          submitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, submitted]);

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  if (assignmentLoading || questionsLoading) return <AssignmentSkeleton />;

  if (!assignment) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Vazifa topilmadi.
      </div>
    );
  }

  const sortedQuestions = [...(questions ?? [])].sort(
    (a, b) => a.order_number - b.order_number
  );

  // Results view
  if (submitted && result) {
    const totalXP = result.gamification.xp_earned;
    const correctCount = result.results.filter((r) => r.is_correct).length;

    return (
      <div className="space-y-6 max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/student/courses/${courseId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Kursga qaytish
        </Button>

        <h1 className="text-2xl font-bold">Natijalar</h1>

        {/* Gamification summary */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <div className="text-center">
                  <Trophy className="h-10 w-10 text-yellow-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">
                    +{totalXP} XP
                  </p>
                  <p className="text-sm text-green-600">Tajriba ballari</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {correctCount}/{result.results.length}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    To&apos;g&apos;ri javoblar
                  </p>
                </div>
                {result.gamification.new_level && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {result.gamification.new_level}-daraja
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Yangi daraja!
                    </p>
                  </div>
                )}
              </div>
              {result.gamification.new_badges.length > 0 && (
                <div className="mt-4 text-center">
                  <p className="text-sm font-medium mb-2">Yangi nishonlar:</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {result.gamification.new_badges.map((badge) => (
                      <Badge key={badge} variant="secondary">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <Separator />

        {/* Per-question results */}
        {sortedQuestions.map((q, idx) => {
          const qResult = result.results.find(
            (r) => r.question_id === q.id
          );
          return (
            <Card
              key={q.id}
              className={
                qResult?.is_correct
                  ? "border-green-200"
                  : qResult?.is_correct === false
                  ? "border-red-200"
                  : ""
              }
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  {qResult?.is_correct ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : qResult?.is_correct === false ? (
                    <XCircle className="h-5 w-5 text-red-600" />
                  ) : null}
                  <CardTitle className="text-sm">
                    {idx + 1}. {q.question_text}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Sizning javobingiz: </span>
                  {answers[q.id] || "Javob berilmagan"}
                </p>
                {qResult?.ai_feedback && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Izoh: </span>
                    {qResult.ai_feedback}
                  </p>
                )}
                {q.explanation && (
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Tushuntirish: </span>
                    {q.explanation}
                  </p>
                )}
                {qResult && (
                  <Badge variant="outline">+{qResult.xp_earned} XP</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Quiz / assignment form
  return (
    <div className="space-y-6 max-w-3xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/student/courses/${courseId}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Kursga qaytish
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{assignment.title}</h1>
          {assignment.instructions && (
            <p className="text-sm text-muted-foreground mt-1">
              {assignment.instructions}
            </p>
          )}
        </div>
        {timeLeft !== null && (
          <div
            className={`flex items-center gap-2 text-lg font-mono font-bold ${
              timeLeft < 60 ? "text-red-600" : "text-orange-600"
            }`}
          >
            <Clock className="h-5 w-5" />
            <span>Vaqt qoldi: {formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {assignment.deadline && (
          <Badge variant="outline">
            Muddat:{" "}
            {new Date(assignment.deadline).toLocaleDateString("uz-UZ")}
          </Badge>
        )}
        <Badge variant="secondary">
          Urinishlar: {assignment.max_attempts}
        </Badge>
      </div>

      <Separator />

      {/* Questions */}
      {sortedQuestions.map((q, idx) => (
        <motion.div
          key={q.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {idx + 1}. {q.question_text}
              </CardTitle>
              <CardDescription>
                {q.points_max} ball
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuestionInput
                question={q}
                value={answers[q.id] ?? ""}
                onChange={(val) => setAnswer(q.id, val)}
              />
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {/* Submit button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={doSubmit}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? "Yuborilmoqda..." : "Yuborish"}
        </Button>
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (val: string) => void;
}) {
  const { question_type, options_json } = question;

  if (question_type === "mcq" && Array.isArray(options_json)) {
    return (
      <div className="space-y-2">
        {(options_json as string[]).map((option, idx) => (
          <label
            key={idx}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              value === option
                ? "border-blue-500 bg-blue-50"
                : "hover:bg-muted"
            }`}
          >
            <input
              type="radio"
              name={`q-${question.id}`}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="h-4 w-4 text-blue-600"
            />
            <span className="text-sm">{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question_type === "fill") {
    return (
      <div className="space-y-2">
        <Label htmlFor={`q-${question.id}`}>Javob berish</Label>
        <Input
          id={`q-${question.id}`}
          placeholder="Javobingizni yozing..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (question_type === "open_answer") {
    return (
      <div className="space-y-2">
        <Label htmlFor={`q-${question.id}`}>Javob berish</Label>
        <Textarea
          id={`q-${question.id}`}
          placeholder="Javobingizni batafsil yozing..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      </div>
    );
  }

  // Fallback for other types
  return (
    <div className="space-y-2">
      <Label htmlFor={`q-${question.id}`}>Javob berish</Label>
      <Input
        id={`q-${question.id}`}
        placeholder="Javobingizni yozing..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
