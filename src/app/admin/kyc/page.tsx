"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminRoute } from "@/components/guards/AdminRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateUserStatus, useUsers } from "@/hooks/useAdmin";
import { UserStatus } from "@/types";

type ToastState = { type: "success" | "error"; message: string } | null;
type PreviewImage = { src: string; title: string } | null;

export default function AdminKycPage() {
  const router = useRouter();
  const { appUser } = useAuth();
  const users = useUsers();
  const updateStatus = useUpdateUserStatus();
  const [activeUid, setActiveUid] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("pending");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [previewImage, setPreviewImage] = useState<PreviewImage>(null);

  const filteredUsers = useMemo(() => {
    if (statusFilter === "all") return users;
    return users.filter((user) => (user.status ?? "pending") === statusFilter);
  }, [users, statusFilter]);

  const activeUser = useMemo(() => {
    return filteredUsers.find((user) => user.uid === activeUid) ?? filteredUsers[0];
  }, [filteredUsers, activeUid]);

  const aadhaarFrontSrc = activeUser?.aadhaarFrontBase64 || activeUser?.aadhaarFrontUrl || "";
  const aadhaarBackSrc = activeUser?.aadhaarBackBase64 || activeUser?.aadhaarBackUrl || "";
  const selfieSrc = activeUser?.selfieBase64 || activeUser?.selfieUrl || "";

  return (
    <AdminRoute>
      <AppShell title="KYC Verification">
        {toast ? (
          <div className="fixed right-4 top-4 z-50">
            <div
              className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
                toast.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/40 bg-red-500/10 text-red-300"
              }`}
            >
              {toast.message}
            </div>
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="glass space-y-2 p-4">
            <h3 className="text-sm font-medium">User KYC Documents ({filteredUsers.length})</h3>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as UserStatus | "all")}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm"
            >
              <option value="all">ALL</option>
              <option value="pending">PENDING</option>
              <option value="approved">APPROVED</option>
              <option value="rejected">REJECTED</option>
              <option value="suspended">SUSPENDED</option>
              <option value="banned">BANNED</option>
            </select>
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <button
                  key={user.uid}
                  type="button"
                  onClick={() => setActiveUid(user.uid)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    activeUser?.uid === user.uid
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-zinc-700 bg-zinc-900/50"
                  }`}
                >
                  <p className="font-medium">{user.displayName}</p>
                  <p className="text-xs text-zinc-400">{user.email}</p>
                  <p className="text-xs text-zinc-500">{(user.status ?? "pending").toUpperCase()}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="glass space-y-3 p-4">
            {activeUser ? (
              <>
                <div>
                  <h3 className="text-sm font-medium">{activeUser.displayName}</h3>
                  <p className="text-xs text-zinc-400">{activeUser.email} • {activeUser.phone}</p>
                  <p className="text-xs text-zinc-400">Aadhaar: {activeUser.aadhaarNumber || "-"} • PAN: {activeUser.panNumber || "-"}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-zinc-700 p-2">
                    <p className="mb-2 text-xs text-zinc-400">Aadhaar Front</p>
                    {aadhaarFrontSrc ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ src: aadhaarFrontSrc, title: "Aadhaar Front" })}
                          className="w-full"
                        >
                          <img src={aadhaarFrontSrc} alt="Aadhaar front" className="h-48 w-full rounded object-cover" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ src: aadhaarFrontSrc, title: "Aadhaar Front" })}
                          className="mt-2 rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200"
                        >
                          View Full Image
                        </button>
                      </>
                    ) : (
                      <p className="text-xs">Not uploaded</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-zinc-700 p-2">
                    <p className="mb-2 text-xs text-zinc-400">Aadhaar Back</p>
                    {aadhaarBackSrc ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ src: aadhaarBackSrc, title: "Aadhaar Back" })}
                          className="w-full"
                        >
                          <img src={aadhaarBackSrc} alt="Aadhaar back" className="h-48 w-full rounded object-cover" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ src: aadhaarBackSrc, title: "Aadhaar Back" })}
                          className="mt-2 rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200"
                        >
                          View Full Image
                        </button>
                      </>
                    ) : (
                      <p className="text-xs">Not uploaded</p>
                    )}
                  </div>
                </div>

                {selfieSrc ? (
                  <div className="block rounded-lg border border-zinc-700 p-2">
                    <p className="mb-2 text-xs text-zinc-400">Selfie</p>
                    <button
                      type="button"
                      onClick={() => setPreviewImage({ src: selfieSrc, title: "Selfie" })}
                      className="w-full"
                    >
                      <img src={selfieSrc} alt="Selfie" className="h-56 w-full rounded object-cover" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewImage({ src: selfieSrc, title: "Selfie" })}
                      className="mt-2 rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200"
                    >
                      View Full Image
                    </button>
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <button
                    disabled={updateStatus.isPending || activeAction === `${activeUser.uid}-approved`}
                    className="rounded-md bg-emerald-500 px-5 py-3 text-base font-bold text-zinc-900"
                    onClick={async () => {
                      const key = `${activeUser.uid}-approved`;
                      setActiveAction(key);
                      setToast(null);

                      try {
                        await updateStatus.mutateAsync({
                          userId: activeUser.uid,
                          adminId: appUser?.uid ?? "admin",
                          status: "approved",
                        });

                        setToast({ type: "success", message: "User approved and email sent successfully." });
                        router.refresh();
                      } catch (error) {
                        console.error("[Admin KYC] Approval failed", error);
                        setToast({ type: "error", message: "Approval email failed. User remains pending." });
                      } finally {
                        setActiveAction(null);
                        setTimeout(() => setToast(null), 3500);
                      }
                    }}
                  >
                    {activeAction === `${activeUser.uid}-approved` ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
                        Sending approval email...
                      </span>
                    ) : (
                      "Approve User"
                    )}
                  </button>
                  <button
                    disabled={updateStatus.isPending}
                    className="rounded-md bg-red-500 px-5 py-3 text-base font-bold"
                    onClick={async () => {
                      const key = `${activeUser.uid}-rejected`;
                      setActiveAction(key);
                      await updateStatus.mutateAsync({
                        userId: activeUser.uid,
                        adminId: appUser?.uid ?? "admin",
                        status: "rejected",
                        reason: "KYC document verification failed",
                      }).finally(() => setActiveAction(null));
                    }}
                  >
                    {activeAction === `${activeUser.uid}-rejected` ? "Rejecting..." : "Reject User"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-400">No users found for selected filter.</p>
            )}
          </div>
        </section>

        {previewImage ? (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="glass w-full max-w-5xl rounded-xl border border-zinc-700 p-3"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">{previewImage.title}</p>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200"
                >
                  Close
                </button>
              </div>
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="max-h-[80vh] w-full rounded-lg object-contain"
              />
            </div>
          </div>
        ) : null}
      </AppShell>
    </AdminRoute>
  );
}
