import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CoursesTable from './CoursesTable';
import type { CourseListRow } from '@/lib/api/courses';

const row = (overrides: Partial<CourseListRow> = {}): CourseListRow => ({
  id: 'c1',
  title: 'Node.js Fundamentals',
  slug: 'nodejs-fundamentals',
  summary: 'Learn how Node actually runs your code.',
  banner: null,
  type: 'VIDEO',
  level: 'Beginner',
  category: { id: 'cat-1', name: 'Backend', color: '#13aece' },
  isPublic: true,
  isPremium: false,
  amount: 0,
  isWaiting: false,
  archivedAt: null,
  status: 'PUBLISHED',
  tags: [],
  languages: [],
  counts: { chapters: 8, items: 42, enrolled: 1204 },
  totalDuration: 3600,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  lastUpdated: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

const fetchCourses = vi.fn();
const fetchCategories = vi.fn();

vi.mock('@/lib/api/courses', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/courses')>('@/lib/api/courses');
  return {
    ...actual,
    fetchCourses: (...args: unknown[]) => fetchCourses(...args),
    fetchCategories: () => fetchCategories(),
    setCourseStatus: vi.fn(),
    deleteCourse: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function renderTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CoursesTable />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchCategories.mockResolvedValue([{ id: 'cat-1', name: 'Backend', color: '#13aece' }]);
});

describe('CoursesTable', () => {
  it('renders a course row with its counts', async () => {
    fetchCourses.mockResolvedValue({ data: [row()], total: 1, page: 1, limit: 20 });

    renderTable();

    // DataTable renders a desktop table and a mobile card list, so every cell
    // appears twice — assert on presence, not uniqueness.
    expect((await screen.findAllByText('Node.js Fundamentals')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('nodejs-fundamentals').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/8 ch · 42 items/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('1,204').length).toBeGreaterThan(0);
  });

  it('flags a course with no category, since it blocks publishing', async () => {
    fetchCourses.mockResolvedValue({
      data: [row({ category: null, status: 'DRAFT', isPublic: false })],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderTable();

    expect((await screen.findAllByText('None')).length).toBeGreaterThan(0);
  });

  it('offers import and a blank form when there are no courses at all', async () => {
    fetchCourses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    renderTable();

    expect(await screen.findByText('No courses yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import a course from JSON/i })).toBeInTheDocument();
  });

  it('offers Unpublish for a waitlist course, which is already public', async () => {
    // The row menu used to branch on status === 'PUBLISHED', so a WAITLIST
    // course — public, but with its own status — was offered "Publish" again.
    fetchCourses.mockResolvedValue({
      data: [row({ status: 'WAITLIST', isWaiting: true, isPublic: true })],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderTable();
    await screen.findAllByText('Node.js Fundamentals');
    await userEvent.click(screen.getAllByRole('button', { name: /open menu|actions/i })[0]);

    expect(await screen.findByText('Unpublish')).toBeInTheDocument();
    expect(screen.queryByText('Publish')).not.toBeInTheDocument();
  });

  it('offers neither publish action while a course is archived', async () => {
    fetchCourses.mockResolvedValue({
      data: [row({ status: 'ARCHIVED', archivedAt: '2026-02-01T00:00:00.000Z' })],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderTable();
    await screen.findAllByText('Node.js Fundamentals');
    await userEvent.click(screen.getAllByRole('button', { name: /open menu|actions/i })[0]);

    // Restore is the only sensible first step out of the archive.
    expect(await screen.findByText('Restore')).toBeInTheDocument();
    expect(screen.queryByText('Publish')).not.toBeInTheDocument();
    expect(screen.queryByText('Unpublish')).not.toBeInTheDocument();
  });

  it('sends the active filters to the API', async () => {
    fetchCourses.mockResolvedValue({ data: [row()], total: 1, page: 1, limit: 20 });

    renderTable();
    await screen.findAllByText('Node.js Fundamentals');

    await waitFor(() => {
      expect(fetchCourses).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20, sort: 'createdAt', order: 'desc' }),
      );
    });
  });
});
