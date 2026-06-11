"use client";

import { useState, useRef } from "react";
import { AdminRoute } from "@/components/guards/AdminRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useAppSettings, useUpdateQRCode, useDeleteQRCode } from "@/hooks/useAppSettings";
import { imageFileToCompressedBase64 } from "@/utils/imageBase64";

export default function AdminSettingsPage() {
  const { data: settings } = useAppSettings();
  const updateQRCode = useUpdateQRCode();
  const deleteQRCode = useDeleteQRCode();

  const [uploadError, setUploadError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [isCompressing, setIsCompressing] = useState(false);
  const [qrPreview, setQrPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleQRFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError("");

    if (!file) {
      setQrPreview("");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file (JPG, PNG, etc.)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be less than 5MB");
      return;
    }

    try {
      setIsCompressing(true);
      const base64 = await imageFileToCompressedBase64(file);
      setQrPreview(base64);
      setUploadError("");
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to process image"
      );
      setQrPreview("");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleUploadQR = async () => {
    if (!qrPreview) {
      setUploadError("Please select a QR code image");
      return;
    }

    try {
      setUploadError("");
      await updateQRCode.mutateAsync(qrPreview);
      setSuccessMessage("QR Code uploaded successfully!");
      setQrPreview("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setUploadError("Failed to upload QR code. Please try again.");
      console.error(error);
    }
  };

  const handleDeleteQR = async () => {
    if (!confirm("Are you sure you want to delete the QR code? Customers won't be able to see it.")) {
      return;
    }

    try {
      setUploadError("");
      await deleteQRCode.mutateAsync();
      setSuccessMessage("QR Code deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setUploadError("Failed to delete QR code. Please try again.");
      console.error(error);
    }
  };

  return (
    <AdminRoute>
      <AppShell title="Admin Settings">
        <section className="glass space-y-4 p-4 text-sm">
          <div>
            <h3 className="font-medium mb-3">QR / Barcode Management</h3>
            <div className="space-y-3">
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

              {settings?.qrCodeBase64 ? (
                <div className="space-y-3">
                  <p className="text-zinc-300 text-xs">Current QR Code:</p>
                  <img
                    src={settings.qrCodeBase64}
                    alt="Current QR Code"
                    className="w-48 h-48 border border-zinc-700 rounded-lg"
                  />
                  <button
                    onClick={handleDeleteQR}
                    disabled={deleteQRCode.isPending}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-medium"
                  >
                    {deleteQRCode.isPending ? "Deleting..." : "Delete QR Code"}
                  </button>
                </div>
              ) : (
                <p className="text-zinc-400 text-xs">No QR code uploaded yet</p>
              )}

              <div className="border-t border-zinc-700 pt-3 mt-3">
                <label className="text-sm text-zinc-300 block mb-2">Upload New QR Code (Max 5MB)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleQRFileSelect}
                  disabled={isCompressing}
                  className="block w-full text-sm text-zinc-400 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-2 file:font-medium file:text-zinc-900 disabled:opacity-50"
                />
                {isCompressing && (
                  <p className="text-xs text-amber-400 mt-2">Compressing image...</p>
                )}
                {qrPreview && (
                  <div className="space-y-2 mt-3">
                    <p className="text-xs text-zinc-400">Preview:</p>
                    <img
                      src={qrPreview}
                      alt="QR code preview"
                      className="w-48 h-48 border border-zinc-700 rounded-lg"
                    />
                    <button
                      onClick={handleUploadQR}
                      disabled={updateQRCode.isPending || isCompressing}
                      className="w-full px-3 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-zinc-900 rounded-lg font-medium text-sm"
                    >
                      {updateQRCode.isPending ? "Uploading..." : "Upload QR Code"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-700 pt-4">
            <h3 className="font-medium mb-3">Email & Compliance Settings</h3>
            <p className="text-zinc-400">Configure these env variables for notification workflow:</p>
            <ul className="space-y-1 text-zinc-300 mt-2">
              <li>NEXT_PUBLIC_EMAILJS_SERVICE_ID</li>
              <li>NEXT_PUBLIC_EMAILJS_TEMPLATE_ID</li>
              <li>NEXT_PUBLIC_EMAILJS_PUBLIC_KEY</li>
              <li>NEXT_PUBLIC_EMAILJS_FROM_NAME</li>
              <li>NEXT_PUBLIC_EMAILJS_REPLY_TO</li>
              <li>NEXT_PUBLIC_APP_URL</li>
            </ul>
            <p className="text-xs text-zinc-500 mt-2">Admin role assignment remains manual via Firestore users document.</p>
          </div>
        </section>
      </AppShell>
    </AdminRoute>
  );
}
