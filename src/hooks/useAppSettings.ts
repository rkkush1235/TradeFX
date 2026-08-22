import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";

export interface AppSettings {
  qrCodeBase64?: string;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  updatedAt?: number;
}

const SETTINGS_DOC = "appSettings";
const SETTINGS_COLLECTION = "config";

// Fetch app settings (QR code, etc.)
export function useAppSettings() {
  return useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      try {
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
        const snapshot = await getDoc(docRef);
        return (snapshot.data() as AppSettings) || {};
      } catch (error) {
        console.error("Error fetching app settings:", error);
        return {};
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Update QR code
export function useUpdateQRCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (qrCodeBase64: string) => {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
      await setDoc(
        docRef,
        {
          qrCodeBase64,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appSettings"] });
    },
    onError: (error) => {
      console.error("Error updating QR code:", error);
    },
  });
}

// Delete QR code
export function useDeleteQRCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
      await setDoc(
        docRef,
        {
          qrCodeBase64: "",
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appSettings"] });
    },
    onError: (error) => {
      console.error("Error deleting QR code:", error);
    },
  });
}


export function useSetMaintenanceMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { enabled: boolean; message?: string; updatedBy: string }) => {
      await setDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC), { maintenanceMode: input.enabled, maintenanceMessage: input.message ?? "TradeFX is temporarily under maintenance. Please try again shortly.", updatedAt: Date.now(), updatedBy: input.updatedBy }, { merge: true });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appSettings"] }),
  });
}
