"use client";

import { useMemo, useState } from "react";
import { Trade } from "@/types";
import { safeNumber, formatPrice, formatPnl } from "@/utils/format";
import { calculatePnL } from "@/utils/tradingCalculations";

function todayInputDate() {
  return toInputDate(Date.now());
}

function toInputDate(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TradesTable({
  trades,
  onClose,
  priceMap,
  closingTradeId,
}: {
  trades: Trade[];
  onClose?: (trade: Trade) => void;
  closingTradeId?: string;
  priceMap?: Record<string, { priceUsd?: number }>;
}) {
  const [startDate, setStartDate] = useState(todayInputDate);
  const [endDate, setEndDate] = useState(todayInputDate);
  const [assetFilter, setAssetFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "buy" | "sell">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");

  const assetOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const trade of trades) {
      unique.add(trade.asset);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [trades]);

  const visibleTrades = useMemo(() => {
    const from = startDate && endDate && startDate > endDate ? endDate : startDate;
    const to = startDate && endDate && startDate > endDate ? startDate : endDate;

    return trades.filter((trade) => {
      const tradeDate = toInputDate(trade.timestamp);

      if (from && tradeDate < from) return false;
      if (to && tradeDate > to) return false;
      if (assetFilter !== "all" && trade.asset !== assetFilter) return false;
      if (typeFilter !== "all" && trade.type !== typeFilter) return false;
      if (statusFilter !== "all" && trade.status !== statusFilter) return false;

      return true;
    });
  }, [assetFilter, endDate, startDate, statusFilter, trades, typeFilter]);

  const rows = visibleTrades.map((trade) => {
    const open = trade.status === "open";
    // Fix: current and entry must use same USD source for accurate PnL.
    const currentPrice = open
      ? safeNumber(priceMap?.[trade.asset]?.priceUsd ?? trade.currentPrice)
      : safeNumber(trade.currentPrice);
    const entryPrice = safeNumber(trade.entryPrice);
    const qty = safeNumber(trade.quantity, 0, 1e6);
    const livePnl = calculatePnL({ entryPrice, currentPrice, quantity: qty, side: trade.type });
    return { trade, open, currentPrice, entryPrice, qty, livePnl };
  });

  return (
    <div className="glass md:overflow-x-auto">
      <div className="grid grid-cols-2 gap-2 border-b border-zinc-800/80 p-3 md:grid-cols-5">
        <input
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-900/70 px-2 py-1.5 text-xs"
          aria-label="Start date"
        />
        <input
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-900/70 px-2 py-1.5 text-xs"
          aria-label="End date"
        />
        <select
          value={assetFilter}
          onChange={(event) => setAssetFilter(event.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-900/70 px-2 py-1.5 text-xs"
          aria-label="Script filter"
        >
          <option value="all">All Scripts</option>
          {assetOptions.map((asset) => (
            <option key={asset} value={asset}>
              {asset}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as "all" | "buy" | "sell")}
          className="rounded-md border border-zinc-700 bg-zinc-900/70 px-2 py-1.5 text-xs"
          aria-label="Type filter"
        >
          <option value="all">All Types</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | "open" | "closed")}
          className="col-span-2 rounded-md border border-zinc-700 bg-zinc-900/70 px-2 py-1.5 text-xs md:col-span-1"
          aria-label="Status filter"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-zinc-500">No positions for the selected filters.</p>
      ) : null}

      {/* Phones: one card per position so P/L and the close button are always on screen. */}
      <ul className="divide-y divide-zinc-800/80 md:hidden">
        {rows.map(({ trade, open, currentPrice, entryPrice, qty, livePnl }) => (
          <li key={trade.id} className="space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{trade.asset}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${trade.type === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                  {trade.type}
                </span>
                <span className="text-xs capitalize text-zinc-500">{trade.status}</span>
              </div>
              <span className={`text-sm font-semibold ${livePnl >= 0 ? "badge-up" : "badge-down"}`}>{formatPnl(livePnl)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-zinc-500">Qty</p>
                <p>{qty.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Entry</p>
                <p>{formatPrice(entryPrice)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Current</p>
                <p>{formatPrice(currentPrice)}</p>
              </div>
            </div>
            {open ? (
              <button
                type="button"
                onClick={() => onClose?.(trade)}
                disabled={Boolean(closingTradeId)}
                className="w-full rounded-md bg-zinc-800 py-2 text-xs hover:bg-zinc-700 disabled:opacity-50"
              >
                {closingTradeId === trade.id ? "Closing..." : trade.type === "sell" ? "Cover" : "Close"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <table className="hidden min-w-full text-sm md:table">
        <thead className="text-left text-xs text-zinc-400">
          <tr>
            <th className="p-3">Asset</th>
            <th className="p-3">Type</th>
            <th className="p-3">Qty</th>
            <th className="p-3">Entry</th>
            <th className="p-3">Current</th>
            <th className="p-3">PnL</th>
            <th className="p-3">Status</th>
            <th className="p-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ trade, open, currentPrice, entryPrice, qty, livePnl }) => (
            <tr key={trade.id} className="border-t border-zinc-800/80">
              <td className="p-3">{trade.asset}</td>
              <td className="p-3 uppercase text-zinc-300">{trade.type}</td>
              <td className="p-3">{qty.toFixed(4)}</td>
              <td className="p-3">{formatPrice(entryPrice)}</td>
              <td className="p-3">{formatPrice(currentPrice)}</td>
              <td className={`p-3 ${livePnl >= 0 ? "badge-up" : "badge-down"}`}>
                {formatPnl(livePnl)}
              </td>
              <td className="p-3 capitalize text-zinc-300">{trade.status}</td>
              <td className="p-3">
                {open ? (
                  <button
                    type="button"
                    onClick={() => onClose?.(trade)}
                    disabled={Boolean(closingTradeId)}
                    className="rounded-md bg-zinc-800 px-3 py-1 text-xs hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {closingTradeId === trade.id ? "Closing..." : trade.type === "sell" ? "Cover" : "Close"}
                  </button>
                ) : (
                  <span className="text-xs text-zinc-500">Closed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
