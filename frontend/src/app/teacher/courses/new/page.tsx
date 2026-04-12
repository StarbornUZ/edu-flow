"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Subject } from "@/types";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

export default function NewCoursePage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [saving, setSaving] = useState(false);

  // Manual form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [difficulty, setDifficulty] = useState("");

  // AI form
  const [aiSubject, setAiSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [goal, setGoal] = useState("");
  const [moduleCount, setModuleCount] = useState("3");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [aiDone, setAiDone] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api
      .get<Subject[]>("/subjects")
      .then((res) => setSubjects(res.data))
      .catch(() => {});
  }, []);

  const handleManualSubmit = async () => {
    if (!title || !subjectId || !difficulty) return;
    setSaving(true);
    try {
      await api.post("/courses", {
        title,
        description,
        subject_id: subjectId,
        difficulty,
      });
      router.push("/teacher/courses");
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiSubject || !gradeLevel || !goal) return;
    setAiGenerating(true);
    setStreamedText("");
    setAiDone(false);
    setAiResult(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/ai/generate-course`,
        {
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
          }),
        }
      );

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6);
            if (payload === "[DONE]") break;
            try {
              const d = JSON.parse(payload);
              if (d.text) {
                fullText += d.text;
                setStreamedText(fullText);
              }
            } catch {
              // skip
            }
          }
        }
      }

      try {
        const parsed = JSON.parse(fullText);
        setAiResult(parsed);
      } catch {
        // text wasn't valid JSON
      }
      setAiDone(true);
    } catch {
      setStreamedText("Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSaveAiCourse = async () => {
    if (!aiResult) return;
    setSaving(true);
    try {
      await api.post("/courses", aiResult);
      router.push("/teacher/courses");
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Yangi kurs yaratish</h1>

      <Tabs defaultValue="manual">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Qo&apos;lda yaratish</TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="h-4 w-4 mr-2" />
            AI bilan yaratish
          </TabsTrigger>
        </TabsList>

        {/* Manual Tab */}
        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle>Kurs ma&apos;lumotlari</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Kurs nomi</Label>
                <Input
                  id="title"
                  placeholder="Masalan: Matematika asoslari"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Tavsif</Label>
                <Textarea
                  id="description"
                  placeholder="Kurs haqida qisqacha ma'lumot..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Fan</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Fanni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Qiyinlik darajasi</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Darajani tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Boshlang&apos;ich</SelectItem>
                    <SelectItem value="intermediate">O&apos;rta</SelectItem>
                    <SelectItem value="advanced">Yuqori</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleManualSubmit}
                disabled={saving || !title || !subjectId || !difficulty}
                className="w-full"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Kursni yaratish
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Tab */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>AI yordamida kurs yaratish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-subject">Fan nomi</Label>
                <Input
                  id="ai-subject"
                  placeholder="Masalan: Matematika"
                  value={aiSubject}
                  onChange={(e) => setAiSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Sinf darajasi</Label>
                <Select value={gradeLevel} onValueChange={setGradeLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sinf tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                      <SelectItem key={g} value={g.toString()}>
                        {g}-sinf
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">Maqsad</Label>
                <Textarea
                  id="goal"
                  placeholder="Kursning maqsadini yozing..."
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Modullar soni</Label>
                <Select value={moduleCount} onValueChange={setModuleCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} ta modul
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!streamedText && !aiGenerating && (
                <Button
                  onClick={handleAiGenerate}
                  disabled={!aiSubject || !gradeLevel || !goal}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Yaratish
                </Button>
              )}

              {(streamedText || aiGenerating) && (
                <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap min-h-[200px] max-h-[400px] overflow-auto">
                  {streamedText}
                  {aiGenerating && (
                    <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5" />
                  )}
                </div>
              )}

              {aiDone && aiResult && (
                <Button
                  onClick={handleSaveAiCourse}
                  disabled={saving}
                  className="w-full"
                >
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Kursni saqlash
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
