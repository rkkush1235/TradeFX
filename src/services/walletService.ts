import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { DepositRequest, Transaction, WithdrawalRequest } from "@/types";

const usersCol = collection(db, "users");
const depositsCol = collection(db, "deposits");
const withdrawalsCol = collection(db, "withdrawals");
const transactionsCol = collection(db, "transactions");

export async function createDepositRequest(input: {
  userId: string;
  amount: number;
  upiId: string;
  screenshotUrl: string;
}) {
  await addDoc(depositsCol, {
    ...input,
    status: "pending",
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });
}

export async function createWithdrawalRequest(input: {
  userId: string;
  amount: number;
  upiId: string;
  accountNumber: string;
  ifscCode: string;
}) {
  await addDoc(withdrawalsCol, {
    ...input,
    status: "pending",
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });
}

export function subscribeTransactions(
  userId: string,
  onData: (rows: Transaction[]) => void,
  onError?: (error: unknown) => void,
) {
  const q = query(
    transactionsCol,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, "id">) })));
    },
    (error) => onError?.(error),
  );
}

export function subscribeDeposits(
  onData: (rows: DepositRequest[]) => void,
  userId?: string,
  onError?: (error: unknown) => void,
) {
  const q = userId
    ? query(depositsCol, where("userId", "==", userId), orderBy("createdAt", "desc"))
    : query(depositsCol, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DepositRequest, "id">) })),
      );
    },
    (error) => onError?.(error),
  );
}

export function subscribeWithdrawals(
  onData: (rows: WithdrawalRequest[]) => void,
  userId?: string,
  onError?: (error: unknown) => void,
) {
  const q = userId
    ? query(withdrawalsCol, where("userId", "==", userId))
    : query(withdrawalsCol, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WithdrawalRequest, "id">) }));
      rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      onData(rows);
    },
    (error) => onError?.(error),
  );
}

export async function reviewDeposit(input: {
  requestId: string;
  userId: string;
  amount: number;
  adminId: string;
  status: "approved" | "rejected";
}) {
  await updateDoc(doc(depositsCol, input.requestId), {
    status: input.status,
    reviewedBy: input.adminId,
    reviewedAt: Date.now(),
  });

  if (input.status === "approved") {
    await setDoc(
      doc(usersCol, input.userId),
      {
        balance: increment(input.amount),
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    await addDoc(transactionsCol, {
      userId: input.userId,
      type: "deposit",
      amount: input.amount,
      status: "approved",
      createdAt: Date.now(),
      createdAtServer: serverTimestamp(),
      note: "Deposit approved",
    });
  }

}

export async function reviewWithdrawal(input: {
  requestId: string;
  userId: string;
  amount: number;
  adminId: string;
  status: "approved" | "rejected";
}) {
  await updateDoc(doc(withdrawalsCol, input.requestId), {
    status: input.status,
    reviewedBy: input.adminId,
    reviewedAt: Date.now(),
  });

  if (input.status === "approved") {
    await updateDoc(doc(usersCol, input.userId), {
      balance: increment(-input.amount),
      updatedAt: Date.now(),
    });

    await addDoc(transactionsCol, {
      userId: input.userId,
      type: "withdrawal",
      amount: input.amount,
      status: "approved",
      createdAt: Date.now(),
      createdAtServer: serverTimestamp(),
      note: "Withdrawal approved",
    });
  }


}

export async function adjustWallet(input: { userId: string; balance: number; locked?: number }) {
  await setDoc(
    doc(usersCol, input.userId),
    {
      balance: input.balance,
      locked: Math.max(0, input.locked ?? 0),
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  await addDoc(transactionsCol, {
    userId: input.userId,
    type: "admin_adjustment",
    amount: input.balance,
    status: "completed",
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
    note: "Admin wallet adjustment",
  });
}
