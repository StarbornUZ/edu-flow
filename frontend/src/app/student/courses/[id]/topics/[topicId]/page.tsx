"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Video } from "lucide-react";
import { api } from "@/lib/api";
import type { Topic } from "@/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import MarkdownRenderer from "@/components/shared/MarkdownRenderer";

function TopicSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function StudentTopicPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const topicId = params.topicId as string;

  const { data: topic, isLoading: topicLoading } = useQuery<Topic>({
    queryKey: ["topic", topicId],
    queryFn: () => api.get(`/topics/${topicId}`).then((res) => res.data),
  });

  // Fetch all topics in the same module to enable prev/next navigation
  const { data: siblingTopics } = useQuery<Topic[]>({
    queryKey: ["module-topics", topic?.module_id],
    queryFn: () =>
      api
        .get(`/modules/${topic!.module_id}/topics`)
        .then((res) => res.data),
    enabled: !!topic?.module_id,
  });

  if (topicLoading) return <TopicSkeleton />;

  if (!topic) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Mavzu topilmadi.
      </div>
    );
  }

  const sorted = [...(siblingTopics ?? [])].sort(
    (a, b) => a.order_index - b.order_index
  );
  const currentIndex = sorted.findIndex((t) => t.id === topicId);
  const prevTopic = currentIndex > 0 ? sorted[currentIndex - 1] : null;
  const nextTopic =
    currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null;

  const hasVideo = !!topic.video_url;
  const isYouTube =
    topic.video_url?.includes("youtube.com") ||
    topic.video_url?.includes("youtu.be");

  function getYouTubeEmbedUrl(url: string) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtu.be")) {
        return `https://www.youtube.com/embed${parsed.pathname}`;
      }
      const videoId = parsed.searchParams.get("v");
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    } catch {
      // ignore
    }
    return url;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back to course */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/student/courses/${courseId}`)}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Kursga qaytish
      </Button>

      <h1 className="text-2xl font-bold">{topic.title}</h1>

      {/* Video */}
      {hasVideo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4 text-purple-600" />
              Video dars
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isYouTube ? (
              <div className="aspect-video w-full">
                <iframe
                  src={getYouTubeEmbedUrl(topic.video_url!)}
                  className="w-full h-full rounded-md"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={topic.title}
                />
              </div>
            ) : (
              <video
                src={topic.video_url!}
                controls
                className="w-full rounded-md"
              >
                Brauzeringiz video elementini qo&apos;llab-quvvatlamaydi.
              </video>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {(topic.content_md || topic.content_latex) && (
        <Card>
          <CardContent className="pt-6">
            <MarkdownRenderer
              content={topic.content_md || topic.content_latex || ""}
            />
          </CardContent>
        </Card>
      )}

      {!topic.content_md && !topic.content_latex && !hasVideo && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Bu mavzuda hali kontent yo&apos;q.
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Prev / Next navigation */}
      <div className="flex items-center justify-between">
        {prevTopic ? (
          <Button
            variant="outline"
            onClick={() =>
              router.push(
                `/student/courses/${courseId}/topics/${prevTopic.id}`
              )
            }
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Oldingi
          </Button>
        ) : (
          <div />
        )}
        {nextTopic ? (
          <Button
            onClick={() =>
              router.push(
                `/student/courses/${courseId}/topics/${nextTopic.id}`
              )
            }
          >
            Keyingi
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
