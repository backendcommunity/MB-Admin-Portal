import { axiosInstance } from './axios';

export type TeamProcessor = 'PADDLE' | 'ASYNCPAY' | 'STRIPE' | 'PAYSTACK' | null;

export type TeamOwner = {
  id: string;
  name: string;
  email: string;
} | null;

export type TeamSeatUsage = {
  paidSeats: number;
  activeMembers: number;
  pendingInvites: number;
  used: number;
  available: number;
};

export type TeamSummary = {
  id: string;
  name: string;
  owner: TeamOwner;
  processor: TeamProcessor;
  subscriptionStatus: string | null;
  seats: TeamSeatUsage;
};

export type TeamMemberRow = {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  removedAt: string | null;
  user: { id: string; name: string; email: string; avatar: string | null };
};

export type TeamInviteRow = {
  id: string;
  email: string;
  invitedByUserId: string;
  expiresAt: string;
  createdAt: string;
};

export type TeamDetail = {
  id: string;
  name: string;
  owner: TeamOwner;
  processor: TeamProcessor;
  subscription: {
    status: string | null;
    seats: number;
    paidSeats: number;
    // Per-seat price, in `currency` below — never assume USD. Paddle
    // localization means the same list price can settle in different
    // currencies for different customers.
    amount: number | null;
    currency: string | null;
  } | null;
  usage: TeamSeatUsage;
  members: TeamMemberRow[];
  pendingInvites: TeamInviteRow[];
};

export async function fetchTeams(params: { page?: number; limit?: number }) {
  const res = await axiosInstance.get<{
    success: boolean;
    data: { teams: TeamSummary[]; total: number; page: number; limit: number };
  }>('/teams', { params });
  return res.data.data;
}

export async function fetchTeamDetail(id: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamDetail }>(`/teams/${id}/admin`);
  return res.data.data;
}

/**
 * Staff seat adjustment — the sales-led path for AsyncPay teams (NG owners
 * cannot buy seats themselves). Refuses (409) when `seats` is below current
 * usage; callers must surface `error.response.data.message` rather than a
 * generic failure toast, since that message names the exact usage figure.
 */
export async function adminSetTeamSeats(id: string, seats: number) {
  const res = await axiosInstance.patch<{ success: boolean; data: TeamSeatUsage }>(
    `/teams/${id}/seats`,
    { seats },
  );
  return res.data.data;
}

/**
 * Formats a minor/major amount in whatever currency the API returned.
 * Deliberately takes `currency` as a required, possibly-null argument
 * instead of defaulting to USD — Paddle localization means a USD-listed
 * plan can settle in another currency depending on the customer, and
 * defaulting here would silently mislabel it.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string | null | undefined,
) {
  if (amount == null) return '—';
  if (!currency) return amount.toLocaleString();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}
