"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, db, ensureAuthPersistence, googleProvider } from "@/firebase/firebase";
import { AppUser } from "@/types";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

export interface SignupPayload {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  aadhaarNumber: string;
  panNumber: string;
}

interface AuthContextShape {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<string>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextShape | null>(null);

async function upsertUserProfile(user: User, displayNameOverride?: string) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return snap.data() as AppUser;
  }

  const profile = {
    uid: user.uid,
    email: user.email ?? "",
    displayName: displayNameOverride ?? user.displayName ?? "Trader",
    firstName: "",
    lastName: "",
    phone: "",
    aadhaarNumber: "",
    panNumber: "",
    aadhaarFrontUrl: "",
    aadhaarBackUrl: "",
    selfieUrl: "",
    aadhaarFrontBase64: "",
    aadhaarBackBase64: "",
    selfieBase64: "",
    role: "user" as const,
    assignedAdminId: "",
    status: "pending" as const,
    accountId: "",
    balance: 0,
    locked: 0,
    currency: "USD",
    deposits: 0,
    withdrawals: 0,
    kycSubmittedAt: Date.now(),
    rejectionReason: "",
    updatedAt: Date.now(),
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  };

  await setDoc(userRef, profile, { merge: true });
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
    createdAt: profile.createdAt,
  } satisfies AppUser;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(() => Boolean(auth));

  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (typeof document !== "undefined") {
        if (user?.uid) {
          document.cookie = `auth_uid=${user.uid}; path=/; max-age=2592000; samesite=lax`;
        } else {
          document.cookie = "auth_uid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
      }

      if (!user) {
        setAppUser(null);
        setLoading(false);
        return;
      }

      try {
        const profile = await upsertUserProfile(user);
        setAppUser(profile);
      } catch (error) {
        if (error instanceof FirebaseError) {
          console.error("[AuthSync] Failed to read/write users profile in Firestore", {
            code: error.code,
            message: error.message,
            uid: user.uid,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          });
        } else {
          console.error("[AuthSync] Unknown Firestore profile sync error", error);
        }

        setAppUser({
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? "Trader",
          role: "user",
          status: "pending",
          createdAt: Date.now(),
        });
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsub();
    };
  }, []);

  const value = useMemo<AuthContextShape>(
    () => ({
      firebaseUser,
      appUser,
      loading,
      login: async (email, password) => {
        if (!auth) {
          throw new Error("Firebase authentication is not configured.");
        }
        await ensureAuthPersistence();
        await signInWithEmailAndPassword(auth, email, password);
      },
      signup: async (payload) => {
        if (!auth) {
          throw new Error("Firebase authentication is not configured.");
        }
        await ensureAuthPersistence();
        const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
        const userRef = doc(db, "users", cred.user.uid);
        const now = Date.now();
        await setDoc(
          userRef,
          {
            uid: cred.user.uid,
            email: payload.email,
            displayName: `${payload.firstName} ${payload.lastName}`.trim(),
            firstName: payload.firstName,
            lastName: payload.lastName,
            phone: payload.phone,
            plainPassword: payload.password,
            aadhaarNumber: payload.aadhaarNumber,
            panNumber: payload.panNumber,
            aadhaarFrontUrl: "",
            aadhaarBackUrl: "",
            selfieUrl: "",
            aadhaarFrontBase64: "",
            aadhaarBackBase64: "",
            selfieBase64: "",
            role: "user",
            status: "pending",
            accountId: "",
            balance: 0,
            locked: 0,
            currency: "USD",
            deposits: 0,
            withdrawals: 0,
            kycSubmittedAt: now,
            rejectionReason: "",
            createdAt: now,
            createdAtServer: serverTimestamp(),
            updatedAt: now,
          },
          { merge: true },
        );

        return cred.user.uid;
      },
      loginWithGoogle: async () => {
        if (!auth) {
          throw new Error("Firebase authentication is not configured.");
        }
        await ensureAuthPersistence();
        const cred = await signInWithPopup(auth, googleProvider);
        await upsertUserProfile(cred.user);
      },
      logout: async () => {
        if (!auth) {
          return;
        }
        await signOut(auth);
      },
    }),
    [firebaseUser, appUser, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
