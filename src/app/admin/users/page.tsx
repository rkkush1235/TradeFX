"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Edit3, History, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AdminRoute } from "@/components/guards/AdminRoute";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateUserDetails, useUpdateUserStatus, useUsers } from "@/hooks/useAdmin";
import { useAdjustWallet, useWithdrawals } from "@/hooks/useWalletRequests";
import { useUserDepositAccount, useSaveUserDepositAccount } from "@/hooks/useBankAccounts";
import { imageFileToCompressedBase64 } from "@/utils/imageBase64";
import { useAdminUpdateTrade, useCloseTrade, useTrades } from "@/hooks/useTrading";
import { AppUser, Trade, UserStatus, WithdrawalRequest } from "@/types";
import { cn, formatCurrency, safeNumber } from "@/utils/format";

type ToastState = { type: "success" | "error"; message: string } | null;
type KycCheckState = {
  aadhaarOk: boolean;
  imagesOk: boolean;
  overallOk: boolean;
  checkedAt: number;
};
type EditForm = {
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accountId: string;
  plainPassword: string;
  aadhaarNumber: string;
  panNumber: string;
  status: UserStatus;
  balance: string;
  locked: string;
};
type EditableUserPatch = Partial<
  Pick<
    AppUser,
    | "displayName"
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "accountId"
    | "plainPassword"
    | "aadhaarNumber"
    | "panNumber"
    | "status"
    | "balance"
    | "locked"
  >
>;
type TradeEditForm = {
  asset: string;
  type: "buy" | "sell";
  quantity: string;
  leverage: string;
  marginUsed: string;
  entryPrice: string;
  currentPrice: string;
  pnl: string;
  status: "open" | "closed";
};

const filterOptions: Array<UserStatus | "all"> = ["all", "pending", "approved", "rejected", "suspended", "banned"];
const statusOptions: UserStatus[] = ["pending", "approved", "rejected", "suspended", "banned"];

const makeEditForm = (user?: AppUser): EditForm => ({
  displayName: user?.displayName ?? "",
  firstName: user?.firstName ?? "",
  lastName: user?.lastName ?? "",
  email: user?.email ?? "",
  phone: user?.phone ?? "",
  accountId: user?.accountId ?? "",
  plainPassword: user?.plainPassword ?? "",
  aadhaarNumber: user?.aadhaarNumber ?? "",
  panNumber: user?.panNumber ?? "",
  status: user?.status ?? "pending",
  balance: String(user?.balance ?? 0),
  locked: String(user?.locked ?? 0),
});

const makeTradeEditForm = (trade: Trade): TradeEditForm => ({
  asset: trade.asset ?? "",
  type: trade.type,
  quantity: String(trade.quantity ?? 0),
  leverage: String(trade.leverage ?? 1),
  marginUsed: String(trade.marginUsed ?? 0),
  entryPrice: String(trade.entryPrice ?? 0),
  currentPrice: String(trade.currentPrice ?? 0),
  pnl: String(trade.pnl ?? 0),
  status: trade.status,
});

export default function AdminUsersPage() {
  const router = useRouter();
  const { appUser } = useAuth();
  const users = useUsers();
  const updateStatus = useUpdateUserStatus();
  const updateUserDetails = useUpdateUserDetails();
  const adjustWallet = useAdjustWallet();
  const updateTrade = useAdminUpdateTrade();
  const closeTrade = useCloseTrade();
  const saveDepositAccount = useSaveUserDepositAccount();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [kycChecks, setKycChecks] = useState<Record<string, KycCheckState>>({});

  const rows = useMemo(() => {
    return users.filter((user) => {
      if (statusFilter !== "all" && (user.status ?? "pending") !== statusFilter) return false;
      const key = `${user.displayName} ${user.email} ${user.phone ?? ""} ${user.accountId ?? ""}`.toLowerCase();
      return key.includes(search.toLowerCase());
    });
  }, [users, search, statusFilter]);

  const selectedUser = useMemo(
    () => selectedUserId ? users.find((user) => user.uid === selectedUserId) : undefined,
    [selectedUserId, users],
  );
  const withdrawals = useWithdrawals(selectedUser?.uid, Boolean(selectedUser?.uid));
  const trades = useTrades(selectedUser?.uid);

  const showToast = (nextToast: ToastState) => {
    setToast(nextToast);
    if (nextToast) setTimeout(() => setToast(null), 3200);
  };

  const runKycCheck = (user: AppUser) => {
    const aadhaarDigits = (user.aadhaarNumber ?? "").replace(/\D/g, "");
    const aadhaarOk = aadhaarDigits.length === 12;
    const hasFrontImage = Boolean(user.aadhaarFrontBase64 || user.aadhaarFrontUrl);
    const hasBackImage = Boolean(user.aadhaarBackBase64 || user.aadhaarBackUrl);
    const imagesOk = hasFrontImage && hasBackImage;
    const overallOk = aadhaarOk && imagesOk;

    setKycChecks((prev) => ({
      ...prev,
      [user.uid]: { aadhaarOk, imagesOk, overallOk, checkedAt: Date.now() },
    }));

    showToast(
      overallOk
        ? { type: "success", message: "KYC quick check passed. You can approve now." }
        : { type: "error", message: "KYC check failed. Verify Aadhaar and both images first." },
    );
  };

  return (
    <AdminRoute>
      <AppShell title="Admin Users">
        {toast ? (
          <div className="fixed right-4 top-4 z-50">
            <div
              className={cn(
                "rounded-lg border px-4 py-3 text-sm shadow-lg",
                toast.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/40 bg-red-500/10 text-red-300",
              )}
            >
              {toast.message}
            </div>
          </div>
        ) : null}

        <section className="glass p-4">
          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.8fr_0.45fr]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone, account id"
              className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as UserStatus | "all")}
              className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm"
            >
              {filterOptions.map((option) => (
                <option key={option} value={option}>{option.toUpperCase()}</option>
              ))}
            </select>
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-300">
              {rows.length} users
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className={cn("glass max-h-[62vh] overflow-auto p-3 lg:max-h-[72vh]", selectedUser ? "hidden lg:block" : "block")}>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <UserRound size={16} className="text-emerald-300" />
              Users
            </div>
            <div className="space-y-2">
              {rows.map((user) => {
                const active = selectedUser?.uid === user.uid;
                return (
                  <button
                    key={user.uid}
                    type="button"
                    onClick={() => setSelectedUserId(user.uid)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left text-sm transition",
                      active
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-zinc-700/80 bg-zinc-900/35 hover:border-zinc-500",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {user.displayName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unnamed user"}
                        </p>
                        <p className="truncate text-xs text-zinc-400">{user.email}</p>
                        <p className="mt-1 text-xs text-zinc-500">ID: {user.accountId || user.uid.slice(0, 8)}</p>
                      </div>
                      <span className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] uppercase text-zinc-300">
                        {user.status ?? "pending"}
                      </span>
                    </div>
                  </button>
                );
              })}
              {!rows.length ? <p className="rounded-lg border border-zinc-700 p-4 text-sm text-zinc-400">No users found.</p> : null}
            </div>
          </div>

          {selectedUser ? (
            <div className="min-w-0">
            <UserDetail
              key={selectedUser.uid}
              user={selectedUser}
              appUserId={appUser?.uid ?? "admin"}
              withdrawals={withdrawals}
              trades={trades}
              activeAction={activeAction}
              updatePending={updateStatus.isPending}
              detailsPending={updateUserDetails.isPending}
              walletPending={adjustWallet.isPending}
              tradePending={updateTrade.isPending || closeTrade.isPending}
              kycCheck={kycChecks[selectedUser.uid]}
              onSetActiveAction={setActiveAction}
              onToast={showToast}
              onRefresh={() => router.refresh()}
              onRunKyc={() => runKycCheck(selectedUser)}
              onDetails={(input) => updateUserDetails.mutateAsync(input)}
              onStatus={(input) => updateStatus.mutateAsync(input)}
              onWallet={(balance) => adjustWallet.mutateAsync({ userId: selectedUser.uid, balance })}
              onTrade={(input) => updateTrade.mutateAsync(input)}
              onCloseTrade={(trade) => closeTrade.mutateAsync(trade)}
              onSaveDepositAccount={(input) => saveDepositAccount.mutateAsync(input)}
              depositAccountPending={saveDepositAccount.isPending}
              onBack={() => setSelectedUserId(null)}
            />
            </div>
          ) : null}
        </section>
      </AppShell>
    </AdminRoute>
  );
}

function UserDetail({
  user,
  appUserId,
  withdrawals,
  trades,
  activeAction,
  updatePending,
  detailsPending,
  walletPending,
  tradePending,
  kycCheck,
  onSetActiveAction,
  onToast,
  onRefresh,
  onRunKyc,
  onDetails,
  onStatus,
  onWallet,
  onTrade,
  onCloseTrade,
  onSaveDepositAccount,
  depositAccountPending,
  onBack,
}: {
  user: AppUser;
  appUserId: string;
  withdrawals: WithdrawalRequest[];
  trades: Trade[];
  activeAction: string | null;
  updatePending: boolean;
  detailsPending: boolean;
  walletPending: boolean;
  tradePending: boolean;
  kycCheck?: KycCheckState;
  onSetActiveAction: (value: string | null) => void;
  onToast: (toast: ToastState) => void;
  onRefresh: () => void;
  onRunKyc: () => void;
  onDetails: (input: { userId: string; adminId: string; patch: EditableUserPatch }) => Promise<unknown>;
  onStatus: (input: { userId: string; adminId: string; status: Extract<UserStatus, "approved" | "rejected" | "suspended" | "banned">; reason?: string }) => Promise<unknown>;
  onWallet: (balance: number) => Promise<unknown>;
  onTrade: (input: { tradeId: string; patch: Partial<Pick<Trade, "asset" | "type" | "quantity" | "leverage" | "marginUsed" | "entryPrice" | "currentPrice" | "pnl" | "status" | "closedAt">> }) => Promise<unknown>;
  onCloseTrade: (trade: Trade) => Promise<unknown>;
  onSaveDepositAccount: (input: { userId: string; adminId: string; bankName: string; accountHolderName: string; accountNumber: string; ifscCode: string; qrCodeBase64: string }) => Promise<unknown>;
  depositAccountPending: boolean;
  onBack: () => void;
}) {
  const [editForm, setEditForm] = useState<EditForm>(makeEditForm(user));
  const { data: depositAccount, isLoading: depositAccountLoading } = useUserDepositAccount(user.uid);
  const saveDetails = async () => {
    onSetActiveAction(`${user.uid}-details`);
    try {
      await onDetails({
        userId: user.uid,
        adminId: appUserId,
        patch: {
          displayName: editForm.displayName.trim(),
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          accountId: editForm.accountId.trim(),
          plainPassword: editForm.plainPassword.trim(),
          aadhaarNumber: editForm.aadhaarNumber.trim(),
          panNumber: editForm.panNumber.trim().toUpperCase(),
          status: editForm.status,
          balance: Number(editForm.balance) || 0,
          locked: Math.max(0, Number(editForm.locked) || 0),
        },
      });
      onToast({ type: "success", message: "User details updated." });
    } catch (error) {
      console.error("[Admin Users] Detail update failed", error);
      onToast({ type: "error", message: "Could not update user details." });
    } finally {
      onSetActiveAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="mb-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 lg:hidden">← Back to users</button>
      <section className="glass p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Edit3 size={16} className="text-cyan-300" />
              Edit User Details
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Balance {formatCurrency(user.balance ?? 0)} • Client ID {user.accountId || "-"}
            </p>
          </div>
          <button
            type="button"
            disabled={detailsPending}
            onClick={saveDetails}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-zinc-950 disabled:opacity-60"
          >
            {activeAction === `${user.uid}-details` ? "Saving..." : "Save Details"}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Display Name" value={editForm.displayName} onChange={(value) => setEditForm((prev) => ({ ...prev, displayName: value }))} />
          <Field label="First Name" value={editForm.firstName} onChange={(value) => setEditForm((prev) => ({ ...prev, firstName: value }))} />
          <Field label="Last Name" value={editForm.lastName} onChange={(value) => setEditForm((prev) => ({ ...prev, lastName: value }))} />
          <Field label="Email" value={editForm.email} onChange={(value) => setEditForm((prev) => ({ ...prev, email: value }))} />
          <Field label="Phone" value={editForm.phone} onChange={(value) => setEditForm((prev) => ({ ...prev, phone: value }))} />
          <Field label="Client ID" value={editForm.accountId} onChange={(value) => setEditForm((prev) => ({ ...prev, accountId: value }))} />
          <Field label="Password" type="password" value={editForm.plainPassword} onChange={(value) => setEditForm((prev) => ({ ...prev, plainPassword: value }))} />
          <Field label="Aadhaar" type="password" value={editForm.aadhaarNumber} onChange={(value) => setEditForm((prev) => ({ ...prev, aadhaarNumber: value }))} />
          <Field label="PAN" value={editForm.panNumber} onChange={(value) => setEditForm((prev) => ({ ...prev, panNumber: value }))} />
          <label className="space-y-1 text-xs text-zinc-400">
            <span>Status</span>
            <select
              value={editForm.status}
              onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value as UserStatus }))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <Field label="Balance" type="number" value={editForm.balance} onChange={(value) => setEditForm((prev) => ({ ...prev, balance: value }))} />
          <Field label="Locked" type="number" value={editForm.locked} onChange={(value) => setEditForm((prev) => ({ ...prev, locked: value }))} />
        </div>
      </section>

      <DepositAccountEditor
        key={`${user.uid}-${depositAccount?.id ?? "new"}-${depositAccount?.updatedAt ?? ""}`}
        userId={user.uid}
        adminId={appUserId}
        depositAccount={depositAccount}
        loading={depositAccountLoading}
        pending={depositAccountPending}
        onSave={onSaveDepositAccount}
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <KycPanel user={user} check={kycCheck} onRun={onRunKyc} />
        <ActionPanel
          key={`${user.uid}-${user.balance ?? 0}`}
          user={user}
          appUserId={appUserId}
          activeAction={activeAction}
          updatePending={updatePending}
          walletPending={walletPending}
          kycReady={Boolean(kycCheck?.overallOk)}
          onSetActiveAction={onSetActiveAction}
          onToast={onToast}
          onRefresh={onRefresh}
          onStatus={onStatus}
          onWallet={onWallet}
        />
      </section>

      <TradeEditorPanel
        trades={trades}
        activeAction={activeAction}
        pending={tradePending}
        onSetActiveAction={onSetActiveAction}
        onToast={onToast}
        onTrade={onTrade}
        onCloseTrade={onCloseTrade}
      />

      <WithdrawalHistory rows={withdrawals} />
    </div>
  );
}

function DepositAccountEditor({
  userId,
  adminId,
  depositAccount,
  loading,
  pending,
  onSave,
}: {
  userId: string;
  adminId: string;
  depositAccount?: {
    id?: string;
    bankName?: string;
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    qrCodeBase64?: string;
    updatedAt?: number;
  };
  loading: boolean;
  pending: boolean;
  onSave: (input: {
    userId: string;
    adminId: string;
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    qrCodeBase64: string;
  }) => Promise<unknown>;
}) {
  const [form, setForm] = useState({
    bankName: depositAccount?.bankName ?? "",
    accountHolderName: depositAccount?.accountHolderName ?? "",
    accountNumber: depositAccount?.accountNumber ?? "",
    ifscCode: depositAccount?.ifscCode ?? "",
    qrCodeBase64: depositAccount?.qrCodeBase64 ?? "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleQr = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("QR / barcode must be an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("QR image must be smaller than 5MB.");
      return;
    }

    try {
      setError("");
      const qrCodeBase64 = await imageFileToCompressedBase64(file);
      setForm((prev) => ({ ...prev, qrCodeBase64 }));
    } catch (qrError) {
      console.error("[Admin Users] QR processing failed", qrError);
      setError("Could not process the QR / barcode image.");
    }
  };

  const save = async () => {
    if (!adminId) return;
    if (
      !form.bankName.trim() ||
      !form.accountHolderName.trim() ||
      !form.accountNumber.trim() ||
      !form.ifscCode.trim() ||
      !form.qrCodeBase64
    ) {
      setError("Bank details and a QR / barcode are required.");
      return;
    }

    setMessage("");
    setError("");
    try {
      await onSave({ userId, adminId, ...form });
      setMessage("Deposit bank account and QR updated successfully.");
    } catch (saveError) {
      console.error("[Admin Users] Deposit account update failed", saveError);
      setError("Could not update the deposit account. Check Firestore rules and try again.");
    }
  };

  return (
    <section className="glass p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">User Deposit Bank Account & QR</h3>
          <p className="mt-1 text-xs text-zinc-400">
            Only this user will see these payment details on the Deposit page.
          </p>
        </div>
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400">
          {depositAccount ? "Assigned" : "Not assigned"}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading deposit account...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bank Name" value={form.bankName} onChange={(value) => setForm((p) => ({ ...p, bankName: value }))} />
            <Field label="Account Holder" value={form.accountHolderName} onChange={(value) => setForm((p) => ({ ...p, accountHolderName: value }))} />
            <Field label="Account Number" value={form.accountNumber} onChange={(value) => setForm((p) => ({ ...p, accountNumber: value }))} />
            <Field label="IFSC Code" value={form.ifscCode} onChange={(value) => setForm((p) => ({ ...p, ifscCode: value.toUpperCase() }))} />

            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <label className="inline-flex cursor-pointer rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                Upload New QR / Barcode
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleQr(event.target.files?.[0])} />
              </label>
              {form.qrCodeBase64 ? (
                <button type="button" onClick={() => setForm((p) => ({ ...p, qrCodeBase64: "" }))} className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300">
                  Remove QR
                </button>
              ) : null}
            </div>

            {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 sm:col-span-2">{error}</p> : null}
            {message ? <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 sm:col-span-2">{message}</p> : null}

            <button type="button" onClick={() => void save()} disabled={pending} className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50 sm:col-span-2">
              {pending ? "Saving Deposit Account..." : "Save Bank Account & QR"}
            </button>
          </div>

          <div className="rounded-xl border border-zinc-700 bg-white/5 p-3">
            <p className="mb-2 text-xs text-zinc-400">Current QR / Barcode</p>
            {form.qrCodeBase64 ? (
              <img src={form.qrCodeBase64} alt="User deposit QR" className="mx-auto aspect-square w-full max-w-52 rounded-lg bg-white object-contain p-2" />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-zinc-700 text-center text-xs text-zinc-500">
                No QR assigned
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1 text-xs text-zinc-400">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100"
      />
    </label>
  );
}

function KycPanel({ user, check, onRun }: { user: AppUser; check?: KycCheckState; onRun: () => void }) {
  const frontImage = user.aadhaarFrontBase64 || user.aadhaarFrontUrl || "";
  const backImage = user.aadhaarBackBase64 || user.aadhaarBackUrl || "";

  return (
    <div className="glass p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={16} className="text-emerald-300" />
          KYC Quick Verify
        </div>
        <button
          type="button"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300"
          onClick={onRun}
        >
          Run Check
        </button>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <KycItem label="Aadhaar" ok={check?.aadhaarOk} value={user.aadhaarNumber || "Not provided"} />
        <KycItem label="Front Image" ok={Boolean(frontImage)} value={frontImage ? "Available" : "Missing"} href={frontImage} />
        <KycItem label="Back Image" ok={Boolean(backImage)} value={backImage ? "Available" : "Missing"} href={backImage} />
      </div>
      {check ? (
        <p className={cn("mt-3 text-xs", check.overallOk ? "text-emerald-300" : "text-red-300")}>
          {check.overallOk ? "Ready to approve" : "Verification failed"}
        </p>
      ) : null}
    </div>
  );
}

function KycItem({ label, value, ok, href }: { label: string; value: string; ok?: boolean; href?: string }) {
  return (
    <div className="rounded-lg border border-zinc-700 p-2">
      <p className="text-zinc-400">{label}</p>
      <p className={ok ? "text-emerald-300" : "text-red-300"}>{value}</p>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-[11px] text-emerald-400">
          Open Image
        </a>
      ) : null}
    </div>
  );
}

function ActionPanel({
  user,
  appUserId,
  activeAction,
  updatePending,
  walletPending,
  kycReady,
  onSetActiveAction,
  onToast,
  onRefresh,
  onStatus,
  onWallet,
}: {
  user: AppUser;
  appUserId: string;
  activeAction: string | null;
  updatePending: boolean;
  walletPending: boolean;
  kycReady: boolean;
  onSetActiveAction: (value: string | null) => void;
  onToast: (toast: ToastState) => void;
  onRefresh: () => void;
  onStatus: (input: { userId: string; adminId: string; status: Extract<UserStatus, "approved" | "rejected" | "suspended" | "banned">; reason?: string }) => Promise<unknown>;
  onWallet: (balance: number) => Promise<unknown>;
}) {
  const [walletAmount, setWalletAmount] = useState(String(user.balance ?? 0));

  const updateStatus = async (status: Extract<UserStatus, "approved" | "rejected" | "suspended" | "banned">) => {
    const key = `${user.uid}-${status}`;
    onSetActiveAction(key);
    try {
      await onStatus({
        userId: user.uid,
        adminId: appUserId,
        status,
        reason: status === "rejected" ? "KYC verification failed" : undefined,
      });
      onToast({ type: "success", message: status === "approved" ? "User approved and email sent." : `User marked ${status}.` });
      onRefresh();
    } catch (error) {
      console.error("[Admin Users] Status update failed", error);
      onToast({ type: "error", message: status === "approved" ? "Approval failed. Check password/email settings." : "Status update failed." });
    } finally {
      onSetActiveAction(null);
    }
  };

  return (
    <div className="glass p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <CheckCircle2 size={16} className="text-amber-300" />
        Admin Actions
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          disabled={updatePending || !kycReady}
          className="rounded-md bg-emerald-500 px-4 py-3 text-sm font-bold text-zinc-950 disabled:opacity-50"
          title={kycReady ? "Approve user" : "Run KYC Check first"}
          onClick={() => updateStatus("approved")}
        >
          {activeAction === `${user.uid}-approved` ? "Approving..." : "Approve"}
        </button>
        <button disabled={updatePending} className="rounded-md bg-red-500 px-4 py-3 text-sm font-bold" onClick={() => updateStatus("rejected")}>
          {activeAction === `${user.uid}-rejected` ? "Rejecting..." : "Reject"}
        </button>
        <button disabled={updatePending} className="rounded-md bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-950" onClick={() => updateStatus("suspended")}>
          {activeAction === `${user.uid}-suspended` ? "Suspending..." : "Suspend"}
        </button>
        <button disabled={updatePending} className="rounded-md bg-zinc-800 px-4 py-3 text-sm font-bold" onClick={() => updateStatus("banned")}>
          {activeAction === `${user.uid}-banned` ? "Banning..." : "Ban"}
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="space-y-1 text-xs text-zinc-400">
          <span>Wallet Balance</span>
          <input
            type="number"
            value={walletAmount}
            onChange={(event) => setWalletAmount(event.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <button
          disabled={walletPending}
          className="self-end rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold"
          onClick={async () => {
            onSetActiveAction(`${user.uid}-wallet`);
            await onWallet(Number(walletAmount) || 0).finally(() => onSetActiveAction(null));
          }}
        >
          {activeAction === `${user.uid}-wallet` ? "Updating..." : "Update Wallet"}
        </button>
      </div>
    </div>
  );
}

function TradeEditorPanel({
  trades,
  activeAction,
  pending,
  onSetActiveAction,
  onToast,
  onTrade,
  onCloseTrade,
}: {
  trades: Trade[];
  activeAction: string | null;
  pending: boolean;
  onSetActiveAction: (value: string | null) => void;
  onToast: (toast: ToastState) => void;
  onTrade: (input: { tradeId: string; patch: Partial<Pick<Trade, "asset" | "type" | "quantity" | "leverage" | "marginUsed" | "entryPrice" | "currentPrice" | "pnl" | "status" | "closedAt">> }) => Promise<unknown>;
  onCloseTrade: (trade: Trade) => Promise<unknown>;
}) {
  const openTrades = trades.filter((trade) => trade.status === "open");
  const closedTrades = trades.filter((trade) => trade.status === "closed");

  return (
    <section className="glass p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <History size={16} className="text-emerald-300" />
          Current Running Trades
        </div>
        <div className="flex gap-2 text-xs text-zinc-300">
          <span className="rounded-md border border-emerald-500/30 px-2 py-1">{openTrades.length} open</span>
          <span className="rounded-md border border-zinc-700 px-2 py-1">{closedTrades.length} closed</span>
        </div>
      </div>

      <div className="grid gap-3">
        {openTrades.map((trade) => (
          <TradeEditCard
            key={trade.id}
            trade={trade}
            activeAction={activeAction}
            pending={pending}
            onSetActiveAction={onSetActiveAction}
            onToast={onToast}
            onTrade={onTrade}
            onCloseTrade={onCloseTrade}
          />
        ))}
        {!openTrades.length ? (
          <div className="rounded-lg border border-zinc-700 p-4 text-sm text-zinc-400">
            No running trade for this user.
          </div>
        ) : null}
      </div>

      {closedTrades.length ? (
        <details className="mt-4 rounded-lg border border-zinc-700/80 p-3">
          <summary className="cursor-pointer text-sm font-medium text-zinc-300">Closed trade history</summary>
          <div className="mt-3 grid gap-2">
            {closedTrades.slice(0, 12).map((trade) => (
              <TradeSummaryCard key={trade.id} trade={trade} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function TradeEditCard({
  trade,
  activeAction,
  pending,
  onSetActiveAction,
  onToast,
  onTrade,
  onCloseTrade,
}: {
  trade: Trade;
  activeAction: string | null;
  pending: boolean;
  onSetActiveAction: (value: string | null) => void;
  onToast: (toast: ToastState) => void;
  onTrade: (input: { tradeId: string; patch: Partial<Pick<Trade, "asset" | "type" | "quantity" | "leverage" | "marginUsed" | "entryPrice" | "currentPrice" | "pnl" | "status" | "closedAt">> }) => Promise<unknown>;
  onCloseTrade: (trade: Trade) => Promise<unknown>;
}) {
  const [form, setForm] = useState<TradeEditForm>(makeTradeEditForm(trade));
  const entry = safeNumber(form.entryPrice);
  const current = safeNumber(form.currentPrice);
  const quantity = safeNumber(form.quantity);
  const previewPnl = form.type === "sell" ? (entry - current) * quantity : (current - entry) * quantity;

  const saveTrade = async () => {
    onSetActiveAction(`${trade.id}-trade`);
    try {
      await onTrade({
        tradeId: trade.id,
        patch: {
          asset: form.asset.trim().toUpperCase(),
          type: form.type,
          quantity: Number(form.quantity) || 0,
          leverage: Number(form.leverage) || 1,
          marginUsed: Number(form.marginUsed) || 0,
          entryPrice: Number(form.entryPrice) || 0,
          currentPrice: Number(form.currentPrice) || 0,
          pnl: Number(form.pnl) || 0,
          status: form.status,
        },
      });
      onToast({ type: "success", message: "Trade updated." });
    } catch (error) {
      console.error("[Admin Users] Trade update failed", error);
      onToast({ type: "error", message: "Could not update trade." });
    } finally {
      onSetActiveAction(null);
    }
  };

  const closeRunningTrade = async () => {
    onSetActiveAction(`${trade.id}-close`);
    try {
      await onCloseTrade(trade);
      onToast({ type: "success", message: "Running trade closed with wallet settlement." });
    } catch (error) {
      console.error("[Admin Users] Trade close failed", error);
      onToast({ type: "error", message: "Could not close trade. Live price may be unavailable." });
    } finally {
      onSetActiveAction(null);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-700/80 bg-zinc-900/35 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{trade.asset}</p>
          <p className="text-xs text-zinc-400">
            {trade.type.toUpperCase()} • Qty {safeNumber(trade.quantity).toFixed(4)} • PnL {formatCurrency(trade.pnl)}
          </p>
        </div>
        <span className="rounded-md border border-emerald-500/40 px-2 py-1 text-xs uppercase text-emerald-300">
          {trade.status}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Asset" value={form.asset} onChange={(value) => setForm((prev) => ({ ...prev, asset: value }))} />
        <label className="space-y-1 text-xs text-zinc-400">
          <span>Type</span>
          <select
            value={form.type}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as "buy" | "sell" }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="buy">BUY</option>
            <option value="sell">SELL</option>
          </select>
        </label>
        <Field label="Quantity" type="number" value={form.quantity} onChange={(value) => setForm((prev) => ({ ...prev, quantity: value }))} />
        <Field label="Leverage" type="number" value={form.leverage} onChange={(value) => setForm((prev) => ({ ...prev, leverage: value }))} />
        <Field label="Margin Used" type="number" value={form.marginUsed} onChange={(value) => setForm((prev) => ({ ...prev, marginUsed: value }))} />
        <Field label="Entry Price" type="number" value={form.entryPrice} onChange={(value) => setForm((prev) => ({ ...prev, entryPrice: value }))} />
        <Field label="Current Price" type="number" value={form.currentPrice} onChange={(value) => setForm((prev) => ({ ...prev, currentPrice: value }))} />
        <Field label="PNL" type="number" value={form.pnl} onChange={(value) => setForm((prev) => ({ ...prev, pnl: value }))} />
        <label className="space-y-1 text-xs text-zinc-400">
          <span>Status</span>
          <select
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "open" | "closed" }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="open">OPEN</option>
            <option value="closed">CLOSED</option>
          </select>
        </label>
        <div className="rounded-lg border border-zinc-700 bg-zinc-950/40 p-2 text-xs">
          <p className="text-zinc-400">Preview PnL</p>
          <p className={previewPnl >= 0 ? "text-emerald-300" : "text-red-300"}>{formatCurrency(previewPnl)}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr]">
        <button
          type="button"
          disabled={pending}
          onClick={saveTrade}
          className="rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-zinc-950 disabled:opacity-60"
        >
          {activeAction === `${trade.id}-trade` ? "Saving Trade..." : "Save Trade Changes"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={closeRunningTrade}
          className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
        >
          {activeAction === `${trade.id}-close` ? "Closing..." : "Close With Wallet Settlement"}
        </button>
      </div>
    </div>
  );
}

function TradeSummaryCard({ trade }: { trade: Trade }) {
  return (
    <div className="grid gap-2 rounded-lg border border-zinc-800 p-3 text-sm sm:grid-cols-[1fr_auto]">
      <div>
        <p className="font-medium">{trade.asset} • {trade.type.toUpperCase()}</p>
        <p className="text-xs text-zinc-400">
          Qty {safeNumber(trade.quantity).toFixed(4)} • Entry {formatCurrency(trade.entryPrice)} • Close {formatCurrency(trade.currentPrice)}
        </p>
      </div>
      <span className={cn("text-xs", safeNumber(trade.pnl) >= 0 ? "text-emerald-300" : "text-red-300")}>
        {formatCurrency(trade.pnl)}
      </span>
    </div>
  );
}

function WithdrawalHistory({ rows }: { rows: WithdrawalRequest[] }) {
  return (
    <section className="glass p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <History size={16} className="text-cyan-300" />
          Withdrawal History
        </div>
        <span className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300">{rows.length} requests</span>
      </div>
      <div className="space-y-2">
        {rows.map((item) => (
          <div key={item.id} className="grid gap-2 rounded-lg border border-zinc-700/80 p-3 text-sm md:grid-cols-[1fr_auto]">
            <div>
              <p className="font-medium">{formatCurrency(item.amount)}</p>
              <p className="text-xs text-zinc-400">
                UPI {item.upiId || "-"} • A/C {item.accountNumber || "-"} • IFSC {item.ifscCode || "-"}
              </p>
              <p className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
            <span
              className={cn(
                "h-fit rounded-md border px-2 py-1 text-xs uppercase",
                item.status === "approved"
                  ? "border-emerald-500/40 text-emerald-300"
                  : item.status === "rejected"
                    ? "border-red-500/40 text-red-300"
                    : "border-amber-500/40 text-amber-300",
              )}
            >
              {item.status}
            </span>
          </div>
        ))}
        {!rows.length ? (
          <div className="rounded-lg border border-zinc-700 p-4 text-sm text-zinc-400">
            No withdrawal request found for this user.
          </div>
        ) : null}
      </div>
    </section>
  );
}
