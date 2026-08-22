"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { FirebaseError } from "firebase/app";
import { auth, db, isFirebaseConfigured } from "@/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email"),

  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

function normalizeRole(
  value: unknown,
): "user" | "admin" | "super_admin" {
  const role = String(value ?? "")
    .trim()
    .toLowerCase();
    console.log("[normalizeRole] role:", role);

  if (role === "super_admin") {
    return "super_admin";
  }

  if (role === "admin") {
    return "admin";
  }

  return "user";
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();

  const [authError, setAuthError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handlePostLoginRoute = async () => {
    const uid = auth?.currentUser?.uid;

    if (!uid) {
      router.replace("/login");
      return;
    }

    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        setAuthError(
          "Your account profile was not found. Please contact support.",
        );
        return;
      }

      const data = snap.data();

      const role = normalizeRole(data.role);
      const status = normalizeStatus(data.status);
      const adminStatus = normalizeStatus(data.adminStatus);

      console.log("[LoginPage] User profile:", {
        uid,
        role,
        status,
        adminStatus,
        rawRole: data.role,
      });

      /*
       * SUPER ADMIN
       *
       * This also fixes:
       * "super_admin\n"
       *
       * because normalizeRole() trims whitespace/newlines.
       */
      if (role === "super_admin") {
        router.replace("/super-admin");
        return;
      }

      /*
       * ADMIN
       */
      if (role === "admin") {
        if (adminStatus === "disabled") {
          setAuthError(
            "Your admin account has been disabled. Please contact the super admin.",
          );
          return;
        }

        router.replace("/admin");
        return;
      }

      /*
       * NORMAL USER
       */
      if (status === "approved") {
        router.replace("/dashboard");
        return;
      }

      /*
       * Pending / rejected / other user status
       */
      router.replace("/approval-status");
    } catch (error) {
      console.error(
        "[LoginPage] Failed to load user profile:",
        error,
      );

      if (error instanceof FirebaseError) {
        if (
          error.code === "permission-denied" ||
          error.code === "failed-precondition" ||
          error.code === "unavailable"
        ) {
          setAuthError(
            "Unable to read your account profile. Please check your internet connection and try again.",
          );
          return;
        }
      }

      setAuthError(
        "Unable to load your account profile. Please try again.",
      );
    }
  };

  const onSubmit = async (data: FormData) => {
    setAuthError("");

    if (!isFirebaseConfigured) {
      setAuthError(
        "Firebase configuration is missing. Please check NEXT_PUBLIC_FIREBASE_* in .env.local.",
      );
      return;
    }

    const email = data.email.trim();
    const password = data.password;

    if (!email || !password.trim()) {
      setAuthError("Email and password are required.");
      return;
    }

    try {
      await login(email, password);
      await handlePostLoginRoute();
    } catch (error) {
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case "auth/user-not-found":
            setAuthError(
              "Account not found in Firebase Auth. Please sign up first.",
            );
            return;

          case "auth/wrong-password":
            setAuthError(
              "Incorrect password. Please try again.",
            );
            return;

          case "auth/invalid-credential":
          case "auth/invalid-login-credentials":
            setAuthError(
              "Invalid email or password.",
            );
            return;

          case "auth/user-disabled":
            setAuthError(
              "This account is disabled in Firebase Auth. Please contact support.",
            );
            return;

          case "auth/operation-not-allowed":
            setAuthError(
              "Email/password login is disabled in Firebase. Enable Email/Password provider in Firebase Console.",
            );
            return;

          case "auth/too-many-requests":
            setAuthError(
              "Too many attempts. Please wait a few minutes and try again.",
            );
            return;

          case "auth/network-request-failed":
            setAuthError(
              "Network error. Please check your internet connection and try again.",
            );
            return;

          case "auth/invalid-api-key":
            setAuthError(
              "Invalid Firebase API key. Please verify your .env.local values.",
            );
            return;

          default:
            setAuthError(
              `Login failed: ${error.code}`,
            );
            return;
        }
      }

      setAuthError(
        "Login failed. Please try again.",
      );
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError("");

    if (!isFirebaseConfigured) {
      setAuthError(
        "Firebase configuration is missing. Please check NEXT_PUBLIC_FIREBASE_* in .env.local.",
      );
      return;
    }

    try {
      setGoogleLoading(true);

      await loginWithGoogle();
      await handlePostLoginRoute();
    } catch (error) {
      if (error instanceof FirebaseError) {
        setAuthError(
          `Google login failed: ${error.code}`,
        );
        return;
      }

      setAuthError(
        "Google login failed. Please try again.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-6">
      <div className="grid w-full gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="glass w-full space-y-4 p-6"
        >
          <h1 className="text-2xl font-semibold">
            Login
          </h1>

          <div>
            <input
              {...register("email")}
              placeholder="Email"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2"
            />

            <p className="mt-1 text-xs text-red-400">
              {errors.email?.message}
            </p>
          </div>

          <div>
            <input
              {...register("password")}
              type="password"
              placeholder="Password"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2"
            />

            <p className="mt-1 text-xs text-red-400">
              {errors.password?.message}
            </p>
          </div>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              googleLoading
            }
            className="w-full rounded-lg bg-emerald-500 px-3 py-2 font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
                Signing in...
              </span>
            ) : (
              "Login"
            )}
          </button>

          <button
            type="button"
            disabled={
              isSubmitting ||
              googleLoading
            }
            onClick={handleGoogleLogin}
            className="w-full rounded-lg border border-zinc-700 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {googleLoading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400/40 border-t-zinc-200" />
                Continuing with Google...
              </span>
            ) : (
              "Continue with Google"
            )}
          </button>

          {authError ? (
            <p className="text-sm text-red-400">
              {authError}
            </p>
          ) : null}

          <p className="text-sm text-zinc-400">
            No account?{" "}
            <Link
              href="/signup"
              className="text-emerald-400"
            >
              Signup
            </Link>
          </p>
        </form>

        <section className="glass space-y-4 p-6">
          <h2 className="text-lg font-semibold">
            Why traders trust Trade FX
          </h2>

          <div className="space-y-3 text-sm text-zinc-300">
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2">
              <p className="font-medium text-zinc-100">
                ISO Certified Infrastructure
              </p>

              <p className="text-xs text-zinc-400">
                Secure trading operations and
                compliance-driven workflows.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2">
              <p className="font-medium text-zinc-100">
                2,00,000+ Registered Users
              </p>

              <p className="text-xs text-zinc-400">
                Growing community of active forex,
                crypto, and metals traders.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2">
              <p className="font-medium text-zinc-100">
                Approved by Indian Gov*
              </p>

              <p className="text-xs text-zinc-400">
                Trusted operations and documented
                KYC-first onboarding journey.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2">
              <p className="font-medium text-zinc-100">
                Serving Since 2016
              </p>

              <p className="text-xs text-zinc-400">
                Consistent execution, transparent
                dashboard, and secure account flow.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500">
            *Demo trust content for presentation purposes.
          </p>
        </section>
      </div>
    </div>
  );
}