import { axiosInstance } from "./axios";

export interface MockInterviewTemplate {
  id: string;
  name: string;
  company?: string | null;
  position?: string | null;
  seniority?: string | null;
  description?: string | null;
  duration: number;
  questions?: number | null;
  difficulty: "Easy" | "Medium" | "Hard";
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTemplates {
  data: MockInterviewTemplate[];
  total: number;
  page: number;
  limit: number;
}

export async function getTemplates(params?: { page?: number; limit?: number; q?: string }): Promise<PaginatedTemplates> {
  const { data } = await axiosInstance.get("/admin/mock-interview-templates", { params });
  return data;
}

export async function createTemplate(payload: Partial<MockInterviewTemplate>): Promise<MockInterviewTemplate> {
  const { data } = await axiosInstance.post("/admin/mock-interview-templates", payload);
  return data.data;
}

export async function updateTemplate(id: string, payload: Partial<MockInterviewTemplate>): Promise<MockInterviewTemplate> {
  const { data } = await axiosInstance.put(`/admin/mock-interview-templates/${id}`, payload);
  return data.data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await axiosInstance.delete(`/admin/mock-interview-templates/${id}`);
}
