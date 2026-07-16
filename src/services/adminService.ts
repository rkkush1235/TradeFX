import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { sendSystemEmail } from "@/services/notificationService";
import { ActivityLog, AppUser, DashboardAnalytics, UserStatus } from "@/types";

const usersCol = collection(db, "users");
const logsCol = collection(db, "activityLogs");

export function subscribeUsers(
  onData: (rows: AppUser[]) => void,
  onError?: (error: unknown) => void,
) {
  const q = query(usersCol, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as AppUser));
    },
    (error) => onError?.(error),
  );
}

export function subscribeUsersByStatus(
  status: UserStatus,
  onData: (rows: AppUser[]) => void,
  onError?: (error: unknown) => void,
) {
  const q = query(usersCol, where("status", "==", status));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as AppUser);
      rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      onData(rows);
    },
    (error) => onError?.(error),
  );
}

export function subscribeActivityLogs(
  onData: (rows: ActivityLog[]) => void,
  onError?: (error: unknown) => void,
) {
  const q = query(logsCol, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLog, "id">) })));
    },
    (error) => onError?.(error),
  );
}

function generateAccountId(uid: string) {
  return `AT-${uid.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-5)}`;
}

export async function updateUserStatus(input: {
  userId: string;
  adminId: string;
  status: Extract<UserStatus, "approved" | "rejected" | "suspended" | "banned">;
  reason?: string;
}) {
  const userRef = doc(usersCol, input.userId);
  const snap = await getDoc(userRef);
  const user = (snap.data() as AppUser | undefined) ?? null;
  if (!user) throw new Error("User not found");

  let accountId: string | undefined;

  if (input.status === "approved") {
    accountId = user.accountId || generateAccountId(input.userId);
    const originalPassword = user.plainPassword?.trim();

    if (!originalPassword) {
      throw new Error("Original signup password is missing. Please ask user to reset password.");
    }

    const emailResult = await sendSystemEmail({
      type: "approval",
      to: user.email,
      name: user.displayName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Trader",
      accountId,
      loginEmail: user.email,
      originalPassword,
    });

    if (!emailResult.ok) {
      console.error("[Admin] Approval email failed", {
        userId: input.userId,
        error: emailResult.error,
      });
      throw new Error(emailResult.error ?? "Approval email failed");
    }
  }

  const patch: Record<string, unknown> = {
    status: input.status,
    updatedAt: Date.now(),
  };

  if (input.status === "approved") {
    patch.accountId = accountId;
    patch.approvedAt = Date.now();
    patch.approvedBy = input.adminId;
    patch.rejectionReason = "";
    patch.aadhaarFrontBase64 = deleteField();
    patch.aadhaarBackBase64 = deleteField();
    patch.selfieBase64 = deleteField();
    patch.aadhaarFrontUrl = deleteField();
    patch.aadhaarBackUrl = deleteField();
    patch.selfieUrl = deleteField();
  }

  if (input.status === "rejected") {
    patch.rejectionReason = input.reason ?? "KYC verification failed";
  }

  await updateDoc(userRef, patch);

  await addDoc(logsCol, {
    userId: input.userId,
    action: `user_${input.status}`,
    actorId: input.adminId,
    actorRole: "admin",
    message:
      input.status === "approved"
        ? `User approved with trading account ${String(accountId ?? patch.accountId)}`
        : `User marked as ${input.status}${input.reason ? `: ${input.reason}` : ""}`,
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });

}

export async function updateUserDetails(input: {
  userId: string;
  adminId: string;
  patch: Partial<
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
}) {
  const cleanPatch = Object.fromEntries(
    Object.entries(input.patch).filter(([, value]) => value !== undefined),
  );
  if (typeof cleanPatch.locked === "number") {
    cleanPatch.locked = Math.max(0, cleanPatch.locked);
  }

  await setDoc(
    doc(usersCol, input.userId),
    {
      ...cleanPatch,
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  await addDoc(logsCol, {
    userId: input.userId,
    action: "user_details_updated",
    actorId: input.adminId,
    actorRole: "admin",
    message: "User details updated by admin",
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });
}

export function subscribeAnalytics(onData: (data: DashboardAnalytics) => void) {
  onData({
    totalUsers: 0,
    openTrades: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    marketUpdatedAt: Date.now(),
  });

  return () => {};
}
