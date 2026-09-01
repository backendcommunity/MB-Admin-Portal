/**
 * Item 7: enrolment (POST /admin/roadmaps/:id/learners) is
 * requireStrictAdmin on the API — an instructor's own path can't take new
 * enrolments through this form, so the control should not be offered at all.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PathDetailClient from '@/components/paths/PathDetailClient';
import type { PathDetail } from '@/lib/api/paths';
import { useAuthStore } from '@/store/authStore';

const path: PathDetail = {
  id: 'p1',
  title: 'Backend Engineering',
  slug: 'backend-engineering',
  summary: 'A summary comfortably past the forty character minimum for publishing.',
  banner: null,
  level: 'Advanced',
  difficulty: '',
  isPremium: false,
  amount: 0,
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
  paddlePlanCode: null,
  paddle_price_id: '',
  waitingLink: '',
  createdById: '',
  createdBy: null,
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
    updatePath: vi.fn(),
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

describe('PathDetailClient — enrol learners gate', () => {
  it('hides Enrol learners from an instructor', async () => {
    asRole('INSTRUCTOR');
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Learners' }));

    await waitFor(() => expect(screen.getByText(/no enrolments/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /enrol learners/i })).not.toBeInTheDocument();
  });

  it('still offers Enrol learners to an admin', async () => {
    asRole('ADMIN');
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Learners' }));

    expect(await screen.findByRole('button', { name: /enrol learners/i })).toBeInTheDocument();
  });
});
