"use client";

import { School } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Class } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OrgClass extends Class {
  teacher_name?: string;
  student_count?: number;
}

export default function ClassesPage() {
  const { data: classes, isLoading } = useQuery<OrgClass[]>({
    queryKey: ["org-classes"],
    queryFn: () => api.get<OrgClass[]>("/org/classes").then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sinflar ro&apos;yxati</h1>
      </div>

      {isLoading ? (
        <div className="rounded-lg border">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-5 w-1/5" />
              </div>
            ))}
          </div>
        </div>
      ) : classes && classes.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sinf nomi</TableHead>
                <TableHead>Fan</TableHead>
                <TableHead>O&apos;qituvchi</TableHead>
                <TableHead>O&apos;quvchilar soni</TableHead>
                <TableHead>O&apos;quv yili</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{cls.subject}</Badge>
                  </TableCell>
                  <TableCell>{cls.teacher_name ?? "---"}</TableCell>
                  <TableCell>{cls.student_count ?? 0}</TableCell>
                  <TableCell>{cls.academic_year}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16">
          <School className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            Hali sinflar yo&apos;q
          </h3>
          <p className="text-muted-foreground mb-4">
            O&apos;qituvchilar tomonidan sinflar yaratilganda bu yerda ko&apos;rinadi
          </p>
        </div>
      )}
    </div>
  );
}
