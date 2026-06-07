"use client";

import { useState } from "react";
import { AdminRoute } from "@/components/guards/AdminRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useDeposits, useReviewDeposit } from "@/hooks/useWalletRequests";
import { formatCurrency } from "@/utils/format";

export default function AdminDepositsPage() {
  const { appUser } = useAuth();
  const deposits = useDeposits();
  const reviewDeposit = useReviewDeposit();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  return (
    <AdminRoute>
      <AppShell title="Admin Deposits">
        <section className="glass p-4">
          <h3 className="mb-3 text-sm font-medium">Deposit Requests</h3>
          <div className="space-y-2">
            {deposits.map((item) => (
              <div key={item.id} className="rounded-lg border border-zinc-700/80 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{item.userId.slice(0, 8)} • {formatCurrency(item.amount)} • {item.status}</span>
                  <div className="flex gap-2">
                    <button
                      disabled={reviewDeposit.isPending}
                      className="rounded-md bg-emerald-500 px-4 py-3 text-sm font-bold text-zinc-900"
                      onClick={async () => {
                        const key = `${item.id}-approve`;
                        setActiveAction(key);
                        await reviewDeposit.mutateAsync({
                          requestId: item.id,
                          userId: item.userId,
                          amount: item.amount,
                          adminId: appUser?.uid ?? "admin",
                          status: "approved",
                        }).finally(() => setActiveAction(null));
                      }}
                    >
                      {activeAction === `${item.id}-approve` ? "Approving..." : "Approve"}
                    </button>
                    <button
                      disabled={reviewDeposit.isPending}
                      className="rounded-md bg-red-500 px-4 py-3 text-sm font-bold"
                      onClick={async () => {
                        const key = `${item.id}-reject`;
                        setActiveAction(key);
                        await reviewDeposit.mutateAsync({
                          requestId: item.id,
                          userId: item.userId,
                          amount: item.amount,
                          adminId: appUser?.uid ?? "admin",
                          status: "rejected",
                        }).finally(() => setActiveAction(null));
                      }}
                    >
                      {activeAction === `${item.id}-reject` ? "Rejecting..." : "Reject"}
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-zinc-300 md:grid-cols-2">
                  <p>UPI: {item.upiId}</p>
                  <a
                    href={item.screenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 underline-offset-2 hover:underline"
                  >
                    Open Payment Screenshot
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      </AppShell>
    </AdminRoute>
  );
}
