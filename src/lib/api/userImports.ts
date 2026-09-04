import { axiosInstance } from '@/lib/api/axios';

/**
 * The admin bulk user-import surface. See `academy`'s
 * `src/modules/admin/user-imports/controller.ts` for the server contract.
 *
 * `createUserImport` never sends a `nameWasDerived` flag or a video URL — the
 * server derives the name for any row that arrives without one, and the
 * activation-video URL and poster are server-side constants. The client only
 * ever says whether to include the video, never where it points.
 */

export const USER_IMPORT_ROW_STATUSES = [
  'QUEUED',
  'CREATED',
  'ALREADY_REGISTERED',
  'SKIPPED',
  'FAILED',
] as const;
export type UserImportRowStatus = (typeof USER_IMPORT_ROW_STATUSES)[number];

export const USER_IMPORT_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
export type UserImportStatus = (typeof USER_IMPORT_STATUSES)[number];

export type UserImportRow = {
  id: string;
  importId: string;
  name: string;
  email: string;
  nameWasDerived: boolean;
  status: UserImportRowStatus;
  error: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserImport = {
  id: string;
  uploadedById: string;
  filename: string;
  includeActivationVideo: boolean;
  totalRows: number;
  created: number;
  alreadyRegistered: number;
  skipped: number;
  failed: number;
  status: UserImportStatus;
  createdAt: string;
  updatedAt: string;
};

export type UserImportDetail = UserImport & { rows: UserImportRow[] };

export type CreateUserImportPayload = {
  filename: string;
  includeActivationVideo?: boolean;
  rows: Array<{ name?: string; email: string }>;
};

export async function createUserImport(payload: CreateUserImportPayload) {
  const { data } = await axiosInstance.post<{
    success: boolean;
    id: string;
    totalRows: number;
    queued: number;
    enqueueFailed: number;
  }>('/admin/user-imports', payload);
  return data;
}

export async function fetchUserImports(params?: { page?: number; limit?: number }) {
  const { data } = await axiosInstance.get<{
    success: boolean;
    data: UserImport[];
    total: number;
    page: number;
    limit: number;
  }>('/admin/user-imports', { params });
  return data;
}

export async function fetchUserImport(id: string) {
  const { data } = await axiosInstance.get<{ success: boolean; data: UserImportDetail }>(
    `/admin/user-imports/${id}`,
  );
  return data.data;
}

export async function retryUserImport(id: string) {
  const { data } = await axiosInstance.post<{
    success: boolean;
    data: { requeued: number; stillFailed: number };
  }>(`/admin/user-imports/${id}/retry`);
  return data.data;
}
