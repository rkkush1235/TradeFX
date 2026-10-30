"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useCloseTrade, useTrades } from "@/hooks/useTrading";
import { useMarketData } from "@/hooks/useMarketData";
import { TradesTable } from "@/components/trades/TradesTable";

export default function TradesPage() {
  const { appUser } = useAuth();
  const trades = useTrades(appUser?.uid);
  const market = useMarketData();
  const closeTrade = useCloseTrade();

  return (
    <AppShell title="Position">
      {closeTrade.error ? (
        <p className="glass mb-3 border-red-500/40 p-3 text-sm text-red-300">
          Could not close position:{closeTrade.error instanceof Error ? closeTrade.error.message : "Unknown error"}
        </p>
      ) : null}
      <TradesTable
        trades={trades}
        priceMap={market.prices}
        closingTradeId={closeTrade.isPending ? closeTrade.variables?.id : undefined}
        onClose={(trade) => closeTrade.mutate(trade)}
      />
    </AppShell>
  );
}
