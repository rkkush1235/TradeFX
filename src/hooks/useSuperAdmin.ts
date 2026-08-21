"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AppUser } from "@/types";
import { assignClientToAdmin, deleteClient, deleteAdmin, setAdminStatus, subscribeAdmins, subscribeAssignedUsers, subscribeUsers } from "@/services/adminService";
import { getFinancialOverview, provisionAdmin } from "@/services/superAdminService";

export function useSuperAdmins() {
  const [rows, setRows] = useState<AppUser[]>([]);
  useEffect(() => subscribeAdmins(setRows, () => setRows([])), []);
  return rows;
}

export function useSuperClients() {
  const { appUser } = useAuth();
  const [rows, setRows] = useState<AppUser[]>([]);
  useEffect(() => {
    if (!appUser) return;
    if (appUser.role === "super_admin") return subscribeUsers(setRows, () => setRows([]));
    return subscribeAssignedUsers(appUser.uid, setRows, () => setRows([]));
  }, [appUser]);
  return rows.filter((u) => u.role === "user" && !u.deleted);
}

export function useFinancialOverview(enabled: boolean) {
  return useQuery({ queryKey: ["super-financial-overview"], queryFn: getFinancialOverview, enabled, refetchInterval: 30000 });
}

export function useProvisionAdmin() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: provisionAdmin, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-financial-overview"] }) });
}

export function useAssignClient() { return useMutation({ mutationFn: assignClientToAdmin }); }
export function useSetAdminStatus() { return useMutation({ mutationFn: setAdminStatus }); }
export function useDeleteClient() { return useMutation({ mutationFn: deleteClient }); }
export function useDeleteAdmin() { return useMutation({ mutationFn: deleteAdmin }); }
