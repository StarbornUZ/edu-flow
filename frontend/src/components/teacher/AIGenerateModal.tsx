"use client";

import { useState, useCallback } from "react";
import { BASE_URL } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";

interface AIGenerateModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  endpoint: string;
  requestBody: Record<string, unknown>;
  onResult: (data: unknown) => void;
}

export default function AIGenerateModal({
  open,
  onClose,
  title,
  endpoint,
  requestBody,
  onResult,
}: AIGenerateModalProps) {
  const [parsedResult, setParsedResult] = useState<unknown>(null);
  const [streamedText, setStreamedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const startGenerationFixed = useCallback(async () => {
    setLoading(true);
    setStreamedText("");
    setParsedResult(null);
    setDone(false);
    setError("");

    try {
      const response = await fetch(
        `${BASE_URL}${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];
      let sseText = "";
      let buffer = "";

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
        const chunk = decoder.decode(value, { stream: true });
        chunks.push(chunk);
        buffer += chunk;

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6);
            if (payload === "[DONE]") break;
            try {
              const d = JSON.parse(payload);
              if (d.text) {
                sseText += d.text;
                setStreamedText(sseText);
              }
            } catch {
              // skip
            }
          }
        }
      }

      // If no SSE data received, treat whole body as plain JSON
      if (!sseText) {
        const fullBody = chunks.join("") + buffer;
        const trimmed = fullBody.trim();
        try {
          const parsed = JSON.parse(trimmed);
          setParsedResult(parsed);
          setStreamedText(""); // hide raw text, show structured preview
        } catch {
          setStreamedText(trimmed);
        }
      } else {
        // Try to parse the accumulated SSE text as JSON
        try {
          const parsed = JSON.parse(sseText.trim());
          setParsedResult(parsed);
        } catch {
          // leave as raw text
        }
      }

      setDone(true);
    } catch {
      setError("Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, requestBody]);

  const handleSave = () => {
    if (parsedResult !== null) {
      onResult(parsedResult);
    } else if (streamedText) {
      try {
        onResult(JSON.parse(streamedText));
      } catch {
        onResult(streamedText);
      }
    }
    handleClose();
  };

  const handleClose = () => {
    setStreamedText("");
    setParsedResult(null);
    setDone(false);
    setLoading(false);
    setError("");
    onClose();
  };

  // Preview parsed questions
  const previewQuestions: Array<{ question_text: string }> = (() => {
    if (!parsedResult) return [];
    if (Array.isArray(parsedResult)) return parsedResult;
    const r = parsedResult as Record<string, unknown>;
    if (Array.isArray(r.questions)) return r.questions as Array<{ question_text: string }>;
    return [];
  })();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-3">
          {!streamedText && !parsedResult && !loading && !error && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                AI yordamida savollar yaratish uchun boshlang
              </p>
              <Button onClick={startGenerationFixed}>Yaratishni boshlash</Button>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <Button variant="outline" onClick={startGenerationFixed}>Qayta urinish</Button>
            </div>
          )}

          {loading && !streamedText && !parsedResult && (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">AI savollar yaratmoqda...</span>
            </div>
          )}

          {/* SSE streaming preview */}
          {streamedText && (
            <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap min-h-[100px] max-h-[300px] overflow-auto">
              {streamedText}
              {loading && (
                <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5" />
              )}
            </div>
          )}

          {/* Parsed questions preview */}
          {previewQuestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-600">
                  {previewQuestions.length} ta savol yaratildi
                </span>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {previewQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded border text-sm">
                    <Badge variant="outline" className="shrink-0 text-xs">{i + 1}</Badge>
                    <span className="text-muted-foreground line-clamp-2">{q.question_text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Bekor qilish
          </Button>
          {loading && (
            <Button disabled>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Yaratilmoqda...
            </Button>
          )}
          {done && (previewQuestions.length > 0 || streamedText) && (
            <Button onClick={handleSave}>
              {previewQuestions.length > 0
                ? `${previewQuestions.length} ta savolni qo'shish`
                : "Saqlash"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
