import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuthStore } from '@/store/authStore';
import { STANDARD_RUBRIC } from '@/lib/mockInterviews/constants';

const createTemplate = vi.fn();
const push = vi.fn();

vi.mock('@/lib/api/mockInterviews', () => ({
  createTemplate: (...args: unknown[]) => createTemplate(...args),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// The portal has no `@/lib/auth/useAuth` hook — the real session lives in the
// `useAuthStore` zustand store (`userRole` + `authResolved`), read directly by
// consumers like `useRoleGuard`/`ProtectedPage` and `NewCourseClient`. Setting
// state on the real store (rather than mocking a hook that doesn't exist)
// matches how every other create-page test in this repo drives role.
const asRole = (role: string, authResolved = true) =>
  useAuthStore.setState({ userRole: role as never, authResolved });

import NewTemplateClient from '@/components/mock-interviews/NewTemplateClient';

const wrap = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <NewTemplateClient />
      </QueryClientProvider>,
    ),
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  asRole('ADMIN');
  createTemplate.mockResolvedValue({ id: 't-new' });
});

describe('NewTemplateClient', () => {
  it('renders every field group, not a stub', () => {
    wrap();
    for (const label of [
      /name/i,
      /summary/i,
      /description/i,
      /company/i,
      /position/i,
      /seniority/i,
      /style/i,
      /format/i,
      /category/i,
      /difficulty/i,
      /duration/i,
      /questions/i,
      /topics/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /add criterion/i })).toBeInTheDocument();
  });

  it('keeps Create disabled until name and duration are both present', () => {
    wrap();
    const create = screen.getByRole('button', { name: /^create$/i });
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Go Backend' } });
    expect(create).toBeEnabled();
  });

  it('posts every entered field', async () => {
    wrap();
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Go Backend' } });
    fireEvent.change(screen.getByLabelText(/summary/i), { target: { value: 'A summary' } });
    fireEvent.change(screen.getByLabelText(/position/i), { target: { value: 'Backend Engineer' } });
    fireEvent.click(screen.getByRole('button', { name: /standard three/i }));
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(createTemplate).toHaveBeenCalled());
    const payload = createTemplate.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: 'Go Backend',
      summary: 'A summary',
      position: 'Backend Engineer',
      format: 'Chat',
    });
    expect(payload.evaluationRubric).toHaveLength(3);
  });

  it('posts the complete payload — every writable field, none silently dropped', async () => {
    // Guards the failure mode called out explicitly for this page: a field
    // that a `...form` spread quietly loses on its way to the request body.
    // `toMatchObject` in the test above only samples a few keys, so a
    // regression dropping an untested key (e.g. `topics`, `category`) would
    // pass that test — this one fills and asserts EVERY writable field via
    // exact equality, so nothing has room to go missing unnoticed.
    const user = userEvent.setup();
    wrap();

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Full Stack' } });
    fireEvent.change(screen.getByLabelText(/^summary/i), { target: { value: 'Full summary' } });
    fireEvent.change(screen.getByLabelText(/^description/i), {
      target: { value: 'Full description' },
    });
    fireEvent.change(screen.getByLabelText(/^company/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/^position/i), { target: { value: 'Backend Eng' } });
    fireEvent.change(screen.getByLabelText(/^seniority/i), { target: { value: 'Senior' } });
    fireEvent.change(screen.getByLabelText(/^category/i), { target: { value: 'Backend' } });
    fireEvent.change(screen.getByLabelText(/^duration/i), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText(/^questions/i), { target: { value: '5' } });

    await user.click(screen.getByLabelText(/^style/i));
    await user.click(await screen.findByRole('option', { name: 'Coding' }));

    await user.click(screen.getByLabelText(/^difficulty/i));
    await user.click(await screen.findByRole('option', { name: 'Hard' }));

    await user.type(screen.getByLabelText(/^topics/i), 'Golang{enter}');

    fireEvent.click(screen.getByRole('button', { name: /standard three/i }));
    fireEvent.click(screen.getByLabelText(/publish immediately/i));

    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(createTemplate).toHaveBeenCalled());
    const payload = createTemplate.mock.calls[0][0];

    expect(payload).toEqual({
      name: 'Full Stack',
      summary: 'Full summary',
      description: 'Full description',
      company: 'Acme',
      position: 'Backend Eng',
      seniority: 'Senior',
      style: 'Coding',
      format: 'Chat',
      category: 'Backend',
      difficulty: 'Hard',
      duration: 45,
      questions: 5,
      topics: ['Golang'],
      evaluationRubric: STANDARD_RUBRIC,
      isPublic: true,
    });
  });

  it('offers an admin a publish checkbox, off by default', () => {
    wrap();
    const box = screen.getByLabelText(/publish immediately/i);
    expect(box).not.toBeChecked();
  });

  it('offers an instructor no publish control, and says why', () => {
    asRole('INSTRUCTOR');
    wrap();
    expect(screen.queryByLabelText(/publish immediately/i)).toBeNull();
    expect(screen.getByText(/an admin publishes/i)).toBeInTheDocument();
  });

  it('refuses to submit while a rubric weight is not positive', async () => {
    wrap();
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Go' } });
    fireEvent.click(screen.getByRole('button', { name: /add criterion/i }));
    fireEvent.change(screen.getByLabelText(/^weight/i), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
  });

  it('routes to the new template after creating', async () => {
    wrap();
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Go' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/mock-interviews/t-new'));
  });

  it('invalidates the admin list cache before navigating away', async () => {
    // The list route uses a 60s staleTime, so a create that skips
    // invalidation would leave a returning admin looking at a stale list
    // missing the row they just made — this would pass every other test
    // here (they don't touch caching) if it regressed.
    const { client } = wrap();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Go' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin-mock-interviews'] }),
    );
  });
});
