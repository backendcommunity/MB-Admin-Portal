import { axiosInstance } from './axios';

export type TeamProcessor = 'PADDLE' | 'ASYNCPAY' | 'STRIPE' | 'PAYSTACK' | null;

export type TeamOwner = {
  id: string;
  name: string;
  email: string;
} | null;

export type TeamSeatUsage = {
  /**
   * Whether the team has an active paid subscription at all. When false,
   * `paidSeats` is meaningless (no plan to count seats against) — render
   * the denominator as an em dash rather than 0.
   */
  subscribed: boolean;
  paidSeats: number;
  activeMembers: number;
  pendingInvites: number;
  used: number;
  available: number;
};

export type TeamMemberRow = {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  removedAt: string | null;
  user: { id: string; name: string; email: string; avatar: string | null };
};

export type TeamInviteRow = {
  id: string;
  email: string;
  invitedByUserId: string;
  expiresAt: string;
  createdAt: string;
  /**
   * `PENDING | ACCEPTED | REVOKED | EXPIRED` — a real column on the raw
   * `TeamInvite` row. `GET /:id/invites` (academy `admin/teams.ts`) returns
   * `prisma.teamInvite.findMany()` output directly, not through
   * `teamDetailRow`'s mapper, so this field is present on the wire. Missing
   * from this type as shipped in Task 8 — the Invites tab's "Outcome" column
   * needs it to tell an accepted invite from a revoked or expired one.
   */
  status: string;
};

export type TeamSummary = {
  id: string;
  name: string;
  owner: TeamOwner;
  processor: TeamProcessor;
  subscriptionStatus: string | null;
  seats: TeamSeatUsage;
  /**
   * The seat-gap the nightly reconcile last reported — alert bookkeeping,
   * never a seat figure. Kept beside `seats` under its own name because
   * conflating the two is the bug this rewrite fixes.
   */
  seatGap: number | null;
  archivedAt: string | null;
  createdAt: string;
};

export type TeamDetail = TeamSummary & {
  subscription: {
    id: string;
    status: string | null;
    seats: number;
    paidSeats: number;
    // Per-seat price, in `currency` below — never assume USD. Paddle
    // localization means the same list price can settle in different
    // currencies for different customers.
    amount: number | null;
    currency: string | null;
  } | null;
  members: TeamMemberRow[];
  pendingInvites: TeamInviteRow[];
};

export type TeamListParams = {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  processor?: string;
  seatState?: string;
};

export type CreateTeamInput = {
  name: string;
  ownerEmail: string;
  subscriptionId?: string;
  seats?: number;
};

type Paged<T> = { teams: T[]; total: number; page: number; limit: number };

/** Drops empty strings and the `ALL` sentinel so they never reach the API. */
function clean(params: Record<string, string | number | boolean | undefined | null>) {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === 'ALL') continue;
    out[k] = v;
  }
  return out;
}

export async function fetchTeams(params: TeamListParams) {
  const res = await axiosInstance.get<{ success: boolean; data: Paged<TeamSummary> }>(
    '/admin/teams',
    { params: clean(params) },
  );
  return res.data.data;
}

export async function fetchTeam(id: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamDetail }>(`/admin/teams/${id}`);
  return res.data.data;
}

export async function createTeam(input: CreateTeamInput) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamSummary }>(
    '/admin/teams',
    input,
  );
  return res.data.data;
}

export async function renameTeam(id: string, name: string) {
  const res = await axiosInstance.patch<{ success: boolean; data: TeamSummary }>(
    `/admin/teams/${id}`,
    { name },
  );
  return res.data.data;
}

export async function transferTeam(id: string, toUserId: string) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamSummary }>(
    `/admin/teams/${id}/transfer`,
    { toUserId },
  );
  return res.data.data;
}

export async function archiveTeam(id: string) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamSummary }>(
    `/admin/teams/${id}/archive`,
  );
  return res.data.data;
}

export async function restoreTeam(id: string) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamSummary }>(
    `/admin/teams/${id}/restore`,
  );
  return res.data.data;
}

/**
 * Staff seat adjustment. Refuses (409) when `seats` is below current usage;
 * callers must surface `error.response.data.message` rather than a generic
 * failure toast, since that message names the exact usage figure.
 */
export async function adminSetTeamSeats(id: string, seats: number) {
  const res = await axiosInstance.patch<{ success: boolean; data: TeamSeatUsage }>(
    `/admin/teams/${id}/seats`,
    { seats },
  );
  return res.data.data;
}

/* ─────────────────────────── members ─────────────────────────── */

export type TeamMemberRole = 'ADMIN' | 'MEMBER';

export async function setTeamMemberRole(teamId: string, memberId: string, role: TeamMemberRole) {
  const res = await axiosInstance.patch<{ success: boolean; data: { id: string; role: string } }>(
    `/admin/teams/${teamId}/members/${memberId}`,
    { role },
  );
  return res.data.data;
}

export async function removeTeamMember(teamId: string, memberId: string) {
  const res = await axiosInstance.delete<{ success: boolean; data: { id: string } }>(
    `/admin/teams/${teamId}/members/${memberId}`,
  );
  return res.data.data;
}

export type TeamMemberProgress = Record<string, unknown>;

export async function fetchTeamMemberProgress(teamId: string, memberId: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamMemberProgress }>(
    `/admin/teams/${teamId}/members/${memberId}/progress`,
  );
  return res.data.data;
}

/* ─────────────────────────── invites ─────────────────────────── */

export type TeamInvites = { pending: TeamInviteRow[]; history: TeamInviteRow[] };

export async function fetchTeamInvites(teamId: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamInvites }>(
    `/admin/teams/${teamId}/invites`,
  );
  return res.data.data;
}

export async function inviteTeamMember(teamId: string, email: string) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamInviteRow }>(
    `/admin/teams/${teamId}/invites`,
    { email },
  );
  return res.data.data;
}

export async function resendTeamInvite(teamId: string, inviteId: string) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamInviteRow }>(
    `/admin/teams/${teamId}/invites/${inviteId}/resend`,
  );
  return res.data.data;
}

export async function revokeTeamInvite(teamId: string, inviteId: string) {
  const res = await axiosInstance.delete<{ success: boolean; data: { id: string } }>(
    `/admin/teams/${teamId}/invites/${inviteId}`,
  );
  return res.data.data;
}

/* ─────────────────────────── groups ─────────────────────────── */

export type TeamGroupRow = {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
};

export async function fetchTeamGroups(teamId: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamGroupRow[] }>(
    `/admin/teams/${teamId}/groups`,
  );
  return res.data.data;
}

export async function createTeamGroup(teamId: string, name: string) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamGroupRow }>(
    `/admin/teams/${teamId}/groups`,
    { name },
  );
  return res.data.data;
}

export async function renameTeamGroup(teamId: string, groupId: string, name: string) {
  const res = await axiosInstance.patch<{ success: boolean; data: TeamGroupRow }>(
    `/admin/teams/${teamId}/groups/${groupId}`,
    { name },
  );
  return res.data.data;
}

/** No `data` in the response body (`{success, message}`) — nothing to unwrap. */
export async function deleteTeamGroup(teamId: string, groupId: string) {
  const res = await axiosInstance.delete<{ success: boolean; message: string }>(
    `/admin/teams/${teamId}/groups/${groupId}`,
  );
  return res.data;
}

export async function setTeamGroupMembers(
  teamId: string,
  groupId: string,
  teamMemberIds: string[],
) {
  const res = await axiosInstance.put<{ success: boolean; data: TeamGroupRow }>(
    `/admin/teams/${teamId}/groups/${groupId}/members`,
    { teamMemberIds },
  );
  return res.data.data;
}

/* ─────────────────────────── assignments ─────────────────────────── */

export type AssignmentTargetType = 'TEAM' | 'GROUP' | 'MEMBER';

export type TeamAssignmentItem = {
  id?: string;
  type: string;
  refId?: string | null;
  text?: string | null;
  position?: number;
};

export type TeamAssignmentRow = {
  id: string;
  teamId: string;
  name: string;
  dueAt: string | null;
  createdAt: string;
  targetType: AssignmentTargetType;
  targetGroupId: string | null;
  targetTeamMemberId: string | null;
  items: TeamAssignmentItem[];
  [key: string]: unknown;
};

export type CreateTeamAssignmentInput = {
  name: string;
  dueAt?: string | null;
  targetType: AssignmentTargetType;
  targetGroupId?: string | null;
  targetTeamMemberId?: string | null;
};

export type UpdateTeamAssignmentInput = Partial<CreateTeamAssignmentInput>;

export async function fetchTeamAssignments(teamId: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamAssignmentRow[] }>(
    `/admin/teams/${teamId}/assignments`,
  );
  return res.data.data;
}

export async function fetchTeamAssignment(teamId: string, assignmentId: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamAssignmentRow }>(
    `/admin/teams/${teamId}/assignments/${assignmentId}`,
  );
  return res.data.data;
}

export async function createTeamAssignment(teamId: string, input: CreateTeamAssignmentInput) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamAssignmentRow }>(
    `/admin/teams/${teamId}/assignments`,
    input,
  );
  return res.data.data;
}

export async function updateTeamAssignment(
  teamId: string,
  assignmentId: string,
  input: UpdateTeamAssignmentInput,
) {
  const res = await axiosInstance.patch<{ success: boolean; data: TeamAssignmentRow }>(
    `/admin/teams/${teamId}/assignments/${assignmentId}`,
    input,
  );
  return res.data.data;
}

/** No `data` in the response body (`{success}` only) — nothing to unwrap. */
export async function deleteTeamAssignment(teamId: string, assignmentId: string) {
  const res = await axiosInstance.delete<{ success: boolean }>(
    `/admin/teams/${teamId}/assignments/${assignmentId}`,
  );
  return res.data;
}

/**
 * Replace an assignment's item list wholesale. Not in the plan's naming
 * list — `PUT /:id/assignments/:assignmentId/items` was left unnamed there
 * even though the route exists and is wired up server-side. Named to match
 * this file's `setX` convention for whole-collection replacement (see
 * `setTeamGroupMembers`).
 */
export async function setTeamAssignmentItems(
  teamId: string,
  assignmentId: string,
  items: TeamAssignmentItem[],
) {
  const res = await axiosInstance.put<{ success: boolean; data: TeamAssignmentRow }>(
    `/admin/teams/${teamId}/assignments/${assignmentId}/items`,
    { items },
  );
  return res.data.data;
}

export type AssignableContentType =
  | 'PATH'
  | 'COURSE'
  | 'PROJECT'
  | 'MOCK_INTERVIEW'
  | 'CHAPTER'
  | 'ARTICLE'
  | 'VIDEO'
  | 'TASK'
  | 'QUIZ'
  | 'EXERCISE'
  | 'LESSON'
  | 'COHORT'
  | 'BOOTCAMP'
  | 'RESOURCE';

export type AssignableContentRow = { id: string; title: string; type: AssignableContentType };

export async function fetchAssignableContent(
  teamId: string,
  params: { type: AssignableContentType; q?: string },
) {
  const res = await axiosInstance.get<{ success: boolean; data: AssignableContentRow[] }>(
    `/admin/teams/${teamId}/assignable`,
    { params: clean(params) },
  );
  return res.data.data;
}

/* ─────────────────────────── paths ─────────────────────────── */

export type TeamPathRow = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  sectionCount: number;
  createdAt: string;
};

export type TeamPathDetail = { id: string; title: string; summary: string; [key: string]: unknown };

export type CreateTeamPathInput = { title: string; summary?: string | null };
export type UpdateTeamPathInput = { title?: string; summary?: string | null };

export async function fetchTeamPaths(teamId: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamPathRow[] }>(
    `/admin/teams/${teamId}/paths`,
  );
  return res.data.data;
}

export async function createTeamPath(teamId: string, input: CreateTeamPathInput) {
  const res = await axiosInstance.post<{ success: boolean; data: TeamPathRow }>(
    `/admin/teams/${teamId}/paths`,
    input,
  );
  return res.data.data;
}

/**
 * Not in the plan's naming list — `GET /:id/paths/:pathId` exists and is
 * wired up server-side, but only the list/create/update/archive/restore
 * names were given. Named to match this file's `fetchX` singular-detail
 * convention (see `fetchTeam` vs `fetchTeams`).
 */
export async function fetchTeamPath(teamId: string, pathId: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamPathDetail }>(
    `/admin/teams/${teamId}/paths/${pathId}`,
  );
  return res.data.data;
}

export async function updateTeamPath(teamId: string, pathId: string, input: UpdateTeamPathInput) {
  const res = await axiosInstance.patch<{ success: boolean; data: TeamPathRow }>(
    `/admin/teams/${teamId}/paths/${pathId}`,
    input,
  );
  return res.data.data;
}

/**
 * Archives, never deletes, despite the HTTP verb — the route only ever sets
 * `archivedAt`. No `data` in the response body (`{success, message}`).
 */
export async function archiveTeamPath(teamId: string, pathId: string) {
  const res = await axiosInstance.delete<{ success: boolean; message: string }>(
    `/admin/teams/${teamId}/paths/${pathId}`,
  );
  return res.data;
}

/** No `data` in the response body (`{success, message}`) — nothing to unwrap. */
export async function restoreTeamPath(teamId: string, pathId: string) {
  const res = await axiosInstance.post<{ success: boolean; message: string }>(
    `/admin/teams/${teamId}/paths/${pathId}/restore`,
  );
  return res.data;
}

/* ─────────────────────────── billing ─────────────────────────── */

/**
 * Attach an existing subscription to a team. The plan's brief lists this as
 * `PATCH /:id/subscription {subscriptionId}`, but the backend's
 * `ValidateAttachSubscription` (`src/modules/admin/validators/teams.ts`)
 * requires `seats` too — it sets both the processor's quantity and the
 * funded-for-this-period figure in the same call, mirroring `POST /` (create
 * team with subscriptionId + seats). Sending only `subscriptionId` 422s.
 * Signature fixed here to match what the API actually requires.
 */
export async function attachTeamSubscription(
  teamId: string,
  subscriptionId: string,
  seats: number,
) {
  const res = await axiosInstance.patch<{ success: boolean; data: TeamSummary }>(
    `/admin/teams/${teamId}/subscription`,
    { subscriptionId, seats },
  );
  return res.data.data;
}

export async function detachTeamSubscription(teamId: string) {
  const res = await axiosInstance.delete<{ success: boolean; data: TeamSummary }>(
    `/admin/teams/${teamId}/subscription`,
  );
  return res.data.data;
}

/**
 * Clears the seat-gap ALERT flag only. `Team.reportedSeatGap` is HEADROOM
 * (`seats - used`), not an error — a gap of 2 usually means the customer
 * bought two spare seats, and the nightly reconcile job that produces it is
 * report-only. This dismisses that alert; it changes no seats and calls no
 * payment processor. Deliberately not a "reconcile" — there is nothing to
 * reconcile, only an alert to acknowledge.
 */
export async function dismissTeamSeatGap(teamId: string) {
  const res = await axiosInstance.post<{
    success: boolean;
    data: { id: string; reportedSeatGap: null };
  }>(`/admin/teams/${teamId}/seat-gap/dismiss`);
  return res.data.data;
}

/* ─────────────────────────── reports ─────────────────────────── */

export type ReportRange = '12w' | '12m';

export type TeamOverview = Record<string, unknown>;
export type TeamReport = Record<string, unknown>;
export type TeamProgressRow = Record<string, unknown>;
export type TeamLeaderboardRow = Record<string, unknown>;

export async function fetchTeamOverview(teamId: string, groupId?: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamOverview }>(
    `/admin/teams/${teamId}/overview`,
    { params: clean({ groupId }) },
  );
  return res.data.data;
}

export async function fetchTeamReport(
  teamId: string,
  params: { range?: ReportRange; groupId?: string } = {},
) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamReport }>(
    `/admin/teams/${teamId}/reports`,
    { params: clean(params) },
  );
  return res.data.data;
}

/**
 * Not in the plan's naming list — no name was given for
 * `GET /:id/reports/export.csv` even though the route exists and is wired
 * up server-side.
 *
 * That endpoint responds with `text/csv` and a `Content-Disposition:
 * attachment; filename="..."` header, NOT the `{success, data}` JSON
 * envelope every other function in this file unwraps — there is no
 * `.data.data` here, the body itself IS the CSV text, and unwrapping it the
 * usual way would corrupt the download. No existing helper in this repo
 * downloads a server-generated CSV (SubscriptionsPanel/CoursesTable both
 * build CSV client-side from rows already in memory), so this returns the
 * raw text plus the filename parsed off the header, leaving the caller to
 * trigger the browser download the same way those two components already do
 * (`new Blob([text], { type: 'text/csv' })` + an object URL).
 */
export async function exportTeamReportCsv(
  teamId: string,
  params: { range?: ReportRange; groupId?: string } = {},
) {
  const res = await axiosInstance.get<string>(`/admin/teams/${teamId}/reports/export.csv`, {
    params: clean(params),
    responseType: 'text',
  });
  const disposition = (res.headers as Record<string, string> | undefined)?.['content-disposition'];
  const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? 'report.csv';
  return { filename, csv: res.data };
}

export async function fetchTeamProgress(teamId: string, groupId?: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamProgressRow[] }>(
    `/admin/teams/${teamId}/progress`,
    { params: clean({ groupId }) },
  );
  return res.data.data;
}

/**
 * Not in the plan's naming list — no name was given for `GET
 * /:id/leaderboard` even though the route exists and is wired up
 * server-side. Named to match this file's `fetchX` convention for the
 * sibling reports endpoints.
 */
export async function fetchTeamLeaderboard(teamId: string, groupId?: string) {
  const res = await axiosInstance.get<{ success: boolean; data: TeamLeaderboardRow[] }>(
    `/admin/teams/${teamId}/leaderboard`,
    { params: clean({ groupId }) },
  );
  return res.data.data;
}

/* ─────────────────────────── audit ─────────────────────────── */

export type TeamAuditLogEntry = {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type PaginatedTeamAuditLog = {
  data: TeamAuditLogEntry[];
  total: number;
  page: number;
  limit: number;
};

/**
 * `/admin/audit-logs` (`src/modules/admin/auditLogs.ts`) predates this
 * file's `{success, data}` envelope — it returns `{data, total, page,
 * limit}` directly. This deliberately returns `res.data`, not
 * `res.data.data`; unwrapping the usual way would drop `total`/`page`/`limit`
 * and hand back only the row array.
 */
export async function fetchTeamAuditLog(teamId: string) {
  const res = await axiosInstance.get<PaginatedTeamAuditLog>('/admin/audit-logs', {
    params: { entityId: teamId, entityType: 'Team' },
  });
  return res.data;
}

/**
 * Formats a minor/major amount in whatever currency the API returned.
 * Deliberately takes `currency` as a required, possibly-null argument
 * instead of defaulting to USD — Paddle localization means a USD-listed
 * plan can settle in another currency depending on the customer, and
 * defaulting here would silently mislabel it.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string | null | undefined,
) {
  if (amount == null) return '—';
  if (!currency) return amount.toLocaleString();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}
