"use client";

import { LayoutDashboard, BookOpen, ClipboardList, Radio } from "lucide-react";
import RoleGuard from "@/components/shared/RoleGuard";
import Navbar from "@/components/shared/Navbar";
import OrgGate from "@/components/shared/OrgGate";
import Sidebar from "@/components/shared/Sidebar";

const sidebarItems = [
  {
    label: "Bosh sahifa",
    href: "/teacher",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Kurslar",
    href: "/teacher/courses",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    label: "Vazifalar",
    href: "/teacher/assignments/new",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    label: "Jonli dars",
    href: "/teacher/live/new",
    icon: <Radio className="h-4 w-4" />,
  },
];

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={["admin", "org_admin", "teacher"]}>
      <OrgGate>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="flex">
            <Sidebar items={sidebarItems} />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </OrgGate>
    </RoleGuard>
  );
}
