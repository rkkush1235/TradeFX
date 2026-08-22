"use client";

import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AdminRoute } from "@/components/guards/AdminRoute";
import { useAuth } from "@/hooks/useAuth";
import { useUsers } from "@/hooks/useAdmin";
import {
  useAllUserDepositAccounts,
  useSaveUserDepositAccount,
} from "@/hooks/useBankAccounts";
import { imageFileToCompressedBase64 } from "@/utils/imageBase64";

export default function BankAccountsPage() {
  const { appUser } = useAuth();
  const users = useUsers();

  const {
    data: assignments = [],
    isLoading,
  } = useAllUserDepositAccounts();

  const save = useSaveUserDepositAccount();

  const [selectedUserId, setSelectedUserId] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    qrCodeBase64: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return users.filter((user) => {
      const key = `${user.displayName} ${user.email} ${
        user.accountId ?? ""
      }`.toLowerCase();

      return key.includes(normalizedSearch);
    });
  }, [users, search]);

  const selectedAssignment = assignments.find(
    (item) => item.userId === selectedUserId,
  );

  const selectUser = (userId: string) => {
    setSelectedUserId(userId);

    const account = assignments.find(
      (item) => item.userId === userId,
    );

    setForm({
      bankName: account?.bankName ?? "",
      accountHolderName: account?.accountHolderName ?? "",
      accountNumber: account?.accountNumber ?? "",
      ifscCode: account?.ifscCode ?? "",
      qrCodeBase64: account?.qrCodeBase64 ?? "",
    });

    setMessage("");
    setError("");
  };

  const handleQr = async (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("QR must be an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("QR image must be smaller than 5MB.");
      return;
    }

    try {
      setError("");

      const qrCodeBase64 =
        await imageFileToCompressedBase64(file);

      setForm((prev) => ({
        ...prev,
        qrCodeBase64,
      }));
    } catch (error) {
      console.error("[Bank Accounts] QR processing failed", error);
      setError("Could not process the QR image.");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedUserId || !appUser?.uid) {
      setError("Select a user first.");
      return;
    }

    if (
      !form.bankName.trim() ||
      !form.accountHolderName.trim() ||
      !form.accountNumber.trim() ||
      !form.ifscCode.trim() ||
      !form.qrCodeBase64
    ) {
      setError(
        "Bank details and a QR / barcode image are required for every user deposit account.",
      );
      return;
    }

    try {
      setError("");
      setMessage("");

      await save.mutateAsync({
        userId: selectedUserId,
        adminId: appUser.uid,
        bankName: form.bankName.trim(),
        accountHolderName: form.accountHolderName.trim(),
        accountNumber: form.accountNumber.trim(),
        ifscCode: form.ifscCode.trim().toUpperCase(),
        qrCodeBase64: form.qrCodeBase64,
      });

      setMessage("Deposit account updated successfully.");
    } catch (error) {
      console.error(
        "[Bank Accounts] Deposit account save failed",
        error,
      );

      setError("Could not save the deposit account.");
    }
  };

  return (
    <AdminRoute>
      <AppShell title="Deposit Accounts">
        <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
          {/* USERS */}
          <section className="glass min-h-0 p-3">
            <div className="mb-3 space-y-2">
              <h3 className="text-sm font-semibold">
                Users
              </h3>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search user"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm"
              />
            </div>

            <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[68vh]">
              {filteredUsers.map((user) => {
                const assigned = assignments.some(
                  (item) => item.userId === user.uid,
                );

                return (
                  <button
                    key={user.uid}
                    type="button"
                    onClick={() =>
                      selectUser(user.uid)
                    }
                    className={`w-full rounded-lg border p-3 text-left ${
                      selectedUserId === user.uid
                        ? "border-emerald-500/60 bg-emerald-500/10"
                        : "border-zinc-700 bg-zinc-900/30"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">
                      {user.displayName || "Unnamed user"}
                    </p>

                    <p className="truncate text-xs text-zinc-400">
                      {user.email}
                    </p>

                    <p className="mt-1 text-[10px] text-zinc-500">
                      {assigned
                        ? "Account assigned"
                        : "No account assigned"}
                    </p>
                  </button>
                );
              })}

              {!filteredUsers.length && (
                <p className="rounded-lg border border-zinc-700 p-4 text-center text-sm text-zinc-500">
                  No users found.
                </p>
              )}
            </div>
          </section>

          {/* EDITOR */}
          <section className="glass p-4">
            {selectedUserId ? (
              <form
                onSubmit={submit}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Assigned Deposit Account
                    </h3>

                    <p className="mt-1 text-xs text-zinc-400">
                      This bank account and QR are shown only
                      to the selected user on Deposit.
                    </p>
                  </div>

                  <span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400">
                    {selectedAssignment
                      ? "Assigned"
                      : "Not assigned"}
                  </span>
                </div>

                {/* BANK DETAILS */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <BankField
                    label="Bank Name"
                    value={form.bankName}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        bankName: value,
                      }))
                    }
                  />

                  <BankField
                    label="Account Holder"
                    value={form.accountHolderName}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        accountHolderName: value,
                      }))
                    }
                  />

                  <BankField
                    label="Account Number"
                    value={form.accountNumber}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        accountNumber: value,
                      }))
                    }
                  />

                  <BankField
                    label="IFSC Code"
                    value={form.ifscCode}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        ifscCode:
                          value.toUpperCase(),
                      }))
                    }
                  />
                </div>

                {/* QR */}
                <div className="rounded-xl border border-zinc-700 bg-zinc-950/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        Payment QR / Barcode
                      </p>

                      <p className="text-xs text-zinc-500">
                        Upload a new QR to replace the
                        current one.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        fileRef.current?.click()
                      }
                      className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-300"
                    >
                      Upload QR
                    </button>

                    <input
                      ref={fileRef}
                      hidden
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        void handleQr(
                          event.target.files?.[0],
                        )
                      }
                    />
                  </div>

                  {form.qrCodeBase64 ? (
                    <img
                      src={form.qrCodeBase64}
                      alt="Deposit QR preview"
                      className="mt-3 h-44 w-44 rounded-lg bg-white object-contain p-2"
                    />
                  ) : (
                    <p className="mt-3 text-xs text-zinc-500">
                      No QR assigned.
                    </p>
                  )}
                </div>

                {/* MESSAGES */}
                {message && (
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                    {message}
                  </p>
                )}

                {error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {error}
                  </p>
                )}

                {/* SAVE */}
                <button
                  type="submit"
                  disabled={
                    save.isPending ||
                    isLoading
                  }
                  className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50"
                >
                  {save.isPending
                    ? "Saving..."
                    : "Save Deposit Account"}
                </button>
              </form>
            ) : (
              <div className="flex min-h-64 items-center justify-center text-center text-sm text-zinc-500">
                Select a user to assign or change their
                deposit bank account and QR.
              </div>
            )}
          </section>
        </div>
      </AppShell>
    </AdminRoute>
  );
}

function BankField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs text-zinc-400">
      <span>{label}</span>

      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100"
      />
    </label>
  );
}