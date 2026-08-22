"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  LucideIcon,
  Shield,
  UserPlus,
  UserRoundCog,
  Users,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { SuperAdminRoute } from "@/components/guards/SuperAdminRoute";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/utils/format";

import {
  useAssignClient,
  useDeleteAdmin,
  useDeleteClient,
  useFinancialOverview,
  useProvisionAdmin,
  useSetAdminStatus,
  useSuperAdmins,
  useSuperClients,
} from "@/hooks/useSuperAdmin";

import { useAppSettings, useSetMaintenanceMode } from "@/hooks/useAppSettings";

export default function SuperAdminPage() {
  const { appUser } = useAuth();

  const admins = useSuperAdmins();
  const clients = useSuperClients();

  const isSuper = appUser?.role === "super_admin";

  const overview = useFinancialOverview(isSuper);

  const assign = useAssignClient();
  const provision = useProvisionAdmin();
  const setStatus = useSetAdminStatus();
  const deleteClient = useDeleteClient();
  const deleteAdmin = useDeleteAdmin();

  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    password: "",
  });

  const [message, setMessage] = useState("");

  const { data: settings } = useAppSettings();
  const maintenance = useSetMaintenanceMode();

  const adminOptions = admins.filter(
    (admin) => admin.role === "admin" && admin.adminStatus !== "disabled",
  );

  const assignedCount = useMemo(
    () => clients.filter((client) => Boolean(client.assignedAdminId)).length,
    [clients],
  );

  const submitAdmin = async () => {
    if (
      !form.displayName.trim() ||
      !form.email.trim() ||
      form.password.length < 8
    ) {
      setMessage("Name, email and an 8+ character password are required.");
      return;
    }

    if (!appUser?.uid) {
      setMessage("Super Admin session not found.");
      return;
    }

    try {
      await provision.mutateAsync({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        actorId: appUser.uid,
      });

      setForm({
        displayName: "",
        email: "",
        phone: "",
        password: "",
      });

      setShowCreate(false);
      setMessage("Admin created successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not create admin.",
      );
    }
  };

  return (
    <SuperAdminRoute>
      <AppShell title="Super Admin">
        {/* Overview */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            icon={Users}
            label="Clients"
            value={String(overview.data?.totalUsers ?? clients.length)}
          />

          <Stat
            icon={ArrowDownToLine}
            label="Total Deposit"
            value={formatCurrency(overview.data?.totalDeposited ?? 0)}
          />

          <Stat
            icon={ArrowUpFromLine}
            label="Total Withdraw"
            value={formatCurrency(overview.data?.totalWithdrawn ?? 0)}
          />

          <Stat
            icon={Wallet}
            label="Net Money In"
            value={formatCurrency(
              (overview.data?.totalDeposited ?? 0) -
                (overview.data?.totalWithdrawn ?? 0),
            )}
          />
        </section>

        {/* Today's stats */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Today Deposit"
            value={formatCurrency(overview.data?.todayDeposited ?? 0)}
          />

          <Stat
            label="Today Withdraw"
            value={formatCurrency(overview.data?.todayWithdrawn ?? 0)}
          />

          <Stat
            label="Pending Deposit"
            value={formatCurrency(overview.data?.pendingDeposits ?? 0)}
          />

          <Stat
            label="Pending Withdraw"
            value={formatCurrency(overview.data?.pendingWithdrawals ?? 0)}
          />
        </section>

        {/* System Control */}
        <section className="glass p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Shield size={17} className="text-emerald-300" />

                <h3 className="font-semibold">System Control</h3>
              </div>

              <p className="mt-1 text-xs text-zinc-500">
                Maintenance mode blocks normal users while Super Admin remains
                available.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                maintenance.mutate({
                  enabled: !settings?.maintenanceMode,
                  updatedBy: appUser?.uid ?? "",
                })
              }
              disabled={maintenance.isPending || !appUser?.uid}
              className={
                settings?.maintenanceMode
                  ? "rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-zinc-950"
                  : "rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950"
              }
            >
              {maintenance.isPending
                ? "Updating..."
                : settings?.maintenanceMode
                  ? "Turn Server ON"
                  : "Turn Maintenance ON"}
            </button>
          </div>
        </section>

        {/* Admin Management */}
        <section className="glass p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Admin Management</h3>

              <p className="text-xs text-zinc-500">
                {admins.filter((admin) => admin.role === "admin").length} normal
                admins
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950"
            >
              <UserPlus size={15} />
              New Admin
            </button>
          </div>

          {showCreate && (
            <div className="mt-4 grid gap-2 rounded-xl border border-zinc-700 p-3 md:grid-cols-4">
              <input
                className="field"
                placeholder="Name"
                value={form.displayName}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    displayName: event.target.value,
                  }))
                }
              />

              <input
                className="field"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    email: event.target.value,
                  }))
                }
              />

              <input
                className="field"
                placeholder="Phone"
                value={form.phone}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    phone: event.target.value,
                  }))
                }
              />

              <input
                className="field"
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    password: event.target.value,
                  }))
                }
              />

              <button
                type="button"
                onClick={submitAdmin}
                disabled={provision.isPending}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950 md:col-span-4 disabled:opacity-50"
              >
                {provision.isPending ? "Creating..." : "Create Admin"}
              </button>
            </div>
          )}

          {message && (
            <p className="mt-3 rounded-lg border border-zinc-700 p-2 text-xs text-zinc-300">
              {message}
            </p>
          )}

          <div className="mt-4 space-y-2">
            {admins
              .filter((admin) => admin.role === "admin")
              .map((admin) => (
                <div
                  key={admin.uid}
                  className="grid gap-2 rounded-lg border border-zinc-700 p-3 md:grid-cols-[1fr_auto_auto]"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {admin.displayName || admin.email}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {admin.email} • {admin.adminStatus ?? "active"}
                    </p>
                  </div>

                  <span className="text-xs text-zinc-400">
                    {
                      clients.filter(
                        (client) => client.assignedAdminId === admin.uid,
                      ).length
                    }{" "}
                    clients
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setStatus.mutate({
                          adminId: admin.uid,
                          status:
                            admin.adminStatus === "disabled"
                              ? "active"
                              : "disabled",
                          actorId: appUser?.uid ?? "",
                        })
                      }
                      disabled={!appUser?.uid}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs"
                    >
                      {admin.adminStatus === "disabled" ? "Enable" : "Disable"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            "Disable/delete this admin? Assigned clients will remain and can be reassigned.",
                          )
                        ) {
                          deleteAdmin.mutate({
                            adminId: admin.uid,
                            actorId: appUser?.uid ?? "",
                          });
                        }
                      }}
                      disabled={!appUser?.uid}
                      className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

            {!admins.filter((admin) => admin.role === "admin").length && (
              <p className="rounded-lg border border-zinc-700 p-4 text-sm text-zinc-500">
                No normal admins created yet.
              </p>
            )}
          </div>
        </section>

        {/* Client Assignment */}
        <section className="glass p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserRoundCog size={17} className="text-emerald-300" />

            <div>
              <h3 className="font-semibold">Client Assignment</h3>

              <p className="text-xs text-zinc-500">
                {assignedCount}/{clients.length} assigned
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {clients.map((client) => (
              <div
                key={client.uid}
                className="grid gap-2 rounded-lg border border-zinc-700 p-3 md:grid-cols-[1fr_13rem_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {client.displayName ||
                      `${client.firstName ?? ""} ${
                        client.lastName ?? ""
                      }`.trim() ||
                      "Unnamed"}
                  </p>

                  <p className="truncate text-xs text-zinc-500">
                    {client.email} •{" "}
                    {client.accountId || client.uid.slice(0, 8)}
                  </p>
                </div>

                <select
                  className="field"
                  value={client.assignedAdminId ?? ""}
                  onChange={(event) =>
                    assign.mutate({
                      userId: client.uid,
                      adminId: event.target.value || null,
                      actorId: appUser?.uid ?? "",
                    })
                  }
                  disabled={!appUser?.uid}
                >
                  <option value="">Unassigned</option>

                  {adminOptions.map((admin) => (
                    <option key={admin.uid} value={admin.uid}>
                      {admin.displayName || admin.email}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Disable this client?")) {
                      deleteClient.mutate({
                        userId: client.uid,
                        actorId: appUser?.uid ?? "",
                      });
                    }
                  }}
                  disabled={!appUser?.uid}
                  className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300"
                >
                  Delete
                </button>
              </div>
            ))}

            {!clients.length && (
              <p className="rounded-lg border border-zinc-700 p-4 text-sm text-zinc-500">
                No clients found.
              </p>
            )}
          </div>
        </section>
      </AppShell>
    </SuperAdminRoute>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="glass p-3 md:p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        {Icon && <Icon size={15} />}
        {label}
      </div>

      <p className="mt-2 text-base font-semibold md:text-xl">{value}</p>
    </div>
  );
}
