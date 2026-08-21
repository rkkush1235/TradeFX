import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseConfig } from "@/firebase/firebase";

export const DEFAULT_SUPER_ADMIN_EMAIL = "superadmin@tradefx.com";
export const DEFAULT_SUPER_ADMIN_PASSWORD = "TradeFX@2026#Super";

export async function bootstrapSuperAdmin(input = { email: DEFAULT_SUPER_ADMIN_EMAIL, password: DEFAULT_SUPER_ADMIN_PASSWORD }) {
  const name = "tradefx-super-bootstrap";
  const app = getApps().find((item) => item.name === name) ?? initializeApp(firebaseConfig, name);
  const auth = getAuth(app);
  const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    email: input.email,
    displayName: "TradeFX Super Admin",
    firstName: "Super",
    lastName: "Admin",
    role: "super_admin",
    status: "approved",
    adminStatus: "active",
    balance: 0,
    locked: 0,
    deposits: 0,
    withdrawals: 0,
    currency: "USD",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdAtServer: serverTimestamp(),
  }, { merge: true });
  await signOut(auth).catch(() => undefined);
  return cred.user.uid;
}
