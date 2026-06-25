import { axiosInstance } from "@/lib/api/axios";

export type RoadmapStatus = "DRAFT" | "PUBLISHED";

export type Roadmap = {
  id: string;
  title: string;
  description?: string;
  difficulty?: string;
  status: RoadmapStatus;
  thumbnail?: string;
  estimatedWeeks?: number;
  hoursPerWeek?: number;
  tags: string[];
  topicsCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type RoadmapTopic = {
  id: string;
  title: string;
  description?: string;
  order: number;
  courseLinks: Array<{ courseId: string; title: string }>;
};

export type RoadmapsListResponse = {
  data: Roadmap[];
  total: number;
  page?: number;
  limit?: number;
};

export async function createRoadmap(payload: Partial<Roadmap>) {
  const response = await axiosInstance.post<Roadmap>("/admin/roadmaps", payload);
  return response.data;
}

export async function updateRoadmap(payload: Partial<Roadmap> & { id: string }) {
  const response = await axiosInstance.put<Roadmap>(`/admin/roadmaps/${payload.id}`, payload);
  return response.data;
}

export async function deleteRoadmap(id: string) {
  const response = await axiosInstance.delete<{ success: boolean }>(`/admin/roadmaps/${id}`);
  return response.data;
}

export async function fetchRoadmapTopics(roadmapId: string) {
  const response = await axiosInstance.get<{ data: RoadmapTopic[]; total: number }>(`/admin/roadmaps/${roadmapId}/topics`);
  return response.data;
}

export async function addRoadmapTopic(roadmapId: string, payload: { title: string; description?: string }) {
  const response = await axiosInstance.post<RoadmapTopic>(`/admin/roadmaps/${roadmapId}/topics`, payload);
  return response.data;
}

export async function reorderRoadmapTopics(roadmapId: string, topicIds: string[]) {
  const response = await axiosInstance.patch<{ success: boolean }>(`/admin/roadmaps/${roadmapId}/topics/reorder`, { topicIds });
  return response.data;
}

export async function linkCourseToRoadmapTopic(roadmapId: string, topicId: string, courseId: string) {
  const response = await axiosInstance.post<{ success: boolean }>(`/admin/roadmaps/${roadmapId}/topics/${topicId}/courses`, { courseId });
  return response.data;
}

export async function unlinkCourseFromRoadmapTopic(roadmapId: string, topicId: string, courseId: string) {
  const response = await axiosInstance.delete<{ success: boolean }>(`/admin/roadmaps/${roadmapId}/topics/${topicId}/courses/${courseId}`);
  return response.data;
}
