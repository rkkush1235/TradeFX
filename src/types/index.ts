export type UserRole = "user" | "admin" | "super_admin";
export type UserStatus = "pending" | "approved" | "rejected" | "suspended" | "banned";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  plainPassword?: string;
  aadhaarFrontUrl?: string;
  aadhaarBackUrl?: string;
  selfieUrl?: string;
  aadhaarFrontBase64?: string;
  aadhaarBackBase64?: string;
  selfieBase64?: string;
  role: UserRole;
  status?: UserStatus;
  accountId?: string;
  currency?: string;
  balance?: number;
  locked?: number;
  deposits?: number;
  withdrawals?: number;
  approvedAt?: number;
  approvedBy?: string;
  rejectionReason?: string;
  kycSubmittedAt?: number;
  updatedAt?: number;
  createdAt: number;
}

export interface MarketPrice {
  symbol: string;
  category: "forex" | "crypto" | "metal";
  priceUsd: number;
  change24h: number;
  updatedAt: number;
}

export interface MarketSnapshot {
  prices: Record<string, MarketPrice>;
  updatedAt: number;
  source: "polling" | "manual";
}

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Trade {
  id: string;
  asset: string;
  type: "buy" | "sell";
  quantity: number;
  leverage?: number;
  marginUsed?: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  status: "open" | "closed";
  timestamp: number;
  closedAt?: number;
  userId: string;
  userDisplayName?: string;
  userEmail?: string;
  userSearchKey?: string;
  assignedAdminId?: string;
}

export interface Wallet {
  userId: string;
  balance: number;
  locked: number;
  updatedAt: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: "deposit" | "withdrawal" | "trade_pnl" | "admin_adjustment";
  amount: number;
  status: "pending" | "approved" | "rejected" | "completed";
  createdAt: number;
  note?: string;
}

export interface DepositRequest {
  id: string;
  userId: string;
  amount: number;
  upiId: string;
  screenshotUrl: string;
  depositAccountId?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: number;
  upiId: string;
  accountNumber: string;
  ifscCode: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
}

export interface DashboardAnalytics {
  totalUsers: number;
  openTrades: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  marketUpdatedAt: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  actorId: string;
  actorRole: UserRole;
  message: string;
  createdAt: number;
}
