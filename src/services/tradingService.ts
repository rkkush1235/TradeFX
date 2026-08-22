import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { getCurrentMarketSnapshot, refreshMarketSnapshot } from "@/services/marketFeed";
import { Trade, Wallet } from "@/types";
import { safeNumber } from "@/utils/format";
import { getMarketStatus, inferMarketCategory } from "@/utils/marketHours";
import { calculatePnL, calculateRequiredMargin } from "@/utils/tradingCalculations";

const usersCol = collection(db, "users");
const tradesCol = collection(db, "trades");
const transactionsCol = collection(db, "transactions");

async function latestPrice(asset: string) {
  const cached = getCurrentMarketSnapshot();
  // Fix: trade pricing must use only USD source.
  const cachedPrice = safeNumber(cached.prices[asset]?.priceUsd);
  if (cachedPrice > 0) return cachedPrice;

  const refreshed = await refreshMarketSnapshot();
  return safeNumber(refreshed.prices[asset]?.priceUsd);
}

async function settleClosedTradeWallet(input: {
  userId: string;
  blockedMargin: number;
  pnl: number;
  now: number;
}) {
  const userRef = doc(usersCol, input.userId);

  return runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("User profile not found");
    }

    const wallet = userSnap.data() as Partial<Wallet>;
    const currentBalance = safeNumber(wallet.balance, 0, 1e12);
    const currentLocked = Math.max(0, safeNumber(wallet.locked, 0, 1e12));
    const releaseMargin = Math.min(currentLocked, Math.max(0, input.blockedMargin));
    const creditAmount = releaseMargin + input.pnl;

    tx.set(
      userRef,
      {
        balance: currentBalance + creditAmount,
        locked: Math.max(0, currentLocked - releaseMargin),
        updatedAt: input.now,
      },
      { merge: true },
    );

    return { releaseMargin, creditAmount };
  });
}

export async function ensureWallet(userId: string): Promise<Wallet> {
  const userRef = doc(usersCol, userId);
  const userSnap = await getDoc(userRef);
  const now = Date.now();
  const defaults: Wallet = {
    userId,
    balance: 0,
    locked: 0,
    updatedAt: now,
  };

  if (!userSnap.exists()) {
    throw new Error("User profile not found");
  }

  const data = userSnap.data() as Partial<Wallet>;
  const wallet: Wallet = {
    userId,
    balance: typeof data.balance === "number" ? data.balance : defaults.balance,
    locked: Math.max(0, typeof data.locked === "number" ? data.locked : defaults.locked),
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : defaults.updatedAt,
  };

  if (
    wallet.balance !== data.balance ||
    wallet.locked !== data.locked ||
    wallet.updatedAt !== data.updatedAt
  ) {
    await setDoc(userRef, wallet, { merge: true });
  }

  return wallet;
}

export function subscribeWallet(
  userId: string,
  onData: (wallet: Wallet) => void,
  onError?: (error: unknown) => void,
) {
  return onSnapshot(
    doc(usersCol, userId),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Partial<Wallet>;
      onData({
        userId,
        balance: typeof data.balance === "number" ? data.balance : 0,
        locked: Math.max(0, typeof data.locked === "number" ? data.locked : 0),
        updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
      });
    },
    (error) => onError?.(error),
  );
}

export function subscribeTrades(
  userId: string,
  onData: (trades: Trade[]) => void,
  onError?: (error: unknown) => void,
) {
  const q = query(tradesCol, where("userId", "==", userId));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Trade, "id">) })) as Trade[];
      rows.sort((a, b) => b.timestamp - a.timestamp);
      onData(rows);
    },
    (error) => onError?.(error),
  );
}

export function subscribeAllTrades(
  onData: (trades: Trade[]) => void,
  onError?: (error: unknown) => void,
) {
  const q = query(tradesCol, orderBy("timestamp", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Trade, "id">) })) as Trade[],
      );
    },
    (error) => onError?.(error),
  );
}

async function getOpenTrades(userId: string) {
  const q = query(tradesCol, where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Trade, "id">) }))
    .filter((trade) => trade.status === "open") as Trade[];
}

async function closePosition(userId: string, tradesToClose: Trade[], currentPriceByAsset: Record<string, number>) {
  let closedType: "buy" | "sell" = "buy";

  for (const trade of tradesToClose) {
    const currentPrice = safeNumber(currentPriceByAsset[trade.asset]);
    if (currentPrice <= 0) {
      throw new Error(`Live price unavailable for ${trade.asset}`);
    }

    const quantity = safeNumber(trade.quantity, 0, 1e6);
    const pnl = calculatePnL({
      entryPrice: safeNumber(trade.entryPrice),
      currentPrice,
      quantity,
      side: trade.type,
    });
    const principal = safeNumber(trade.entryPrice * quantity, 0, 1e12);
    const blockedMargin =
      safeNumber(trade.marginUsed, 0, 1e12) > 0
        ? safeNumber(trade.marginUsed, 0, 1e12)
        : principal;
    const now = Date.now();

    await updateDoc(doc(tradesCol, trade.id), {
      currentPrice,
      pnl,
      status: "closed",
      closedAt: now,
    });

    const settlement = await settleClosedTradeWallet({ userId, blockedMargin, pnl, now });

    try {
      await addDoc(transactionsCol, {
        userId,
        type: "trade_pnl",
        amount: settlement.creditAmount,
        status: "completed",
        createdAt: now,
        createdAtServer: serverTimestamp(),
        note: `Position closed ${trade.asset} (${trade.type.toUpperCase()}) P/L ${pnl.toFixed(2)}`,
      });
    } catch (error) {
      console.error("[Trading] Transaction log write failed after position close", error);
    }

    closedType = trade.type;
  }

  return { closedType };
}

async function openPosition(input: {
  userId: string;
  asset: string;
  type: "buy" | "sell";
  quantity: number;
  leverage: number;
  currentPrice: number;
}) {
  const { userId, asset, type, quantity, leverage, currentPrice } = input;
  const required = calculateRequiredMargin(quantity, currentPrice, leverage);

  await ensureWallet(userId);
  const userRef = doc(usersCol, userId);
  const userProfileSnap = await getDoc(userRef);
  if (!userProfileSnap.exists()) {
    throw new Error("User profile not found");
  }

  const userProfile = userProfileSnap.data() as { displayName?: string; email?: string; assignedAdminId?: string };
  const userDisplayName = userProfile.displayName ?? "Trader";
  const userEmail = userProfile.email ?? "";
  const userSearchKey = `${userDisplayName} ${userEmail} ${userId}`.trim().toLowerCase();

  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("User profile not found");
    }

    const userData = userSnap.data() as Partial<Wallet>;
    const wallet: Wallet = {
      userId,
      balance: typeof userData.balance === "number" ? userData.balance : 0,
      locked: typeof userData.locked === "number" ? userData.locked : 0,
      updatedAt: Date.now(),
    };

    if (safeNumber(wallet.balance) < required) {
      throw new Error(`Insufficient wallet balance. Required margin: ${required.toFixed(2)}`);
    }

    tx.set(
      userRef,
      {
        balance: safeNumber(wallet.balance) - required,
        locked: safeNumber(wallet.locked) + required,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  });

  await addDoc(tradesCol, {
    userId,
    userDisplayName,
    userEmail,
    userSearchKey,
    assignedAdminId: userProfile.assignedAdminId ?? "",
    asset,
    type,
    quantity,
    leverage,
    marginUsed: required,
    entryPrice: currentPrice,
    currentPrice,
    pnl: 0,
    status: "open",
    timestamp: Date.now(),
    createdAtServer: serverTimestamp(),
  });

  try {
    await addDoc(transactionsCol, {
      userId,
      type: "trade_pnl",
      amount: -required,
      status: "completed",
      createdAt: Date.now(),
      createdAtServer: serverTimestamp(),
      note: `Margin blocked for ${type.toUpperCase()} ${asset}`,
    });
  } catch (error) {
    console.error("[Trading] Transaction log write failed after trade placement", error);
  }
}

export type PlaceTradeResult = {
  action: "opened" | "closed_position";
  closedType?: "buy" | "sell";
  message: string;
};

export async function placeTrade(input: {
  userId: string;
  asset: string;
  type: "buy" | "sell";
  quantity: number;
  leverage?: number;
}): Promise<PlaceTradeResult> {
  const { userId, asset, type } = input;
  const safeQuantity = safeNumber(input.quantity, 0, 1e6);
  if (safeQuantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  const snapshot = getCurrentMarketSnapshot();
  const category = snapshot.prices[asset]?.category ?? inferMarketCategory(asset);
  const marketStatus = getMarketStatus(category);
  if (!marketStatus.isOpen) {
    throw new Error(marketStatus.message);
  }

  const currentPrice = await latestPrice(asset);
  if (!currentPrice || currentPrice <= 0) {
    throw new Error("Live price unavailable for selected asset");
  }

  // Allow multiple positions (BUY and SELL) for same asset, like CoinDCX. No forced closing.

  const rawLeverage = safeNumber(input.leverage, 1, 300);
  const safeLeverage = Math.max(1, rawLeverage);
  await openPosition({
    userId,
    asset,
    type,
    quantity: safeQuantity,
    leverage: safeLeverage,
    currentPrice,
  });

  return {
    action: "opened",
    message: `${type.toUpperCase()} position opened successfully.`,
  };
}

export async function closeTrade(trade: Trade) {
  const currentPrice = await latestPrice(trade.asset);
  if (!currentPrice || currentPrice <= 0) {
    throw new Error("Live price unavailable for selected asset");
  }

  const entryPrice = safeNumber(trade.entryPrice);
  const quantity = safeNumber(trade.quantity, 0, 1e6);

  // Fix: canonical formula required by spec, with direction handling for sell trades.
  const pnl = calculatePnL({
    entryPrice,
    currentPrice,
    quantity,
    side: trade.type,
  });
  const principal = safeNumber(entryPrice * quantity, 0, 1e12);
  const blockedMargin =
    safeNumber(trade.marginUsed, 0, 1e12) > 0
      ? safeNumber(trade.marginUsed, 0, 1e12)
      : principal;
  const now = Date.now();

  await updateDoc(doc(tradesCol, trade.id), {
    currentPrice,
    pnl,
    status: "closed",
    closedAt: now,
  });

  const settlement = await settleClosedTradeWallet({
    userId: trade.userId,
    blockedMargin,
    pnl,
    now,
  });

  try {
    await addDoc(transactionsCol, {
      userId: trade.userId,
      type: "trade_pnl",
      amount: settlement.creditAmount,
      status: "completed",
      createdAt: now,
      createdAtServer: serverTimestamp(),
      note: `Trade closed ${trade.asset} (${trade.type.toUpperCase()}) P/L ${pnl.toFixed(2)}`,
    });
  } catch (error) {
    console.error("[Trading] Transaction log write failed after trade close", error);
  }
}

export async function adminUpdateTradeEntryPrice(input: {
  tradeId: string;
  entryPrice: number;
}) {
  if (!Number.isFinite(input.entryPrice) || input.entryPrice <= 0) {
    throw new Error("Entry price must be greater than 0");
  }

  await updateDoc(doc(tradesCol, input.tradeId), {
    entryPrice: input.entryPrice,
    updatedAt: Date.now(),
  });
}

export async function adminUpdateTrade(input: {
  tradeId: string;
  patch: Partial<
    Pick<
      Trade,
      | "asset"
      | "type"
      | "quantity"
      | "leverage"
      | "marginUsed"
      | "entryPrice"
      | "currentPrice"
      | "pnl"
      | "status"
      | "closedAt"
    >
  >;
}) {
  const numericFields = ["quantity", "leverage", "marginUsed", "entryPrice", "currentPrice", "pnl"] as const;
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input.patch)) {
    if (value === undefined) continue;
    if (numericFields.includes(key as (typeof numericFields)[number])) {
      const numericValue = safeNumber(value, 0, 1e12);
      if (key !== "pnl" && numericValue < 0) {
        throw new Error(`${key} cannot be negative`);
      }
      patch[key] = numericValue;
      continue;
    }
    patch[key] = value;
  }

  if (patch.status === "closed" && !patch.closedAt) {
    patch.closedAt = Date.now();
  }

  if (patch.status === "open") {
    patch.closedAt = null;
  }

  await updateDoc(doc(tradesCol, input.tradeId), {
    ...patch,
    updatedAt: Date.now(),
  });
}


export function subscribeAssignedTrades(adminId: string, onData: (rows: Trade[]) => void, onError?: (error: unknown) => void) {
  const userQuery = query(usersCol, where("assignedAdminId", "==", adminId), where("role", "==", "user"));
  let childUnsubs: Array<() => void> = [];
  let rows = new Map<string, Trade>();
  let stopped = false;
  const unsubUsers = onSnapshot(userQuery, (usersSnap) => {
    childUnsubs.forEach((u) => u()); childUnsubs = []; rows = new Map();
    usersSnap.docs.forEach((userDoc) => {
      const q = query(tradesCol, where("userId", "==", userDoc.id));
      childUnsubs.push(onSnapshot(q, (snap) => {
        snap.docs.forEach((d) => rows.set(d.id, { id: d.id, ...(d.data() as Omit<Trade, "id">) } as Trade));
        if (!stopped) onData(Array.from(rows.values()).sort((a, b) => b.timestamp - a.timestamp));
      }, onError));
    });
    if (!usersSnap.size) onData([]);
  }, onError);
  return () => { stopped = true; childUnsubs.forEach((u) => u()); unsubUsers(); };
}
