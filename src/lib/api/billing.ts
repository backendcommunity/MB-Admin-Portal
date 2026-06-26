import { axiosInstance } from '@/lib/api/axios';

export type Plan = {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  interval?: string;
  popular: boolean;
  hasDiscount: boolean;
  activeSubscribers?: number;
};

export type Subscription = {
  id: string;
  status: string;
  amount: number;
  startedAt?: string;
  expiry?: string;
  planId?: string;
  planName?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
};

export type Transaction = {
  id: string;
  amount: number;
  currency?: string;
  title: string;
  description?: string;
  status: string;
  provider: string;
  invoice: string;
  userName?: string;
  userEmail?: string;
  createdAt?: string;
};

export async function createPlan(payload: Partial<Plan>) {
  const response = await axiosInstance.post<Plan>('/admin/plans', payload);
  return response.data;
}

export async function updatePlan(payload: Partial<Plan> & { id: string }) {
  const response = await axiosInstance.put<Plan>(`/admin/plans/${payload.id}`, payload);
  return response.data;
}

export async function fetchPlans(params?: Record<string, unknown>) {
  const response = await axiosInstance.get<{ data: Plan[]; total: number }>('/admin/plans', {
    params,
  });
  return response.data;
}

export async function fetchSubscriptions(params?: Record<string, unknown>) {
  const response = await axiosInstance.get<{ data: Subscription[]; total: number }>(
    '/admin/subscriptions',
    { params },
  );
  return response.data;
}

export async function cancelSubscription(id: string) {
  const response = await axiosInstance.patch<{ success: boolean }>(
    `/admin/subscriptions/${id}/cancel`,
  );
  return response.data;
}

export async function grantManualSubscription(payload: {
  userId: string;
  planId: string;
  amount?: number;
}) {
  const response = await axiosInstance.post<{ id: string; status: string }>(
    '/admin/subscriptions/manual',
    payload,
  );
  return response.data;
}

export async function fetchTransactions(params?: Record<string, unknown>) {
  const response = await axiosInstance.get<{ data: Transaction[]; total: number }>(
    '/admin/transactions',
    { params },
  );
  return response.data;
}
