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
import {
  auth,
  db,
  ensureAuthPersistence,
  googleProvider,
} from "@/firebase/firebase";
import { AppUser } from "@/types";
import { normalizeRole } from "@/utils/roles";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

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

/**
 * Read the existing Firestore profile using Firebase Auth UID.
 *
 * Existing admin / super_admin profiles are never overwritten.
 */
async function getUserProfile(
  user: User,
): Promise<AppUser | null> {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    return null;
  }

  const raw = snap.data() as Record<string, unknown>;
  const role = normalizeRole(raw.role);
  const rawRole = String(raw.role ?? "").trim().toLowerCase();

  // Clean accidental whitespace such as "super_admin\n" without changing
  // a legitimate role value. This keeps routing and Firestore consistent.
  if (rawRole && rawRole !== String(raw.role ?? "")) {
    await setDoc(userRef, { role }, { merge: true });
  }

  return {
    ...(raw as AppUser),
    uid: user.uid,
    email: String(raw.email ?? user.email ?? ""),
    displayName: String(
      raw.displayName ?? user.displayName ?? "Trader",
    ),
    role,
    createdAt: Number(raw.createdAt ?? Date.now()),
  };
}

/**
 * Create a normal user profile only when the user
 * does not already have a Firestore profile.
 */
async function upsertUserProfile(
  user: User,
  displayNameOverride?: string,
): Promise<AppUser> {
  const existingProfile = await getUserProfile(user);

  if (existingProfile) {
    return existingProfile;
  }

  const now = Date.now();

  const profile = {
    uid: user.uid,
    email: user.email ?? "",
    displayName:
      displayNameOverride ??
      user.displayName ??
      "Trader",

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

    kycSubmittedAt: now,
    rejectionReason: "",

    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
  };

  await setDoc(
    doc(db, "users", user.uid),
    profile,
    { merge: true },
  );

  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
    status: profile.status,
    assignedAdminId: profile.assignedAdminId,
    accountId: profile.accountId,
    balance: profile.balance,
    locked: profile.locked,
    currency: profile.currency,
    deposits: profile.deposits,
    withdrawals: profile.withdrawals,
    createdAt: profile.createdAt,
  };
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebaseUser, setFirebaseUser] =
    useState<User | null>(null);

  const [appUser, setAppUser] =
    useState<AppUser | null>(null);

  const [loading, setLoading] = useState(
    () => Boolean(auth),
  );

  useEffect(() => {
    /*
     * auth is initialized by firebase.ts.
     *
     * If it is unavailable, the initial loading state
     * is already false, so we don't call setState here.
     */
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        setFirebaseUser(user);

        if (typeof document !== "undefined") {
          if (user?.uid) {
            document.cookie =
              `auth_uid=${user.uid}; path=/; max-age=2592000; samesite=lax`;
          } else {
            document.cookie =
              "auth_uid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          }
        }

        if (!user) {
          setAppUser(null);
          setLoading(false);
          return;
        }

        setLoading(true);

        try {
          /*
           * IMPORTANT:
           *
           * Firestore document is read using Firebase Auth UID.
           *
           * Existing:
           *   super_admin -> stays super_admin
           *   admin       -> stays admin
           *   user        -> stays user
           *
           * Nothing is overwritten if the document already exists.
           */
          const profile =
            await upsertUserProfile(user);

          console.log(
            "[AuthSync] Firebase user:",
            {
              uid: user.uid,
              email: user.email,
            },
          );

          console.log(
            "[AuthSync] Firestore profile:",
            {
              uid: profile.uid,
              email: profile.email,
              role: profile.role,
              status: profile.status,
              adminStatus:
                profile.adminStatus,
            },
          );

          setAppUser(profile);
        } catch (error) {
          if (error instanceof FirebaseError) {
            console.error(
              "[AuthSync] Failed to load users profile",
              {
                code: error.code,
                message: error.message,
                uid: user.uid,
                projectId:
                  process.env
                    .NEXT_PUBLIC_FIREBASE_PROJECT_ID,
              },
            );
          } else {
            console.error(
              "[AuthSync] Unknown Firestore profile error",
              error,
            );
          }

          /*
           * Do NOT silently convert Firestore errors
           * into a normal user.
           *
           * Otherwise a super_admin could incorrectly
           * become role=user and get redirected to dashboard.
           */
          setAppUser(null);
        } finally {
          setLoading(false);
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextShape>(
    () => ({
      firebaseUser,
      appUser,
      loading,

      login: async (
        email,
        password,
      ) => {
        if (!auth) {
          throw new Error(
            "Firebase authentication is not configured.",
          );
        }

        await ensureAuthPersistence();

        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
      },

      signup: async (payload) => {
        if (!auth) {
          throw new Error(
            "Firebase authentication is not configured.",
          );
        }

        await ensureAuthPersistence();

        const cred =
          await createUserWithEmailAndPassword(
            auth,
            payload.email.trim(),
            payload.password,
          );

        const userRef = doc(
          db,
          "users",
          cred.user.uid,
        );

        const now = Date.now();

        await setDoc(
          userRef,
          {
            uid: cred.user.uid,

            email: payload.email.trim(),

            displayName:
              `${payload.firstName} ${payload.lastName}`.trim(),

            firstName: payload.firstName,
            lastName: payload.lastName,

            phone: payload.phone,

            /*
             * Firebase Auth already stores the password.
             * Keeping this field here only because your
             * existing application currently uses it.
             */
            plainPassword:
              payload.password,

            aadhaarNumber:
              payload.aadhaarNumber,

            panNumber:
              payload.panNumber,

            aadhaarFrontUrl: "",
            aadhaarBackUrl: "",
            selfieUrl: "",

            aadhaarFrontBase64: "",
            aadhaarBackBase64: "",
            selfieBase64: "",

            role: "user",
            status: "pending",

            assignedAdminId: "",

            accountId: "",

            balance: 0,
            locked: 0,

            currency: "USD",

            deposits: 0,
            withdrawals: 0,

            kycSubmittedAt: now,

            rejectionReason: "",

            createdAt: now,
            updatedAt: now,

            createdAtServer:
              serverTimestamp(),
          },
          {
            merge: true,
          },
        );

        return cred.user.uid;
      },

      loginWithGoogle: async () => {
        if (!auth) {
          throw new Error(
            "Firebase authentication is not configured.",
          );
        }

        await ensureAuthPersistence();

        const cred =
          await signInWithPopup(
            auth,
            googleProvider,
          );

        const profile =
          await upsertUserProfile(
            cred.user,
          );

        setFirebaseUser(cred.user);
        setAppUser(profile);
      },

      logout: async () => {
        if (!auth) {
          return;
        }

        await signOut(auth);

        setFirebaseUser(null);
        setAppUser(null);
      },
    }),
    [
      firebaseUser,
      appUser,
      loading,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider",
    );
  }

  return context;
}