import { axiosInstance } from "@/lib/api/axios";

export type Bootcamp = { id: string; name: string; location?: string; active: boolean };

export async function fetchBootcamps(params?: {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
  sort?: string;
  order?: string;
}) {
  const response = await axiosInstance.get<{ data: Bootcamp[]; total: number }>("/admin/bootcamps", { params });
  return response.data;
}

export async function createBootcamp(payload: Partial<Bootcamp>) {
  const response = await axiosInstance.post<Bootcamp>("/admin/bootcamps", payload);
  return response.data;
}

export async function updateBootcamp(payload: Partial<Bootcamp> & { id: string }) {
  const response = await axiosInstance.put<Bootcamp>(`/admin/bootcamps/${payload.id}`, payload);
  return response.data;
}

export async function deleteBootcamp(id: string) {
  const response = await axiosInstance.delete<{ success: boolean }>(`/admin/bootcamps/${id}`);
  return response.data;
}
