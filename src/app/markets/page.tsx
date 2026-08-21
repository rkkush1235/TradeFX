"use client";

import { AppShell } from "@/components/layout/AppShell";
import { MarketCards } from "@/components/markets/MarketCards";
import { TradingChart } from "@/charts/TradingChart";
import { useMarketData } from "@/hooks/useMarketData";

export default function MarketsPage() {
  const snapshot = useMarketData();

  return (
    <AppShell title="Markets">
      <section className="mobile-chart-sticky">
        <TradingChart />
      </section>
      <section className="mobile-market-list">
        <MarketCards snapshot={snapshot} />
      </section>
    </AppShell>
  );
}
