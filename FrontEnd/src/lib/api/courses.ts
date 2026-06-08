import { axiosInstance } from "@/lib/api/axios";

export type Course = {
  id: number;
  title: string;
  description?: string;
  published: boolean;
  category?: string;
  instructor?: string;
  tags?: string[];
  thumbnail?: string;
  enrolledCount?: number;
  chaptersCount?: number;
};

export async function fetchCourses(params?: { page?: number; limit?: number; q?: string }) {
  const response = await axiosInstance.get<{ data: Course[]; total: number }>("/courses", { params });
  return response.data;
}

export async function createCourse(payload: Partial<Course>) {
  const response = await axiosInstance.post<Course>("/courses", payload);
  return response.data;
}

export async function updateCourse(payload: Partial<Course> & { id: number }) {
  const response = await axiosInstance.put<Course>(`/courses/${payload.id}`, payload);
  return response.data;
}

export async function deleteCourse(id: number) {
  const response = await axiosInstance.delete("/courses", { params: { id } });
  return response.data;
}
