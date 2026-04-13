import RoleGuard from "@/components/shared/RoleGuard";

export default function LiveSessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGuard allowedRoles={["student"]}>{children}</RoleGuard>;
}
