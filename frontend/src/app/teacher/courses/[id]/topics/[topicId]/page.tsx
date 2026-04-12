"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Save, Sparkles, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Topic } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import MarkdownRenderer from "@/components/shared/MarkdownRenderer";

export default function TopicEditPage() {
  const params = useParams();
  const topicId = params.topicId as string;

  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    api
      .get<Topic>(`/topics/${topicId}`)
      .then((res) => {
        const t = res.data;
        setTopic(t);
        setTitle(t.title);
        setContentMd(t.content_md || "");
        setVideoUrl(t.video_url || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [topicId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.patch<Topic>(`/topics/${topicId}`, {
        title,
        content_md: contentMd,
        video_url: videoUrl || null,
      });
      setTopic(res.data);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  const handleAiFill = async () => {
    setAiLoading(true);
    try {
      const res = await api.post<{ content_md: string }>(
        "/ai/generate-topic",
        {
          topic_id: topicId,
          title,
        }
      );
      setContentMd(res.data.content_md);
    } catch {
      // handle error
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Mavzu topilmadi
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mavzuni tahrirlash</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleAiFill}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            AI bilan to&apos;ldirish
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Saqlash
          </Button>
        </div>
      </div>

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Tahrirlash</TabsTrigger>
          <TabsTrigger value="preview">Ko&apos;rish</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mavzu ma&apos;lumotlari</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic-title">Mavzu nomi</Label>
                <Input
                  id="topic-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Kontent (Markdown)</Label>
                <Textarea
                  id="content"
                  value={contentMd}
                  onChange={(e) => setContentMd(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="Markdown formatida kontent yozing..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="video-url">Video havola</Label>
                <Input
                  id="video-url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              {contentMd ? (
                <MarkdownRenderer content={contentMd} />
              ) : (
                <p className="text-muted-foreground">
                  Hali kontent kiritilmagan
                </p>
              )}
              {videoUrl && (
                <div className="mt-4 p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">
                    Video: {videoUrl}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
