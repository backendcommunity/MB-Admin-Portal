import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fetchTemplates = vi.fn();
const deleteTemplate = vi.fn();

vi.mock('@/lib/api/mockInterviews', () => ({
  fetchTemplates: (...args: unknown[]) => fetchTemplates(...args),
  deleteTemplate: (...args: unknown[]) => deleteTemplate(...args),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import MockInterviewsTable from '@/components/mock-interviews/MockInterviewsTable';
import { toast } from 'sonner';

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const template = (over: Partial<any> = {}) => ({
  id: 't-1',
  name: 'Go Backend',
  position: 'Backend Engineer',
  seniority: 'Senior',
  style: 'Technical',
  difficulty: 'Medium',
  topics: ['golang'],
  isPublic: true,
  isCustom: false,
  addedBy: null,
  attemptCount: 2,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('MockInterviewsTable', () => {
  it('renders a row per template', async () => {
    fetchTemplates.mockResolvedValue({ data: [template()], total: 1, page: 1, limit: 25 });
    wrap(<MockInterviewsTable />);
    // The name is unique — DataTable's mobile title collapses it with the
    // role so it never repeats the bare name (see mobileTitle below). Status
    // has its own column, though, and DataTable renders a desktop table and
    // a mobile card list from the same cell defs, so "Published" appears
    // twice — assert on presence, not uniqueness, as CoursesTable.test.tsx
    // does for every plain column value.
    expect(await screen.findByText('Go Backend')).toBeInTheDocument();
    expect(screen.getAllByText('Published').length).toBeGreaterThan(0);
  });

  // Review finding: every fixture above defaults `isPublic: true` and
  // `addedBy: null`, so nothing would fail if the Status column always said
  // "Published" or the Owner column always said "Platform" — both are true
  // for every row in this suite by coincidence, not by assertion. A DRAFT
  // row (isPublic: false) with a non-null `addedBy` pins down the other
  // branch of each column.
  it('renders a DRAFT row as Draft, and labels a non-null addedBy as Authored (never a claimed role)', async () => {
    fetchTemplates.mockResolvedValue({
      data: [template({ isPublic: false, addedBy: 'instructor-1' })],
      total: 1,
      page: 1,
      limit: 25,
    });
    wrap(<MockInterviewsTable />);

    await screen.findByText('Go Backend');
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Published').length).toBe(0);
    expect(screen.getAllByText('Authored').length).toBeGreaterThan(0);
    // `addedBy` is just an id — the payload carries no role for it, and
    // "Instructor" would claim one the data does not have (an admin-authored
    // row looks identical on the wire).
    expect(screen.queryAllByText('Instructor').length).toBe(0);
  });

  it('badges a learner-generated template', async () => {
    fetchTemplates.mockResolvedValue({
      data: [template({ isCustom: true })],
      total: 1,
      page: 1,
      limit: 25,
    });
    wrap(<MockInterviewsTable />);
    expect(await screen.findByText(/custom/i)).toBeInTheDocument();
  });

  it('says "nothing authored yet" when the account has no templates at all', async () => {
    fetchTemplates.mockResolvedValue({ data: [], total: 0, page: 1, limit: 25 });
    wrap(<MockInterviewsTable />);
    expect(await screen.findByText(/not authored/i)).toBeInTheDocument();
  });

  it('requests scope=mine — the list is the author’s own content, not the catalogue', async () => {
    fetchTemplates.mockResolvedValue({ data: [], total: 0, page: 1, limit: 25 });
    wrap(<MockInterviewsTable />);
    await waitFor(() => expect(fetchTemplates).toHaveBeenCalled());
    expect(fetchTemplates.mock.calls[0][0]).toMatchObject({ scope: 'mine' });
  });

  // The two empty states are different problems and must read differently —
  // this locks in the "filters active" wording, which no other test above
  // exercises (they only cover the "nothing authored at all" case).
  it('says "nothing matches" — not "not authored" — when a filter narrows the list to zero', async () => {
    fetchTemplates.mockResolvedValue({ data: [template()], total: 1, page: 1, limit: 25 });
    wrap(<MockInterviewsTable />);
    await screen.findByText('Go Backend');

    fetchTemplates.mockResolvedValue({ data: [], total: 0, page: 1, limit: 25 });
    await userEvent.type(
      screen.getByLabelText('Search mock interview templates'),
      'nothing-will-match',
    );

    expect(await screen.findByText(/nothing matches those filters/i)).toBeInTheDocument();
    expect(screen.queryByText(/not authored/i)).not.toBeInTheDocument();
  });

  // The API's rejection message carries the attempt count
  // ("Cannot delete: 3 learner attempts…") — that detail is the whole point
  // of the message, so it must reach the toast verbatim, not a generic string.
  it('surfaces the API error message verbatim when a delete is refused', async () => {
    fetchTemplates.mockResolvedValue({ data: [template()], total: 1, page: 1, limit: 25 });
    deleteTemplate.mockRejectedValue({
      response: { data: { message: 'Cannot delete: 3 learner attempts reference this template.' } },
    });
    wrap(<MockInterviewsTable />);
    await screen.findByText('Go Backend');

    await userEvent.click(screen.getAllByRole('button', { name: /actions for go backend/i })[0]);
    await userEvent.click(await screen.findByText('Delete'));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteTemplate).toHaveBeenCalledWith('t-1'));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Could not delete it',
        expect.objectContaining({
          description: 'Cannot delete: 3 learner attempts reference this template.',
        }),
      ),
    );
  });

  // A narrower filter can leave the current page past the end of the new,
  // smaller result set — nothing else above ever advances past page 1.
  it('resets to page 1 when a filter changes, after paging forward', async () => {
    fetchTemplates.mockResolvedValue({ data: [template()], total: 30, page: 1, limit: 25 });
    wrap(<MockInterviewsTable />);
    await screen.findByText('Go Backend');

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(fetchTemplates.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 }));

    await userEvent.type(screen.getByLabelText('Search mock interview templates'), 'x');
    await waitFor(() =>
      expect(fetchTemplates.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1, q: 'x' }),
    );
  });
});
