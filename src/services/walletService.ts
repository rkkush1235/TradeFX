import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
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
  depositAccountId?: string;
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
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Withdrawal amount must be greater than 0");
  }

  const userSnap = await getDoc(doc(usersCol, input.userId));
  if (!userSnap.exists()) {
    throw new Error("User profile not found");
  }

  const balance = Number(userSnap.data().balance ?? 0);
  if (!Number.isFinite(balance) || balance < input.amount) {
    throw new Error("Insufficient wallet balance for this withdrawal");
  }

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
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Withdrawal amount must be greater than 0");
  }

  const requestRef = doc(withdrawalsCol, input.requestId);
  const userRef = doc(usersCol, input.userId);
  const now = Date.now();

  await runTransaction(db, async (tx) => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists()) {
      throw new Error("Withdrawal request not found");
    }

    const request = requestSnap.data() as Partial<WithdrawalRequest>;
    if (request.status !== "pending") {
      throw new Error("Withdrawal request has already been reviewed");
    }

    const amount = Number(request.amount ?? input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid withdrawal amount");
    }

    tx.update(requestRef, {
      status: input.status,
      reviewedBy: input.adminId,
      reviewedAt: now,
    });

    if (input.status !== "approved") return;

    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("User profile not found");
    }

    const currentBalance = Number(userSnap.data().balance ?? 0);
    if (!Number.isFinite(currentBalance) || currentBalance < amount) {
      throw new Error("Insufficient wallet balance. Withdrawal cannot be approved.");
    }

    tx.update(userRef, {
      balance: currentBalance - amount,
      updatedAt: now,
    });

    const transactionRef = doc(transactionsCol);
    tx.set(transactionRef, {
      userId: input.userId,
      type: "withdrawal",
      amount,
      status: "approved",
      createdAt: now,
      createdAtServer: serverTimestamp(),
      note: "Withdrawal approved",
    });
  });
}

export async function adjustWallet(input: { userId: string; balance: number; locked?: number }) {
  if (!Number.isFinite(input.balance) || input.balance < 0) {
    throw new Error("Wallet balance cannot be negative");
  }

  const locked = Math.max(0, Number(input.locked ?? 0));
  if (!Number.isFinite(locked)) {
    throw new Error("Locked balance is invalid");
  }

  await setDoc(
    doc(usersCol, input.userId),
    {
      balance: input.balance,
      locked,
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
