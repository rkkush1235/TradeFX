"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useRef } from "react";
import type { ChangeEvent } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useCreateDepositRequest, useDeposits } from "@/hooks/useWalletRequests";
import { useUserDepositAccount } from "@/hooks/useBankAccounts";
import { imageFileToCompressedBase64 } from "@/utils/imageBase64";
import { formatCurrency } from "@/utils/format";

const schema = z.object({
  amount: z.number().min(100),
  upiId: z.string().min(3),
});

type FormData = z.infer<typeof schema>;

export default function DepositPage() {
  const { appUser } = useAuth();
  const createDeposit = useCreateDepositRequest();
  const rows = useDeposits(appUser?.uid);
  const { data: depositAccount, isLoading: isDepositAccountLoading } = useUserDepositAccount(appUser?.uid);

  const [screenshotPreview, setScreenshotPreview] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError("");

    if (!file) {
      setScreenshotPreview("");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file (JPG, PNG, etc.)");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image must be less than 10MB");
      return;
    }

    try {
      setIsCompressing(true);
      // Convert to compressed base64
      const base64 = await imageFileToCompressedBase64(file);
      setScreenshotPreview(base64);
      setUploadError("");
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to process image"
      );
      setScreenshotPreview("");
    } finally {
      setIsCompressing(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!appUser?.uid) return;
    if (!screenshotPreview) {
      setUploadError("Please upload a payment screenshot");
      return;
    }

    try {
      setUploadError("");

      // Submit deposit with base64 screenshot
      await createDeposit.mutateAsync({
        userId: appUser.uid,
        amount: data.amount,
        upiId: data.upiId,
        screenshotUrl: screenshotPreview, // Store base64 directly
        depositAccountId: depositAccount?.id,
      });

      setSuccessMessage("Deposit request submitted successfully!");
      reset();
      setScreenshotPreview("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      setUploadError("Failed to submit deposit. Please try again.");
      console.error(error);
    }
  };

  return (
    <AppShell title="Deposit">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-medium">Payment Details</h3>
          {isDepositAccountLoading ? (
            <div className="rounded-lg bg-zinc-900/70 p-3 text-sm text-zinc-400">Loading your assigned bank details...</div>
          ) : depositAccount ? (
            <div className="rounded-lg bg-zinc-900/70 p-3 text-sm space-y-2">
              <p className="font-medium text-emerald-300">{depositAccount.bankName}</p>
              <p><span className="text-zinc-400">Name:</span> {depositAccount.accountHolderName}</p>
              <p><span className="text-zinc-400">Account Number:</span> {depositAccount.accountNumber}</p>
              <p><span className="text-zinc-400">IFSC Code:</span> {depositAccount.ifscCode}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">No deposit bank account has been assigned to your account yet. Please contact support.</div>
          )}

          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            Your deposit will be considered valid only after payment is received in the above account.
          </div>
        </section>

        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-medium">QR / Barcode</h3>
          {depositAccount?.qrCodeBase64 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <img
                src={depositAccount.qrCodeBase64}
                alt="Payment QR Code"
                className="w-40 h-40 border-2 border-emerald-500/50 rounded-lg p-2 bg-white"
              />
              <p className="mt-3 text-xs text-emerald-200">Scan to pay instantly</p>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/60 p-8 text-center">
              <div className="space-y-2">
                <div className="text-2xl">📱</div>
                <p className="text-sm font-medium text-zinc-200">QR Code not assigned</p>
                <p className="text-xs text-zinc-400">Please contact support before making a deposit.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <form
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
        className="glass mx-auto w-full max-w-xl space-y-3 p-4"
      >
        <h3 className="text-sm font-medium">Deposit Request</h3>

        {successMessage && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}

        {uploadError && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
            {uploadError}
          </div>
        )}

        <input
          type="number"
          placeholder="Amount"
          {...register("amount", { valueAsNumber: true })}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2"
        />
        <input
          placeholder="Your UPI ID"
          {...register("upiId")}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2"
        />

        <div className="space-y-2">
          <label className="text-sm text-zinc-300">Payment Screenshot * (Max 10MB)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={isCompressing}
            className="block w-full text-sm text-zinc-400 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-2 file:font-medium file:text-zinc-900 disabled:opacity-50"
          />
          {isCompressing && (
            <p className="text-xs text-amber-400">Compressing image...</p>
          )}
          {screenshotPreview && (
            <div className="relative mt-2 rounded-lg overflow-hidden border border-zinc-700">
              <img src={screenshotPreview} alt="Payment screenshot preview" className="w-full h-auto max-h-48 object-cover" />
              <button
                type="button"
                onClick={() => {
                  setScreenshotPreview("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="absolute top-2 right-2 rounded-lg bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={formState.isSubmitting || createDeposit.isPending || isCompressing || !screenshotPreview || !depositAccount}
          className="w-full rounded-lg bg-emerald-500 px-3 py-2 font-medium text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {formState.isSubmitting || createDeposit.isPending ? "Submitting..." : "Submit Deposit Request"}
        </button>
      </form>

      <section className="glass p-4">
        <h3 className="mb-3 text-sm font-medium">Deposit History</h3>
        <div className="space-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.id} className="rounded-lg border border-zinc-700/70 p-3">
              {formatCurrency(row.amount)} • {row.status} • {new Date(row.createdAt).toLocaleString()}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
