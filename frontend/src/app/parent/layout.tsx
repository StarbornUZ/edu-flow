"use client";

import { LayoutDashboard } from "lucide-react";
import RoleGuard from "@/components/shared/RoleGuard";
import Navbar from "@/components/shared/Navbar";
import Sidebar from "@/components/shared/Sidebar";

const sidebarItems = [
  {
    label: "Bosh sahifa",
    href: "/parent",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
];

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={["parent"]}>
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
