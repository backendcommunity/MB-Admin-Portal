import { axiosInstance } from '@/lib/api/axios';

export type EarningsSummary = {
  totalEarned: number;
  pendingPayout: number;
  currentBalance: number;
  totalPayouts: number;
};

export type EarningsBreakdownItem = {
  contentTitle: string;
  month: string;
  amount: number;
  transactions: number;
};

export type PayoutItem = {
  id: string;
  amount: number;
  status: string;
  title: string;
  date: string;
};

export async function fetchEarningsSummary() {
  const response = await axiosInstance.get<{ data: EarningsSummary }>(
    '/instructor/earnings/summary',
  );
  return response.data.data;
}

export async function fetchEarningsBreakdown(params?: { months?: number }) {
  const response = await axiosInstance.get<{ data: EarningsBreakdownItem[] }>(
    '/instructor/earnings/breakdown',
    { params },
  );
  return response.data.data;
}

export async function fetchPayoutHistory(params?: { page?: number; limit?: number }) {
  const response = await axiosInstance.get<{
    data: PayoutItem[];
    total: number;
    page: number;
    limit: number;
  }>('/instructor/earnings/payouts', { params });
  return response.data;
}
