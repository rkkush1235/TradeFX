"use client";

import { useAuth } from "@/hooks/useAuth";
import { BrandLoader } from "@/components/common/BrandLoader";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && appUser?.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [loading, appUser, router]);

  if (loading || appUser?.role !== "admin") {
    return <BrandLoader />;
  }

  return <>{children}</>;
}
