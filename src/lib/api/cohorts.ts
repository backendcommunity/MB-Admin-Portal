import { axiosInstance } from "@/lib/api/axios";

export type Cohort = {
  id: string;
  bootcampId: string;
  name: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
  memberCount?: number;
  weekCount?: number;
};

export type CohortMember = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type CohortLesson = {
  id: string;
  title: string;
  type: "video" | "live" | "assignment";
  status: "pending" | "reviewed" | "approved";
};

export type CohortWeek = {
  id: string;
  title: string;
  lessons: CohortLesson[];
};

export type CohortDetail = Cohort & {
  size?: number;
  members: CohortMember[];
  weeks: CohortWeek[];
};

export type CohortsListResponse = {
  data: Cohort[];
  total: number;
};

export async function fetchCohorts(params?: {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  sort?: string;
  order?: string;
  bootcampId?: string;
}) {
  const bootcampId = params?.bootcampId;
  if (!bootcampId) {
    throw new Error("bootcampId is required to fetch cohorts");
  }

  const { bootcampId: _bootcampId, ...queryParams } = params;
  const response = await axiosInstance.get<CohortsListResponse>(`/admin/bootcamps/${bootcampId}/cohorts`, {
    params: queryParams,
  });
  return response.data;
}

export async function createCohort(payload: Partial<Cohort>) {
  if (!payload.bootcampId) {
    throw new Error("bootcampId is required to create cohort");
  }
  const response = await axiosInstance.post<Cohort>(`/admin/bootcamps/${payload.bootcampId}/cohorts`, payload);
  return response.data;
}

export async function updateCohort(payload: Partial<Cohort> & { id: string }) {
  const response = await axiosInstance.put<Cohort>("/cohorts", payload);
  return response.data;
}

export async function deleteCohort(id: string) {
  const response = await axiosInstance.delete<{ success: boolean }>(`/cohorts/${id}`);
  return response.data;
}

export async function fetchCohortById(id: string) {
  const response = await axiosInstance.get<CohortDetail>(`/cohorts/${id}`);
  return response.data;
}

export async function fetchCohortMembers(id: string) {
  const response = await axiosInstance.get<{ data: CohortMember[] }>(`/cohorts/${id}/members`);
  return response.data;
}

export async function enrollCohortMember(id: string, email: string) {
  const response = await axiosInstance.post<CohortMember>(`/cohorts/${id}/members`, { email });
  return response.data;
}

export async function removeCohortMember(id: string, memberId: string) {
  const response = await axiosInstance.delete<{ success: boolean }>(`/cohorts/${id}/members`, {
    params: { memberId },
  });
  return response.data;
}

export async function fetchCohortCurriculum(id: string) {
  const response = await axiosInstance.get<{ data: CohortWeek[] }>(`/cohorts/${id}/curriculum`);
  return response.data;
}

export async function addCohortWeek(id: string, title: string) {
  const response = await axiosInstance.post<CohortWeek>(`/cohorts/${id}/curriculum`, {
    action: "week",
    title,
  });
  return response.data;
}

export async function addCohortLesson(
  id: string,
  payload: { weekId: string; title: string; type: CohortLesson["type"] }
) {
  const response = await axiosInstance.post<CohortLesson>(`/cohorts/${id}/curriculum`, {
    action: "lesson",
    ...payload,
  });
  return response.data;
}

export async function reorderCohortWeeks(id: string, orderedIds: string[]) {
  const response = await axiosInstance.patch<{ data: CohortWeek[] }>(`/cohorts/${id}/curriculum`, {
    action: "reorder-weeks",
    orderedIds,
  });
  return response.data;
}

export async function reorderCohortLessons(
  id: string,
  payload: { weekId: string; orderedIds: string[] }
) {
  const response = await axiosInstance.patch<{ data: CohortLesson[] }>(`/cohorts/${id}/curriculum`, {
    action: "reorder-lessons",
    ...payload,
  });
  return response.data;
}

export async function updateCohortLessonStatus(
  id: string,
  payload: { weekId: string; lessonId: string; status: CohortLesson["status"] }
) {
  const response = await axiosInstance.put<CohortLesson>(`/cohorts/${id}/curriculum`, {
    action: "lesson",
    ...payload,
  });
  return response.data;
}

export async function removeCohortWeek(id: string, weekId: string) {
  const response = await axiosInstance.delete<{ success: boolean }>(`/cohorts/${id}/curriculum`, {
    params: { action: "week", weekId },
  });
  return response.data;
}

export async function removeCohortLesson(
  id: string,
  payload: { weekId: string; lessonId: string }
) {
  const response = await axiosInstance.delete<{ success: boolean }>(`/cohorts/${id}/curriculum`, {
    params: { action: "lesson", weekId: payload.weekId, lessonId: payload.lessonId },
  });
  return response.data;
}
