import { axiosInstance } from "@/lib/api/axios";

export type ProjectStatus = "DRAFT" | "PUBLISHED";

export type Project = {
  id: string;
  title: string;
  description?: string;
  difficulty?: string;
  status: ProjectStatus;
  tags: string[];
  githubUrl?: string;
  liveUrl?: string;
  thumbnail?: string;
  submissionsCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectsListResponse = {
  data: Project[];
  total: number;
  page?: number;
  limit?: number;
};

export async function createProject(payload: Partial<Project>) {
  const response = await axiosInstance.post<Project>("/admin/projects", payload);
  return response.data;
}

export async function updateProject(payload: Partial<Project> & { id: string }) {
  const response = await axiosInstance.put<Project>(`/admin/projects/${payload.id}`, payload);
  return response.data;
}

export async function deleteProject(id: string) {
  const response = await axiosInstance.delete<{ success: boolean }>(`/admin/projects/${id}`);
  return response.data;
}

export async function fetchProjectSubmissions(id: string) {
  const response = await axiosInstance.get<{ data: Array<{ id: string; userName: string; userEmail: string; status: string; submittedAt: string }>; total: number }>(
    `/admin/projects/${id}/submissions`
  );
  return response.data;
}
