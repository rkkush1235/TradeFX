"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import {
  adjustWallet,
  createDepositRequest,
  createWithdrawalRequest,
  reviewDeposit,
  reviewWithdrawal,
  subscribeDeposits,
  subscribeAssignedDeposits,
  subscribeTransactions,
  subscribeWithdrawals,
  subscribeAssignedWithdrawals,
} from "@/services/walletService";
import { DepositRequest, Transaction, WithdrawalRequest } from "@/types";

export function useTransactions(userId?: string) {
  const [rows, setRows] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeTransactions(userId, setRows, () => {
      setRows([]);
    });
    return () => unsub();
  }, [userId]);

  return rows;
}

export function useDeposits(userId?: string) {
  const { appUser } = useAuth();
  const [rows, setRows] = useState<DepositRequest[]>([]);

  useEffect(() => {
    const unsub = appUser?.role === "admin" && !userId
      ? subscribeAssignedDeposits(appUser.uid, setRows, () => setRows([]))
      : subscribeDeposits(setRows, userId, () => {
      setRows([]);
    });
    return () => unsub();
  }, [userId, appUser]);

  return rows;
}

export function useWithdrawals(userId?: string, enabled = true) {
  const { appUser } = useAuth();
  const [rows, setRows] = useState<WithdrawalRequest[]>([]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const unsub = appUser?.role === "admin" && !userId
      ? subscribeAssignedWithdrawals(appUser.uid, setRows, () => setRows([]))
      : subscribeWithdrawals(setRows, userId, () => {
      setRows([]);
    });
    return () => unsub();
  }, [userId, enabled, appUser]);

  return rows;
}

export const useCreateDepositRequest = () =>
  useMutation({
    mutationFn: createDepositRequest,
  });

export const useCreateWithdrawalRequest = () =>
  useMutation({
    mutationFn: createWithdrawalRequest,
  });

export const useReviewDeposit = () =>
  useMutation({
    mutationFn: reviewDeposit,
  });

export const useReviewWithdrawal = () =>
  useMutation({
    mutationFn: reviewWithdrawal,
  });

export const useAdjustWallet = () =>
  useMutation({
    mutationFn: adjustWallet,
  });
