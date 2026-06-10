"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AdminRoute } from "@/components/guards/AdminRoute";
import { useBankAccounts, useAddBankAccount, useDeleteBankAccount } from "@/hooks/useBankAccounts";

const schema = z.object({
  bankName: z.string().min(2, "Bank name must be at least 2 characters"),
  accountHolderName: z.string().min(2, "Account holder name must be at least 2 characters"),
  accountNumber: z.string().min(5, "Account number must be at least 5 digits"),
  ifscCode: z.string().min(11).max(11, "IFSC code must be exactly 11 characters"),
});

type FormData = z.infer<typeof schema>;

function BankAccountsContent() {
  const { data: bankAccounts = [], isLoading } = useBankAccounts();
  const addAccount = useAddBankAccount();
  const deleteAccount = useDeleteBankAccount();
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const { register, handleSubmit, formState, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setErrorMessage("");
      await addAccount.mutateAsync({
        bankName: data.bankName,
        accountHolderName: data.accountHolderName,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode.toUpperCase(),
        isActive: true,
      });
      setSuccessMessage("Bank account added successfully!");
      reset();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage("Failed to add bank account. Please try again.");
    }
  };

  const handleDelete = async (accountId: string) => {
    if (confirm("Are you sure you want to delete this account?")) {
      try {
        setErrorMessage("");
        await deleteAccount.mutateAsync(accountId);
        setSuccessMessage("Bank account deleted successfully!");
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (error) {
        setErrorMessage("Failed to delete bank account. Please try again.");
      }
    }
  };

  return (
    <AppShell title="Bank Accounts Management">
      <div className="space-y-4">
        {successMessage && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="glass space-y-3 p-4">
          <h3 className="text-sm font-medium">Add New Bank Account</h3>
          <input
            placeholder="Bank Name (e.g., State Bank of India)"
            {...register("bankName")}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm"
          />
          {formState.errors.bankName && (
            <p className="text-xs text-red-400">{formState.errors.bankName.message}</p>
          )}
          <input
            placeholder="Account Holder Name"
            {...register("accountHolderName")}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm"
          />
          {formState.errors.accountHolderName && (
            <p className="text-xs text-red-400">{formState.errors.accountHolderName.message}</p>
          )}
          <input
            placeholder="Account Number"
            {...register("accountNumber")}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm"
          />
          {formState.errors.accountNumber && (
            <p className="text-xs text-red-400">{formState.errors.accountNumber.message}</p>
          )}
          <input
            placeholder="IFSC Code (11 characters)"
            maxLength={11}
            {...register("ifscCode")}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm uppercase"
          />
          {formState.errors.ifscCode && (
            <p className="text-xs text-red-400">{formState.errors.ifscCode.message}</p>
          )}
          <button
            type="submit"
            disabled={formState.isSubmitting || addAccount.isPending}
            className="w-full rounded-lg bg-emerald-500 px-3 py-2 font-medium text-zinc-900 disabled:opacity-50"
          >
            {formState.isSubmitting || addAccount.isPending ? "Adding..." : "Add Account"}
          </button>
        </form>

        <section className="glass p-4">
          <h3 className="mb-3 text-sm font-medium">Active Bank Accounts</h3>
          {isLoading ? (
            <p className="text-sm text-zinc-400">Loading accounts...</p>
          ) : bankAccounts.length > 0 ? (
            <div className="space-y-3">
              {bankAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-start justify-between rounded-lg border border-zinc-700/70 bg-zinc-900/30 p-4"
                >
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-emerald-400">{account.bankName}</p>
                    <div className="mt-2 space-y-1 text-zinc-300">
                      <p><span className="text-zinc-400">Account Holder:</span> {account.accountHolderName}</p>
                      <p><span className="text-zinc-400">Account Number:</span> {account.accountNumber}</p>
                      <p><span className="text-zinc-400">IFSC Code:</span> {account.ifscCode}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(account.id)}
                    disabled={deleteAccount.isPending}
                    className="ml-4 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No bank accounts added yet. Add one to get started.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default function BankAccountsPage() {
  return (
    <AdminRoute>
      <BankAccountsContent />
    </AdminRoute>
  );
}
