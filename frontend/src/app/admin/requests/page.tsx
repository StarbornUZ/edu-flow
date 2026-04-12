"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import type { OrgRequest, OrgRequestStatus } from "@/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const STATUS_LABELS: Record<OrgRequestStatus, string> = {
  pending: "Kutilayotgan",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
};

const STATUS_VARIANTS: Record<OrgRequestStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
};

const ORG_TYPE_LABELS: Record<string, string> = {
  school: "Maktab",
  learning_center: "O'quv markaz",
  university: "Universitet",
};

type FilterStatus = "all" | OrgRequestStatus;

export default function AdminRequestsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: "approve" | "reject";
    request: OrgRequest | null;
  }>({ open: false, type: "approve", request: null });
  const [reviewNote, setReviewNote] = useState("");

  const { data: requests, isLoading, isError } = useQuery<OrgRequest[]>({
    queryKey: ["admin", "org-requests"],
    queryFn: async () => {
      const res = await api.get<OrgRequest[]>("/admin/org-requests");
      return res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, review_note }: { id: string; review_note: string }) => {
      await api.put(`/admin/org-requests/${id}/approve`, { review_note });
    },
    onSuccess: () => {
      toast.success("So'rov muvaffaqiyatli tasdiqlandi");
      queryClient.invalidateQueries({ queryKey: ["admin", "org-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      closeDialog();
    },
    onError: () => {
      toast.error("So'rovni tasdiqlashda xatolik yuz berdi");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, review_note }: { id: string; review_note: string }) => {
      await api.put(`/admin/org-requests/${id}/reject`, { review_note });
    },
    onSuccess: () => {
      toast.success("So'rov rad etildi");
      queryClient.invalidateQueries({ queryKey: ["admin", "org-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      closeDialog();
    },
    onError: () => {
      toast.error("So'rovni rad etishda xatolik yuz berdi");
    },
  });

  function openDialog(type: "approve" | "reject", request: OrgRequest) {
    setActionDialog({ open: true, type, request });
    setReviewNote("");
  }

  function closeDialog() {
    setActionDialog({ open: false, type: "approve", request: null });
    setReviewNote("");
  }

  function handleSubmit() {
    if (!actionDialog.request) return;
    const payload = { id: actionDialog.request.id, review_note: reviewNote };
    if (actionDialog.type === "approve") {
      approveMutation.mutate(payload);
    } else {
      rejectMutation.mutate(payload);
    }
  }

  const isSubmitting = approveMutation.isPending || rejectMutation.isPending;

  const filteredRequests = requests?.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  const filterTabs: { label: string; value: FilterStatus }[] = [
    { label: "Barchasi", value: "all" },
    { label: "Kutilayotgan", value: "pending" },
    { label: "Tasdiqlangan", value: "approved" },
    { label: "Rad etilgan", value: "rejected" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Tashkilot so&apos;rovlari</h1>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
        <Card>
          <CardContent className="pt-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Ma&apos;lumotlarni yuklashda xatolik yuz berdi.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tashkilot so&apos;rovlari</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={filter === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
            {tab.value !== "all" && requests && (
              <Badge variant="secondary" className="ml-2">
                {requests.filter((r) =>
                  tab.value === "all" ? true : r.status === tab.value
                ).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Requests table */}
      <Card>
        <CardContent className="pt-6">
          {filteredRequests && filteredRequests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tashkilot nomi</TableHead>
                  <TableHead>Turi</TableHead>
                  <TableHead>Mas&apos;ul shaxs</TableHead>
                  <TableHead>Holati</TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {request.org_data.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ORG_TYPE_LABELS[request.org_data.type] || request.org_data.type}
                    </TableCell>
                    <TableCell>{request.org_data.responsible_person}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[request.status]}>
                        {STATUS_LABELS[request.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.created_at
                        ? new Date(request.created_at).toLocaleDateString("uz-UZ")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" ? (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openDialog("approve", request)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Tasdiqlash
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openDialog("reject", request)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rad etish
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {request.review_note || "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Hozircha so&apos;rovlar mavjud emas.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve / Reject Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === "approve" ? "So'rovni tasdiqlash" : "So'rovni rad etish"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.request && (
                <>
                  <strong>{actionDialog.request.org_data.name}</strong> tashkiloti uchun so&apos;rov{" "}
                  {actionDialog.type === "approve" ? "tasdiqlanadi" : "rad etiladi"}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="review_note">Izoh</Label>
            <Textarea
              id="review_note"
              placeholder="Izoh qoldiring..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Bekor qilish
            </Button>
            <Button
              variant={actionDialog.type === "approve" ? "default" : "destructive"}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Yuklanmoqda..."
                : actionDialog.type === "approve"
                  ? "Tasdiqlash"
                  : "Rad etish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
