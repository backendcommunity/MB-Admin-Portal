/**
 * The billing panel, driven by a real API payload.
 *
 * The record page read `User.subscription` — a denormalised pointer that is
 * missing for one owner and points at a different row for another — so real
 * subscriptions rendered as "No subscription". It also printed `status`
 * straight from a char(36) column, which arrives padded to the full width.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const detail = {
  id: 'u1',
  name: 'Ada Okonjo',
  email: 'ada@acme.test',
  username: '',
  avatar: '',
  role: 'USER',
  status: 'active',
  access: 'premium',
  isPremium: true,
  isTrial: false,
  emailConfirmed: true,
  plan: 'Enterprise',
  points: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,
  signedUpThrough: 'GOOGLE',
  createdAt: '2026-02-14T00:00:00.000Z',
  lastActivityAt: '2026-08-29T00:00:00.000Z',
  suspendedAt: null,
  deletedAt: null,
  profile: {
    title: '',
    bio: '',
    country: '',
    phone: '',
    address: '',
    website: '',
    github: '',
    githubProfileUrl: '',
    linkedin: '',
    twitter: '',
    resume: '',
    openToWork: false,
  },
  onboarding: {
    hasFinishedOnboarding: true,
    experienceLevel: '',
    learningGoal: '',
    weeklyCommitment: '',
    preferredLanguage: '',
    completedAt: null,
    skippedAt: null,
  },
  progress: {
    points: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    lastStreakDate: null,
    league: null,
    courses: 0,
    roadmaps: 0,
    cohorts: 0,
    projects: 0,
    achievements: 0,
  },
  security: {
    signedUpThrough: 'GOOGLE',
    hasPassword: false,
    mustResetPassword: false,
    githubId: '',
    twitterId: '',
    authId: '',
    githubConnectionStatus: '',
    suspendedReason: '',
  },
  // Exactly the shape the API returns, taken from a real row.
  subscription: {
    id: 's1',
    name: 'Enterprise',
    plan: 'Enterprise',
    status: 'active',
    amount: 199.99,
    currency: 'USD',
    startedAt: '2026-08-19T00:52:18.387Z',
    expiry: '2027-08-19T00:52:18.387Z',
    externalId: 'sub_01m0br2d8pkawqea2am5hf2319',
    channel: 'PADDLE',
    card: { brand: 'visa', last4: '4242', expires: '12/2030', holder: 'A Person' },
  },
  subscriptions: [
    {
      id: 's1',
      name: 'Enterprise',
      plan: 'Enterprise',
      status: 'active',
      amount: 199.99,
      currency: 'USD',
      startedAt: '2026-08-19T00:52:18.387Z',
      expiry: null,
      externalId: null,
      channel: 'PADDLE',
      card: null,
    },
    {
      id: 's0',
      name: 'Pro',
      plan: 'Pro',
      status: 'canceled',
      amount: 49,
      currency: 'USD',
      startedAt: '2025-08-19T00:52:18.387Z',
      expiry: null,
      externalId: null,
      channel: 'PADDLE',
      card: null,
    },
  ],
  teams: [],
  flags: [],
};

// The endpoint is paged, and carries a breakdown so the filter can offer its
// options without a second call.
const entitlements = {
  total: 1,
  page: 1,
  limit: 25,
  breakdown: [{ itemType: 'COURSE', source: 'ROADMAP', count: 1 }],
  data: [
    {
      id: 'e1',
      itemType: 'COURSE',
      itemId: 'fbf0612f-c764-4f06-9c35-d846970731d3',
      itemTitle: 'The Internet & HTTP for Backend Engineers',
      source: 'ROADMAP',
      sourceId: null,
      expiresAt: null,
      createdAt: '2026-06-08T00:00:00.000Z',
    },
  ],
};

const billing = {
  // The Payment ledger: gross, the processor's fee, tax and a signed net, per
  // currency. The legacy Transaction table carried none of that.
  transactions: {
    total: 2,
    page: 1,
    limit: 25,
    data: [
      {
        id: 'p1',
        amount: 9.99,
        gross: 13.14,
        fee: 1.14,
        tax: 2.01,
        title: 'PADDLE CHARGE',
        status: 'SETTLED',
        provider: 'PADDLE',
        kind: 'CHARGE',
        interval: 'MONTHLY',
        invoice: 'txn_01m0khp9sawekg6yjdegp06f6f',
        currency: 'USD',
        createdAt: '2026-08-22T01:34:46.058Z',
      },
      {
        id: 'p2',
        // A refund is negative, so the column adds up to what was kept.
        amount: -5,
        gross: -5,
        fee: 0,
        tax: 0,
        title: 'PADDLE REFUND',
        status: 'REFUNDED',
        provider: 'PADDLE',
        kind: 'REFUND',
        interval: null,
        invoice: 'txn_refund',
        currency: 'USD',
        createdAt: '2026-08-23T01:34:46.058Z',
      },
    ],
  },
  revenue: [
    { currency: 'USD', payments: 2, gross: 8.14, fee: 1.14, tax: 2.01, net: 4.99 },
    { currency: 'NGN', payments: 1, gross: 5000, fee: 0, tax: 0, net: 5000 },
  ],
  subscriptions: detail.subscriptions,
  purchases: [
    {
      id: 'o1',
      offerId: 'off1',
      title: 'Backend Bundle',
      amount: 120,
      isPreview: false,
      isCompleted: true,
      redeemedAt: '2026-05-01T00:00:00.000Z',
    },
  ],
  receipts: [
    {
      id: 't1',
      title: 'Pro Monthly (PPP)',
      description: '',
      type: 'subscription',
      invoice: 'txn_legacy',
      status: 'paid',
      amount: 6.99,
      createdAt: '2026-08-18T23:29:23.897Z',
    },
  ],
};

const teams = [
  {
    teamId: 'tm1',
    name: 'Acme Engineering',
    isOwner: false,
    role: 'MEMBER',
    status: 'ACTIVE',
    memberId: 'm1',
    joinedAt: '2026-03-01T00:00:00.000Z',
    owner: { id: 'u9', name: 'Owner', email: 'owner@acme.test' },
    seats: null,
    subscription: { id: 's9', plan: 'Team', status: 'active' },
    counts: { members: 12, invites: 2, groups: 3, assignments: 5 },
  },
  {
    teamId: 'tm2',
    name: 'Owned Team',
    isOwner: true,
    role: 'OWNER',
    status: 'ACTIVE',
    memberId: null,
    joinedAt: null,
    owner: { id: 'u1', name: 'Ada Okonjo', email: 'ada@acme.test' },
    seats: null,
    subscription: null,
    counts: { members: 4, invites: 0, groups: 1, assignments: 0 },
  },
];

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'u1' }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
      const key = String(queryKey[0]);
      if (key === 'admin-user-entitlements') {
        return { data: entitlements, isLoading: false, isError: false, refetch: vi.fn() };
      }
      if (key === 'admin-user-billing') {
        return { data: billing, isLoading: false, isError: false, refetch: vi.fn() };
      }
      if (key === 'admin-user-teams') {
        return { data: teams, isLoading: false, isError: false, refetch: vi.fn() };
      }
      if (key === 'admin-user-activity') {
        return {
          data: { data: [], total: 0, page: 1, limit: 25 },
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        };
      }
      return { data: detail, isLoading: false, isError: false, refetch: vi.fn() };
    },
  };
});

import UserDetailClient from '../UserDetailClient';

function openAccess() {
  render(<UserDetailClient />);
  fireEvent.click(screen.getByRole('tab', { name: 'Access' }));
}

function openBilling() {
  render(<UserDetailClient />);
  fireEvent.click(screen.getByRole('tab', { name: 'Billing' }));
}

function openTeams() {
  render(<UserDetailClient />);
  fireEvent.click(screen.getByRole('tab', { name: 'Teams' }));
}

describe('the billing panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the plan and its status rather than "No subscription"', () => {
    openAccess();
    expect(screen.getAllByText('Enterprise').length).toBeGreaterThan(0);
    // The account's own status badge also says "active", so this counts both
    // rather than asserting the panel owns the only one.
    expect(screen.getAllByText('active').length).toBeGreaterThan(1);
    expect(screen.queryByText('No subscription.')).not.toBeInTheDocument();
  });

  it('shows the money, the dates and the processor', () => {
    openAccess();
    expect(screen.getByText('199.99 USD')).toBeInTheDocument();
    expect(screen.getByText('PADDLE')).toBeInTheDocument();
    // Started and renews are separate rows — one answers "since when", the
    // other "how long left".
    expect(screen.getByText('Started')).toBeInTheDocument();
    expect(screen.getByText('Renews / ends')).toBeInTheDocument();
  });

  it('shows the card without the full number', () => {
    openAccess();
    expect(screen.getByText('visa ···· 4242 · 12/2030')).toBeInTheDocument();
  });

  it('shows the processor id a support ticket would quote', () => {
    openAccess();
    expect(screen.getByText('sub_01m0br2d8pkawqea2am5hf2319')).toBeInTheDocument();
  });

  it('offers the earlier subscriptions without leading with them', () => {
    openAccess();
    expect(screen.getByText('1 earlier subscription')).toBeInTheDocument();
  });
});

describe('the entitlement rows', () => {
  it('names what the entitlement points at', () => {
    openAccess();
    expect(screen.getByText('The Internet & HTTP for Backend Engineers')).toBeInTheDocument();
  });

  it('says the source is a reason, not a second type', () => {
    openAccess();
    // "course" and "roadmap" side by side read as a contradiction; "via
    // roadmap" reads as what granted it.
    expect(screen.getByText('course')).toBeInTheDocument();
    expect(screen.getByText('via roadmap')).toBeInTheDocument();
    expect(screen.queryByText('roadmap')).not.toBeInTheDocument();
  });
});

describe('the billing tab', () => {
  it('lists ledger transactions with the processor reference', () => {
    openBilling();
    expect(screen.getByText('txn_01m0khp9sawekg6yjdegp06f6f')).toBeInTheDocument();
    expect(screen.getAllByText('PADDLE').length).toBeGreaterThan(0);
  });

  it('breaks each transaction into gross, fee, tax and net', () => {
    openBilling();
    expect(screen.getByText('13.14 USD')).toBeInTheDocument();
    // Fee and tax appear both on the row and in the revenue summary.
    expect(screen.getAllByText('1.14').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2.01').length).toBeGreaterThan(0);
    expect(screen.getByText('9.99')).toBeInTheDocument();
  });

  it('shows a refund as a negative rather than hiding it', () => {
    openBilling();
    expect(screen.getByText('-5.00')).toBeInTheDocument();
    expect(screen.getByText('refunded')).toBeInTheDocument();
  });

  it('totals revenue per currency, never adding them together', () => {
    openBilling();
    // 4.99 USD and 5000 NGN are two totals, not one.
    expect(screen.getByText('4.99 USD')).toBeInTheDocument();
    expect(screen.getByText('5,000.00 NGN')).toBeInTheDocument();
    expect(screen.getByText(/nothing is converted/i)).toBeInTheDocument();
  });

  it('keeps the legacy receipts out of revenue and says why', () => {
    openBilling();
    expect(screen.getByText('1 legacy receipt')).toBeInTheDocument();
    expect(screen.getByText(/never counted towards revenue/i)).toBeInTheDocument();
  });
});

describe('the teams tab', () => {
  it('lists the teams they belong to', () => {
    openTeams();
    expect(screen.getByText('Acme Engineering')).toBeInTheDocument();
    expect(screen.getByText(/12 members/)).toBeInTheDocument();
  });

  it('offers role and removal on a team they do not own', () => {
    openTeams();
    expect(screen.getByLabelText('Role in this team')).toBeInTheDocument();
    expect(screen.getByText('Remove from this team')).toBeInTheDocument();
  });

  it('refuses both on a team they own, and says why', () => {
    openTeams();
    expect(screen.getByText('Owned Team')).toBeInTheDocument();
    expect(screen.getByText(/Transfer ownership before changing their role/i)).toBeInTheDocument();
  });
});
