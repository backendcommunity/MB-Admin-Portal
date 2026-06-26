import { axiosInstance } from '@/lib/api/axios';

export type AnalyticsSummary = {
  totalUsers: { value: number; delta: number };
  activeSubscribers: { value: number; delta: number };
  mrr: { value: number; delta: number | null; byCurrency?: Record<string, number> };
  coursesEnrolled: { value: number; delta: number };
};

export type SignupDataPoint = { date: string; count: number };
export type SignupTrend = { period: string; data: SignupDataPoint[] };

export type RevenuePlanPoint = { plan: string; revenue: number };
export type RevenueProviderPoint = { provider: string; revenue: number };
export type RevenueBreakdown = {
  period: string;
  byPlan: RevenuePlanPoint[];
  byProvider: RevenueProviderPoint[];
  usd?: number;
  byCurrency?: Record<string, { gross: number; net: number; fees: number }>;
};

export type ReconciliationStatus = {
  lastRanAt: string | null;
  healthy: boolean;
  providers: { provider: string; currency: string; discrepancy: number; ranAt: string }[];
};

export type TopCourse = {
  courseId: string;
  title: string;
  slug: string;
  enrollments: number;
};
export type TopCoursesData = { data: TopCourse[] };

export type AnalyticsPeriod = '7d' | '30d' | '90d';

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const res = await axiosInstance.get<AnalyticsSummary>('/admin/analytics/summary');
  return res.data;
}

export async function fetchSignupTrend(period: AnalyticsPeriod): Promise<SignupTrend> {
  const res = await axiosInstance.get<SignupTrend>('/admin/analytics/signups', {
    params: { period },
  });
  return res.data;
}

export async function fetchRevenueBreakdown(period: AnalyticsPeriod): Promise<RevenueBreakdown> {
  const res = await axiosInstance.get<RevenueBreakdown>('/admin/analytics/revenue', {
    params: { period },
  });
  return res.data;
}

export async function fetchTopCourses(): Promise<TopCoursesData> {
  const res = await axiosInstance.get<TopCoursesData>('/admin/analytics/top-courses');
  return res.data;
}

export async function fetchReconciliationStatus(): Promise<ReconciliationStatus> {
  const res = await axiosInstance.get<ReconciliationStatus>('/admin/analytics/reconciliation');
  return res.data;
}
