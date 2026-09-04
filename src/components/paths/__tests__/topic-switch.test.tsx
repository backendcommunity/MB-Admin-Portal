import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PathDetailClient from '@/components/paths/PathDetailClient';
import type { PathDetail, Topic } from '@/lib/api/paths';

const topic = (id: string, title: string, duration: number): Topic => ({
  id,
  title,
  slug: title.toLowerCase().replace(/\s+/g, '-'),
  summary: '',
  description: '',
  banner: '',
  level: 'Beginner',
  duration,
  outcomes: [],
  recommendation: 1,
  reference: '',
  isPremium: false,
  order: 0,
  items: [{ kind: 'course', id: 'c1', title: 'Node.js Fundamentals', order: 0 }],
});

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
  counts: { topics: 2, enrolled: 0, items: 2 },
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
  topics: [topic('t1', 'How the Internet Works', 6), topic('t2', 'Relational Databases', 9)],
  readiness: [],
};

vi.mock('@/lib/api/paths', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/paths')>('@/lib/api/paths');
  return {
    ...actual,
    fetchPath: () => Promise.resolve(path),
    fetchLearners: () => Promise.resolve({ data: [], total: 0, page: 1, limit: 20 }),
    checkPathSlug: () => Promise.resolve({ slug: '', available: true, suggestion: '' }),
    updateTopic: vi.fn().mockResolvedValue(undefined),
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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PathDetailClient />
    </QueryClientProvider>,
  );
}

describe('PathDetailClient — switching topics', () => {
  it('shows the newly selected topic’s title, not the previous one', async () => {
    renderPage();

    // Land on the curriculum tab, where the spine lives.
    fireEvent.click(await screen.findByRole('tab', { name: 'Curriculum' }));

    const title = () => screen.getByLabelText('Title') as HTMLInputElement;
    const hours = () => screen.getByLabelText('Hours') as HTMLInputElement;

    await waitFor(() => expect(title().value).toBe('How the Internet Works'));
    expect(hours().value).toBe('6');

    // The pane renders ONE input for whichever topic is selected. Without a key
    // React reuses the same DOM node and `defaultValue` never re-applies, so
    // the box keeps showing the previous topic.
    fireEvent.click(screen.getByText('Relational Databases'));

    await waitFor(() => expect(title().value).toBe('Relational Databases'));
    expect(hours().value).toBe('9');

    // And back again, so this is not a one-way flush.
    fireEvent.click(screen.getByText('How the Internet Works'));
    await waitFor(() => expect(title().value).toBe('How the Internet Works'));
  });
});
