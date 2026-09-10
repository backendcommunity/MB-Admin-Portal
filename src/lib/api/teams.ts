import { axiosInstance } from './axios';

export type TeamProcessor = 'PADDLE' | 'ASYNCPAY' | 'STRIPE' | 'PAYSTACK' | null;

export type TeamOwner = {
  id: string;
  name: string;
  email: string;
} | null;

export type TeamSeatUsage = {
  /**
   * Whether the team has an active paid subscription at all. When false,
   * `paidSeats` is meaningless (no plan to count seats against) — render
   * the denominator as an em dash rather than 0.
   */
  subscribed: boolean;
  paidSeats: number;
  activeMembers: number;
  pendingInvites: number;
  used: number;
  available: number;
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

export type TeamSummary = {
  id: string;
  name: string;
  owner: TeamOwner;
  processor: TeamProcessor;
  subscriptionStatus: string | null;
  seats: TeamSeatUsage;
  /**
   * The seat-gap the nightly reconcile last reported — alert bookkeeping,
   * never a seat figure. Kept beside `seats` under its own name because
   * conflating the two is the bug this rewrite fixes.
   */
  seatGap: number | null;
  archivedAt: string | null;
  createdAt: string;
};

export type TeamDetail = TeamSummary & {
  subscription: {
    id: string;
    status: string | null;
    seats: number;
    paidSeats: number;
    // Per-seat price, in `currency` below — never assume USD. Paddle
    // localization means the same list price can settle in different
    // currencies for different customers.
    amount: number | null;
    currency: string | null;
  } | null;
  members: TeamMemberRow[];
  pendingInvites: TeamInviteRow[];
};

export type TeamListParams = {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  processor?: string;
  seatState?: string;
};

export type CreateTeamInput = {
  name: string;
  ownerEmail: string;
  subscriptionId?: string;
  seats?: number;
};

type Paged<T> = { teams: T[]; total: number; page: number; limit: number };

/** Drops empty strings and the `ALL` sentinel so they never reach the API. */
function clean(params: TeamListParams) {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === 'ALL') continue;
    out[k] = v as string | number;
  }
  return out;
}

export async function fetchTeams(params: TeamListParams) {
  const res = await axiosInstance.get<{ success: boolean; data: Paged<TeamSummary> }>(
    '/admin/teams',
    { params: clean(params) },
  );
  return res.data.data;
}

export async function fetchTeam(id: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamDetail }>(`/admin/teams/${id}`);
  return res.data.data;
}

export async function createTeam(input: CreateTeamInput) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamSummary }>(
    '/admin/teams',
    input,
  );
  return res.data.data;
}

export async function renameTeam(id: string, name: string) {
  const res = await axiosInstance.patch<{ success: boolean; data: TeamSummary }>(
    `/admin/teams/${id}`,
    { name },
  );
  return res.data.data;
}

export async function transferTeam(id: string, toUserId: string) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamSummary }>(
    `/admin/teams/${id}/transfer`,
    { toUserId },
  );
  return res.data.data;
}

export async function archiveTeam(id: string) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamSummary }>(
    `/admin/teams/${id}/archive`,
  );
  return res.data.data;
}

export async function restoreTeam(id: string) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamSummary }>(
    `/admin/teams/${id}/restore`,
  );
  return res.data.data;
}

/**
 * Staff seat adjustment. Refuses (409) when `seats` is below current usage;
 * callers must surface `error.response.data.message` rather than a generic
 * failure toast, since that message names the exact usage figure.
 */
export async function adminSetTeamSeats(id: string, seats: number) {
  const res = await axiosInstance.patch<{ success: boolean; data: TeamSeatUsage }>(
    `/admin/teams/${id}/seats`,
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
