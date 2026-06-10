"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { AdminRoute } from "@/components/guards/AdminRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useDeposits, useReviewDeposit } from "@/hooks/useWalletRequests";
import { formatCurrency } from "@/utils/format";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/firebase/firebase";

export default function AdminDepositsPage() {
  const { appUser } = useAuth();
  const deposits = useDeposits();
  const reviewDeposit = useReviewDeposit();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);

  const handleClearScreenshot = async (depositId: string) => {
    if (!confirm("Clear screenshot for this deposit? This cannot be undone.")) return;
    
    try {
      setClearingId(depositId);
      await updateDoc(doc(db, "deposits", depositId), {
        screenshotUrl: "",
        screenshotClearedAt: Date.now(),
      });
    } catch (error) {
      console.error("Error clearing screenshot:", error);
    } finally {
      setClearingId(null);
    }
  };

  return (
    <AdminRoute>
      <AppShell title="Admin Deposits">
        <section className="glass p-4">
          <h3 className="mb-4 text-sm font-medium">Deposit Requests</h3>
          <div className="space-y-4">
            {deposits.length === 0 ? (
              <p className="text-sm text-zinc-400">No deposit requests</p>
            ) : (
              deposits.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-zinc-700/80 overflow-hidden bg-zinc-900/30"
                >
                  <div className="p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          {item.userId.slice(0, 8)} • {formatCurrency(item.amount)}
                        </span>
                        <span className={`text-xs font-medium w-fit px-2 py-1 rounded ${
                          item.status === "approved" ? "bg-emerald-500/20 text-emerald-400" :
                          item.status === "rejected" ? "bg-red-500/20 text-red-400" :
                          "bg-amber-500/20 text-amber-400"
                        }`}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                      </div>
                      {item.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            disabled={reviewDeposit.isPending}
                            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-bold text-zinc-900 hover:bg-emerald-600 disabled:opacity-50"
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
                            className="rounded-md bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
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
                      )}
                    </div>

                    <div className="grid gap-2 text-xs text-zinc-300">
                      <p><span className="text-zinc-400">UPI ID:</span> {item.upiId}</p>
                      <p><span className="text-zinc-400">Requested:</span> {new Date(item.createdAt).toLocaleString()}</p>
                    </div>

                    <div className="mt-3 flex gap-2 flex-wrap">
                      {item.screenshotUrl && (
                        <>
                          <button
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            className="text-xs text-emerald-400 hover:underline font-medium"
                          >
                            {expandedId === item.id ? "Hide Screenshot" : "View Screenshot"}
                          </button>
                          {item.status === "approved" && (
                            <button
                              onClick={() => handleClearScreenshot(item.id)}
                              disabled={clearingId === item.id}
                              className="text-xs text-amber-400 hover:underline font-medium disabled:opacity-50"
                            >
                              {clearingId === item.id ? "Clearing..." : "Clear Screenshot"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {expandedId === item.id && item.screenshotUrl && (
                    <div className="border-t border-zinc-700 p-4 bg-zinc-900/50">
                      <p className="text-xs text-zinc-400 mb-3">Payment Proof:</p>
                      <div className="relative rounded-lg overflow-hidden border border-zinc-700 bg-black">
                        <img
                          src={item.screenshotUrl}
                          alt="Payment screenshot"
                          className="max-h-96 w-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </AppShell>
    </AdminRoute>
  );
}
