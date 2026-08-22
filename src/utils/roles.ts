import type { AppUser, UserRole } from "@/types";

export function normalizeRole(role: unknown): UserRole {
  const value = String(role ?? "").trim().toLowerCase();

  if (value === "super_admin") return "super_admin";
  if (value === "admin") return "admin";
  return "user";
}

export function normalizeUserProfile(data: Record<string, unknown>): AppUser {
  return {
    ...(data as AppUser),
    uid: String(data.uid ?? ""),
    email: String(data.email ?? ""),
    displayName: String(data.displayName ?? "Trader"),
    role: normalizeRole(data.role),
    createdAt: Number(data.createdAt ?? Date.now()),
  };
}
