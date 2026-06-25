import { axiosInstance } from "@/lib/api/axios";

export type MyContentItem = {
  id: string;
  type: "COURSE" | "PROJECT" | "ROADMAP";
  title: string;
  difficulty: string;
  status: string;
  progress: number;
  submittedAt: string;
  updatedAt: string;
  feedback?: string;
};

export type MyContentResponse = {
  data: {
    courses: MyContentItem[];
    projects: MyContentItem[];
    roadmaps: MyContentItem[];
  };
};

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

export async function fetchMyContent() {
  const response = await axiosInstance.get<MyContentResponse>("/instructor/my-content");
  return response.data;
}

export async function submitMyContentForReview(payload: {
  type: "COURSE" | "PROJECT" | "ROADMAP";
  id: string;
  notes?: string;
}) {
  const response = await axiosInstance.post<{ success: boolean }>(
    `/instructor/my-content/${payload.type}/${payload.id}/submit`,
    { notes: payload.notes }
  );
  return response.data;
}

export async function createInstructorContent(payload: {
  type: string;
  title: string;
  description: string;
}) {
  const response = await axiosInstance.post<{ success: boolean; id: string }>(
    `/instructor/my-content`,
    payload
  );
  return response.data;
}

export async function fetchEarningsSummary() {
  const response = await axiosInstance.get<{ data: EarningsSummary }>("/instructor/earnings/summary");
  return response.data.data;
}

export async function fetchEarningsBreakdown(params?: { months?: number }) {
  const response = await axiosInstance.get<{ data: EarningsBreakdownItem[] }>("/instructor/earnings/breakdown", { params });
  return response.data.data;
}

export async function fetchPayoutHistory(params?: { page?: number; limit?: number }) {
  const response = await axiosInstance.get<{ data: PayoutItem[]; total: number; page: number; limit: number }>(
    "/instructor/earnings/payouts",
    { params }
  );
  return response.data;
}
