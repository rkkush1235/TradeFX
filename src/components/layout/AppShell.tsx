"use client";

import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen p-4 pb-24 md:pb-4 md:pl-[18.5rem]">
        <Sidebar />
        <main className="mx-auto max-w-7xl space-y-4">
          <Navbar title={title} />
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
