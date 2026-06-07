"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { MarketSnapshot } from "@/types";
import type { Trade } from "@/types";
import { formatCurrency, formatPercent, safeNumber } from "@/utils/format";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/hooks/useAuth";
import { usePlaceTrade, useTrades, useWallet } from "@/hooks/useTrading";
import { getMarketStatus } from "@/utils/marketHours";
import { calculatePnL } from "@/utils/tradingCalculations";

function normalizeSymbol(symbol: string) {
  return symbol.replace(/\//g, "").trim().toUpperCase();
}

function mapToTradingViewSymbol(symbol: string, category?: "forex" | "crypto" | "metal") {
  const clean = symbol.trim().toUpperCase();
  if (clean.includes(":")) return clean;

  const normalized = normalizeSymbol(clean);
  const known: Record<string, string> = {
    BTC: "BINANCE:BTCUSDT",
    ETH: "BINANCE:ETHUSDT",
    SOL: "BINANCE:SOLUSDT",
    BNB: "BINANCE:BNBUSDT",
    XRP: "BINANCE:XRPUSDT",
    DOGE: "BINANCE:DOGEUSDT",
    EURUSD: "FX:EURUSD",
    GBPUSD: "FX:GBPUSD",
    USDJPY: "FX:USDJPY",
    AUDUSD: "FX:AUDUSD",
    USDCAD: "FX:USDCAD",
    GOLD: "OANDA:XAUUSD",
    XAUUSD: "OANDA:XAUUSD",
    SILVER: "OANDA:XAGUSD",
    XAGUSD: "OANDA:XAGUSD",
  };

  if (known[normalized]) return known[normalized];
  if (category === "forex" && /^[A-Z]{6}$/.test(normalized)) return `FX:${normalized}`;
  if (category === "crypto") return `BINANCE:${normalized.endsWith("USDT") ? normalized : `${normalized}USDT`}`;
  if (category === "metal") return `OANDA:${normalized}`;
  return normalized;
}

interface DraftOrder {
  symbol: string;
  side: "buy" | "sell";
}

const LEVERAGE_OPTIONS = [20, 30, 50, 100, 200, 300] as const;

function normalizeQuantityInput(raw: string) {
  const stripped = raw.replace(/[^\d.]/g, "");
  if (!stripped) return "";

  const firstDotIndex = stripped.indexOf(".");
  if (firstDotIndex >= 0) {
    const intPart = stripped.slice(0, firstDotIndex).replace(/^0+(\d)/, "$1") || "0";
    const decimalPart = stripped.slice(firstDotIndex + 1).replace(/\./g, "");
    return `${intPart}.${decimalPart}`;
  }

  return stripped.replace(/^0+(\d)/, "$1");
}

function toQtyInput(value: number) {
  const fixed = safeNumber(value, 0, 1e12).toFixed(6);
  return fixed.replace(/\.?0+$/, "") || "0";
}

export function MarketCards({ snapshot }: { snapshot: MarketSnapshot }) {
  const { selectedSymbol, setSelectedSymbol, setSelectedOrderType } = useAppStore();
  const { appUser } = useAuth();
  const wallet = useWallet(appUser?.uid);
  const trades = useTrades(appUser?.uid);
  const placeTrade = usePlaceTrade();
  const rows = Object.values(snapshot.prices);
  // Fix: cards must be ready only on USD feed values.
  const ready = rows.some((item) => safeNumber(item.priceUsd) > 0);
  const [draftOrder, setDraftOrder] = useState<DraftOrder | null>(null);
  const [quantityInput, setQuantityInput] = useState("1");
  const [selectedLeverage, setSelectedLeverage] = useState<(typeof LEVERAGE_OPTIONS)[number] | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState(false);

  // Support multiple open positions per asset (BUY and SELL)
  const openTradesByAsset = useMemo(() => {
    const map: Record<string, Trade[]> = {};
    for (const trade of trades) {
      if (trade.status === "open") {
        if (!map[trade.asset]) map[trade.asset] = [];
        map[trade.asset].push(trade);
      }
    }
    return map;
  }, [trades]);

  // For the selected asset in the modal, get all open trades (BUY/SELL)
  const selectedAssetOpenTrades = draftOrder ? openTradesByAsset[draftOrder.symbol] || [] : [];

  const activeTrade = selectedAssetOpenTrades[0] ?? null;
  const activePositionState =
    selectedAssetOpenTrades.length === 0
      ? "None"
      : selectedAssetOpenTrades.map((trade) => trade.type.toUpperCase()).join(" + ");
  const activePnl = selectedAssetOpenTrades.reduce((sum, trade) => {
    const livePrice = safeNumber(snapshot.prices[trade.asset]?.priceUsd || trade.currentPrice);
    return (
      sum +
      calculatePnL({
        entryPrice: safeNumber(trade.entryPrice),
        currentPrice: livePrice > 0 ? livePrice : safeNumber(trade.currentPrice),
        quantity: safeNumber(trade.quantity, 0, 1e6),
        side: trade.type,
      })
    );
  }, 0);

  const quantity = safeNumber(quantityInput, 0, 1e6);

  const draftPrice = draftOrder
    ? safeNumber(snapshot.prices[draftOrder.symbol]?.priceUsd)
    : 0;
  const selectedLeverageValue = selectedLeverage ?? 0;
  const effectiveLeverage = selectedLeverageValue > 0 ? selectedLeverageValue : 1;

  const estimated = safeNumber(Math.max(0, draftPrice * quantity));
  const leveragedEstimated = safeNumber(estimated * effectiveLeverage, 0, 1e15);
  const requiredMargin = safeNumber(estimated / effectiveLeverage, 0, 1e12);
  const walletBalance = safeNumber(wallet?.balance, 0, 1e12);
  const maxTradePower = safeNumber(walletBalance * effectiveLeverage, 0, 1e15);
  const maxTradeQtyLimit = safeNumber(draftPrice > 0 ? maxTradePower / draftPrice : 0, 0, 1e12);

  // No forced close, allow both BUY and SELL positions
  const willCloseOpposite = false;
  const sameDirectionActive = false;

  const tvSymbol = useMemo(() => {
    if (!draftOrder) return "";
    const category = snapshot.prices[draftOrder.symbol]?.category;
    return mapToTradingViewSymbol(draftOrder.symbol, category);
  }, [draftOrder, snapshot.prices]);

  const draftMarketStatus = useMemo(() => {
    if (!draftOrder) return null;
    const category = snapshot.prices[draftOrder.symbol]?.category;
    if (!category) return null;
    return getMarketStatus(category);
  }, [draftOrder, snapshot.prices]);

  const openOrderModal = (symbol: string, side: "buy" | "sell") => {
    setSelectedSymbol(symbol);
    setSelectedOrderType(side);
    setOrderError(null);
    setQuantityInput("1");
    setSelectedLeverage(null);
    setDraftOrder({ symbol, side });
  };

  const submitOrder = async () => {
    if (!appUser?.uid || !draftOrder) return;
    setOrderError(null);

    if (sameDirectionActive) {
      setOrderError(`Only one active position allowed. ${activeTrade?.type.toUpperCase()} already active.`);
      return;
    }

    if (!willCloseOpposite) {
      if (quantity <= 0) {
        setOrderError("Enter valid quantity");
        return;
      }
      if (quantity > maxTradeQtyLimit + 1e-9) {
        setOrderError(`Max ${draftOrder.side} quantity at ${effectiveLeverage}x is ${maxTradeQtyLimit.toFixed(6)}`);
        return;
      }
    }

    try {
      setConfirmingOrder(true);
      await Promise.all([
        placeTrade.mutateAsync({
          userId: appUser.uid,
          asset: draftOrder.symbol,
          type: draftOrder.side,
          quantity: willCloseOpposite
            ? safeNumber(activeTrade?.quantity, 0, 1e6) || 0.000001
            : safeNumber(quantity, 0, 1e6),
          leverage: effectiveLeverage,
        }),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]);
      setDraftOrder(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to place order";
      setOrderError(message);
    } finally {
      setConfirmingOrder(false);
    }
  };

  if (!ready) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="glass p-4">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton mt-3 h-7 w-28 rounded" />
            <div className="skeleton mt-2 h-3 w-12 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((item, idx) => {
        const up = item.change24h >= 0;
        const selected = selectedSymbol === item.symbol;
        const status = getMarketStatus(item.category);
        return (
          <motion.div
            key={item.symbol}
            whileHover={{ y: -2 }}
            onClick={() => setSelectedSymbol(item.symbol)}
            className={`glass p-4 text-left transition ${
              selected ? "ring-1 ring-emerald-500/80" : ""
            }`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
          >
            <p className="text-xs text-zinc-400">{item.symbol}</p>
            <h3 className="mt-2 text-lg font-semibold">{formatCurrency(safeNumber(item.priceUsd))}</h3>
            <p className={`mt-1 text-xs ${up ? "badge-up" : "badge-down"}`}>
              {formatPercent(safeNumber(item.change24h))}
            </p>
            {!status.isOpen ? (
              <p className="mt-1 text-[11px] text-red-400">Market Closed</p>
            ) : null}

            {selected ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openOrderModal(item.symbol, "buy");
                  }}
                  className="flex-1 rounded-md bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-zinc-900"
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openOrderModal(item.symbol, "sell");
                  }}
                  className="flex-1 rounded-md bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  SELL
                </button>
              </div>
            ) : null}
          </motion.div>
        );
      })}

      {draftOrder ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="glass w-full max-w-xl space-y-3 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                {draftOrder.side === "buy" ? "BUY" : "SELL"} {draftOrder.symbol}
              </h4>
              <button
                type="button"
                onClick={() => setDraftOrder(null)}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
              >
                Close
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-700/70 bg-zinc-950">
              <iframe
                key={tvSymbol}
                src={`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=15&theme=dark&style=1&locale=en&timezone=Asia%2FKolkata&hide_top_toolbar=1&hide_legend=1&withdateranges=0&saveimage=0&hideideas=1`}
                title={`${draftOrder.symbol} quick chart`}
                className="h-40 w-full"
                loading="lazy"
              />
            </div>

            {/* Show all open positions for this asset */}
            {selectedAssetOpenTrades.length > 0 && (
              <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-2 text-[11px] text-zinc-300 space-y-1">
                <div className="font-semibold text-xs mb-1">Open Positions</div>
                {selectedAssetOpenTrades.map((trade) => {
                  const livePrice = safeNumber(snapshot.prices[trade.asset]?.priceUsd || trade.currentPrice);
                  const pnl = calculatePnL({
                    entryPrice: safeNumber(trade.entryPrice),
                    currentPrice: livePrice > 0 ? livePrice : safeNumber(trade.currentPrice),
                    quantity: safeNumber(trade.quantity, 0, 1e6),
                    side: trade.type,
                  });
                  return (
                    <div key={trade.id} className="flex items-center justify-between">
                      <span>{trade.type.toUpperCase()} • Qty {safeNumber(trade.quantity, 0, 1e6).toFixed(6)}</span>
                      <span className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>P/L {formatCurrency(pnl)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-3">
              <p className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
                LTP: {draftPrice > 0 ? formatCurrency(draftPrice) : "--"}
              </p>
              <p className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
                Position: {activePositionState}
              </p>
              <p className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
                Live P/L: <span className={activePnl >= 0 ? "badge-up" : "badge-down"}>{formatCurrency(activePnl)}</span>
              </p>
            </div>

            {activeTrade ? (
              <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-2 text-[11px] text-zinc-300">
                Active Position • {activeTrade.asset} • {activeTrade.type.toUpperCase()} • Qty {safeNumber(activeTrade.quantity, 0, 1e6).toFixed(6)}
              </div>
            ) : null}

            <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-900/60 p-2">
              <p className="text-xs text-zinc-400">Leverage</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {LEVERAGE_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setSelectedLeverage(value);
                      const autoMaxQty = safeNumber(
                        draftPrice > 0
                          ? safeNumber(walletBalance * value, 0, 1e15) / draftPrice
                          : 0,
                        0,
                        1e12,
                      );
                      const autoMaxQtyLimit = safeNumber(Math.floor(autoMaxQty * 1e6) / 1e6, 0, 1e12);
                      if (!willCloseOpposite) {
                        setQuantityInput(toQtyInput(autoMaxQtyLimit));
                      }
                    }}
                    className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
                      selectedLeverage === value
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                        : "border-zinc-700 bg-zinc-900 text-zinc-300"
                    }`}
                  >
                    {value}x
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-zinc-400">
                {selectedLeverageValue > 0
                  ? `${formatCurrency(estimated)} × ${selectedLeverageValue} = ${formatCurrency(leveragedEstimated)}`
                  : `${formatCurrency(estimated)} × 1 = ${formatCurrency(leveragedEstimated)}`}
              </p>
              <p className="text-[11px] text-zinc-400">
                Required margin: {formatCurrency(requiredMargin)}
              </p>
              <p className="text-[11px] text-zinc-300">
                Max Qty at {effectiveLeverage}x: {maxTradeQtyLimit.toFixed(6)}
              </p>
            </div>

            <input
              type="text"
              inputMode="decimal"
              value={quantityInput}
              onChange={(event) => setQuantityInput(normalizeQuantityInput(event.target.value))}
              placeholder="0.01"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2"
              disabled={willCloseOpposite}
            />

            <button
              type="button"
              disabled={confirmingOrder || draftMarketStatus?.isOpen === false}
              onClick={submitOrder}
              className={`w-full rounded-lg px-4 py-2 text-sm font-semibold ${
                draftOrder.side === "buy"
                  ? "bg-emerald-500 text-zinc-900"
                  : "bg-red-500 text-white"
              } disabled:opacity-60`}
            >
              {draftMarketStatus?.isOpen === false
                ? "Market Closed"
                : confirmingOrder
                ? "Processing..."
                : draftOrder.side === "buy"
                  ? "Open Buy Position"
                  : "Open Sell Position"}
            </button>

            {draftMarketStatus && !draftMarketStatus.isOpen ? (
              <p className="text-xs text-red-400">{draftMarketStatus.message}</p>
            ) : null}
            {orderError ? <p className="text-xs text-red-400">{orderError}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
