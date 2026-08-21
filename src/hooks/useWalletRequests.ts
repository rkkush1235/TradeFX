"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  adjustWallet,
  createDepositRequest,
  createWithdrawalRequest,
  reviewDeposit,
  reviewWithdrawal,
  subscribeDeposits,
  subscribeTransactions,
  subscribeWithdrawals,
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
  const [rows, setRows] = useState<DepositRequest[]>([]);

  useEffect(() => {
    const unsub = subscribeDeposits(setRows, userId, () => {
      setRows([]);
    });
    return () => unsub();
  }, [userId]);

  return rows;
}

export function useWithdrawals(userId?: string, enabled = true) {
  const [rows, setRows] = useState<WithdrawalRequest[]>([]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const unsub = subscribeWithdrawals(setRows, userId, () => {
      setRows([]);
    });
    return () => unsub();
  }, [userId, enabled]);

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
