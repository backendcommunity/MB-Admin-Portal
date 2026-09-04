import { axiosInstance } from '@/lib/api/axios';

/**
 * The admin project surface.
 *
 * A project is three stacked things: the brief, the playground it runs in, and
 * a curriculum of ProjectTasks holding graded Tasks. The playground mode decides
 * which grading contract a task carries — `apiSpec` for rest-api, `terminalSpec`
 * for terminal, neither for frontend — so mode is the field everything else
 * hangs off.
 */

export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
export const MODES = ['rest-api', 'frontend', 'terminal'] as const;
export const PLAYGROUND_LANGUAGES = ['node', 'python'] as const;
export const TASK_TYPES = ['TASK', 'QUIZ', 'ACTIVITY', 'EXERCISE'] as const;
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export const ASSERTION_KINDS = ['status', 'jsonPath', 'bodySubset', 'header', 'shape'] as const;
export const SOLUTION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export type Level = (typeof LEVELS)[number];
export type Mode = (typeof MODES)[number];
export type TaskType = (typeof TASK_TYPES)[number];
export type HttpMethod = (typeof HTTP_METHODS)[number];
export type AssertionKind = (typeof ASSERTION_KINDS)[number];
export type SolutionStatus = (typeof SOLUTION_STATUSES)[number];

/** Only these three task types can carry a link to existing content. */
export const TASK_LINK_KINDS = {
  videoId: 'video',
  articleId: 'article',
  chapterId: 'chapter',
} as const;

// ── the grading contract ────────────────────────────────────────────────────

/**
 * The five kinds `endpoint-prober.ts` evaluates. Anything else is ignored at
 * grade time, which reads as a test that never fails.
 */
export type Assertion =
  | { kind: 'status'; equals: number }
  | { kind: 'jsonPath'; path: string; equals?: unknown; exists?: boolean; type?: string }
  | { kind: 'bodySubset'; subset: unknown }
  | { kind: 'header'; name: string; equals?: string; matches?: string }
  | { kind: 'shape'; path: string; shape: unknown; minItems?: number };

export type ApiSpec = {
  method: HttpMethod;
  /** A path on the learner's server, so it begins with "/". */
  url: string;
  request?: {
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  };
  /** An empty `assertions` list passes whatever the learner wrote. */
  response: { status?: number; assertions: Assertion[] };
};

export type TerminalSpec = { stdin: string[]; expectedOutput: string };

// ── types ───────────────────────────────────────────────────────────────────

export type Task = {
  id: string;
  projectTaskId: string;
  title: string;
  description: string;
  slug: string;
  type: TaskType;
  required: boolean;
  isPremium: boolean;
  mb: number;
  order: number;
  answer: string;
  questions: Array<Record<string, unknown>>;
  apiSpec: ApiSpec | null;
  terminalSpec: TerminalSpec | null;
  videoId: string;
  articleId: string;
  chapterId: string;
  videoTitle: string;
  articleTitle: string;
  chapterTitle: string;
};

export type ProjectTask = {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  summary: string;
  banner: string;
  isPremium: boolean;
  order: number;
  tasks: Task[];
};

export type Project = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  banner: string;
  level: string;
  duration: number;
  skills: string[];
  technologies: string[];
  prerequisites: string[];
  industries: string[];
  languages: string[];
  isPremium: boolean;
  amount: number;
  isSample: boolean;
  /** The whole publish state, and it defaults to true. */
  isWaiting: boolean;
  status: 'draft' | 'published';
  waitingLink: string;
  baseRepository: string;
  frontendURL: string;
  referenceApiURL: string;
  PRDLink: string;
  playgroundConfig: Record<string, unknown> | null;
  mode: Mode;
  language: string;
  entrypoint: string;
  terminalJail: boolean;
  showPreviewOnLoad: boolean;
  projectTaskCount?: number;
  learnerCount?: number;
  solutionCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectDetail = Project & { projectTasks: ProjectTask[] };

export type Learner = {
  id: string;
  userId: string;
  name: string;
  email: string;
  cloned: boolean;
  serverId: string;
  serverUrl: string;
  serverStatus: string;
  done: number;
  total: number;
  isCompleted: boolean;
  startedAt: string;
  completedAt: string | null;
};

export type Solution = {
  id: string;
  userId: string;
  name: string;
  email: string;
  title: string;
  repository: string;
  baseURL: string;
  docsURL: string;
  isPublic: boolean;
  tools: string[];
  /** The learner's own account of the work — the substance of a submission. */
  challenges: string;
  achievements: string;
  feedback: string;
  status: SolutionStatus;
  score: number;
  submittedAt: string;
};

export type Paged<T> = { data: T[]; total: number; page: number; limit: number };

export type ProjectInput = Partial<
  Omit<
    Project,
    | 'id'
    | 'status'
    | 'mode'
    | 'language'
    | 'entrypoint'
    | 'terminalJail'
    | 'showPreviewOnLoad'
    | 'projectTaskCount'
    | 'learnerCount'
    | 'solutionCount'
    | 'createdAt'
    | 'updatedAt'
  >
>;

// ── projects ────────────────────────────────────────────────────────────────

export async function fetchProjects(params?: {
  q?: string;
  level?: string;
  status?: string;
  mode?: string;
  page?: number;
  limit?: number;
}) {
  const { data } = await axiosInstance.get<Paged<Project>>('/admin/projects', { params });
  return data;
}

export async function fetchProject(id: string) {
  const { data } = await axiosInstance.get<ProjectDetail>(`/admin/projects/${id}`);
  return data;
}

export async function slugAvailable(slug: string, exclude?: string) {
  const { data } = await axiosInstance.get<{ available: boolean }>(
    '/admin/projects/slug-available',
    { params: { slug, ...(exclude ? { exclude } : {}) } },
  );
  return data.available;
}

export async function createProject(payload: ProjectInput) {
  const { data } = await axiosInstance.post<Project>('/admin/projects', payload);
  return data;
}

export async function updateProject(id: string, payload: ProjectInput) {
  const { data } = await axiosInstance.patch<Project>(`/admin/projects/${id}`, payload);
  return data;
}

export async function deleteProject(id: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(`/admin/projects/${id}`);
  return data;
}

// ── ProjectTasks ────────────────────────────────────────────────────────────

export type ProjectTaskInput = Partial<
  Pick<ProjectTask, 'title' | 'slug' | 'summary' | 'banner' | 'isPremium'>
>;

export async function createProjectTask(projectId: string, payload: ProjectTaskInput) {
  const { data } = await axiosInstance.post<ProjectTask>(
    `/admin/projects/${projectId}/project-tasks`,
    payload,
  );
  return data;
}

export async function updateProjectTask(
  projectId: string,
  ptId: string,
  payload: ProjectTaskInput,
) {
  const { data } = await axiosInstance.patch<ProjectTask>(
    `/admin/projects/${projectId}/project-tasks/${ptId}`,
    payload,
  );
  return data;
}

export async function deleteProjectTask(projectId: string, ptId: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(
    `/admin/projects/${projectId}/project-tasks/${ptId}`,
  );
  return data;
}

/** Order is the position in `orderedIds` — dragging is the only control. */
export async function reorderProjectTasks(projectId: string, orderedIds: string[]) {
  const { data } = await axiosInstance.patch<{ data: ProjectTask[] }>(
    `/admin/projects/${projectId}/project-tasks/reorder`,
    { orderedIds },
  );
  return data.data;
}

// ── Tasks ───────────────────────────────────────────────────────────────────

export type TaskInput = Partial<
  Pick<
    Task,
    | 'title'
    | 'description'
    | 'slug'
    | 'type'
    | 'required'
    | 'isPremium'
    | 'mb'
    | 'answer'
    | 'questions'
    | 'videoId'
    | 'articleId'
    | 'chapterId'
  >
> & { apiSpec?: ApiSpec | null; terminalSpec?: TerminalSpec | null };

export async function createTask(projectId: string, ptId: string, payload: TaskInput) {
  const { data } = await axiosInstance.post<Task>(
    `/admin/projects/${projectId}/project-tasks/${ptId}/tasks`,
    payload,
  );
  return data;
}

export async function updateTask(
  projectId: string,
  ptId: string,
  taskId: string,
  payload: TaskInput,
) {
  const { data } = await axiosInstance.patch<Task>(
    `/admin/projects/${projectId}/project-tasks/${ptId}/tasks/${taskId}`,
    payload,
  );
  return data;
}

export async function deleteTask(projectId: string, ptId: string, taskId: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(
    `/admin/projects/${projectId}/project-tasks/${ptId}/tasks/${taskId}`,
  );
  return data;
}

export async function reorderTasks(projectId: string, ptId: string, orderedIds: string[]) {
  const { data } = await axiosInstance.patch<{ data: Task[] }>(
    `/admin/projects/${projectId}/project-tasks/${ptId}/tasks/reorder`,
    { orderedIds },
  );
  return data.data;
}

// ── learners ────────────────────────────────────────────────────────────────

export async function fetchLearners(
  projectId: string,
  params?: { q?: string; page?: number; limit?: number },
) {
  const { data } = await axiosInstance.get<Paged<Learner> & { taskTotal: number }>(
    `/admin/projects/${projectId}/learners`,
    { params },
  );
  return data;
}

export type EnrolResult = {
  added: Learner[];
  skipped: Array<{ email: string; reason: string }>;
  taskTotal: number;
};

/** Nothing is all-or-nothing: each address is reported on individually. */
export async function enrolLearners(projectId: string, emails: string[]) {
  const { data } = await axiosInstance.post<EnrolResult>(`/admin/projects/${projectId}/learners`, {
    emails,
  });
  return data;
}

export async function removeLearner(projectId: string, learnerId: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(
    `/admin/projects/${projectId}/learners/${learnerId}`,
  );
  return data;
}

// ── solutions ───────────────────────────────────────────────────────────────

export async function fetchSolutions(projectId: string, status?: string) {
  const { data } = await axiosInstance.get<{ data: Solution[]; total: number }>(
    `/admin/projects/${projectId}/solutions`,
    { params: status ? { status } : undefined },
  );
  return data;
}

export async function reviewSolution(
  projectId: string,
  solutionId: string,
  payload: { status: SolutionStatus; score?: number; feedback?: string },
) {
  const { data } = await axiosInstance.patch<Solution>(
    `/admin/projects/${projectId}/solutions/${solutionId}`,
    payload,
  );
  return data;
}
