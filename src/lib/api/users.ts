import { axiosInstance } from '@/lib/api/axios';

/**
 * The admin user surface.
 *
 * Two derived fields carry most of the meaning. `status` answers "can they sign
 * in?" — it reads three columns, not one, because a soft delete, a suspension
 * and an unconfirmed address are different states with different remedies.
 * `access` answers "what can they open?" and reads the role, two flags and the
 * subscription.
 */

export const ROLES = ['USER', 'INSTRUCTOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const STATUSES = ['active', 'unverified', 'suspended', 'deleted'] as const;
export type UserStatus = (typeof STATUSES)[number];

export const ACCESS = ['staff', 'premium', 'trial', 'free'] as const;
export type UserAccess = (typeof ACCESS)[number];

export const SIGNUP_SOURCES = ['MASTERINGBACKEND', 'GOOGLE', 'GITHUB', 'OTP'] as const;
export type SignupSource = (typeof SIGNUP_SOURCES)[number];

export const ENTITLEMENT_TYPES = [
  'COURSE',
  'ROADMAP',
  'PROJECT',
  'BOOTCAMP',
  'QUIZ',
  'EXERCISE',
  'MOCK_INTERVIEW',
  'CHAPTER',
  'VIDEO',
  'ARTICLE',
  'RESOURCE',
] as const;
export type EntitlementType = (typeof ENTITLEMENT_TYPES)[number];

export const ENTITLEMENT_SOURCES = [
  'ROADMAP',
  'OFFER',
  'SUBSCRIPTION',
  'PURCHASE',
  'TRIAL',
  'ADMIN',
] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

export const LANGUAGES = [
  'JAVASCRIPT',
  'TYPESCRIPT',
  'PYTHON',
  'GO',
  'JAVA',
  'PHP',
  'RUBY',
  'CSHARP',
  'RUST',
] as const;

export const EXPERIENCE = ['beginner', 'intermediate', 'advanced'] as const;

// ── types ───────────────────────────────────────────────────────────────────

export type UserRow = {
  id: string;
  name: string;
  email: string;
  username: string;
  avatar: string;
  role: Role;
  status: UserStatus;
  access: UserAccess;
  isPremium: boolean;
  isTrial: boolean;
  emailConfirmed: boolean;
  plan: string | null;
  points: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  signedUpThrough: SignupSource;
  createdAt: string;
  lastActivityAt: string;
  suspendedAt: string | null;
  deletedAt: string | null;
};

export type UserFlag = { code: string; detail: string };

export type Subscription = {
  id: string;
  name: string;
  plan: string | null;
  /** Trimmed — the column is char(36) and comes back padded. */
  status: string;
  amount: number;
  currency: string | null;
  startedAt: string | null;
  expiry: string | null;
  /** The processor's own id, which is what a support ticket quotes. */
  externalId: string | null;
  channel: string | null;
  card: { brand: string; last4: string; expires: string; holder: string } | null;
};

export type UserDetail = UserRow & {
  profile: {
    title: string;
    bio: string;
    country: string;
    phone: string;
    address: string;
    website: string;
    github: string;
    githubProfileUrl: string;
    linkedin: string;
    twitter: string;
    resume: string;
    openToWork: boolean;
  };
  onboarding: {
    hasFinishedOnboarding: boolean;
    experienceLevel: string;
    learningGoal: string;
    weeklyCommitment: string;
    preferredLanguage: string;
    completedAt: string | null;
    skippedAt: string | null;
  };
  /** Earned, never editable — see the note on the Progress tab. */
  progress: {
    points: number;
    level: number;
    currentStreak: number;
    longestStreak: number;
    lastStreakDate: string | null;
    league: string | null;
    courses: number;
    roadmaps: number;
    cohorts: number;
    projects: number;
    achievements: number;
  };
  security: {
    signedUpThrough: SignupSource;
    /** Whether a hash exists. The hash itself never leaves the server. */
    hasPassword: boolean;
    mustResetPassword: boolean;
    githubId: string;
    twitterId: string;
    authId: string;
    githubConnectionStatus: string;
    suspendedReason: string;
  };
  subscription: Subscription | null;
  /** Every subscription they have held, newest first. */
  subscriptions: Subscription[];
  teams: Array<{ id: string; teamId: string; name: string; role: string; status: string }>;
  flags: UserFlag[];
};

export type Entitlement = {
  id: string;
  itemType: EntitlementType;
  itemId: string;
  /** What it points at. Empty when the target no longer exists. */
  itemTitle: string;
  source: EntitlementSource;
  sourceId: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type ActivityRow = {
  id: string;
  title: string;
  description: string;
  where: string;
  createdAt: string;
};

export type Paged<T> = { data: T[]; total: number; page: number; limit: number };

/** Everything the update route accepts. Points and level are absent by design. */
export type UserInput = Partial<{
  name: string;
  email: string;
  username: string;
  title: string;
  bio: string;
  avatar: string;
  country: string;
  phone: string;
  address: string;
  website: string;
  github: string;
  githubProfileUrl: string;
  linkedin: string;
  twitter: string;
  resume: string;
  openToWork: boolean;
  experienceLevel: string;
  learningGoal: string;
  weeklyCommitment: string;
  preferredLanguage: string;
  hasFinishedOnboarding: boolean;
  isPremium: boolean;
  isTrial: boolean;
  emailConfirmed: boolean;
  mustResetPassword: boolean;
}>;

// ── calls ───────────────────────────────────────────────────────────────────

export async function fetchUsers(params?: {
  q?: string;
  role?: string;
  status?: string;
  access?: string;
  source?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
}) {
  const { data } = await axiosInstance.get<Paged<UserRow>>('/admin/users', { params });
  return data;
}

/** Accounts needing a decision, each with the reasons why. */
export async function fetchFlagged() {
  const { data } = await axiosInstance.get<{
    data: Array<UserRow & { flags: UserFlag[] }>;
    total: number;
  }>('/admin/users/flagged');
  return data;
}

export async function fetchUser(id: string) {
  const { data } = await axiosInstance.get<UserDetail>(`/admin/users/${id}`);
  return data;
}

export async function createUser(payload: {
  name: string;
  email: string;
  role?: Role;
  emailConfirmed?: boolean;
}) {
  const { data } = await axiosInstance.post<UserRow>('/admin/users', payload);
  return data;
}

export async function updateUser(id: string, payload: UserInput) {
  const { data } = await axiosInstance.patch<UserRow>(`/admin/users/${id}`, payload);
  return data;
}

export async function updateUserRole(id: string, role: Role) {
  const { data } = await axiosInstance.patch<UserRow>(`/admin/users/${id}/role`, { role });
  return data;
}

/** Reversible, and deliberately not the same thing as deleting. */
export async function suspendUser(id: string, suspended: boolean, reason?: string) {
  const { data } = await axiosInstance.patch<UserRow>(`/admin/users/${id}/suspend`, {
    suspended,
    ...(reason ? { reason } : {}),
  });
  return data;
}

/** Flags the account so the next sign-in must set a new password. */
export async function requirePasswordReset(id: string) {
  const { data } = await axiosInstance.post<{
    success: boolean;
    mustResetPassword: boolean;
    emailConfirmed: boolean;
    message: string;
  }>(`/admin/users/${id}/reset-password`);
  return data;
}

/** Soft delete: the row stays until the purge job removes it. */
export async function deleteUser(id: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(`/admin/users/${id}`);
  return data;
}

export async function restoreUser(id: string) {
  const { data } = await axiosInstance.post<UserRow>(`/admin/users/${id}/restore`);
  return data;
}

export type EntitlementPage = Paged<Entitlement> & {
  /** Counted across everything they hold, so the filter can offer its options. */
  breakdown: Array<{ itemType: EntitlementType; source: EntitlementSource; count: number }>;
};

/**
 * Paged: a path enrolment writes one entitlement per item in the path, so a
 * learner on two paths already holds hundreds.
 */
export async function fetchEntitlements(
  id: string,
  params?: { page?: number; limit?: number; itemType?: string; source?: string },
) {
  const { data } = await axiosInstance.get<EntitlementPage>(`/admin/users/${id}/entitlements`, {
    params,
  });
  return data;
}

export async function grantEntitlement(
  id: string,
  payload: { itemType: EntitlementType; itemId: string; expiresAt?: string | null },
) {
  const { data } = await axiosInstance.post<Entitlement>(
    `/admin/users/${id}/entitlements`,
    payload,
  );
  return data;
}

/** Only an ADMIN grant can be revoked here; the API refuses the rest. */
export async function revokeEntitlement(id: string, entitlementId: string) {
  const { data } = await axiosInstance.delete<{ success: boolean }>(
    `/admin/users/${id}/entitlements/${entitlementId}`,
  );
  return data;
}

export async function fetchUserActivity(id: string, params?: { page?: number; limit?: number }) {
  const { data } = await axiosInstance.get<Paged<ActivityRow>>(`/admin/users/${id}/activity`, {
    params,
  });
  return data;
}

// ── billing ─────────────────────────────────────────────────────────────────

export type Transaction = {
  id: string;
  title: string;
  description: string;
  type: string;
  /** The processor's reference, which is what a dispute quotes. */
  invoice: string;
  /** Trimmed. Blank when the row never recorded one. */
  status: string;
  amount: number;
  createdAt: string;
};

export type Purchase = {
  id: string;
  offerId: string;
  title: string;
  amount: number;
  /** A preview is a look at the bundle, not ownership of it. */
  isPreview: boolean;
  isCompleted: boolean;
  redeemedAt: string;
};

/** One row of the Payment ledger — the authority on money. */
export type LedgerRow = {
  id: string;
  /** Signed net in major units: a refund is negative. */
  amount: number;
  gross: number;
  fee: number;
  tax: number;
  title: string;
  status: string;
  provider: string;
  /** CHARGE | REFUND | CHARGEBACK */
  kind: string;
  interval: string | null;
  invoice: string;
  currency: string;
  createdAt: string;
};

/** Native per-currency totals. Nothing is converted between them. */
export type RevenueByCurrency = {
  currency: string;
  payments: number;
  gross: number;
  fee: number;
  tax: number;
  net: number;
};

export type Billing = {
  transactions: Paged<LedgerRow>;
  revenue: RevenueByCurrency[];
  subscriptions: Subscription[];
  purchases: Purchase[];
  /** Pre-ledger rows, listed for reference and never summed. */
  receipts: Transaction[];
};

export async function fetchBilling(
  id: string,
  params?: { page?: number; limit?: number; provider?: string; status?: string },
) {
  const { data } = await axiosInstance.get<Billing>(`/admin/users/${id}/billing`, { params });
  return data;
}

// ── teams ───────────────────────────────────────────────────────────────────

export type UserTeam = {
  teamId: string;
  name: string;
  isOwner: boolean;
  role: string;
  status: string;
  memberId: string | null;
  joinedAt: string | null;
  owner: { id: string; name: string; email: string } | null;
  seats: number | null;
  subscription: { id: string; plan: string | null; status: string } | null;
  counts: { members: number; invites: number; groups: number; assignments: number };
};

export async function fetchUserTeams(id: string) {
  const { data } = await axiosInstance.get<{ data: UserTeam[] }>(`/admin/users/${id}/teams`);
  return data.data;
}

/**
 * Admin-scoped, because the team's own member routes are gated on
 * `requireTeamRole` — a super admin who does not belong to the team cannot use
 * them at all.
 */
export async function setUserTeamRole(id: string, teamId: string, role: string) {
  const { data } = await axiosInstance.patch<{ teamId: string; role: string }>(
    `/admin/users/${id}/teams/${teamId}`,
    { role },
  );
  return data;
}

export async function removeUserFromTeam(id: string, teamId: string) {
  const { data } = await axiosInstance.delete<{ teamId: string; status: string }>(
    `/admin/users/${id}/teams/${teamId}`,
  );
  return data;
}
