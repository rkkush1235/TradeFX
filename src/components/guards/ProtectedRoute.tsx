"use client";

import { useAuth } from "@/hooks/useAuth";
import { BrandLoader } from "@/components/common/BrandLoader";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, appUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace("/login");
    }
  }, [loading, firebaseUser, router]);

  useEffect(() => {
    if (loading || !appUser) return;
    const isAdminRoute = pathname.startsWith("/admin");
    const isAdmin = appUser.role === "admin";

    if (!isAdminRoute && !isAdmin && appUser.status !== "approved") {
      router.replace("/approval-status");
    }
  }, [loading, appUser, pathname, router]);

  if (loading) {
    return <BrandLoader />;
  }

  if (!firebaseUser) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-zinc-300">Session not found. Please login to continue.</p>
        <Link
          href="/login"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  const isAdminRoute = pathname.startsWith("/admin");
  const isAdmin = appUser?.role === "admin";
  if (!isAdminRoute && !isAdmin && appUser && appUser.status !== "approved") {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-zinc-300">Waiting for admin approval. Your KYC is under review.</p>
        <Link
          href="/approval-status"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900"
        >
          View Status
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
