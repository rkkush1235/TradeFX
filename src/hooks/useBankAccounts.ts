import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";

export interface BankAccount {
  id: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

const COLLECTION_NAME = "bankAccounts";

// Fetch all active bank accounts
export function useBankAccounts() {
  return useQuery({
    queryKey: ["bankAccounts"],
    queryFn: async () => {
      try {
        const q = query(
          collection(db, COLLECTION_NAME),
          where("isActive", "==", true)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as BankAccount[];
      } catch (error) {
        console.error("Error fetching bank accounts:", error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Add new bank account
export function useAddBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      account: Omit<BankAccount, "id" | "createdAt" | "updatedAt">
    ) => {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...account,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
    },
    onError: (error) => {
      console.error("Error adding bank account:", error);
    },
  });
}

// Delete bank account (soft delete - set isActive to false)
export function useDeleteBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      await updateDoc(doc(db, COLLECTION_NAME, accountId), {
        isActive: false,
        updatedAt: Date.now(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
    },
    onError: (error) => {
      console.error("Error deleting bank account:", error);
    },
  });
}
