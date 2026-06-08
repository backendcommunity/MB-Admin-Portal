import { axiosInstance } from "@/lib/api/axios";

export type Bootcamp = { id: number; name: string; location?: string; active: boolean };

export async function fetchBootcamps(params?: { q?: string }) {
  const response = await axiosInstance.get<{ data: Bootcamp[]; total: number }>("/bootcamps", { params });
  return response.data;
}

export async function createBootcamp(payload: Partial<Bootcamp>) {
  const response = await axiosInstance.post<Bootcamp>("/bootcamps", payload);
  return response.data;
}

export async function updateBootcamp(payload: Partial<Bootcamp> & { id: number }) {
  const response = await axiosInstance.put<Bootcamp>(`/bootcamps/${payload.id}`, payload);
  return response.data;
}

export async function deleteBootcamp(id: number) {
  const response = await axiosInstance.delete("/bootcamps", { params: { id } });
  return response.data;
}
