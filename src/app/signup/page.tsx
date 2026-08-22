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
import { deleteUser } from "firebase/auth";
import { deleteDoc, doc, setDoc, Timestamp } from "firebase/firestore";
import {
  estimateDataUrlBytes,
  imageFileToCompressedBase64,
} from "@/utils/imageBase64";

const COUNTRY_CODES = [
  { label: "India (+91)", value: "+91" },
  { label: "United States (+1)", value: "+1" },
  { label: "United Kingdom (+44)", value: "+44" },
  { label: "UAE (+971)", value: "+971" },
  { label: "Singapore (+65)", value: "+65" },
  { label: "Australia (+61)", value: "+61" },
] as const;

const PHONE_LENGTH_BY_COUNTRY_CODE: Record<
  (typeof COUNTRY_CODES)[number]["value"],
  number
> = {
  "+91": 10,
  "+1": 10,
  "+44": 10,
  "+971": 9,
  "+65": 8,
  "+61": 9,
};

function parsePhoneByCountryCode(value: string) {
  const normalized = value.replace(/\s+/g, "");

  const matchedCode = COUNTRY_CODES.map((entry) => entry.value)
    .sort((a, b) => b.length - a.length)
    .find((code) => normalized.startsWith(code));

  if (!matchedCode) {
    return null;
  }

  return {
    code: matchedCode,
    localNumber: normalized.slice(matchedCode.length),
  };
}

const schema = z.object({
  firstName: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: "First name is required",
    })
    .refine((value) => value.length >= 2, {
      message: "First name must be at least 2 characters",
    }),

  lastName: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: "Last name is required",
    })
    .refine((value) => value.length >= 2, {
      message: "Last name must be at least 2 characters",
    }),

  phone: z
    .string()
    .transform((value) => value.replace(/\s+/g, ""))
    .refine(
      (value) => {
        const parsed = parsePhoneByCountryCode(value);

        if (!parsed) return false;

        const allowedLength =
          PHONE_LENGTH_BY_COUNTRY_CODE[parsed.code];

        return (
          /^\d+$/.test(parsed.localNumber) &&
          parsed.localNumber.length === allowedLength
        );
      },
      {
        message: "Phone length must match selected country code",
      },
    ),

  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email"),

  password: z
    .string()
    .refine((value) => value.trim().length > 0, {
      message: "Password is required",
    })
    .refine((value) => value.length >= 6, {
      message: "Password must be at least 6 characters",
    })
    .refine((value) => /[A-Z]/.test(value), {
      message: "Password must contain at least one capital letter",
    })
    .refine((value) => /[^A-Za-z0-9]/.test(value), {
      message: "Password must contain at least one special character",
    }),

  aadhaarNumber: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 12, {
      message: "Aadhaar must be exactly 12 digits",
    }),

  // PAN is completely optional
  panNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((value) =>
      value ? value.toUpperCase().replace(/\s+/g, "") : "",
    ),

  // Aadhaar photos are required
  aadhaarFront: z.any(),
  aadhaarBack: z.any(),

  // Selfie is optional
  selfie: z.any().optional(),
});

type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();

  const [authError, setAuthError] = useState<string>("");
  const [progressMessage, setProgressMessage] =
    useState<string>("");

  const [countryCode, setCountryCode] =
    useState<string>("+91");

  const [localPhone, setLocalPhone] =
    useState<string>("");

  const maxLocalDigits =
    PHONE_LENGTH_BY_COUNTRY_CODE[
      countryCode as keyof typeof PHONE_LENGTH_BY_COUNTRY_CODE
    ] ?? 10;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: "+91",
      panNumber: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setAuthError("");
    setProgressMessage("Preparing files...");

    if (!isFirebaseConfigured) {
      setAuthError(
        "Firebase configuration is missing. Please check NEXT_PUBLIC_FIREBASE_* in .env.local.",
      );
      setProgressMessage("");
      return;
    }

    let createdUid: string | null = null;

    try {
      const firstName = data.firstName.trim();
      const lastName = data.lastName.trim();
      const email = data.email.trim();

      const frontFile = data.aadhaarFront?.[0] as
        | File
        | undefined;

      const backFile = data.aadhaarBack?.[0] as
        | File
        | undefined;

      const selfieFile = data.selfie?.[0] as
        | File
        | undefined;

      if (
        !firstName ||
        !lastName ||
        !email ||
        !data.password.trim()
      ) {
        setAuthError("Please fill all required fields.");
        setProgressMessage("");
        return;
      }

      if (!frontFile || !backFile) {
        setAuthError(
          "Aadhaar front and back photos are required.",
        );
        setProgressMessage("");
        return;
      }

      setProgressMessage(
        "Creating account and optimizing KYC...",
      );

      const signupPromise = signup({
        firstName,
        lastName,
        phone: data.phone,
        email,
        password: data.password,
        aadhaarNumber: data.aadhaarNumber,
        ...(data.panNumber
          ? { panNumber: data.panNumber }
          : {}),
      });

      const compressionPromise = Promise.all([
        imageFileToCompressedBase64(frontFile, {
          maxDimension: 1000,
          targetKB: 260,
        }),

        imageFileToCompressedBase64(backFile, {
          maxDimension: 1000,
          targetKB: 260,
        }),

        selfieFile
          ? imageFileToCompressedBase64(selfieFile, {
              maxDimension: 900,
              targetKB: 180,
            })
          : Promise.resolve(""),
      ] as const);

      const [
        signupResult,
        compressionResult,
      ] = await Promise.allSettled([
        signupPromise,
        compressionPromise,
      ]);

      if (signupResult.status === "fulfilled") {
        createdUid = signupResult.value;
      }

      if (signupResult.status === "rejected") {
        throw signupResult.reason;
      }

      if (compressionResult.status === "rejected") {
        throw compressionResult.reason;
      }

      const [
        aadhaarFrontBase64,
        aadhaarBackBase64,
        selfieBase64,
      ] = compressionResult.value;

      const approxTotalImageBytes =
        estimateDataUrlBytes(aadhaarFrontBase64) +
        estimateDataUrlBytes(aadhaarBackBase64) +
        (selfieBase64
          ? estimateDataUrlBytes(selfieBase64)
          : 0);

      if (approxTotalImageBytes > 850 * 1024) {
        throw new Error(
          "Images are too large for Firestore document. Please use lower-size images.",
        );
      }

      if (!createdUid) {
        throw new Error(
          "Account creation failed. Please try again.",
        );
      }

      const uid = createdUid;

      setProgressMessage("Saving KYC details...");

      const now = Timestamp.now().toMillis();

      await setDoc(
        doc(db, "users", uid),
        {
          aadhaarFrontUrl: "",
          aadhaarBackUrl: "",
          selfieUrl: "",
          aadhaarFrontBase64,
          aadhaarBackBase64,
          selfieBase64,
          kycSubmittedAt: now,
          updatedAt: now,
          ...(data.panNumber
            ? { panNumber: data.panNumber }
            : {}),
        },
        { merge: true },
      );

      setProgressMessage("Finalizing...");

      router.replace("/approval-status");
    } catch (error) {
      if (createdUid) {
        const uid = createdUid;

        try {
          await deleteDoc(doc(db, "users", uid));

          if (auth?.currentUser) {
            await deleteUser(auth.currentUser);
          }
        } catch (cleanupError) {
          console.error(
            "[Signup] Cleanup failed after signup error",
            cleanupError,
          );
        }
      }

      if (error instanceof FirebaseError) {
        console.error("[Signup] Firebase error", {
          code: error.code,
          message: error.message,
        });

        if (error.code === "auth/email-already-in-use") {
          setAuthError(
            "This email is already registered. Please login or use another email.",
          );
          setProgressMessage("");
          return;
        }

        if (
          error.code === "auth/operation-not-allowed"
        ) {
          setAuthError(
            "Email/Password signup is disabled in Firebase Authentication. Please enable it.",
          );
          setProgressMessage("");
          return;
        }

        if (
          error.code === "auth/configuration-not-found"
        ) {
          setAuthError(
            "Firebase Auth configuration missing for this project. Check Authentication setup.",
          );
          setProgressMessage("");
          return;
        }

        if (error.code === "auth/invalid-api-key") {
          setAuthError(
            "Invalid Firebase API key in .env.local.",
          );
          setProgressMessage("");
          return;
        }

        if (error.code === "auth/too-many-requests") {
          setAuthError(
            "Too many attempts. Please wait and try again.",
          );
          setProgressMessage("");
          return;
        }

        if (
          error.code === "auth/network-request-failed"
        ) {
          setAuthError(
            "Network request failed. Check internet and try again.",
          );
          setProgressMessage("");
          return;
        }

        setAuthError(`Signup failed: ${error.code}`);
        setProgressMessage("");
        return;
      }

      if (error instanceof Error) {
        setAuthError(error.message);
      } else {
        setAuthError("Signup failed. Please try again.");
      }

      setProgressMessage("");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-6">
      <div className="grid w-full gap-4 lg:grid-cols-[1.2fr_0.8fr]">

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="glass w-full space-y-4 p-6"
        >
          <h1 className="text-2xl font-semibold">
            Create Account
          </h1>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <input
                {...register("firstName")}
                placeholder="First Name"
                onBlur={(event) => {
                  event.target.value =
                    event.target.value.trim();
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2"
              />

              <p className="mt-1 text-xs text-red-400">
                {errors.firstName?.message}
              </p>
            </div>

            <div>
              <input
                {...register("lastName")}
                placeholder="Last Name"
                onBlur={(event) => {
                  event.target.value =
                    event.target.value.trim();
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2"
              />

              <p className="mt-1 text-xs text-red-400">
                {errors.lastName?.message}
              </p>
            </div>
          </div>

          <div>
            <input
              type="hidden"
              {...register("phone")}
            />

            <div className="grid grid-cols-[160px_1fr] gap-2">
              <select
                value={countryCode}
                onChange={(event) => {
                  const nextCode =
                    event.target.value;

                  const nextMax =
                    PHONE_LENGTH_BY_COUNTRY_CODE[
                      nextCode as keyof typeof PHONE_LENGTH_BY_COUNTRY_CODE
                    ] ?? 10;

                  const nextLocal =
                    localPhone.slice(0, nextMax);

                  setCountryCode(nextCode);
                  setLocalPhone(nextLocal);

                  setValue(
                    "phone",
                    `${nextCode}${nextLocal}`,
                    { shouldValidate: true },
                  );
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2"
              >
                {COUNTRY_CODES.map((code) => (
                  <option
                    key={code.value}
                    value={code.value}
                  >
                    {code.label}
                  </option>
                ))}
              </select>

              <input
                value={localPhone}
                placeholder="Mobile number"
                inputMode="numeric"
                maxLength={maxLocalDigits}
                onChange={(event) => {
                  const digits =
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, maxLocalDigits);

                  setLocalPhone(digits);

                  setValue(
                    "phone",
                    `${countryCode}${digits}`,
                    { shouldValidate: true },
                  );
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2"
              />
            </div>

            <p className="mt-1 text-xs text-red-400">
              {errors.phone?.message}
            </p>
          </div>

          <div>
            <input
              {...register("email")}
              placeholder="Email"
              onBlur={(event) => {
                event.target.value =
                  event.target.value.trim();
              }}
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

            <p className="mt-1 text-xs text-zinc-500">
              Minimum 6 characters, including at least one
              capital letter and one special character.
            </p>

            <p className="mt-1 text-xs text-red-400">
              {errors.password?.message}
            </p>
          </div>

          <div>
            <input
              {...register("aadhaarNumber")}
              placeholder="Aadhaar Number (12 digits)"
              inputMode="numeric"
              maxLength={12}
              onChange={(event) => {
                const digits =
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 12);

                setValue(
                  "aadhaarNumber",
                  digits,
                  { shouldValidate: true },
                );
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2"
            />

            <p className="mt-1 text-xs text-red-400">
              {errors.aadhaarNumber?.message}
            </p>
          </div>

          {/* PAN OPTIONAL */}

          <div>
            <input
              {...register("panNumber")}
              placeholder="PAN Number (Optional)"
              maxLength={10}
              onChange={(event) => {
                const normalized =
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 10);

                setValue(
                  "panNumber",
                  normalized,
                  { shouldValidate: true },
                );
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 uppercase"
            />

            <p className="mt-1 text-xs text-zinc-500">
              PAN is optional.
            </p>
          </div>

          {/* AADHAAR FRONT REQUIRED */}

          <div className="space-y-2">
            <label className="block text-xs text-zinc-400">
              Aadhaar Front Photo *
            </label>

            <input
              type="file"
              accept="image/*"
              required
              {...register("aadhaarFront")}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2"
            />
          </div>

          {/* AADHAAR BACK REQUIRED */}

          <div className="space-y-2">
            <label className="block text-xs text-zinc-400">
              Aadhaar Back Photo *
            </label>

            <input
              type="file"
              accept="image/*"
              required
              {...register("aadhaarBack")}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2"
            />
          </div>

          {/* SELFIE OPTIONAL */}

          <div className="space-y-2">
            <label className="block text-xs text-zinc-400">
              Selfie Photo (Optional)
            </label>

            <input
              type="file"
              accept="image/*"
              {...register("selfie")}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2"
            />
          </div>

          <button
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-500 px-3 py-2 font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
                Creating account...
              </span>
            ) : (
              "Signup"
            )}
          </button>

          {isSubmitting && progressMessage ? (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300">
              {progressMessage}
            </div>
          ) : null}

          {authError ? (
            <p className="text-sm text-red-400">
              {authError}
            </p>
          ) : null}

          <p className="text-sm text-zinc-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-emerald-400"
            >
              Login
            </Link>
          </p>
        </form>

        <section className="glass space-y-4 p-6">
          <h2 className="text-lg font-semibold">
            Trusted Trading Ecosystem
          </h2>

          <div className="space-y-3 text-sm text-zinc-300">
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2">
              <p className="font-medium text-zinc-100">
                ISO Certified Platform
              </p>

              <p className="text-xs text-zinc-400">
                Security-led onboarding and account
                handling standards.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2">
              <p className="font-medium text-zinc-100">
                2,00,000+ Users
              </p>

              <p className="text-xs text-zinc-400">
                Large user base across forex, crypto,
                and commodity markets.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2">
              <p className="font-medium text-zinc-100">
                Approved by Indian Gov*
              </p>

              <p className="text-xs text-zinc-400">
                KYC-centric onboarding process aligned
                for Indian users.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2">
              <p className="font-medium text-zinc-100">
                Operating Since 2016
              </p>

              <p className="text-xs text-zinc-400">
                Stable service journey with transparent
                user workflows.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500">
            *Demo trust content for UI representation.
          </p>
        </section>
      </div>
    </div>
  );
}