"use client";

import { useEffect, useState } from "react";
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
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsub = subscribeUsers(setUsers, () => {
      setUsers([]);
    });
    return () => unsub();
  }, []);

  return users;
}

export function useUsersByStatus(status: UserStatus) {
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsub = subscribeUsersByStatus(status, setUsers, () => {
      setUsers([]);
    });
    return () => unsub();
  }, [status]);

  return users;
}

export function useAnalytics() {
  const [data, setData] = useState<DashboardAnalytics>({
    totalUsers: 0,
    openTrades: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    marketUpdatedAt: Date.now(),
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
