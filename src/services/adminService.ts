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
import { ActivityLog, AppUser, DashboardAnalytics, UserStatus } from "@/types";
import { normalizeRole } from "@/utils/roles";

const usersCol = collection(db, "users");
const logsCol = collection(db, "activityLogs");

export function subscribeUsers(
  onData: (rows: AppUser[]) => void,
  onError?: (error: unknown) => void,
  assignedAdminId?: string,
) {
  const q = assignedAdminId
    ? query(usersCol, where("assignedAdminId", "==", assignedAdminId))
    : query(usersCol, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => {
      const row = { ...d.data(), uid: d.id } as AppUser;
      return { ...row, role: normalizeRole(row.role) };
    }).filter((u) => u.role === "user" && !u.deleted));
    },
    (error) => onError?.(error),
  );
}

export function subscribeUsersByStatus(
  status: UserStatus,
  onData: (rows: AppUser[]) => void,
  onError?: (error: unknown) => void,
  assignedAdminId?: string,
) {
  // Keep the query simple to avoid requiring a composite Firestore index.
  // Admin scoping is applied again in the snapshot filter below.
  const q = query(usersCol, where("status", "==", status));

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const row = { ...d.data(), uid: d.id } as AppUser;
        return { ...row, role: normalizeRole(row.role) };
      }).filter((u) => u.role === "user" && !u.deleted && (!assignedAdminId || u.assignedAdminId === assignedAdminId));

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
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ActivityLog, "id">),
        })),
      );
    },
    (error) => onError?.(error),
  );
}

function generateAccountId(uid: string) {
  return `AT-${uid.slice(0, 6).toUpperCase()}-${Date.now()
    .toString()
    .slice(-5)}`;
}

export async function updateUserStatus(input: {
  userId: string;
  adminId: string;
  status: Extract<
    UserStatus,
    "approved" | "rejected" | "suspended" | "banned"
  >;
  reason?: string;
}) {
  const userRef = doc(usersCol, input.userId);

  const snap = await getDoc(userRef);

  const user = (snap.data() as AppUser | undefined) ?? null;

  if (!user) {
    throw new Error("User not found");
  }

  let accountId: string | undefined;

  // Generate account ID when user is approved.
  // No email is sent here.
  if (input.status === "approved") {
    accountId = user.accountId || generateAccountId(input.userId);
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

    // Remove KYC documents after approval
    patch.aadhaarFrontBase64 = deleteField();
    patch.aadhaarBackBase64 = deleteField();
    patch.selfieBase64 = deleteField();

    patch.aadhaarFrontUrl = deleteField();
    patch.aadhaarBackUrl = deleteField();
    patch.selfieUrl = deleteField();
  }

  if (input.status === "rejected") {
    patch.rejectionReason =
      input.reason ?? "KYC verification failed";
  }

  // Update user status in Firestore
  await updateDoc(userRef, patch);

  // Create activity log
  await addDoc(logsCol, {
    userId: input.userId,
    action: `user_${input.status}`,
    actorId: input.adminId,
    actorRole: "admin",
    message:
      input.status === "approved"
        ? `User approved with trading account ${String(
            accountId ?? patch.accountId,
          )}`
        : `User marked as ${input.status}${
            input.reason ? `: ${input.reason}` : ""
          }`,
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
    Object.entries(input.patch).filter(
      ([, value]) => value !== undefined,
    ),
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

export function subscribeAnalytics(
  onData: (data: DashboardAnalytics) => void,
) {
  onData({
    totalUsers: 0,
    openTrades: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    marketUpdatedAt: Date.now(),
  });

  return () => {};
}

export function subscribeAdmins(onData: (rows: AppUser[]) => void, onError?: (error: unknown) => void) {
  const q = query(usersCol, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs
      .map((d) => {
        const row = { ...d.data(), uid: d.id } as AppUser;
        return { ...row, role: normalizeRole(row.role) };
      })
      .filter((u) => (u.role === "admin" || u.role === "super_admin") && !u.deleted);
    onData(rows);
  }, (error) => onError?.(error));
}

export async function assignClientToAdmin(input: { userId: string; adminId: string | null; actorId: string }) {
  const adminRef = input.adminId ? doc(usersCol, input.adminId) : null;
  if (adminRef) {
    const snap = await getDoc(adminRef);
    const admin = snap.data() as AppUser | undefined;
    if (!admin || !["admin", "super_admin"].includes(normalizeRole(admin.role))) throw new Error("Admin not found");
  }
  await setDoc(doc(usersCol, input.userId), { assignedAdminId: input.adminId ?? "", updatedAt: Date.now() }, { merge: true });
  await addDoc(logsCol, { userId: input.userId, action: "client_assigned", actorId: input.actorId, actorRole: "super_admin", message: input.adminId ? `Client assigned to admin ${input.adminId}` : "Client unassigned", createdAt: Date.now(), createdAtServer: serverTimestamp() });
}

export async function setAdminStatus(input: { adminId: string; status: "active" | "disabled"; actorId: string }) {
  const ref = doc(usersCol, input.adminId);
  const snap = await getDoc(ref);
  const admin = snap.data() as AppUser | undefined;
  if (!admin || normalizeRole(admin.role) !== "admin") throw new Error("Only normal admins can be disabled from this action");
  await updateDoc(ref, { adminStatus: input.status, updatedAt: Date.now() });
  await addDoc(logsCol, { userId: input.adminId, action: `admin_${input.status}`, actorId: input.actorId, actorRole: "super_admin", message: `Admin ${input.status}`, createdAt: Date.now(), createdAtServer: serverTimestamp() });
}

export async function deleteClient(input: { userId: string; actorId: string }) {
  await updateDoc(doc(usersCol, input.userId), { deleted: true, status: "banned", updatedAt: Date.now() });
  await addDoc(logsCol, { userId: input.userId, action: "client_deleted", actorId: input.actorId, actorRole: "super_admin", message: "Client disabled/deleted by super admin", createdAt: Date.now(), createdAtServer: serverTimestamp() });
}

export async function createAdminProfile(input: { uid: string; email: string; displayName: string; phone?: string; actorId: string }) {
  await setDoc(doc(usersCol, input.uid), {
    uid: input.uid, email: input.email, displayName: input.displayName, phone: input.phone ?? "", role: "admin", status: "approved", adminStatus: "active", assignedAdminId: "", balance: 0, locked: 0, deposits: 0, withdrawals: 0, currency: "USD", createdAt: Date.now(), updatedAt: Date.now(), createdAtServer: serverTimestamp(),
  }, { merge: true });
  await addDoc(logsCol, { userId: input.uid, action: "admin_created", actorId: input.actorId, actorRole: "super_admin", message: `Admin ${input.email} created`, createdAt: Date.now(), createdAtServer: serverTimestamp() });
}

export function subscribeAssignedUsers(adminId: string, onData: (rows: AppUser[]) => void, onError?: (error: unknown) => void) {
  const q = query(usersCol, where("assignedAdminId", "==", adminId));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => {
      const row = { ...d.data(), uid: d.id } as AppUser;
      return { ...row, role: normalizeRole(row.role) };
    }).filter((u) => u.role === "user" && !u.deleted);
    rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    onData(rows);
  }, (error) => onError?.(error));
}


export async function deleteAdmin(input: { adminId: string; actorId: string }) {
  const ref = doc(usersCol, input.adminId);
  const snap = await getDoc(ref);
  const admin = snap.data() as AppUser | undefined;
  if (!admin || normalizeRole(admin.role) !== "admin") throw new Error("Admin not found");
  await updateDoc(ref, { deleted: true, adminStatus: "disabled", updatedAt: Date.now() });
  await addDoc(logsCol, { userId: input.adminId, action: "admin_deleted", actorId: input.actorId, actorRole: "super_admin", message: "Admin disabled/deleted by super admin", createdAt: Date.now(), createdAtServer: serverTimestamp() });
}
