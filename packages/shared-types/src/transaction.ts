/**
 * Transaction Types - Shared types for financial transactions
 */

export type TransactionType = 'payment' | 'refund' | 'deposit' | 'tip' | 'expense';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
export type TransactionPaymentMethod = 'cash' | 'card' | 'mercadopago' | 'transfer' | 'other';
export type ExternalPaymentProvider = 'mercadopago' | 'stripe';

export interface TransactionServiceBreakdown {
  serviceId: string;
  name: string;
  amount: number;
}

export interface TransactionBreakdown {
  services?: TransactionServiceBreakdown[];
  discount?: number;
  discountCode?: string;
  tip?: number;
  tax?: number;
}

export interface ExternalPaymentInfo {
  provider: ExternalPaymentProvider;
  transactionId: string;
  status: string;
  rawResponse?: Record<string, unknown>;
}

export interface ExpenseInfo {
  category: string;
  description?: string;
  receipt?: string;
}

export interface Transaction {
  _id: string;
  businessId: string;
  appointmentId?: string;
  clientId?: string;
  staffId?: string;
  type: TransactionType;
  amount: number;
  currency: string;
  paymentMethod: TransactionPaymentMethod;
  externalPayment?: ExternalPaymentInfo;
  breakdown?: TransactionBreakdown;
  expense?: ExpenseInfo;
  status: TransactionStatus;
  notes?: string;
  processedAt?: string;
  processedBy?: string;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  client?: {
    _id: string;
    profile: { firstName: string; lastName: string };
  };
  staff?: {
    _id: string;
    profile: { firstName: string; lastName: string };
  };
  appointment?: {
    _id: string;
    date: string;
    services: Array<{ name: string }>;
  };
}

// API Request Types
export interface CreateTransactionRequest {
  appointmentId?: string;
  clientId?: string;
  staffId?: string;
  type: TransactionType;
  amount: number;
  paymentMethod: TransactionPaymentMethod;
  breakdown?: TransactionBreakdown;
  notes?: string;
}

export interface CreateExpenseRequest {
  amount: number;
  category: string;
  description?: string;
  receipt?: string;
  paymentMethod?: TransactionPaymentMethod;
  notes?: string;
}

export interface UpdateExpenseRequest {
  amount?: number;
  category?: string;
  description?: string;
  receipt?: string;
  notes?: string;
}

// POS Types
export interface CheckoutRequest {
  appointmentId: string;
  services?: Array<{
    serviceId: string;
    price?: number;
  }>;
  discountCode?: string;
  discountAmount?: number;
  tip?: number;
  paymentMethod: TransactionPaymentMethod;
}

export interface QuickSaleRequest {
  clientId?: string;
  clientName?: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  paymentMethod: TransactionPaymentMethod;
  notes?: string;
}

// Report Types
export interface FinancialSummary {
  period: {
    from: string;
    to: string;
  };
  revenue: {
    total: number;
    byPaymentMethod: Record<TransactionPaymentMethod, number>;
    byService: Array<{ serviceId: string; name: string; amount: number }>;
    byStaff: Array<{ staffId: string; name: string; amount: number }>;
  };
  expenses: {
    total: number;
    byCategory: Record<string, number>;
  };
  profit: number;
  transactionCount: number;
  averageTicket: number;
}

export interface DailyCloseReport {
  date: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  transactions: {
    cash: { count: number; amount: number };
    card: { count: number; amount: number };
    mercadopago: { count: number; amount: number };
    transfer: { count: number; amount: number };
  };
  refunds: number;
  tips: number;
  expenses: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number;
}
