"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useCreateWithdrawalRequest, useWithdrawals } from "@/hooks/useWalletRequests";
import { formatCurrency } from "@/utils/format";

const schema = z.object({
  amount: z.number({ error: "Enter withdrawal amount" }).min(1, "Minimum withdrawal amount is 1"),
  upiId: z.string().min(3),
  accountNumber: z.string().min(8),
  ifscCode: z.string().min(6),
});

type FormData = z.infer<typeof schema>;

export default function WithdrawPage() {
  const { appUser } = useAuth();
  const createWithdrawal = useCreateWithdrawalRequest();
  const rows = useWithdrawals(appUser?.uid);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { register, handleSubmit, formState, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!appUser?.uid) return;
    setMessage(null);
    try {
      await createWithdrawal.mutateAsync({
        userId: appUser.uid,
        amount: data.amount,
        upiId: data.upiId,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode.toUpperCase(),
      });
      reset();
      setMessage({ type: "success", text: "Withdrawal request submitted." });
    } catch (error) {
      console.error("[Withdraw] Request failed", error);
      setMessage({ type: "error", text: "Withdrawal request submit nahi hui. Please try again." });
    }
  };

  return (
    <AppShell title="Withdraw">
      <form onSubmit={handleSubmit(onSubmit)} className="glass mx-auto w-full max-w-xl space-y-3 p-4">
        <h3 className="text-sm font-medium">Withdrawal Request</h3>
        {message ? (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              message.type === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            {message.text}
          </div>
        ) : null}
        <input
          type="number"
          min={1}
          step="any"
          placeholder="Amount"
          {...register("amount", { valueAsNumber: true })}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2"
        />
        {formState.errors.amount ? (
          <p className="text-xs text-red-300">{formState.errors.amount.message}</p>
        ) : null}
        <input
          placeholder="UPI ID"
          {...register("upiId")}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2"
        />
        <input
          placeholder="Account Number"
          {...register("accountNumber")}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2"
        />
        <input
          placeholder="IFSC Code"
          {...register("ifscCode")}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2"
        />
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="w-full rounded-lg bg-emerald-500 px-3 py-2 font-medium text-zinc-900"
        >
          {formState.isSubmitting ? "Submitting..." : "Submit Withdrawal"}
        </button>
      </form>

      <section className="glass p-4">
        <h3 className="mb-3 text-sm font-medium">Withdrawal History</h3>
        <div className="space-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-lg border border-zinc-700/70 p-3 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-medium">{formatCurrency(row.amount)}</p>
                <p className="text-xs text-zinc-400">
                  Requested: {new Date(row.createdAt).toLocaleString()}
                </p>
                <p className="text-xs text-zinc-500">
                  UPI {row.upiId || "-"} • A/C {row.accountNumber || "-"} • IFSC {row.ifscCode || "-"}
                </p>
              </div>
              <span className="h-fit rounded-md border border-zinc-700 px-2 py-1 text-xs uppercase text-zinc-300">
                {row.status}
              </span>
            </div>
          ))}
          {!rows.length ? (
            <div className="rounded-lg border border-zinc-700/70 p-4 text-sm text-zinc-400">
              No withdrawal request yet.
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
