import { axiosInstance } from '@/lib/api/axios';

/**
 * The six kinds an instructor can author and submit for review.
 * `roadmap` is what the API calls a Path — the portal's own naming is `path`
 * in some places and `roadmap` in others, and the endpoint accepts either
 * (case-insensitive, `path` is an alias) — but the response always echoes
 * back the canonical `"ROADMAP"`. Bootcamp submits the identity row; a
 * cohort has no submit state of its own. `mock-interview` is the kebab form
 * the API's `canonicalKind` accepts as an alias for `MOCK_INTERVIEW` (it
 * uppercases whatever is sent, so the dash survives and matches its own
 * `"MOCK-INTERVIEW"` check).
 */
export type SubmittableType =
  | 'course'
  | 'project'
  | 'bootcamp'
  | 'roadmap'
  | 'offer'
  | 'mock-interview';

export type SubmitForReviewResponse = {
  success: boolean;
  id: string;
  type: string;
  status: string;
};

/**
 * `POST /instructor/my-content/:type/:id/submit` — draft → submitted. This is
 * the ONLY way a non-staff author moves their own content toward publish;
 * the model's own update/status routes 403 an instructor who tries to flip
 * the publish flag directly (`assertMayPublish` on the API side).
 */
export async function submitForReview(type: SubmittableType, id: string, notes?: string) {
  const { data } = await axiosInstance.post<SubmitForReviewResponse>(
    `/instructor/my-content/${type}/${id}/submit`,
    notes ? { notes } : {},
  );
  return data;
}

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
