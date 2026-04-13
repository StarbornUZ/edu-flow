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
import { Loader2 } from "lucide-react";

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
  const [streamedText, setStreamedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const startGeneration = useCallback(async () => {
    setLoading(true);
    setStreamedText("");
    setDone(false);

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
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
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
              // skip invalid JSON
            }
          }
        }
      }

      setDone(true);
    } catch {
      setStreamedText("Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, requestBody]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(streamedText);
      onResult(parsed);
    } catch {
      onResult(streamedText);
    }
    handleClose();
  };

  const handleClose = () => {
    setStreamedText("");
    setDone(false);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {!streamedText && !loading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                AI yordamida kontent yaratish uchun boshlang
              </p>
              <Button onClick={startGeneration}>Yaratishni boshlash</Button>
            </div>
          )}

          {(streamedText || loading) && (
            <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap min-h-[200px] max-h-[400px] overflow-auto">
              {streamedText}
              {loading && (
                <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5" />
              )}
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
          {done && (
            <Button onClick={handleSave}>Saqlash</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
