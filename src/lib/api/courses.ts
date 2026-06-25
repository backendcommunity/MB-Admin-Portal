import { axiosInstance } from "@/lib/api/axios";

export type Course = {
  id: string;
  title: string;
  description?: string;
  status?: string;
  published: boolean;
  category?: string;
  instructor?: string;
  tags?: string[];
  thumbnail?: string;
  enrolledCount?: number;
  chaptersCount?: number;
};

export type CoursesListResponse = {
  data: Course[];
  total: number;
  page?: number;
  limit?: number;
};

export type Chapter = {
  id: string;
  title: string;
  type: "video" | "article";
  published: boolean;
  videoId?: string;
  content?: string;
};

export async function fetchCourses(params?: {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  sort?: string;
  order?: string;
}) {
  const response = await axiosInstance.get<CoursesListResponse>("/admin/courses", { params });
  return response.data;
}

export async function createCourse(payload: Partial<Course>) {
  const response = await axiosInstance.post<Course>("/admin/courses", payload);
  return response.data;
}

export async function updateCourse(payload: Partial<Course> & { id: string }) {
  const response = await axiosInstance.put<Course>(`/admin/courses/${payload.id}`, payload);
  return response.data;
}

export async function deleteCourse(id: string) {
  const response = await axiosInstance.delete<{ success: boolean }>(`/admin/courses/${id}`);
  return response.data;
}

export async function fetchCourseById(id: string) {
  const response = await axiosInstance.get<Course>(`/admin/courses/${id}`);
  return response.data;
}

export async function fetchCourseChapters(id: string) {
  const response = await axiosInstance.get<{ data: Chapter[] }>(`/admin/courses/${id}/chapters`);
  return response.data;
}

export async function createCourseChapter(
  id: string,
  payload: Pick<Chapter, "title" | "type"> & Partial<Pick<Chapter, "videoId" | "content">>
) {
  const response = await axiosInstance.post<Chapter>(`/admin/courses/${id}/chapters`, payload);
  return response.data;
}

export async function updateCourseChapter(
  id: string,
  payload: Partial<Chapter> & { chapterId: string }
) {
  const response = await axiosInstance.put<Chapter>(`/admin/courses/${id}/chapters`, payload);
  return response.data;
}

export async function reorderCourseChapters(id: string, orderedIds: string[]) {
  const response = await axiosInstance.patch<{ data: Chapter[] }>(`/admin/courses/${id}/chapters`, {
    action: "reorder",
    orderedIds,
  });
  return response.data;
}

export async function deleteCourseChapter(id: string, chapterId: string) {
  const response = await axiosInstance.delete<{ success: boolean }>(`/admin/courses/${id}/chapters`, {
    params: { chapterId },
  });
  return response.data;
}
