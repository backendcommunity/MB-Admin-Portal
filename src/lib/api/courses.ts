import { axiosInstance } from '@/lib/api/axios';

/* ────────────────────────────── types ────────────────────────────── */

export type CourseStatus = 'PUBLISHED' | 'DRAFT' | 'WAITLIST' | 'ARCHIVED';
export type CourseType = 'VIDEO' | 'TEXT' | 'WORKSHOP';
export type ChapterType = 'MIXED' | 'VIDEO' | 'QUIZ' | 'PLAYGROUND' | 'EXERCISE';
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type Modality = 'CHAT' | 'AUDIO' | 'VIDEO';

export type Category = { id: string; name: string; color: string };

export type ReadinessFailure = { field: string; message: string };

export type CourseListRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  banner: string | null;
  type: CourseType;
  level: Level | null;
  category: Category | null;
  isPublic: boolean;
  isPremium: boolean;
  amount: number;
  isWaiting: boolean;
  archivedAt: string | null;
  status: CourseStatus;
  tags: string[];
  languages: string[];
  counts: { chapters: number; items: number; enrolled: number };
  totalDuration: number;
  createdAt: string;
  updatedAt: string;
  lastUpdated: string;
};

export type ChapterItem = {
  id: string;
  kind: 'video' | 'article' | 'quiz' | 'exercise';
  title: string;
  slug?: string;
  order?: number;
  isPremium?: boolean;
  refId?: string;
  meta?: string;
  required?: boolean;
  // video
  video?: string | null;
  duration?: string | number | null;
  summary?: string | null;
  description?: string | null;
  banner?: string | null;
  difficulty?: Level;
  day?: number;
  mb?: number;
  technologies?: string[];
  playgroundId?: string | null;
  // article
  content?: string;
  blocks?: unknown[];
  excerpt?: string | null;
  readingTime?: number;
  featured_image?: string | null;
  color?: string | null;
  tags?: string[];
  categories?: string[];
  is_public?: boolean;
  is_locked?: boolean;
  type?: string;
};

export type Chapter = {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  banner: string | null;
  slug: string;
  type: ChapterType;
  isPremium: boolean;
  order: number;
  vimeoFolderURI?: string | null;
  vimeoFolderId?: string | null;
  items: ChapterItem[];
};

export type CapstoneProject = { id: string; title: string; order: number; isOptional: boolean };
export type CapstoneMock = CapstoneProject & { type: Modality };

export type CapstoneAttachment = {
  id: string;
  title: string;
  order: number;
  isOptional: boolean;
  meta?: string;
};

export type CourseDetail = CourseListRow & {
  description: string | null;
  categoryId: string | null;
  preview: string | null;
  vimeoFolderURI: string | null;
  vimeoFolderId: string | null;
  waitingLink: string | null;
  productId: string | null;
  paddlePlanCode: number | null;
  paddle_price_id: string | null;
  createdById: string | null;
  chapters: Chapter[];
  capstone: {
    projects: CapstoneProject[];
    mockInterviews: CapstoneMock[];
    quizzes: CapstoneAttachment[];
    exercises: CapstoneAttachment[];
    videos: CapstoneAttachment[];
    articles: CapstoneAttachment[];
  };
  stats: { enrolled: number; completed: number; completionRate: number };
  readiness: ReadinessFailure[];
};

export type CourseListResponse = {
  data: CourseListRow[];
  total: number;
  page: number;
  limit: number;
};

export type CourseInput = Partial<{
  title: string;
  slug: string;
  summary: string;
  description: string;
  type: CourseType;
  categoryId: string | null;
  level: Level | null;
  tags: string[];
  languages: string[];
  isPremium: boolean;
  amount: number;
  paddlePlanCode: number | null;
  paddle_price_id: string | null;
  banner: string;
  preview: string | null;
  vimeoFolderURI: string | null;
  vimeoFolderId: string | null;
  isWaiting: boolean;
  waitingLink: string | null;
}>;

export type CourseListParams = {
  page?: number;
  limit?: number;
  q?: string;
  status?: CourseStatus;
  premium?: 'true' | 'false';
  level?: Level;
  categoryId?: string;
  language?: string;
  tag?: string;
  sort?: 'createdAt' | 'lastUpdated' | 'title' | 'amount' | 'enrolled';
  order?: 'asc' | 'desc';
};

export type Learner = {
  id: string;
  user: { id: string; name: string; email: string; avatar: string | null };
  isCompleted: boolean;
  completedAt: string | null;
  startedAt: string;
  lastActivityAt: string;
  completedItems: number;
};

/** A 422 from PATCH /status carries the full list of what is missing. */
export class NotReadyError extends Error {
  failures: ReadinessFailure[];
  constructor(message: string, failures: ReadinessFailure[]) {
    super(message);
    this.name = 'NotReadyError';
    this.failures = failures;
  }
}

const BASE = '/admin/courses';

/* ────────────────────────────── course record ────────────────────────────── */

export function buildCourseQuery(params: CourseListParams = {}): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `${BASE}?${qs}` : BASE;
}

export async function fetchCourses(params: CourseListParams = {}) {
  const { data } = await axiosInstance.get<CourseListResponse>(buildCourseQuery(params));
  return data;
}

export async function fetchCourse(id: string) {
  const { data } = await axiosInstance.get<CourseDetail>(`${BASE}/${id}`);
  return data;
}

export async function createCourse(payload: CourseInput) {
  const { data } = await axiosInstance.post<CourseListRow>(BASE, payload);
  return data;
}

export async function updateCourse(id: string, payload: CourseInput) {
  const { data } = await axiosInstance.put<CourseListRow>(`${BASE}/${id}`, payload);
  return data;
}

export async function setCourseStatus(
  id: string,
  action: 'publish' | 'unpublish' | 'archive' | 'restore',
) {
  try {
    const { data } = await axiosInstance.patch<CourseListRow>(`${BASE}/${id}/status`, { action });
    return data;
  } catch (error) {
    const response = (error as { response?: { status?: number; data?: unknown } }).response;
    const body = response?.data as { message?: string; failures?: ReadinessFailure[] } | undefined;
    if (response?.status === 422 && body?.failures) {
      throw new NotReadyError(body.message ?? 'Course is not ready to publish', body.failures);
    }
    throw error;
  }
}

export async function deleteCourse(id: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(`${BASE}/${id}`);
  return data;
}

export async function checkSlug(slug: string, excludeId?: string) {
  const search = new URLSearchParams({ slug });
  if (excludeId) search.set('excludeId', excludeId);
  const { data } = await axiosInstance.get<{
    slug: string;
    available: boolean;
    suggestion: string;
  }>(`${BASE}/slug-available?${search.toString()}`);
  return data;
}

export async function fetchLearners(id: string, page = 1, limit = 20) {
  const { data } = await axiosInstance.get<{
    data: Learner[];
    total: number;
    page: number;
    limit: number;
  }>(`${BASE}/${id}/learners?page=${page}&limit=${limit}`);
  return data;
}

/* ────────────────────────────── chapters ────────────────────────────── */

export type ChapterInput = Partial<{
  title: string;
  summary: string;
  description: string;
  banner: string | null;
  slug: string;
  type: ChapterType;
  isPremium: boolean;
  order: number;
  vimeoFolderURI: string | null;
  vimeoFolderId: string | null;
}>;

export async function createChapter(courseId: string, payload: ChapterInput) {
  const { data } = await axiosInstance.post<Chapter>(`${BASE}/${courseId}/chapters`, payload);
  return data;
}

export async function updateChapter(courseId: string, chapterId: string, payload: ChapterInput) {
  const { data } = await axiosInstance.put<Chapter>(
    `${BASE}/${courseId}/chapters/${chapterId}`,
    payload,
  );
  return data;
}

export async function deleteChapter(courseId: string, chapterId: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(
    `${BASE}/${courseId}/chapters/${chapterId}`,
  );
  return data;
}

export async function reorderChapters(courseId: string, orderedIds: string[]) {
  const { data } = await axiosInstance.patch<{ success: boolean }>(
    `${BASE}/${courseId}/chapters/reorder`,
    { orderedIds },
  );
  return data;
}

/* ────────────────────────────── videos & articles ────────────────────────────── */

export type VideoInput = Partial<{
  title: string;
  summary: string;
  description: string;
  slug: string;
  video: string;
  duration: number | string;
  banner: string | null;
  isPremium: boolean;
  order: number;
  day: number;
  mb: number;
  difficulty: Level;
  technologies: string[];
  type: string;
  playgroundId: string | null;
}>;

export type ArticleInput = Partial<{
  title: string;
  /** Prose fallback; `blocks` is the real body and wins when present. */
  content: string;
  blocks: unknown[];
  excerpt: string;
  slug: string;
  featured_image: string | null;
  color: string | null;
  type: string;
  tags: string[];
  categories: string[];
  readingTime: number;
  isPremium: boolean;
  is_public: boolean;
  is_locked: boolean;
  order: number;
}>;

export async function createVideo(courseId: string, chapterId: string, payload: VideoInput) {
  const { data } = await axiosInstance.post(
    `${BASE}/${courseId}/chapters/${chapterId}/videos`,
    payload,
  );
  return data;
}

export async function updateVideo(
  courseId: string,
  chapterId: string,
  videoId: string,
  payload: VideoInput,
) {
  const { data } = await axiosInstance.put(
    `${BASE}/${courseId}/chapters/${chapterId}/videos/${videoId}`,
    payload,
  );
  return data;
}

export async function deleteVideo(courseId: string, chapterId: string, videoId: string) {
  const { data } = await axiosInstance.delete(
    `${BASE}/${courseId}/chapters/${chapterId}/videos/${videoId}`,
  );
  return data;
}

export async function createArticle(courseId: string, chapterId: string, payload: ArticleInput) {
  const { data } = await axiosInstance.post(
    `${BASE}/${courseId}/chapters/${chapterId}/articles`,
    payload,
  );
  return data;
}

export async function updateArticle(
  courseId: string,
  chapterId: string,
  articleId: string,
  payload: ArticleInput,
) {
  const { data } = await axiosInstance.put(
    `${BASE}/${courseId}/chapters/${chapterId}/articles/${articleId}`,
    payload,
  );
  return data;
}

export async function deleteArticle(courseId: string, chapterId: string, articleId: string) {
  const { data } = await axiosInstance.delete(
    `${BASE}/${courseId}/chapters/${chapterId}/articles/${articleId}`,
  );
  return data;
}

/** One sequence across both tables — the builder shows a merged list. */
export async function reorderChapterItems(
  courseId: string,
  chapterId: string,
  orderedIds: string[],
) {
  const { data } = await axiosInstance.patch(
    `${BASE}/${courseId}/chapters/${chapterId}/items/reorder`,
    { orderedIds },
  );
  return data;
}

/* ────────────────────────────── attachments ────────────────────────────── */

export async function attachQuiz(
  courseId: string,
  payload: {
    quizId: string;
    /** Omit to attach at course level — that is what puts it in the capstone. */
    chapterId?: string;
    videoId?: string;
    required?: boolean;
    order?: number;
  },
) {
  const { data } = await axiosInstance.post(`${BASE}/${courseId}/quizzes`, payload);
  return data;
}

/** `scope: 'course'` drops only the capstone link, leaving chapter links attached. */
export async function detachQuiz(courseId: string, quizId: string, scope?: 'course') {
  const { data } = await axiosInstance.delete(
    `${BASE}/${courseId}/quizzes/${quizId}${scope ? `?scope=${scope}` : ''}`,
  );
  return data;
}

export async function attachExercise(
  courseId: string,
  payload: {
    exerciseId: string;
    /** Omit to attach at course level — that is what puts it in the capstone. */
    chapterId?: string;
    videoId?: string;
    required?: boolean;
    order?: number;
  },
) {
  const { data } = await axiosInstance.post(`${BASE}/${courseId}/exercises`, payload);
  return data;
}

export async function detachExercise(courseId: string, exerciseId: string, scope?: 'course') {
  const { data } = await axiosInstance.delete(
    `${BASE}/${courseId}/exercises/${exerciseId}${scope ? `?scope=${scope}` : ''}`,
  );
  return data;
}

export async function attachProject(
  courseId: string,
  payload: { projectId: string; order?: number; isOptional?: boolean },
) {
  const { data } = await axiosInstance.post(`${BASE}/${courseId}/projects`, payload);
  return data;
}

export async function updateProjectLink(
  courseId: string,
  projectId: string,
  payload: { order?: number; isOptional?: boolean },
) {
  const { data } = await axiosInstance.put(`${BASE}/${courseId}/projects/${projectId}`, payload);
  return data;
}

export async function detachProject(courseId: string, projectId: string) {
  const { data } = await axiosInstance.delete(`${BASE}/${courseId}/projects/${projectId}`);
  return data;
}

export async function attachMockInterview(
  courseId: string,
  payload: { mockInterviewId: string; order?: number; isOptional?: boolean; type?: Modality },
) {
  const { data } = await axiosInstance.post(`${BASE}/${courseId}/mock-interviews`, payload);
  return data;
}

export async function updateMockLink(
  courseId: string,
  mockInterviewId: string,
  payload: { order?: number; isOptional?: boolean; type?: Modality },
) {
  const { data } = await axiosInstance.put(
    `${BASE}/${courseId}/mock-interviews/${mockInterviewId}`,
    payload,
  );
  return data;
}

export async function detachMockInterview(courseId: string, mockInterviewId: string) {
  const { data } = await axiosInstance.delete(
    `${BASE}/${courseId}/mock-interviews/${mockInterviewId}`,
  );
  return data;
}

export async function reorderCapstone(
  courseId: string,
  ordered: Array<{
    kind: 'project' | 'mock' | 'quiz' | 'exercise' | 'video' | 'article';
    id: string;
    order: number;
  }>,
) {
  const { data } = await axiosInstance.patch(`${BASE}/${courseId}/capstone/reorder`, { ordered });
  return data;
}

/* ────────────────────────────── supporting ────────────────────────────── */

export async function fetchCategories() {
  const { data } = await axiosInstance.get<{ data: Category[] }>('/admin/categories');
  return data.data;
}

export async function createCategory(name: string, color = '#13aece') {
  const { data } = await axiosInstance.post<Category>('/admin/categories', { name, color });
  return data;
}

export type UploadScope = 'course-banner' | 'course-preview' | 'chapter-banner' | 'article-image';

/**
 * Uploads through the API rather than straight to R2.
 *
 * A presigned PUT was tried and dropped: R2 does not enforce the signed
 * `Content-Type`, so the browser could choose what the object is served as — an
 * HTML body came back as a page from the media domain. The API decides the type
 * from the file's own bytes instead. Going through the proxy also sidesteps the
 * bucket CORS a direct browser PUT would need.
 */
export async function uploadImage(file: File, scope: UploadScope, ownerId: string) {
  const search = new URLSearchParams({ scope, id: ownerId });
  const { data } = await axiosInstance.post<{
    success: boolean;
    data: { publicUrl: string; key: string; contentType: string; bytes: number };
  }>(`/admin/uploads?${search.toString()}`, file, {
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  return data.data.publicUrl;
}

/* ────────────────────────────── reusing existing content ────────────────────────────── */

export type LibraryKind = 'quiz' | 'exercise' | 'video' | 'article' | 'chapter';

export type LibraryRow = {
  id: string;
  kind: LibraryKind;
  title: string;
  meta: string;
  context: string | null;
  /**
   * "attach" joins this course to the same row — detaching later leaves it alone.
   * "copy" duplicates it, because the row belongs to exactly one parent.
   */
  reuse: 'attach' | 'copy';
};

export async function searchLibrary(params: {
  kind: LibraryKind;
  q?: string;
  page?: number;
  limit?: number;
  excludeCourseId?: string;
}) {
  const search = new URLSearchParams({ kind: params.kind });
  if (params.q) search.set('q', params.q);
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.excludeCourseId) search.set('excludeCourseId', params.excludeCourseId);

  const { data } = await axiosInstance.get<{
    data: LibraryRow[];
    total: number;
    page: number;
    limit: number;
  }>(`/admin/library?${search.toString()}`);
  return data;
}

/** Duplicates a chapter from another course, with or without its content. */
export async function copyChapter(courseId: string, sourceChapterId: string, includeItems = true) {
  const { data } = await axiosInstance.post<Chapter & { copiedItems: number }>(
    `${BASE}/${courseId}/chapters/copy`,
    { sourceChapterId, includeItems },
  );
  return data;
}

/** Duplicates one video or article into this chapter. */
export async function copyItem(
  courseId: string,
  chapterId: string,
  kind: 'video' | 'article',
  sourceId: string,
) {
  const { data } = await axiosInstance.post(
    `${BASE}/${courseId}/chapters/${chapterId}/items/copy`,
    { kind, sourceId },
  );
  return data;
}

/**
 * Capstone media. Send `id` to attach one that exists, or `create` to author a new
 * one — the API keeps it in a hidden holder chapter, because Video.chapterId and
 * Article.chapterId are required and the capstone is not a chapter.
 */
export async function addCapstoneMedia(
  courseId: string,
  kind: 'video' | 'article',
  payload: { id?: string; create?: VideoInput | ArticleInput; isOptional?: boolean },
) {
  const { data } = await axiosInstance.post(`${BASE}/${courseId}/capstone/${kind}s`, payload);
  return data;
}

export async function removeCapstoneMedia(
  courseId: string,
  kind: 'video' | 'article',
  itemId: string,
) {
  const { data } = await axiosInstance.delete(`${BASE}/${courseId}/capstone/${kind}s/${itemId}`);
  return data;
}
