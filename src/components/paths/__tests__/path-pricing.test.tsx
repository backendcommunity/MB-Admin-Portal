/**
 * Item 5: `PathDetailClient` sends `paddlePlanCode` and `paddle_price_id` on
 * every save, unconditionally. The API's `assertMayWriteFields` refuses a
 * non-staff payload that merely CONTAINS one of those keys, regardless of
 * value — so an instructor's very first path edit 403'd with "Only an admin
 * can set the Paddle price id (paddle_price_id)". Paths never got the
 * `stripPricingFields` treatment courses, cohorts and Ships already have.
 *
 * Fix (same pattern as `CourseDetailClient`, commit 694620d): strip the
 * pricing keys from the outgoing payload for a non-staff caller.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PathDetailClient from '@/components/paths/PathDetailClient';
import type { PathDetail } from '@/lib/api/paths';
import { useAuthStore } from '@/store/authStore';

const updatePath = vi.fn();

const path: PathDetail = {
  id: 'p1',
  title: 'Backend Engineering',
  slug: 'backend-engineering',
  summary: 'A summary comfortably past the forty character minimum for publishing.',
  banner: null,
  level: 'Advanced',
  difficulty: '',
  isPremium: true,
  amount: 4999,
  isWaiting: false,
  isPublic: true,
  ownerTeamId: null,
  archivedAt: null,
  status: 'PUBLISHED',
  skills: [],
  languages: [],
  estimatedWeeks: 12,
  hoursPerWeek: 8,
  counts: { topics: 0, enrolled: 0, items: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  description: '',
  preview: '',
  timeframe: '',
  instructor: '',
  prerequisites: [],
  paddlePlanCode: 12,
  paddle_price_id: 'pri_123',
  waitingLink: '',
  createdById: 'u1',
  createdBy: { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', avatar: null },
  topics: [],
  readiness: [],
};

vi.mock('@/lib/api/paths', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/paths')>('@/lib/api/paths');
  return {
    ...actual,
    fetchPath: () => Promise.resolve(path),
    fetchLearners: () => Promise.resolve({ data: [], total: 0, page: 1, limit: 20 }),
    checkPathSlug: () => Promise.resolve({ slug: '', available: true, suggestion: '' }),
    updateTopic: vi.fn(),
    createTopic: vi.fn(),
    deleteTopic: vi.fn(),
    detachItem: vi.fn(),
    reorderTopics: vi.fn(),
    reorderItems: vi.fn(),
    setPathStatus: vi.fn(),
    updatePath: (...args: unknown[]) => updatePath(...args),
    removeLearner: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'p1' }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

const asRole = (role: string, authResolved = true) =>
  useAuthStore.setState({ userRole: role as never, authResolved });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PathDetailClient />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  updatePath.mockResolvedValue(path);
});

describe('PathDetailClient — instructor save payload', () => {
  it('saves without either Paddle key, even on an already-priced path', async () => {
    asRole('INSTRUCTOR');
    renderPage();

    await screen.findByRole('tab', { name: 'Overview' });
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updatePath).toHaveBeenCalled());
    const [id, payload] = updatePath.mock.calls[0];
    expect(id).toBe('p1');
    expect('paddle_price_id' in payload).toBe(false);
    expect('paddlePlanCode' in payload).toBe(false);
  });

  it('still sends both Paddle keys, unchanged, when an admin saves the same path', async () => {
    asRole('ADMIN');
    renderPage();

    await screen.findByRole('tab', { name: 'Overview' });
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updatePath).toHaveBeenCalled());
    const [, payload] = updatePath.mock.calls[0];
    expect(payload).toMatchObject({ paddlePlanCode: 12, paddle_price_id: 'pri_123' });
  });
});
