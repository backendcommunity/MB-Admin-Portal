/**
 * The instructor's dashboard used to be `EmptyModulePage` — a permanent "No
 * data yet" regardless of how much they had authored. This covers the real
 * one: per-kind authored counts, the draft figure (the single most
 * actionable number on the page), the brand-new-instructor empty state, and
 * that one kind's API failure doesn't take the rest of the page down with
 * it.
 *
 * Mocked at the API-client boundary (the `@/lib/api/*` modules), following
 * the pattern in OffersDashboard.test.tsx rather than mocking axios or
 * react-query itself.
 */
import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import InstructorDashboard from '../InstructorDashboard';
import type { CourseListRow, CourseListResponse } from '@/lib/api/courses';
import type { PathListRow, PathListResponse } from '@/lib/api/paths';
import type { Project, Paged as ProjectPaged } from '@/lib/api/projects';
import type { Bootcamp, Paged as BootcampPaged } from '@/lib/api/bootcamps';
import type { Offer, PaginatedOffers } from '@/lib/api/offers';
import type { EarningsSummary } from '@/lib/api/instructor';

const fetchCourses = vi.fn();
const fetchPaths = vi.fn();
const fetchProjects = vi.fn();
const fetchBootcamps = vi.fn();
const getOffers = vi.fn();
const fetchEarningsSummary = vi.fn();

vi.mock('@/lib/api/courses', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/courses')>('@/lib/api/courses');
  return { ...actual, fetchCourses: (...args: unknown[]) => fetchCourses(...args) };
});
vi.mock('@/lib/api/paths', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/paths')>('@/lib/api/paths');
  return { ...actual, fetchPaths: (...args: unknown[]) => fetchPaths(...args) };
});
vi.mock('@/lib/api/projects', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/projects')>('@/lib/api/projects');
  return { ...actual, fetchProjects: (...args: unknown[]) => fetchProjects(...args) };
});
vi.mock('@/lib/api/bootcamps', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/bootcamps')>('@/lib/api/bootcamps');
  return { ...actual, fetchBootcamps: (...args: unknown[]) => fetchBootcamps(...args) };
});
vi.mock('@/lib/api/offers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/offers')>('@/lib/api/offers');
  return { ...actual, getOffers: (...args: unknown[]) => getOffers(...args) };
});
vi.mock('@/lib/api/instructor', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/instructor')>('@/lib/api/instructor');
  return { ...actual, fetchEarningsSummary: () => fetchEarningsSummary() };
});

/* ─────────────────────────────── fixtures ─────────────────────────────── */

const course = (overrides: Partial<CourseListRow> = {}): CourseListRow => ({
  id: 'course-1',
  title: 'Backend Fundamentals',
  slug: 'backend-fundamentals',
  summary: '',
  banner: null,
  type: 'VIDEO',
  level: null,
  category: null,
  isPublic: true,
  isPremium: false,
  amount: 0,
  isWaiting: false,
  archivedAt: null,
  status: 'PUBLISHED',
  tags: [],
  languages: [],
  counts: { chapters: 1, items: 1, enrolled: 10 },
  totalDuration: 60,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastUpdated: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const path = (overrides: Partial<PathListRow> = {}): PathListRow => ({
  id: 'path-1',
  title: 'API Design Path',
  slug: 'api-design-path',
  summary: '',
  banner: null,
  level: '',
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
  estimatedWeeks: 0,
  hoursPerWeek: 0,
  counts: { topics: 0, enrolled: 0 },
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  title: 'Build a REST API',
  slug: 'build-a-rest-api',
  summary: '',
  description: '',
  banner: '',
  level: 'Beginner',
  duration: 0,
  skills: [],
  technologies: [],
  prerequisites: [],
  industries: [],
  languages: [],
  isPremium: false,
  amount: 0,
  isSample: false,
  isWaiting: true,
  status: 'draft',
  waitingLink: '',
  baseRepository: '',
  frontendURL: '',
  referenceApiURL: '',
  PRDLink: '',
  playgroundConfig: null,
  mode: 'rest-api',
  language: '',
  entrypoint: '',
  terminalJail: true,
  showPreviewOnLoad: false,
  createdAt: '2026-01-03T00:00:00.000Z',
  updatedAt: '2026-01-03T00:00:00.000Z',
  ...overrides,
});

const bootcamp = (overrides: Partial<Bootcamp> = {}): Bootcamp => ({
  id: 'bootcamp-1',
  title: 'Backend Bootcamp',
  slug: 'backend-bootcamp',
  summary: '',
  banner: '',
  level: 'Beginner',
  topics: [],
  createdAt: '2026-01-04T00:00:00.000Z',
  updatedAt: '2026-01-04T00:00:00.000Z',
  ...overrides,
});

const offer = (overrides: Partial<Offer> = {}): Offer => ({
  id: 'offer-1',
  title: 'Launch Ship',
  summary: '',
  description: null,
  slug: 'launch-ship',
  isPremium: false,
  isWaiting: true,
  amount: 0,
  createdAt: '2026-01-05T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
  ...overrides,
});

const earnings = (overrides: Partial<EarningsSummary> = {}): EarningsSummary => ({
  totalEarned: 0,
  pendingPayout: 0,
  currentBalance: 0,
  totalPayouts: 0,
  ...overrides,
});

const emptyPage = <T,>(): { data: T[]; total: number; page: number; limit: number } => ({
  data: [],
  total: 0,
  page: 1,
  limit: 100,
});

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InstructorDashboard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InstructorDashboard — authored counts and drafts', () => {
  beforeEach(() => {
    fetchCourses.mockImplementation((params: { status?: string } = {}) => {
      if (params.status === 'DRAFT') {
        return Promise.resolve({ data: [], total: 3, page: 1, limit: 1 } as CourseListResponse);
      }
      return Promise.resolve({
        data: [
          course({ id: 'c1', counts: { chapters: 1, items: 1, enrolled: 10 } }),
          course({ id: 'c2', counts: { chapters: 1, items: 1, enrolled: 5 } }),
        ],
        total: 5,
        page: 1,
        limit: 100,
      } as CourseListResponse);
    });

    fetchPaths.mockImplementation((params: { status?: string } = {}) => {
      if (params.status === 'DRAFT') {
        return Promise.resolve({ data: [], total: 0, page: 1, limit: 1 } as PathListResponse);
      }
      return Promise.resolve({
        data: [path()],
        total: 2,
        page: 1,
        limit: 100,
      } as PathListResponse);
    });

    fetchProjects.mockImplementation((params: { status?: string } = {}) => {
      if (params.status === 'draft') {
        return Promise.resolve({ data: [], total: 1, page: 1, limit: 1 } as ProjectPaged<Project>);
      }
      return Promise.resolve({
        data: [project()],
        total: 1,
        page: 1,
        limit: 100,
      } as ProjectPaged<Project>);
    });

    fetchBootcamps.mockResolvedValue({
      data: [bootcamp()],
      total: 1,
      page: 1,
      limit: 100,
    } as BootcampPaged<Bootcamp>);

    getOffers.mockResolvedValue({
      data: [offer({ isWaiting: true })],
      total: 1,
      page: 1,
      limit: 100,
    } as PaginatedOffers);

    fetchEarningsSummary.mockResolvedValue(earnings({ totalEarned: 250.5, currentBalance: 400 }));
  });

  it("shows each kind's authored total", async () => {
    renderDashboard();

    const coursesCard = screen.getByTestId('kind-card-courses');
    expect(await within(coursesCard).findByText('5')).toBeInTheDocument();

    const pathsCard = screen.getByTestId('kind-card-paths');
    expect(await within(pathsCard).findByText('2')).toBeInTheDocument();

    const projectsCard = screen.getByTestId('kind-card-projects');
    expect(await within(projectsCard).findByText('1')).toBeInTheDocument();

    const bootcampsCard = screen.getByTestId('kind-card-bootcamps');
    expect(await within(bootcampsCard).findByText('1')).toBeInTheDocument();

    const shipsCard = screen.getByTestId('kind-card-ships');
    expect(await within(shipsCard).findByText('1')).toBeInTheDocument();
  });

  it('sums the enrolled count across the fetched courses as learners reached', async () => {
    renderDashboard();

    const coursesCard = screen.getByTestId('kind-card-courses');
    expect(await within(coursesCard).findByText('Learners reached')).toBeInTheDocument();
    expect(within(coursesCard).getByText('15')).toBeInTheDocument();
  });

  it('surfaces the draft figure prominently when drafts exist, and marks a fully-published kind distinctly', async () => {
    renderDashboard();

    const coursesCard = screen.getByTestId('kind-card-courses');
    expect(await within(coursesCard).findByText('3 drafts')).toBeInTheDocument();

    const projectsCard = screen.getByTestId('kind-card-projects');
    expect(await within(projectsCard).findByText('1 draft')).toBeInTheDocument();

    const shipsCard = screen.getByTestId('kind-card-ships');
    expect(await within(shipsCard).findByText('1 draft')).toBeInTheDocument();

    // Paths has zero drafts among its 2 — that reads as "all published",
    // not silence.
    const pathsCard = screen.getByTestId('kind-card-paths');
    expect(await within(pathsCard).findByText('All published')).toBeInTheDocument();
  });

  it('does not show a draft badge for Bootcamps, whose list row exposes no publish-state field', async () => {
    renderDashboard();

    const bootcampsCard = screen.getByTestId('kind-card-bootcamps');
    // Wait for its content to actually resolve before asserting an absence.
    expect(await within(bootcampsCard).findByText('1')).toBeInTheDocument();
    expect(within(bootcampsCard).queryByText(/draft/i)).not.toBeInTheDocument();
    expect(within(bootcampsCard).queryByText(/published/i)).not.toBeInTheDocument();
  });

  it('renders the earnings summary using the shared currency formatter', async () => {
    renderDashboard();

    const earningsCard = screen.getByTestId('earnings-card');
    expect(await within(earningsCard).findByText('$250.50')).toBeInTheDocument();
    expect(within(earningsCard).getByText('$400.00')).toBeInTheDocument();
  });

  it('lists recently updated items linking to their edit pages', async () => {
    renderDashboard();

    const recent = screen.getByTestId('recent-updated');
    // The offer is the most recently updated fixture (2026-01-05).
    const link = await within(recent).findByRole('link', { name: /launch ship/i });
    expect(link).toHaveAttribute('href', '/offers');
  });
});

describe('InstructorDashboard — brand-new instructor', () => {
  it('shows the empty state instead of a row of zeros when nothing has been authored', async () => {
    fetchCourses.mockResolvedValue(emptyPage<CourseListRow>());
    fetchPaths.mockResolvedValue(emptyPage<PathListRow>());
    fetchProjects.mockResolvedValue(emptyPage<Project>());
    fetchBootcamps.mockResolvedValue(emptyPage<Bootcamp>());
    getOffers.mockResolvedValue(emptyPage<Offer>());
    fetchEarningsSummary.mockResolvedValue(earnings());

    renderDashboard();

    expect(await screen.findByText('Nothing published yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create a course/i })).toHaveAttribute(
      'href',
      '/courses/new',
    );

    // No zeros dressed up as achievement, and no per-kind cards at all.
    expect(screen.queryByTestId('kind-card-courses')).not.toBeInTheDocument();
    expect(screen.queryByTestId('earnings-card')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

describe('InstructorDashboard — partial failure', () => {
  it("degrades only the failing kind's card, leaving the rest of the page usable", async () => {
    fetchCourses.mockImplementation((params: { status?: string } = {}) => {
      if (params.status === 'DRAFT') {
        return Promise.resolve({ data: [], total: 0, page: 1, limit: 1 } as CourseListResponse);
      }
      return Promise.resolve({
        data: [course()],
        total: 2,
        page: 1,
        limit: 100,
      } as CourseListResponse);
    });
    fetchPaths.mockResolvedValue(emptyPage<PathListRow>());
    fetchProjects.mockResolvedValue(emptyPage<Project>());
    // Bootcamps is the one that fails.
    fetchBootcamps.mockRejectedValue(new Error('network down'));
    getOffers.mockResolvedValue(emptyPage<Offer>());
    fetchEarningsSummary.mockResolvedValue(earnings());

    renderDashboard();

    const bootcampsCard = screen.getByTestId('kind-card-bootcamps');
    expect(await within(bootcampsCard).findByText(/couldn't load bootcamps/i)).toBeInTheDocument();
    expect(within(bootcampsCard).getByRole('button', { name: /retry/i })).toBeInTheDocument();

    // Courses, unaffected, still renders its real total.
    const coursesCard = await screen.findByTestId('kind-card-courses');
    await waitFor(() => expect(within(coursesCard).getByText('2')).toBeInTheDocument());
  });
});
