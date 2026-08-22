"use client";

import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SuperAdminRoute } from "@/components/guards/SuperAdminRoute";
import { useAuth } from "@/hooks/useAuth";
import { useSuperClients } from "@/hooks/useSuperAdmin";
import { useAllUserDepositAccounts, useSaveUserDepositAccount } from "@/hooks/useBankAccounts";
import { imageFileToCompressedBase64 } from "@/utils/imageBase64";

export default function SuperAdminBankAccountsPage() {
  const { appUser } = useAuth();
  const users = useSuperClients();
  const { data: accounts = [], isLoading } = useAllUserDepositAccounts();
  const save = useSaveUserDepositAccount();
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ bankName: "", accountHolderName: "", accountNumber: "", ifscCode: "", qrCodeBase64: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => users.filter((u) => `${u.displayName} ${u.email} ${u.accountId ?? ""}`.toLowerCase().includes(search.toLowerCase())), [users, search]);

  const select = (uid: string) => {
    setSelected(uid);
    const a = accounts.find((x) => x.userId === uid);
    setForm({ bankName: a?.bankName ?? "", accountHolderName: a?.accountHolderName ?? "", accountNumber: a?.accountNumber ?? "", ifscCode: a?.ifscCode ?? "", qrCodeBase64: a?.qrCodeBase64 ?? "" });
    setMessage("");
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMessage("QR must be an image file.");
    if (file.size > 5 * 1024 * 1024) return setMessage("QR image must be smaller than 5MB.");
    try {
      const qrCodeBase64 = await imageFileToCompressedBase64(file);
      setForm((f) => ({ ...f, qrCodeBase64 }));
      setMessage("");
    } catch {
      setMessage("Could not process QR image.");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !appUser?.uid) return setMessage("Select a user first.");
    if (Object.values(form).some((v) => !v.trim())) return setMessage("All bank details and QR are required.");
    try { await save.mutateAsync({ userId: selected, adminId: appUser.uid, ...form }); setMessage("Deposit account saved successfully."); } catch { setMessage("Could not save deposit account."); }
  };

  return (
    <SuperAdminRoute>
      <AppShell title="Deposit Accounts">
        <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <section className="glass p-3"><input className="field mb-3 w-full" placeholder="Search user" value={search} onChange={(e) => setSearch(e.target.value)} /><div className="max-h-[65vh] space-y-2 overflow-y-auto">{filtered.map((u) => <button key={u.uid} type="button" onClick={() => select(u.uid)} className={`w-full rounded-lg border p-3 text-left ${selected === u.uid ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-700"}`}><p className="truncate text-sm font-medium">{u.displayName || "Unnamed"}</p><p className="truncate text-xs text-zinc-500">{u.email}</p></button>)}{!filtered.length && <p className="p-2 text-xs text-zinc-500">No users found.</p>}</div></section>
          <section className="glass p-4">{selected ? <form onSubmit={submit} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{(["bankName", "accountHolderName", "accountNumber", "ifscCode"] as const).map((key) => <label key={key} className="space-y-1 text-xs text-zinc-400"><span>{key === "bankName" ? "Bank Name" : key === "accountHolderName" ? "Account Holder" : key === "accountNumber" ? "Account Number" : "IFSC Code"}</span><input className="field w-full" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: key === "ifscCode" ? e.target.value.toUpperCase() : e.target.value }))} /></label>)}</div><div className="rounded-xl border border-zinc-700 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Payment QR / Barcode</p><p className="text-xs text-zinc-500">Shown to this user on Deposit.</p></div><button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs text-emerald-300">Upload QR</button><input ref={fileRef} hidden type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} /></div>{form.qrCodeBase64 ? <img src={form.qrCodeBase64} alt="Deposit QR preview" className="mt-3 h-44 w-44 rounded-lg bg-white object-contain p-2" /> : <p className="mt-3 text-xs text-zinc-500">No QR assigned.</p>}</div>{message && <p className="text-sm text-zinc-300">{message}</p>}<button disabled={save.isPending || isLoading} className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50">{save.isPending ? "Saving..." : "Save Deposit Account"}</button></form> : <div className="flex min-h-64 items-center justify-center text-sm text-zinc-500">Select a user to assign or change their deposit account.</div>}</section>
        </div>
      </AppShell>
    </SuperAdminRoute>
  );
}
