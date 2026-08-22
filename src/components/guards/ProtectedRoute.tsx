"use client";

import { useAuth } from "@/hooks/useAuth";
import { BrandLoader } from "@/components/common/BrandLoader";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { normalizeRole } from "@/utils/roles";

export function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { firebaseUser, appUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { data: appSettings } = useAppSettings();

  const role = normalizeRole(appUser?.role);
  const isSuperAdminRoute = pathname.startsWith("/super-admin");
  const isAdminRoute = pathname.startsWith("/admin");
  const isStaffRoute = isAdminRoute || isSuperAdminRoute;
  const isStaff = role === "admin" || role === "super_admin";

  useEffect(() => {
    if (loading) return;

    if (!firebaseUser) {
      router.replace("/login");
    }
  }, [loading, firebaseUser, router]);

  useEffect(() => {
    if (loading || !firebaseUser || !appUser) {
      return;
    }

    console.log("[ProtectedRoute]", {
      uid: appUser.uid,
      email: appUser.email,
      role: appUser.role,
      status: appUser.status,
      pathname,
    });

    // SUPER ADMIN
    if (role === "super_admin") {
      if (!isSuperAdminRoute) {
        router.replace("/super-admin");
      }
      return;
    }

    // NORMAL ADMIN
    if (role === "admin") {
      if (!isAdminRoute) {
        router.replace("/admin");
      }
      return;
    }

    // USER CANNOT ACCESS STAFF ROUTES
    if (isStaffRoute) {
      router.replace("/dashboard");
      return;
    }

    // USER KYC/APPROVAL CHECK
    if (appUser.status !== "approved") {
      router.replace("/approval-status");
    }
  }, [
    loading,
    firebaseUser,
    appUser,
    pathname,
    isSuperAdminRoute,
    isAdminRoute,
    isStaffRoute,
    role,
    isStaff,
    router,
  ]);

  /*
   * Don't show maintenance page to:
   * - super admin
   * - admin
   */
  if (
    appSettings?.maintenanceMode &&
    role !== "super_admin" &&
    role !== "admin" &&
    !isStaffRoute
  ) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm font-semibold text-amber-300">
          TradeFX is under maintenance
        </p>

        <p className="text-sm text-zinc-400">
          {appSettings.maintenanceMessage ||
            "Please try again shortly."}
        </p>
      </div>
    );
  }

  if (loading) {
    return <BrandLoader />;
  }

  if (!firebaseUser) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-zinc-300">
          Session not found. Please login to continue.
        </p>

        <Link
          href="/login"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  /*
   * While Firestore profile is loading, don't incorrectly
   * show approval page.
   */
  if (!appUser) {
    return <BrandLoader />;
  }

  /*
   * Normal user waiting for approval.
   *
   * Admin and Super Admin never reach this because
   * isAdmin === true for both.
   */
  if (
    !isStaffRoute &&
    !isStaff &&
    appUser.status !== "approved"
  ) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-zinc-300">
          Waiting for admin approval. Your KYC is under review.
        </p>

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