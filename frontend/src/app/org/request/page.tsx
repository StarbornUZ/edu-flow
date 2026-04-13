"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const schema = z.object({
  name: z.string().min(2, "Tashkilot nomi kamida 2 ta belgidan iborat bo'lishi kerak"),
  type: z.enum(["school", "learning_center", "university"], {
    message: "Tashkilot turini tanlang",
  }),
  address: z.string().optional(),
  phone: z.string().optional(),
  stir: z.string().optional(),
  responsible_person: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface OrgRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  org_data: Record<string, string>;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig = {
  pending: { label: "Ko'rib chiqilmoqda", icon: Clock, variant: "secondary" as const, color: "text-orange-600" },
  approved: { label: "Tasdiqlandi", icon: CheckCircle, variant: "default" as const, color: "text-green-600" },
  rejected: { label: "Rad etildi", icon: XCircle, variant: "destructive" as const, color: "text-red-600" },
};

const orgTypeLabels: Record<string, string> = {
  school: "Maktab",
  learning_center: "O'quv markaz",
  university: "Universitet",
};

const COOLDOWN_SECONDS = 86400;

function getCooldownRemaining(updatedAt: string): number {
  const elapsed = (Date.now() - new Date(updatedAt).getTime()) / 1000;
  return Math.max(0, COOLDOWN_SECONDS - elapsed);
}

function formatCooldown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} soat ${m} daqiqa`;
}

export default function OrgRequestPage() {
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);

  const { data: existingRequest, isLoading } = useQuery<OrgRequest>({
    queryKey: ["my-org-request"],
    queryFn: () =>
      api.get("/organizations/my-request").then((r) => r.data),
    retry: false,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "school" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormData) =>
      api.post("/organizations/requests", {
        org_data: values,
      }),
    onSuccess: () => {
      toast.success("So'rov muvaffaqiyatli yuborildi!");
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["my-org-request"] });
    },
    onError: (err: { response?: { data?: { detail?: unknown } } }) => {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Xatolik yuz berdi";
      toast.error(msg);
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  // Show existing request status
  if (existingRequest || submitted) {
    const req = existingRequest;
    const status = req?.status ?? "pending";
    const cfg = statusConfig[status];
    const Icon = cfg.icon;

    const cooldownRemaining =
      status === "rejected" && req?.updated_at
        ? getCooldownRemaining(req.updated_at)
        : 0;

    const handleResubmit = () => {
      if (req?.org_data) {
        reset({
          name: req.org_data.name ?? "",
          type: (req.org_data.type as FormData["type"]) ?? "school",
          address: req.org_data.address ?? "",
          phone: req.org_data.phone ?? "",
          stir: req.org_data.stir ?? "",
          responsible_person: req.org_data.responsible_person ?? "",
        });
      }
      setSubmitted(false);
    };

    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Tashkilot so'rovi</h1>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Icon className={`h-6 w-6 ${cfg.color}`} />
              <div>
                <CardTitle>So'rov holati</CardTitle>
                <CardDescription>
                  {req?.created_at
                    ? new Date(req.created_at).toLocaleDateString("uz-UZ")
                    : ""}
                </CardDescription>
              </div>
              <Badge variant={cfg.variant} className="ml-auto">
                {cfg.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {req?.org_data && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(req.org_data).map(([key, value]) => (
                  <div key={key}>
                    <span className="font-medium text-muted-foreground capitalize">
                      {key === "name" ? "Nomi" :
                       key === "type" ? "Turi" :
                       key === "address" ? "Manzil" :
                       key === "phone" ? "Telefon" :
                       key === "stir" ? "STIR" :
                       key === "responsible_person" ? "Mas'ul shaxs" : key}:{" "}
                    </span>
                    <span>
                      {key === "type" ? orgTypeLabels[value] ?? value : value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {req?.review_note && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <span className="font-medium">Izoh: </span>
                {req.review_note}
              </div>
            )}

            {status === "rejected" && (
              <div className="space-y-2">
                {cooldownRemaining > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Qaytadan yuborish uchun kuting:
                    </p>
                    <Button variant="outline" disabled>
                      <Clock className="h-4 w-4 mr-2" />
                      {formatCooldown(cooldownRemaining)}
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={handleResubmit}>
                    Qaytadan yuborish
                  </Button>
                )}
              </div>
            )}

            {status === "pending" && (
              <p className="text-sm text-muted-foreground">
                Administrator so'rovingizni ko'rib chiqadi. Tasdiqlangandan so'ng tashkilotingiz faollashadi.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Request form
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tashkilot so'rovi</h1>
        <p className="text-muted-foreground mt-1">
          Tashkilotingizni platformaga qo'shish uchun so'rov yuboring. Administrator tasdiqlaydi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tashkilot ma'lumotlari</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tashkilot nomi *</Label>
              <Input
                id="name"
                placeholder="Masalan: 15-maktab"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tashkilot turi *</Label>
              <select
                id="type"
                {...register("type")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="school">Maktab</option>
                <option value="learning_center">O'quv markaz</option>
                <option value="university">Universitet</option>
              </select>
              {errors.type && (
                <p className="text-sm text-red-500">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsible_person">Mas'ul shaxs</Label>
              <Input
                id="responsible_person"
                placeholder="F.I.O."
                {...register("responsible_person")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon raqami</Label>
              <Input
                id="phone"
                placeholder="+998 90 123 45 67"
                {...register("phone")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Manzil</Label>
              <Input
                id="address"
                placeholder="Viloyat, shahar, ko'cha"
                {...register("address")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stir">STIR (INN)</Label>
              <Input
                id="stir"
                placeholder="123456789"
                {...register("stir")}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || mutation.isPending}
            >
              {mutation.isPending ? "Yuborilmoqda..." : "So'rov yuborish"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
