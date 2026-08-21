"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { adminUpdateTrade, adminUpdateTradeEntryPrice, closeTrade, ensureWallet, placeTrade, subscribeAllTrades, subscribeAssignedTrades, subscribeTrades, subscribeWallet } from "@/services/tradingService";
import { Trade, Wallet } from "@/types";

export function useWallet(userId?: string) {
  const [wallet, setWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    if (!userId) return;
    ensureWallet(userId)
      .then(setWallet)
      .catch(() => {
        setWallet(null);
      });
    const unsub = subscribeWallet(userId, setWallet, () => {
      setWallet(null);
    });
    return () => unsub();
  }, [userId]);

  return wallet;
}

export function useTrades(userId?: string) {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeTrades(userId, setTrades, () => {
      setTrades([]);
    });
    return () => unsub();
  }, [userId]);

  return trades;
}

export function useAllTrades() {
  const { appUser } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    const unsub = appUser?.role === "admin"
      ? subscribeAssignedTrades(appUser.uid, setTrades, () => setTrades([]))
      : subscribeAllTrades(setTrades, () => {
      setTrades([]);
    });
    return () => unsub();
  }, [appUser]);

  return trades;
}

export const usePlaceTrade = () =>
  useMutation({
    mutationFn: placeTrade,
  });

export const useCloseTrade = () =>
  useMutation({
    mutationFn: closeTrade,
  });

export const useAdminUpdateTradeEntryPrice = () =>
  useMutation({
    mutationFn: adminUpdateTradeEntryPrice,
  });

export const useAdminUpdateTrade = () =>
  useMutation({
    mutationFn: adminUpdateTrade,
  });
