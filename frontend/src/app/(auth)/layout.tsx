export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 py-8">
      {children}
    </div>
  );
}
