"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useCreateDepositRequest, useDeposits } from "@/hooks/useWalletRequests";
import { formatCurrency } from "@/utils/format";

const schema = z.object({
  amount: z.number().min(100),
  upiId: z.string().min(3),
  screenshotUrl: z.string().url(),
});

type FormData = z.infer<typeof schema>;

export default function DepositPage() {
  const { appUser } = useAuth();
  const createDeposit = useCreateDepositRequest();
  const rows = useDeposits(appUser?.uid);

  const { register, handleSubmit, formState, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!appUser?.uid) return;
    await createDeposit.mutateAsync({
      userId: appUser.uid,
      amount: data.amount,
      upiId: data.upiId,
      screenshotUrl: data.screenshotUrl,
    });
    reset();
  };

  return (
    <AppShell title="Deposit">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-medium">Payment Details</h3>
          <div className="rounded-lg bg-zinc-900/70 p-3 text-sm">
            <p>Bank Name: Axis Bank</p>
            <p>Holder Name: Mahendra Bhargav</p>
            <p>Account Number: 925010058902322</p>
            <p>IFSC Code: UTIB0005692</p>
          </div>

          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            Your deposit will be considered valid only after payment is received in the above account.
          </div>
        </section>

        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-medium">QR / Barcode</h3>
          <div className="flex min-h-52 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/60 text-center">
            <div>
              <p className="text-sm font-medium text-zinc-200">QR Code Coming Soon</p>
              <p className="mt-1 text-xs text-zinc-400">Barcode / scan payment option will be added soon.</p>
            </div>
          </div>
        </section>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="glass mx-auto w-full max-w-xl space-y-3 p-4">
        <h3 className="text-sm font-medium">Deposit Request</h3>
        <input
          type="number"
          placeholder="Amount"
          {...register("amount", { valueAsNumber: true })}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2"
        />
        <input
          placeholder="Your UPI ID"
          {...register("upiId")}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2"
        />
        <input
          placeholder="Payment Screenshot URL"
          {...register("screenshotUrl")}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2"
        />
        <button
          type="submit"
          disabled={formState.isSubmitting || createDeposit.isPending}
          className="w-full rounded-lg bg-emerald-500 px-3 py-2 font-medium text-zinc-900"
        >
          {formState.isSubmitting || createDeposit.isPending ? "Submitting..." : "Submit Deposit Request"}
        </button>
      </form>

      <section className="glass p-4">
        <h3 className="mb-3 text-sm font-medium">Deposit History</h3>
        <div className="space-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.id} className="rounded-lg border border-zinc-700/70 p-3">
              {formatCurrency(row.amount)} • {row.status} • {new Date(row.createdAt).toLocaleString()}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
