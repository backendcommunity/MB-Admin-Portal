import { axiosInstance } from './axios';

export type CertificateImportRow = {
  id: string;
  name: string;
  email: string;
  status: 'QUEUED' | 'ISSUED' | 'SKIPPED' | 'FAILED';
  isNewUser: boolean;
  certCode: string | null;
  error: string | null;
};

export type CertificateImport = {
  id: string;
  courseId: string;
  filename: string;
  totalRows: number;
  newUsers: number;
  existingUsers: number;
  issued: number;
  skipped: number;
  failed: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
};

export type CertificateImportDetail = CertificateImport & { rows: CertificateImportRow[] };

export type CreateImportPayload = {
  courseId: string;
  filename: string;
  rows: { name: string; email: string }[];
};

export async function createCertificateImport(payload: CreateImportPayload) {
  const res = await axiosInstance.post<{
    success: boolean;
    data: { importId: string; queued: number; skippedInvalid: number };
  }>('/admin/certificate-imports', payload);
  return res.data.data;
}

export async function fetchCertificateImports(params?: { page?: number; limit?: number }) {
  const res = await axiosInstance.get<{ data: CertificateImport[]; total: number }>(
    '/admin/certificate-imports',
    { params },
  );
  return res.data;
}

export async function fetchCertificateImport(id: string) {
  const res = await axiosInstance.get<{ success: boolean; data: CertificateImportDetail }>(
    `/admin/certificate-imports/${id}`,
  );
  return res.data.data;
}

export async function retryCertificateImport(id: string) {
  const res = await axiosInstance.post<{ success: boolean; data: { requeued: number } }>(
    `/admin/certificate-imports/${id}/retry`,
  );
  return res.data.data;
}
