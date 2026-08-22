import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, query, where, getDocs, getDoc, addDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";

export interface BankAccount {
  id: string;
  userId?: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  qrCodeBase64?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  assignedUserId?: string;
  updatedBy?: string;
}

const COLLECTION_NAME = "bankAccounts";
const USER_COLLECTION_NAME = "userDepositAccounts";

export function useBankAccounts() {
  return useQuery({
    queryKey: ["bankAccounts"],
    queryFn: async () => {
      const q = query(collection(db, COLLECTION_NAME), where("isActive", "==", true));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BankAccount[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUserDepositAccount(userId?: string) {
  return useQuery({
    queryKey: ["userDepositAccount", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null;
      const item = await getDoc(doc(db, USER_COLLECTION_NAME, userId));
      return item.exists() ? ({ id: item.id, ...item.data() } as BankAccount) : null;
    },
    staleTime: 1000 * 60,
  });
}

export function useAllUserDepositAccounts() {
  return useQuery({
    queryKey: ["userDepositAccounts"],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, USER_COLLECTION_NAME));
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BankAccount[];
    },
    staleTime: 1000 * 60,
  });
}

export function useAddBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (account: Omit<BankAccount, "id" | "createdAt" | "updatedAt">) => {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...account,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return docRef.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bankAccounts"] }),
  });
}

export function useSaveUserDepositAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      adminId: string;
      bankName: string;
      accountHolderName: string;
      accountNumber: string;
      ifscCode: string;
      qrCodeBase64: string;
    }) => {
      await setDoc(doc(db, USER_COLLECTION_NAME, input.userId), {
        userId: input.userId,
        bankName: input.bankName.trim(),
        accountHolderName: input.accountHolderName.trim(),
        accountNumber: input.accountNumber.trim(),
        ifscCode: input.ifscCode.trim().toUpperCase(),
        qrCodeBase64: input.qrCodeBase64,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: input.adminId,
      }, { merge: true });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["userDepositAccount", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["userDepositAccounts"] });
    },
  });
}
