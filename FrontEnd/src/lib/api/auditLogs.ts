import { axiosInstance } from "./axios";

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "SUSPEND" | "RESTORE" | "CANCEL" | "GRANT";
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface GetAuditLogsParams {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  adminId?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface PaginatedAuditLogs {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export async function getAuditLogs(params?: GetAuditLogsParams): Promise<PaginatedAuditLogs> {
  const { data } = await axiosInstance.get("/admin/audit-logs", { params });
  return data;
}

export async function getAuditLog(id: string): Promise<AuditLog> {
  const { data } = await axiosInstance.get(`/admin/audit-logs/${id}`);
  return data;
}
