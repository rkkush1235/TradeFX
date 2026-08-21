"use client";

import { AppShell } from "@/components/layout/AppShell";
import { TradingChart } from "@/charts/TradingChart";
import { MarketCards } from "@/components/markets/MarketCards";
import { useMarketData } from "@/hooks/useMarketData";
import { useAuth } from "@/hooks/useAuth";
import { useCloseTrade, useTrades } from "@/hooks/useTrading";
import { useTransactions } from "@/hooks/useWalletRequests";
import { TransactionsTable } from "@/components/wallet/TransactionsTable";
import { TradesTable } from "@/components/trades/TradesTable";

export default function DashboardPage() {
  const market = useMarketData();
  const { appUser } = useAuth();
  const trades = useTrades(appUser?.uid);
  const closeTrade = useCloseTrade();
  const txRows = useTransactions(appUser?.uid);

  return (
    <AppShell title="Dashboard">
      <section className="mobile-chart-sticky">
        <TradingChart />
      </section>

      <section className="mobile-market-list">
        <MarketCards snapshot={market} />
      </section>

      <section className="glass p-4">
        <h3 className="mb-3 text-sm font-medium">My Buy/Sell Positions</h3>
        <TradesTable trades={trades.slice(0, 8)} priceMap={market.prices} onClose={(trade) => closeTrade.mutate(trade)} />
      </section>

      <section className="glass p-4">
        <h3 className="mb-3 text-sm font-medium">Recent Transactions</h3>
        <TransactionsTable rows={txRows.slice(0, 6)} />
      </section>
    </AppShell>
  );
}
