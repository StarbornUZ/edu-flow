"use client";

import { LayoutDashboard, BookOpen, User } from "lucide-react";
import RoleGuard from "@/components/shared/RoleGuard";
import Navbar from "@/components/shared/Navbar";
import OrgGate from "@/components/shared/OrgGate";
import Sidebar from "@/components/shared/Sidebar";

const sidebarItems = [
  {
    label: "Bosh sahifa",
    href: "/student",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Kurslar",
    href: "/student/courses",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    label: "Profil",
    href: "/student/profile",
    icon: <User className="h-4 w-4" />,
  },
];

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={["student"]}>
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
