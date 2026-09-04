/**
 * Instructors have scoped CRUD on their own courses. The API refuses a
 * non-staff payload that merely CONTAINS a pricing key (`amount`,
 * `isPremium`, `paddle_price_id`, `paddlePlanCode`, …) at all, regardless of
 * value (`assertMayWriteFields` in the academy repo's field-guard.ts) — same
 * rule as Ships (OffersDashboard) and cohorts (CohortFormDialog).
 *
 * The course create/update forms never got the `stripPricingFields`
 * treatment those two got: `createCourse`/`updateCourse` were always called
 * with the full draft, including `isPremium`/`amount`/`paddle_price_id`/
 * `paddlePlanCode` — so an instructor's very first course save 403'd.
 *
 * Fix (same pattern as commits faeee54 / 8f83142): strip the pricing keys
 * from the outgoing payload for a non-staff caller, on both create and
 * update, and disable the pricing inputs for that caller with a visible
 * reason via `StaffOnly`.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import NewCourseClient from '../NewCourseClient';
import CourseDetailClient from '../CourseDetailClient';
import { useAuthStore } from '@/store/authStore';
import type { CourseDetail } from '@/lib/api/courses';

const createCourse = vi.fn();
const updateCourse = vi.fn();
const fetchCourse = vi.fn();
const fetchCategories = vi.fn();
const setCourseStatus = vi.fn();

vi.mock('@/lib/api/courses', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/courses')>('@/lib/api/courses');
  return {
    ...actual,
    createCourse: (...args: unknown[]) => createCourse(...args),
    updateCourse: (...args: unknown[]) => updateCourse(...args),
    fetchCourse: (...args: unknown[]) => fetchCourse(...args),
    fetchCategories: (...args: unknown[]) => fetchCategories(...args),
    setCourseStatus: (...args: unknown[]) => setCourseStatus(...args),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: 'course-1' }),
}));

const asRole = (role: string, authResolved = true) =>
  useAuthStore.setState({ userRole: role as never, authResolved });

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const course = (overrides: Partial<CourseDetail> = {}): CourseDetail => ({
  id: 'course-1',
  title: 'Distributed Systems',
  slug: 'distributed-systems',
  summary: 'Learn distributed systems.',
  banner: null,
  type: 'VIDEO',
  level: 'Intermediate',
  category: null,
  isPublic: false,
  isPremium: true,
  amount: 4999,
  isWaiting: false,
  archivedAt: null,
  status: 'DRAFT',
  tags: [],
  languages: [],
  counts: { chapters: 0, items: 0, enrolled: 0 },
  totalDuration: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastUpdated: '2026-01-01T00:00:00.000Z',
  description: null,
  categoryId: null,
  preview: null,
  vimeoFolderURI: null,
  vimeoFolderId: null,
  waitingLink: null,
  productId: null,
  paddlePlanCode: null,
  paddle_price_id: 'pri_123',
  createdById: null,
  chapters: [],
  capstone: {
    projects: [],
    mockInterviews: [],
    quizzes: [],
    exercises: [],
    videos: [],
    articles: [],
  },
  stats: { enrolled: 0, completed: 0, completionRate: 0 },
  readiness: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchCategories.mockResolvedValue([]);
  createCourse.mockResolvedValue({ id: 'course-1' });
  updateCourse.mockResolvedValue(course());
  fetchCourse.mockResolvedValue(course());
});

describe('NewCourseClient — instructor create payload', () => {
  it('sends no pricing keys when an instructor creates a course', async () => {
    asRole('INSTRUCTOR');
    renderWithClient(<NewCourseClient />);

    await userEvent.type(screen.getByLabelText(/^title/i), 'My New Course');
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(createCourse).toHaveBeenCalled());
    const payload = createCourse.mock.calls[0][0];
    expect('amount' in payload).toBe(false);
    expect('isPremium' in payload).toBe(false);
    expect('paddle_price_id' in payload).toBe(false);
    expect('paddlePlanCode' in payload).toBe(false);
    expect(payload).toMatchObject({ title: 'My New Course' });
  });

  it('still sends the pricing keys, unchanged, when an admin creates a course', async () => {
    asRole('ADMIN');
    renderWithClient(<NewCourseClient />);

    await userEvent.type(screen.getByLabelText(/^title/i), 'Priced Course');
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(createCourse).toHaveBeenCalled());
    const payload = createCourse.mock.calls[0][0];
    expect(payload).toMatchObject({ isPremium: false, amount: 0 });
  });
});

describe('NewCourseClient — pricing input gating', () => {
  it('disables the premium switch for an instructor, with a reason', async () => {
    asRole('INSTRUCTOR');
    renderWithClient(<NewCourseClient />);

    await screen.findByLabelText(/^title/i);
    expect(screen.getByLabelText(/premium/i)).toBeDisabled();
    expect(screen.getByText(/only an admin can set the premium flag/i)).toBeInTheDocument();
  });

  it('leaves the premium switch enabled for an admin', async () => {
    asRole('ADMIN');
    renderWithClient(<NewCourseClient />);

    await screen.findByLabelText(/^title/i);
    expect(screen.getByLabelText(/premium/i)).toBeEnabled();
  });
});

describe('CourseDetailClient — instructor edit payload', () => {
  it('saves a title-only edit without any pricing key, even on an already-premium course', async () => {
    asRole('INSTRUCTOR');
    renderWithClient(<CourseDetailClient />);

    const titleInput = await screen.findByLabelText(/^title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Renamed Course');
    await userEvent.click(screen.getAllByRole('button', { name: /save changes/i })[0]);

    await waitFor(() => expect(updateCourse).toHaveBeenCalled());
    const [id, payload] = updateCourse.mock.calls[0];
    expect(id).toBe('course-1');
    expect(payload.title).toBe('Renamed Course');
    expect('amount' in payload).toBe(false);
    expect('isPremium' in payload).toBe(false);
    expect('paddle_price_id' in payload).toBe(false);
    expect('paddlePlanCode' in payload).toBe(false);
  });

  it('still sends the pricing keys, unchanged, when an admin edits the same course', async () => {
    asRole('ADMIN');
    renderWithClient(<CourseDetailClient />);

    const titleInput = await screen.findByLabelText(/^title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Renamed Course');
    await userEvent.click(screen.getAllByRole('button', { name: /save changes/i })[0]);

    await waitFor(() => expect(updateCourse).toHaveBeenCalled());
    const [, payload] = updateCourse.mock.calls[0];
    expect(payload).toMatchObject({ isPremium: true, amount: 4999, paddle_price_id: 'pri_123' });
  });
});

/**
 * Item 9/10: the two Paddle inputs used to render StaffOnly — visible but
 * disabled, with a reason — same as Premium and Price. Per the owner's
 * answer in §6 of the fix plan, Premium and Price stay that way (an
 * instructor benefits from seeing them even though they can't set them),
 * but the two Paddle fields are payment-processor plumbing an instructor
 * can't act on and should not render at all, matching the treatment the
 * cohort form already gives its own Paddle/AsyncPay/subscription fields.
 */
describe('CourseDetailClient — Paddle field gating (course is already premium)', () => {
  it('renders no Paddle price ID or Paddle plan code input for an instructor', async () => {
    asRole('INSTRUCTOR');
    renderWithClient(<CourseDetailClient />);

    await screen.findByLabelText(/^title/i);
    fireEvent.click(screen.getByRole('tab', { name: 'Access & pricing' }));

    expect(await screen.findByLabelText(/premium/i)).toBeDisabled();
    // Premium and Price stay visible, just disabled — this fix must not widen.
    expect(screen.getByLabelText(/^price/i)).toBeDisabled();
    expect(screen.queryByLabelText(/paddle price id/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/paddle plan code/i)).not.toBeInTheDocument();
  });

  it('still renders both Paddle inputs, enabled, for an admin', async () => {
    asRole('ADMIN');
    renderWithClient(<CourseDetailClient />);

    await screen.findByLabelText(/^title/i);
    fireEvent.click(screen.getByRole('tab', { name: 'Access & pricing' }));

    expect(await screen.findByLabelText(/paddle price id/i)).toBeEnabled();
    expect(screen.getByLabelText(/paddle plan code/i)).toBeEnabled();
  });
});
