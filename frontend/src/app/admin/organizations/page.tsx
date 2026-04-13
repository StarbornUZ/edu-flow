"use client";

import { useState, useMemo } from "react";
import { Building2, GraduationCap, Users, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Organization, OrgStatus, OrgType } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortField = "name" | "created_at" | "teachers_count" | "students_count" | "status" | "type";
type SortDir = "asc" | "desc";

const STATUS_LABELS: Record<OrgStatus, string> = {
  active: "Faol",
  suspended: "To'xtatilgan",
  trial: "Sinov",
};

const TYPE_LABELS: Record<OrgType, string> = {
  school: "Maktab",
  learning_center: "O'quv markaz",
  university: "Universitet",
};

const STATUS_VARIANTS: Record<OrgStatus, "default" | "destructive" | "outline" | "secondary"> = {
  active: "default",
  suspended: "destructive",
  trial: "outline",
};

export default function AdminOrganizationsPage() {
  const { data: orgs, isLoading } = useQuery<Organization[]>({
    queryKey: ["admin", "organizations"],
    queryFn: () => api.get<Organization[]>("/organizations/").then((r) => r.data),
  });

  const [statusFilter, setStatusFilter] = useState<OrgStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<OrgType | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [teachersMin, setTeachersMin] = useState("");
  const [teachersMax, setTeachersMax] = useState("");
  const [studentsMin, setStudentsMin] = useState("");
  const [studentsMax, setStudentsMax] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    if (!orgs) return [];
    return orgs
      .filter((o) => {
        if (statusFilter !== "all" && o.status !== statusFilter) return false;
        if (typeFilter !== "all" && o.type !== typeFilter) return false;
        if (dateFrom && o.created_at < dateFrom) return false;
        if (dateTo && o.created_at > dateTo + "T23:59:59") return false;
        if (teachersMin && o.teachers_count < Number(teachersMin)) return false;
        if (teachersMax && o.teachers_count > Number(teachersMax)) return false;
        if (studentsMin && o.students_count < Number(studentsMin)) return false;
        if (studentsMax && o.students_count > Number(studentsMax)) return false;
        return true;
      })
      .sort((a, b) => {
        let av: string | number = a[sortField] ?? "";
        let bv: string | number = b[sortField] ?? "";
        if (typeof av === "string") av = av.toLowerCase();
        if (typeof bv === "string") bv = bv.toLowerCase();
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [orgs, statusFilter, typeFilter, dateFrom, dateTo, teachersMin, teachersMax, studentsMin, studentsMax, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const SortHead = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center">
        {children}
        <SortIcon field={field} />
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tashkilotlar</h1>
        {orgs && (
          <span className="text-sm text-muted-foreground">
            {filtered.length} / {orgs.length} ta
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "trial", "suspended"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "Barchasi" : STATUS_LABELS[s]}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Type */}
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as OrgType | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Tur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha turlar</SelectItem>
              <SelectItem value="school">Maktab</SelectItem>
              <SelectItem value="learning_center">O&apos;quv markaz</SelectItem>
              <SelectItem value="university">Universitet</SelectItem>
            </SelectContent>
          </Select>

          {/* Date range */}
          <Input type="date" placeholder="Dan" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" placeholder="Gacha" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />

          {/* Reset */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all"); setTypeFilter("all");
              setDateFrom(""); setDateTo("");
              setTeachersMin(""); setTeachersMax("");
              setStudentsMin(""); setStudentsMax("");
            }}
          >
            Tozalash
          </Button>
        </div>

        {/* Count range */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Input type="number" min={0} placeholder="O'qituvchi min" value={teachersMin} onChange={(e) => setTeachersMin(e.target.value)} />
          <Input type="number" min={0} placeholder="O'qituvchi max" value={teachersMax} onChange={(e) => setTeachersMax(e.target.value)} />
          <Input type="number" min={0} placeholder="O'quvchi min" value={studentsMin} onChange={(e) => setStudentsMin(e.target.value)} />
          <Input type="number" min={0} placeholder="O'quvchi max" value={studentsMax} onChange={(e) => setStudentsMax(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-lg border p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              {Array.from({ length: 6 }).map((__, j) => <Skeleton key={j} className="h-5 flex-1" />)}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p>Tashkilot topilmadi</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead field="name">Nomi</SortHead>
                <SortHead field="type">Tur</SortHead>
                <SortHead field="status">Holat</SortHead>
                <SortHead field="teachers_count">
                  <GraduationCap className="h-4 w-4 mr-1" />
                  O&apos;qituvchilar
                </SortHead>
                <SortHead field="students_count">
                  <Users className="h-4 w-4 mr-1" />
                  O&apos;quvchilar
                </SortHead>
                <SortHead field="created_at">Yaratilgan</SortHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{TYPE_LABELS[org.type]}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[org.status]}>
                      {STATUS_LABELS[org.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{org.teachers_count}</TableCell>
                  <TableCell>{org.students_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(org.created_at).toLocaleDateString("uz-UZ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
