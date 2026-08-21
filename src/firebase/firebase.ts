import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  type Auth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
);

if (!isFirebaseConfigured && typeof window !== "undefined") {
  console.error(
    "Firebase env configuration is incomplete. Check NEXT_PUBLIC_FIREBASE_* variables in .env.local",
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth | null =
  typeof window !== "undefined" && isFirebaseConfigured ? getAuth(app) : null;

export async function ensureAuthPersistence() {
  if (typeof window === "undefined" || !auth) return;
  await setPersistence(auth, browserLocalPersistence);
}

if (typeof window !== "undefined") {
  ensureAuthPersistence().catch(() => undefined);
}

export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
