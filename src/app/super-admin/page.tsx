"use client";

import { useMemo, useState } from "react";
import { Shield, Users, Wallet, ArrowDownToLine, ArrowUpFromLine, UserPlus, UserRoundCog, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/utils/format";
import { useAssignClient, useDeleteAdmin, useDeleteClient, useFinancialOverview, useProvisionAdmin, useSetAdminStatus, useSuperAdmins, useSuperClients } from "@/hooks/useSuperAdmin";
import { useAppSettings, useSetMaintenanceMode } from "@/hooks/useAppSettings";

export default function SuperAdminPage() {
  const { appUser } = useAuth();
  const isSuper = appUser?.role === "super_admin";
  const admins = useSuperAdmins();
  const clients = useSuperClients();
  const overview = useFinancialOverview(isSuper);
  const assign = useAssignClient();
  const provision = useProvisionAdmin();
  const setStatus = useSetAdminStatus();
  const deleteClient = useDeleteClient();
  const deleteAdmin = useDeleteAdmin();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ displayName: "", email: "", phone: "", password: "" });
  const [message, setMessage] = useState("");
  const { data: settings } = useAppSettings();
  const maintenance = useSetMaintenanceMode();

  const adminOptions = admins.filter((a) => a.role === "admin" && a.adminStatus !== "disabled");
  const assignedCount = useMemo(() => clients.filter((c) => c.assignedAdminId).length, [clients]);
  if (!isSuper) return <AppShell title="Super Admin"><div className="glass p-6 text-sm text-zinc-400">Super Admin access required.</div></AppShell>;

  const submitAdmin = async () => {
    if (!form.displayName || !form.email || form.password.length < 8) return setMessage("Name, email and an 8+ character password are required.");
    try {
      await provision.mutateAsync({ ...form, actorId: appUser.uid });
      setForm({ displayName: "", email: "", phone: "", password: "" }); setShowCreate(false); setMessage("Admin created successfully.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not create admin."); }
  };

  return (
    <AppShell title="Super Admin">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Users} label="Clients" value={String(overview.data?.totalUsers ?? clients.length)} />
        <Stat icon={ArrowDownToLine} label="Total Deposit" value={formatCurrency(overview.data?.totalDeposited ?? 0)} />
        <Stat icon={ArrowUpFromLine} label="Total Withdraw" value={formatCurrency(overview.data?.totalWithdrawn ?? 0)} />
        <Stat icon={Wallet} label="Net Money In" value={formatCurrency((overview.data?.totalDeposited ?? 0) - (overview.data?.totalWithdrawn ?? 0))} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Today Deposit" value={formatCurrency(overview.data?.todayDeposited ?? 0)} />
        <Stat label="Today Withdraw" value={formatCurrency(overview.data?.todayWithdrawn ?? 0)} />
        <Stat label="Pending Deposit" value={formatCurrency(overview.data?.pendingDeposits ?? 0)} />
        <Stat label="Pending Withdraw" value={formatCurrency(overview.data?.pendingWithdrawals ?? 0)} />
      </section>

      <section className="glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">System Control</h3><p className="text-xs text-zinc-500">Maintenance mode blocks normal users while Super Admin remains available.</p></div><button onClick={() => maintenance.mutate({ enabled: !settings?.maintenanceMode, updatedBy: appUser.uid })} disabled={maintenance.isPending} className={settings?.maintenanceMode ? "rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-zinc-950" : "rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950"}>{maintenance.isPending ? "Updating..." : settings?.maintenanceMode ? "Turn Server ON" : "Turn Maintenance ON"}</button></div>
      </section>

      <section className="glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Admin Management</h3><p className="text-xs text-zinc-500">{admins.filter(a => a.role === "admin").length} normal admins</p></div><button onClick={() => setShowCreate(v => !v)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950"><UserPlus size={15}/> New Admin</button></div>
        {showCreate && <div className="mt-4 grid gap-2 rounded-xl border border-zinc-700 p-3 md:grid-cols-4"><input className="field" placeholder="Name" value={form.displayName} onChange={e => setForm({...form, displayName:e.target.value})}/><input className="field" placeholder="Email" value={form.email} onChange={e => setForm({...form, email:e.target.value})}/><input className="field" placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})}/><input className="field" type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password:e.target.value})}/><button onClick={submitAdmin} disabled={provision.isPending} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950 md:col-span-4">{provision.isPending ? "Creating..." : "Create Admin"}</button></div>}
        {message && <p className="mt-3 rounded-lg border border-zinc-700 p-2 text-xs text-zinc-300">{message}</p>}
        <div className="mt-4 space-y-2">{admins.filter(a => a.role === "admin").map(admin => <div key={admin.uid} className="grid gap-2 rounded-lg border border-zinc-700 p-3 md:grid-cols-[1fr_auto_auto]"><div><p className="text-sm font-medium">{admin.displayName || admin.email}</p><p className="text-xs text-zinc-500">{admin.email} • {admin.adminStatus ?? "active"}</p></div><span className="text-xs text-zinc-400">{clients.filter(c => c.assignedAdminId === admin.uid).length} clients</span><div className="flex gap-2"><button onClick={() => setStatus.mutate({adminId: admin.uid, status: admin.adminStatus === "disabled" ? "active" : "disabled", actorId: appUser.uid})} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs">{admin.adminStatus === "disabled" ? "Enable" : "Disable"}</button><button onClick={() => { if (confirm("Disable/delete this admin? Assigned clients will remain and can be reassigned.")) deleteAdmin.mutate({ adminId: admin.uid, actorId: appUser.uid }); }} className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300">Delete</button></div></div>)}</div>
      </section>

      <section className="glass p-4">
        <div className="mb-3 flex items-center gap-2"><UserRoundCog size={17} className="text-emerald-300"/><div><h3 className="font-semibold">Client Assignment</h3><p className="text-xs text-zinc-500">{assignedCount}/{clients.length} assigned</p></div></div>
        <div className="space-y-2">{clients.map(client => <div key={client.uid} className="grid gap-2 rounded-lg border border-zinc-700 p-3 md:grid-cols-[1fr_13rem_auto]"><div className="min-w-0"><p className="truncate text-sm font-medium">{client.displayName || `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Unnamed"}</p><p className="truncate text-xs text-zinc-500">{client.email} • {client.accountId || client.uid.slice(0,8)}</p></div><select className="field" value={client.assignedAdminId ?? ""} onChange={e => assign.mutate({userId: client.uid, adminId: e.target.value || null, actorId: appUser.uid})}><option value="">Unassigned</option>{adminOptions.map(a => <option key={a.uid} value={a.uid}>{a.displayName || a.email}</option>)}</select><button onClick={() => { if(confirm("Disable this client?")) deleteClient.mutate({userId:client.uid, actorId:appUser.uid}); }} className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300">Delete</button></div>)}</div>
      </section>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon?: LucideIcon; label: string; value: string }) { return <div className="glass p-3 md:p-4"><div className="flex items-center gap-2 text-xs text-zinc-400">{Icon && <Icon size={15}/>} {label}</div><p className="mt-2 text-base font-semibold md:text-xl">{value}</p></div>; }
