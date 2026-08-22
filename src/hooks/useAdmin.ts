"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import {
  subscribeUsers,
  subscribeAnalytics,
  subscribeUsersByStatus,
  subscribeActivityLogs,
  updateUserDetails,
  updateUserStatus,
} from "@/services/adminService";
import { ActivityLog, AppUser, DashboardAnalytics, UserStatus } from "@/types";

export function useUsers() {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const assignedAdminId = appUser?.role === "admin" ? appUser.uid : undefined;
    if (!appUser) return;
    const unsub = subscribeUsers(setUsers, () => {
      setUsers([]);
    }, assignedAdminId);
    return () => unsub();
  }, [appUser]);

  return users;
}

export function useUsersByStatus(status: UserStatus) {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const adminId = appUser?.role === "admin" ? appUser.uid : undefined;
    const unsub = subscribeUsersByStatus(status, setUsers, () => {
      setUsers([]);
    }, adminId);
    return () => unsub();
  }, [status, appUser]);

  return users;
}

export function useAnalytics() {
  const [data, setData] = useState<DashboardAnalytics>({
    totalUsers: 0,
    openTrades: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    marketUpdatedAt: 0,
  });

  useEffect(() => {
    const unsub = subscribeAnalytics(setData);
    return () => unsub();
  }, []);

  return data;
}

export function useActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const unsub = subscribeActivityLogs(setLogs, () => {
      setLogs([]);
    });
    return () => unsub();
  }, []);

  return logs;
}

export const useUpdateUserStatus = () =>
  useMutation({
    mutationFn: updateUserStatus,
  });

export const useUpdateUserDetails = () =>
  useMutation({
    mutationFn: updateUserDetails,
  });
