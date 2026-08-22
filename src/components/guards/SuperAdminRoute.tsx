"use client";

import { useAuth } from "@/hooks/useAuth";
import { BrandLoader } from "@/components/common/BrandLoader";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { normalizeRole } from "@/utils/roles";

export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { appUser, loading } = useAuth();
  const router = useRouter();
  const role = normalizeRole(appUser?.role);

  useEffect(() => {
    if (loading || !appUser) return;

    if (role !== "super_admin") {
      router.replace(role === "admin" ? "/admin" : "/dashboard");
    }
  }, [loading, appUser, role, router]);

  if (loading || !appUser || role !== "super_admin") {
    return <BrandLoader />;
  }

  return <>{children}</>;
}
