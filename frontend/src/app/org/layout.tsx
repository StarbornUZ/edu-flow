"use client";

import { LayoutDashboard, Users, GraduationCap, School, FilePlus } from "lucide-react";
import RoleGuard from "@/components/shared/RoleGuard";
import Navbar from "@/components/shared/Navbar";
import Sidebar from "@/components/shared/Sidebar";

const sidebarItems = [
  {
    label: "Bosh sahifa",
    href: "/org",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "O'qituvchilar",
    href: "/org/teachers",
    icon: <Users className="h-4 w-4" />,
  },
  {
    label: "O'quvchilar",
    href: "/org/students",
    icon: <GraduationCap className="h-4 w-4" />,
  },
  {
    label: "Sinflar",
    href: "/org/classes",
    icon: <School className="h-4 w-4" />,
  },
  {
    label: "Tashkilot so'rovi",
    href: "/org/request",
    icon: <FilePlus className="h-4 w-4" />,
  },
];

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={["admin", "org_admin"]}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex">
          <Sidebar items={sidebarItems} />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </RoleGuard>
  );
}
