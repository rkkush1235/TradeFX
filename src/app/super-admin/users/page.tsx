"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SuperAdminRoute } from "@/components/guards/SuperAdminRoute";
import { useAuth } from "@/hooks/useAuth";
import { useAssignClient, useDeleteClient, useSuperAdmins, useSuperClients } from "@/hooks/useSuperAdmin";

export default function SuperAdminUsersPage() {
  const { appUser } = useAuth();
  const users = useSuperClients();
  const admins = useSuperAdmins().filter((u) => u.role === "admin" && u.adminStatus !== "disabled");
  const assign = useAssignClient();
  const remove = useDeleteClient();
  const rows = useMemo(() => [...users].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)), [users]);

  return (
    <SuperAdminRoute>
      <AppShell title="Users">
        <section className="glass p-4">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold">All Users</h2><p className="text-xs text-zinc-500">Assign each client to exactly one active admin.</p></div><span className="text-xs text-zinc-500">{rows.length} users</span></div>
          <div className="space-y-2">
            {rows.map((user) => <div key={user.uid} className="grid gap-3 rounded-xl border border-zinc-700 p-3 md:grid-cols-[1fr_16rem_auto] md:items-center">
              <div className="min-w-0"><p className="truncate font-medium">{user.displayName || "Unnamed user"}</p><p className="truncate text-xs text-zinc-500">{user.email} • {user.status ?? "pending"} • {user.accountId || user.uid.slice(0, 8)}</p></div>
              <select className="field" value={user.assignedAdminId ?? ""} disabled={assign.isPending} onChange={(e) => assign.mutate({ userId: user.uid, adminId: e.target.value || null, actorId: appUser?.uid ?? "" })}><option value="">Unassigned</option>{admins.map((admin) => <option key={admin.uid} value={admin.uid}>{admin.displayName || admin.email}</option>)}</select>
              <button type="button" disabled={remove.isPending} onClick={() => { if (confirm("Disable this user?")) remove.mutate({ userId: user.uid, actorId: appUser?.uid ?? "" }); }} className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300">Disable</button>
            </div>)}
            {!rows.length && <p className="text-sm text-zinc-500">No users found.</p>}
          </div>
        </section>
      </AppShell>
    </SuperAdminRoute>
  );
}
