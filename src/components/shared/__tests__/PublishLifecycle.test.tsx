import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { deriveLifecycle, SubmitForReviewControl } from '../PublishLifecycle';

const submitForReview = vi.fn();

vi.mock('@/lib/api/instructor', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/instructor')>('@/lib/api/instructor');
  return {
    ...actual,
    submitForReview: (...args: unknown[]) => submitForReview(...args),
  };
});

describe('deriveLifecycle', () => {
  it('is published once the live flag is set, regardless of isWaiting', () => {
    expect(deriveLifecycle({ isWaiting: false, isLive: true })).toBe('published');
    expect(deriveLifecycle({ isWaiting: true, isLive: true })).toBe('published');
  });

  it('is draft when nothing has been submitted', () => {
    expect(deriveLifecycle({ isWaiting: false, isLive: false })).toBe('draft');
  });

  it('is in review when submitted with no reviewer note', () => {
    expect(deriveLifecycle({ isWaiting: true, isLive: false })).toBe('in_review');
    expect(deriveLifecycle({ isWaiting: true, waitingLink: '', isLive: false })).toBe('in_review');
    expect(deriveLifecycle({ isWaiting: true, waitingLink: '   ', isLive: false })).toBe(
      'in_review',
    );
  });

  it('is changes requested when submitted with a non-blank note', () => {
    expect(
      deriveLifecycle({ isWaiting: true, waitingLink: 'Fix the thumbnail', isLive: false }),
    ).toBe('changes_requested');
  });
});

describe('SubmitForReviewControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers Submit for review from draft, and calls the submit endpoint', async () => {
    submitForReview.mockResolvedValue({
      success: true,
      id: 'c1',
      type: 'COURSE',
      status: 'PENDING_REVIEW',
    });
    const onSubmitted = vi.fn();
    render(
      <SubmitForReviewControl type="course" id="c1" state="draft" onSubmitted={onSubmitted} />,
    );

    expect(screen.getByText('Draft')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    await waitFor(() => expect(submitForReview).toHaveBeenCalledWith('course', 'c1'));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
  });

  it('offers Resubmit, and shows the reviewer note, when changes were requested', () => {
    render(
      <SubmitForReviewControl
        type="project"
        id="p1"
        state="changes_requested"
        note="The rubric needs a rework."
        onSubmitted={() => {}}
      />,
    );

    expect(screen.getByText('Changes requested')).toBeInTheDocument();
    expect(screen.getByText('The rubric needs a rework.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resubmit/i })).toBeInTheDocument();
  });

  it('offers no action once in review or published', () => {
    const { rerender } = render(
      <SubmitForReviewControl type="offer" id="o1" state="in_review" onSubmitted={() => {}} />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <SubmitForReviewControl type="offer" id="o1" state="published" onSubmitted={() => {}} />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
