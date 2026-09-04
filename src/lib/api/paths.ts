import { axiosInstance } from '@/lib/api/axios';

/* ────────────────────────────── types ────────────────────────────── */

export type PathStatus = 'PUBLISHED' | 'DRAFT' | 'WAITLIST' | 'ARCHIVED' | 'TEAM';
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type Modality = 'CHAT' | 'AUDIO' | 'VIDEO';

/**
 * The twelve things a topic can hold. Every one is a join table, so reuse is
 * always "attach" — nothing here is ever copied, and detaching never destroys
 * the underlying row.
 *
 * `optional` used to mark the three joins that had an isOptional column; all
 * twelve carry it now. The flag stays on the table so a future kind that cannot
 * store it is a data change here rather than a control that saves nothing.
 */
export const ITEM_KINDS = [
  { id: 'course', label: 'Course', optional: true, attachable: true, creatable: false },
  { id: 'chapter', label: 'Chapter', optional: true, attachable: true, creatable: false },
  { id: 'video', label: 'Video', optional: true, attachable: true, creatable: false },
  { id: 'article', label: 'Article', optional: true, attachable: true, creatable: false },
  { id: 'quiz', label: 'Quiz', optional: true, attachable: true, creatable: false },
  { id: 'exercise', label: 'Exercise', optional: true, attachable: true, creatable: false },
  { id: 'project', label: 'Project', optional: true, attachable: true, creatable: false },
  { id: 'mock', label: 'Mock interview', optional: true, attachable: true, creatable: false },
  { id: 'bootcamp', label: 'Bootcamp', optional: true, attachable: true, creatable: false },
  // A cohort IS a bootcamp's cohort, so attaching one duplicates what attaching
  // the bootcamp already says. No new ones are offered; links that already
  // exist stay listed so they can be read and detached rather than stranded.
  { id: 'cohort', label: 'Cohort', optional: true, attachable: false, creatable: false },
  { id: 'lesson', label: 'Lesson', optional: true, attachable: true, creatable: false },
  { id: 'resource', label: 'Resource', optional: true, attachable: true, creatable: true },
] as const;

/** The kinds the editor offers — cohort is readable but no longer attachable. */
export const ATTACHABLE_KINDS = ITEM_KINDS.filter((kind) => kind.attachable);

/**
 * Kinds an import may CREATE rather than only link. Resources only: a title and
 * a link is the whole object, so nothing is invented. Everything else needs
 * content a title cannot supply — a quiz needs questions, an exercise needs its
 * own solution — and a shell that looks real in the catalogue is worse than a
 * skip.
 */
export function kindIsCreatable(kind: string): boolean {
  return ITEM_KINDS.find((k) => k.id === kind)?.creatable ?? false;
}

export type ItemKind = (typeof ITEM_KINDS)[number]['id'];

export function kindLabel(kind: string): string {
  return ITEM_KINDS.find((k) => k.id === kind)?.label ?? kind;
}
export function kindTakesOptional(kind: string): boolean {
  return ITEM_KINDS.find((k) => k.id === kind)?.optional ?? false;
}

/**
 * Nothing is pinned to the end. Resources used to be — compile-path added 1000
 * to their order — which meant the field could not mean anything for them.
 * They are ordered with everything else now.
 */
export const TAIL_KINDS: ReadonlySet<string> = new Set<string>();

export type ReadinessFailure = { field: string; message: string };

/** Resolved from `createdById`, because a uuid is not something a UI can show. */
export type PathAuthor = { id: string; name: string; email: string; avatar: string | null };

export type TopicItem = {
  kind: ItemKind;
  id: string;
  title: string;
  order: number;
  isOptional?: boolean;
  type?: Modality;
};

export type Topic = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  banner: string;
  level: string;
  duration: number;
  outcomes: string[];
  recommendation: number;
  reference: string;
  /** Stored on the path-to-topic link, so it is per path. */
  isPremium: boolean;
  order: number;
  items: TopicItem[];
};

export type PathListRow = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  banner: string | null;
  level: string;
  difficulty: string;
  isPremium: boolean;
  amount: number;
  isWaiting: boolean;
  isPublic: boolean;
  ownerTeamId: string | null;
  archivedAt: string | null;
  status: PathStatus;
  skills: string[];
  languages: string[];
  estimatedWeeks: number;
  hoursPerWeek: number;
  counts: { topics: number; enrolled: number; items?: number };
  createdAt: string;
  updatedAt: string;
};

export type PathDetail = PathListRow & {
  description: string;
  preview: string;
  timeframe: string;
  instructor: string;
  prerequisites: string[];
  paddlePlanCode: number | null;
  paddle_price_id: string;
  waitingLink: string;
  createdById: string;
  createdBy: PathAuthor | null;
  topics: Topic[];
  readiness: ReadinessFailure[];
};

export type PathListResponse = {
  data: PathListRow[];
  total: number;
  page: number;
  limit: number;
};

/**
 * `ownerTeamId` and `isPublic` are deliberately absent.
 *
 * Ownership and catalogue visibility are decided in the team workspace. The API
 * rejects both on this body — sending either publishes or transfers a team's
 * private curriculum — so they are not part of the type either.
 */
export type PathInput = Partial<{
  title: string;
  slug: string;
  summary: string;
  description: string;
  banner: string;
  preview: string;
  level: string;
  difficulty: string;
  timeframe: string;
  instructor: string;
  prerequisites: string[];
  skills: string[];
  languages: string[];
  estimatedWeeks: number;
  hoursPerWeek: number;
  isPremium: boolean;
  amount: number;
  paddlePlanCode: number | null;
  paddle_price_id: string;
  isWaiting: boolean;
  waitingLink: string;
  createdById: string;
}>;

export type TopicInput = Partial<{
  title: string;
  slug: string;
  summary: string;
  description: string;
  banner: string;
  level: string;
  duration: number;
  outcomes: string[];
  recommendation: number;
  reference: string;
  isPremium: boolean;
}>;

export type PathListParams = {
  page?: number;
  limit?: number;
  q?: string;
  status?: PathStatus;
  premium?: 'true' | 'false';
  level?: string;
  sort?: 'createdAt' | 'updatedAt' | 'title' | 'amount' | 'estimatedWeeks';
  order?: 'asc' | 'desc';
};

export type Learner = {
  id: string;
  user: { id: string; name: string; email: string; avatar: string | null };
  isPreview: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  enrolledAt: string;
  topicsStarted: number;
};

export type EnrolResult = {
  summary: { enrolled: number; skipped: number; failed: number; notFound: number };
  details: {
    enrolled: string[];
    skipped: string[];
    failed: Array<{ email: string; reason: string }>;
    notFound: string[];
  };
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

// The API still lives under its original name; only the product calls it a path.
const BASE = '/admin/roadmaps';

/* ────────────────────────────── the path record ────────────────────────────── */

export function buildPathQuery(params: PathListParams = {}): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `${BASE}?${qs}` : BASE;
}

export async function fetchPaths(params: PathListParams = {}) {
  const { data } = await axiosInstance.get<PathListResponse>(buildPathQuery(params));
  return data;
}

export async function fetchPath(id: string) {
  const { data } = await axiosInstance.get<PathDetail>(`${BASE}/${id}`);
  return data;
}

export async function createPath(payload: { title: string; slug?: string; summary?: string }) {
  const { data } = await axiosInstance.post<PathListRow>(BASE, payload);
  return data;
}

export async function updatePath(id: string, payload: PathInput) {
  const { data } = await axiosInstance.put<PathDetail>(`${BASE}/${id}`, payload);
  return data;
}

export async function setPathStatus(
  id: string,
  action: 'publish' | 'unpublish' | 'archive' | 'restore',
) {
  try {
    const { data } = await axiosInstance.patch<PathListRow>(`${BASE}/${id}/status`, { action });
    return data;
  } catch (error) {
    const response = (error as { response?: { status?: number; data?: unknown } }).response;
    const body = response?.data as { message?: string; failures?: ReadinessFailure[] } | undefined;
    if (response?.status === 422 && body?.failures) {
      throw new NotReadyError(body.message ?? 'This path is not ready to publish', body.failures);
    }
    throw error;
  }
}

export async function deletePath(id: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(`${BASE}/${id}`);
  return data;
}

export async function checkPathSlug(
  slug: string,
  scope: 'path' | 'topic' = 'path',
  excludeId?: string,
) {
  const search = new URLSearchParams({ slug, scope });
  if (excludeId) search.set('excludeId', excludeId);
  const { data } = await axiosInstance.get<{
    slug: string;
    available: boolean;
    suggestion: string;
  }>(`${BASE}/slug-available?${search.toString()}`);
  return data;
}

/* ────────────────────────────── topics ────────────────────────────── */

export async function createTopic(pathId: string, payload: { title: string; summary?: string }) {
  const { data } = await axiosInstance.post<Topic>(`${BASE}/${pathId}/topics`, payload);
  return data;
}

export async function updateTopic(pathId: string, topicId: string, payload: TopicInput) {
  const { data } = await axiosInstance.put<Topic>(`${BASE}/${pathId}/topics/${topicId}`, payload);
  return data;
}

export async function deleteTopic(pathId: string, topicId: string) {
  const { data } = await axiosInstance.delete<{ success: boolean; unlinkedOnly: boolean }>(
    `${BASE}/${pathId}/topics/${topicId}`,
  );
  return data;
}

export async function reorderTopics(pathId: string, orderedIds: string[]) {
  const { data } = await axiosInstance.patch(`${BASE}/${pathId}/topics/reorder`, { orderedIds });
  return data;
}

/* ────────────────────────────── attachments ────────────────────────────── */

export async function attachItem(
  pathId: string,
  topicId: string,
  payload: {
    kind: ItemKind;
    /** Either an existing row… */
    id?: string;
    /** …or the resource to create and link in the same call. */
    create?: { title: string; link: string; type?: string; summary?: string };
    isOptional?: boolean;
    order?: number;
    type?: Modality;
  },
) {
  const { data } = await axiosInstance.post(`${BASE}/${pathId}/topics/${topicId}/items`, payload);
  return data;
}

/**
 * Change an attachment in place: whether it is required, and a mock interview's
 * modality. Attach cannot do this — it is idempotent and returns the existing
 * row untouched, so re-attaching to change a flag silently does nothing.
 */
export async function updateItem(
  pathId: string,
  topicId: string,
  kind: string,
  itemId: string,
  payload: { isOptional?: boolean; type?: Modality },
) {
  const { data } = await axiosInstance.patch(
    `${BASE}/${pathId}/topics/${topicId}/items/${kind}/${itemId}`,
    payload,
  );
  return data;
}

export async function detachItem(pathId: string, topicId: string, kind: string, itemId: string) {
  const { data } = await axiosInstance.delete(
    `${BASE}/${pathId}/topics/${topicId}/items/${kind}/${itemId}`,
  );
  return data;
}

/**
 * One sequence across all twelve join tables — the API renumbers every one of
 * them in a single transaction, because compile-path sorts them together.
 */
export async function reorderItems(
  pathId: string,
  topicId: string,
  ordered: Array<{ kind: string; id: string }>,
) {
  const { data } = await axiosInstance.patch(`${BASE}/${pathId}/topics/${topicId}/items/reorder`, {
    ordered,
  });
  return data;
}

/* ────────────────────────────── learners ────────────────────────────── */

export async function fetchLearners(
  pathId: string,
  params: { page?: number; limit?: number; q?: string; access?: 'full' | 'preview' } = {},
) {
  const search = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });
  // Searched on the joined user: an admin looking for someone knows their name
  // or address, never their enrolment id.
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.access) search.set('access', params.access);

  const { data } = await axiosInstance.get<{
    data: Learner[];
    total: number;
    page: number;
    limit: number;
  }>(`${BASE}/${pathId}/learners?${search.toString()}`);
  return data;
}

export async function enrolLearners(pathId: string, emails: string[]) {
  const { data } = await axiosInstance.post<EnrolResult>(`${BASE}/${pathId}/learners`, {
    emails,
  });
  return data;
}

/**
 * Move a learner between preview and full access.
 *
 * `isPreview` is not the access on its own — the Entitlement rows are what
 * unlock content — so the API grants them on the way up and revokes them on the
 * way down. It answers with how many moved, and `changed: false` when the
 * learner was already in that state.
 */
export async function setLearnerAccess(pathId: string, userId: string, access: 'full' | 'preview') {
  const { data } = await axiosInstance.patch<{
    success: boolean;
    isPreview: boolean;
    changed: boolean;
    granted: number;
    revoked: number;
  }>(`${BASE}/${pathId}/learners/${userId}/access`, { access });
  return data;
}

export async function removeLearner(pathId: string, userId: string) {
  const { data } = await axiosInstance.delete(`${BASE}/${pathId}/learners/${userId}`);
  return data;
}

/* ────────────────────────────── the attach library ────────────────────────────── */

export type LibraryRow = { id: string; title: string; meta?: string };

/**
 * Where each kind's rows come from. Projects, bootcamps and mock interviews have
 * their own admin lists; everything else comes from the shared content library.
 *
 * These endpoints RESHAPE their models, so the field holding the display name
 * differs per endpoint rather than following the table — `/admin/bootcamps`
 * answers `name: b.title`, and its `metaKey` has to be a field that endpoint
 * actually returns. Getting either wrong renders every row as "Untitled",
 * which is why `titleOf` below falls back rather than trusting one key.
 */
const LIBRARY_SOURCES: Record<string, { url: string; metaKey?: string }> = {
  course: { url: '/admin/courses', metaKey: 'slug' },
  project: { url: '/admin/projects', metaKey: 'difficulty' },
  mock: { url: '/admin/mock-interview-templates', metaKey: 'format' },
  // hasCohorts: a bootcamp with no cohort has no dates and nothing for a
  // learner to start, so it is not worth offering as a step.
  bootcamp: { url: '/admin/bootcamps?hasCohorts=true', metaKey: 'cohortCount' },
};

/**
 * Every one of these rows names itself with `title` or `name`. Trying both means
 * an endpoint that reshapes its model differently shows the right label instead
 * of silently falling through to "Untitled".
 */
function titleOf(row: Record<string, unknown>): string {
  const title = row.title ?? row.name;
  return title == null || String(title).trim() === '' ? 'Untitled' : String(title);
}

export async function searchLibrary(kind: string, q: string): Promise<LibraryRow[]> {
  const source = LIBRARY_SOURCES[kind];
  if (source) {
    const search = new URLSearchParams({ limit: '20' });
    if (q) search.set('q', q);
    // A source url may already carry its own filter (bootcamps do).
    const joiner = source.url.includes('?') ? '&' : '?';
    const { data } = await axiosInstance.get(`${source.url}${joiner}${search.toString()}`);
    const rows = (data?.data ?? []) as Array<Record<string, unknown>>;
    return rows.map((row) => {
      const meta = source.metaKey ? row[source.metaKey] : undefined;
      return {
        id: String(row.id),
        title: titleOf(row),
        meta: meta == null || meta === '' ? undefined : String(meta),
      };
    });
  }

  // The rest live in the content library the course editor already searches.
  const search = new URLSearchParams({ kind, limit: '20' });
  if (q) search.set('q', q);
  const { data } = await axiosInstance.get(`/admin/library?${search.toString()}`);
  const rows = (data?.data ?? []) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    title: titleOf(row),
    meta: row.meta ? String(row.meta) : undefined,
  }));
}
