import { axiosInstance } from "@/lib/api/axios";

export type ApprovalType = "COURSE" | "PROJECT" | "ROADMAP" | "OFFER" | "SOLUTION";

export type ApprovalItem = {
  id: string;
  type: ApprovalType;
  title: string;
  status: string;
  submittedAt: string;
  updatedAt: string;
  feedback?: string;
  submittedBy?: string;
};

export type ApprovalsResponse = {
  data: ApprovalItem[];
  total: number;
  page: number;
  limit: number;
  counts?: Record<string, number>;
};

export async function fetchApprovals(params?: Record<string, unknown>) {
  const response = await axiosInstance.get<ApprovalsResponse>("/admin/approvals", { params });
  return response.data;
}

export async function approvalAction(payload: {
  type: ApprovalType;
  id: string;
  action: "approve" | "reject" | "request-changes";
  feedback?: string;
}) {
  const response = await axiosInstance.patch<{ success: boolean }>(
    `/admin/approvals/${payload.type}/${payload.id}/${payload.action}`,
    { feedback: payload.feedback }
  );
  return response.data;
}
