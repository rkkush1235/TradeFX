"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SuperAdminRoute } from "@/components/guards/SuperAdminRoute";
import { useAuth } from "@/hooks/useAuth";
import { useDeleteAdmin, useProvisionAdmin, useSetAdminStatus, useSuperAdmins, useSuperClients } from "@/hooks/useSuperAdmin";

export default function SuperAdminAdminsPage() {
  const { appUser } = useAuth();
  const admins = useSuperAdmins().filter((u) => u.role === "admin");
  const clients = useSuperClients();
  const create = useProvisionAdmin();
  const setStatus = useSetAdminStatus();
  const remove = useDeleteAdmin();
  const [form, setForm] = useState({ displayName: "", email: "", phone: "", password: "" });
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!appUser?.uid) return setMessage("Super Admin session not found.");
    if (!form.displayName.trim() || !form.email.trim() || form.password.length < 8) {
      return setMessage("Name, email and an 8+ character password are required.");
    }
    try {
      await create.mutateAsync({ ...form, displayName: form.displayName.trim(), email: form.email.trim(), phone: form.phone.trim(), actorId: appUser.uid });
      setForm({ displayName: "", email: "", phone: "", password: "" });
      setMessage("Admin created successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create admin.");
    }
  };

  return (
    <SuperAdminRoute>
      <AppShell title="Admins">
        <section className="glass p-4">
          <h2 className="text-lg font-semibold">Create Admin</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <input className="field" placeholder="Name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            <input className="field" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="field" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="field" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" onClick={submit} disabled={create.isPending} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-zinc-950 md:col-span-4 disabled:opacity-50">{create.isPending ? "Creating..." : "Create Admin"}</button>
          </div>
          {message && <p className="mt-3 text-sm text-zinc-300">{message}</p>}
        </section>

        <section className="glass p-4">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Admin Accounts</h2><span className="text-xs text-zinc-500">{admins.length} admins</span></div>
          <div className="space-y-2">
            {admins.map((admin) => {
              const count = clients.filter((u) => u.assignedAdminId === admin.uid).length;
              const disabled = admin.adminStatus === "disabled";
              return <div key={admin.uid} className="grid gap-3 rounded-xl border border-zinc-700 p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div><p className="font-medium">{admin.displayName || "Unnamed admin"}</p><p className="text-xs text-zinc-500">{admin.email} • {disabled ? "disabled" : "active"} • {count} assigned users</p></div>
                <button type="button" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ adminId: admin.uid, status: disabled ? "active" : "disabled", actorId: appUser?.uid ?? "" })} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs">{disabled ? "Enable" : "Disable"}</button>
                <button type="button" disabled={remove.isPending} onClick={() => { if (confirm("Delete this admin?")) remove.mutate({ adminId: admin.uid, actorId: appUser?.uid ?? "" }); }} className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300">Delete</button>
              </div>;
            })}
            {!admins.length && <p className="text-sm text-zinc-500">No admins created yet.</p>}
          </div>
        </section>
      </AppShell>
    </SuperAdminRoute>
  );
}
