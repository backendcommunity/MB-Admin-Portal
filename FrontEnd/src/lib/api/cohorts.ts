import { axiosInstance } from "@/lib/api/axios";

export type Cohort = {
  id: number;
  bootcampId: number;
  name: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
};

export async function fetchCohorts(params?: { bootcampId?: number }) {
  const response = await axiosInstance.get<{ data: Cohort[]; total: number }>("/cohorts", { params });
  return response.data;
}

export async function createCohort(payload: Partial<Cohort>) {
  const response = await axiosInstance.post<Cohort>("/cohorts", payload);
  return response.data;
}

export async function updateCohort(payload: Partial<Cohort> & { id: number }) {
  const response = await axiosInstance.put<Cohort>("/cohorts", payload);
  return response.data;
}

export async function deleteCohort(id: number) {
  const response = await axiosInstance.delete("/cohorts", { params: { id } });
  return response.data;
}
