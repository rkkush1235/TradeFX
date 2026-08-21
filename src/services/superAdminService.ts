import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";
import { firebaseConfig, db } from "@/firebase/firebase";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { AppUser, DepositRequest, WithdrawalRequest } from "@/types";
import { createAdminProfile, subscribeAdmins } from "@/services/adminService";

function provisioningAuth() {
  const name = "tradefx-admin-provisioning";
  const existing = getApps().find((app) => app.name === name);
  const app = existing ?? initializeApp(firebaseConfig, name);
  return getAuth(app);
}

export async function provisionAdmin(input: { email: string; password: string; displayName: string; phone?: string; actorId: string }) {
  const auth = provisioningAuth();
  const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  try {
    await createAdminProfile({ uid: cred.user.uid, email: input.email.trim(), displayName: input.displayName.trim(), phone: input.phone, actorId: input.actorId });
  } catch (error) {
    await cred.user.delete().catch(() => undefined);
    throw error;
  } finally {
    await signOut(auth).catch(() => undefined);
  }
  return cred.user.uid;
}

export async function getFinancialOverview() {
  const [depositSnap, withdrawalSnap, usersSnap] = await Promise.all([
    getDocs(query(collection(db, "deposits"), orderBy("createdAt", "desc"))),
    getDocs(query(collection(db, "withdrawals"), orderBy("createdAt", "desc"))),
    getDocs(query(collection(db, "users"), where("role", "==", "user"))),
  ]);
  const deposits = depositSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DepositRequest, "id">) }));
  const withdrawals = withdrawalSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WithdrawalRequest, "id">) }));
  const approvedDeposits = deposits.filter((x) => x.status === "approved");
  const approvedWithdrawals = withdrawals.filter((x) => x.status === "approved");
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0); const start = dayStart.getTime();
  const total = (rows: Array<{ amount: number }>) => rows.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  return {
    totalUsers: usersSnap.size,
    totalDeposited: total(approvedDeposits),
    totalWithdrawn: total(approvedWithdrawals),
    todayDeposited: total(approvedDeposits.filter((x) => x.createdAt >= start)),
    todayWithdrawn: total(approvedWithdrawals.filter((x) => x.createdAt >= start)),
    pendingDeposits: deposits.filter((x) => x.status === "pending").reduce((s, x) => s + Number(x.amount || 0), 0),
    pendingWithdrawals: withdrawals.filter((x) => x.status === "pending").reduce((s, x) => s + Number(x.amount || 0), 0),
  };
}

export { subscribeAdmins };
