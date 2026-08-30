/**
 * The picker has to hit the endpoint that exists.
 *
 * It was calling invented per-kind URLs — `/admin/library/videos` and friends —
 * against an API that serves one route keyed by `kind`. Every request 422'd,
 * the catch swallowed it, and the dropdown said "nothing matches", so a real
 * outage looked like an empty library.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
vi.mock('@/lib/api/axios', () => ({
  axiosInstance: { get: (...args: unknown[]) => get(...args) },
}));

import LibraryPicker from '../LibraryPicker';

function open() {
  fireEvent.focus(screen.getByLabelText('Video'));
}

describe('LibraryPicker', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: { data: [] } });
  });

  it('searches the one library endpoint, keyed by kind', async () => {
    render(<LibraryPicker kind="video" label="Video" value="" valueTitle="" onPick={() => {}} />);
    open();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const url = String(get.mock.calls[0][0]);
    expect(url).toContain('/admin/library?');
    expect(url).toContain('kind=video');
    // Not a per-kind route — those do not exist.
    expect(url).not.toContain('/admin/library/videos');
  });

  it('passes the typed term through as q', async () => {
    render(<LibraryPicker kind="quiz" label="Video" value="" valueTitle="" onPick={() => {}} />);
    open();
    fireEvent.change(screen.getByLabelText('Video'), { target: { value: 'redis' } });

    await waitFor(() => {
      const last = String(get.mock.calls.at(-1)?.[0]);
      expect(last).toContain('kind=quiz');
      expect(last).toContain('q=redis');
    });
  });

  it('renders what the endpoint returns, with its qualifier', async () => {
    get.mockResolvedValue({
      data: {
        data: [{ id: 'v1', title: 'Redis in Practice', meta: '12 min', context: 'Caching' }],
      },
    });
    render(<LibraryPicker kind="video" label="Video" value="" valueTitle="" onPick={() => {}} />);
    open();

    expect(await screen.findByText('Redis in Practice')).toBeInTheDocument();
    expect(screen.getByText('12 min · Caching')).toBeInTheDocument();
  });

  it('hands back the picked row', async () => {
    const onPick = vi.fn();
    get.mockResolvedValue({
      data: { data: [{ id: 'v1', title: 'Redis', meta: '', context: null }] },
    });
    render(<LibraryPicker kind="video" label="Video" value="" valueTitle="" onPick={onPick} />);
    open();

    fireEvent.click(await screen.findByText('Redis'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1', title: 'Redis' }));
  });

  it('says a failed search failed, instead of showing it as empty', async () => {
    get.mockRejectedValue(new Error('422'));
    render(<LibraryPicker kind="video" label="Video" value="" valueTitle="" onPick={() => {}} />);
    open();

    expect(await screen.findByText(/library search failed/i)).toBeInTheDocument();
  });

  it('closes when the pointer leaves, so three stacked pickers do not bury the form', async () => {
    get.mockResolvedValue({
      data: { data: [{ id: 'v1', title: 'Redis', meta: '', context: null }] },
    });
    const { container } = render(
      <LibraryPicker kind="video" label="Video" value="" valueTitle="" onPick={() => {}} />,
    );
    open();
    expect(await screen.findByText('Redis')).toBeInTheDocument();

    // Blur first: a list being typed into must survive the pointer moving away.
    fireEvent.blur(screen.getByLabelText('Video'));
    fireEvent.mouseLeave(container.firstChild as Element);

    await waitFor(() => expect(screen.queryByText('Redis')).not.toBeInTheDocument());
  });

  it('stays open while it still has focus', async () => {
    get.mockResolvedValue({
      data: { data: [{ id: 'v1', title: 'Redis', meta: '', context: null }] },
    });
    const { container } = render(
      <LibraryPicker kind="video" label="Video" value="" valueTitle="" onPick={() => {}} />,
    );
    open();
    expect(await screen.findByText('Redis')).toBeInTheDocument();

    // Focused — a keyboard user never moves a pointer.
    fireEvent.mouseLeave(container.firstChild as Element);
    expect(screen.getByText('Redis')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    get.mockResolvedValue({
      data: { data: [{ id: 'v1', title: 'Redis', meta: '', context: null }] },
    });
    render(<LibraryPicker kind="video" label="Video" value="" valueTitle="" onPick={() => {}} />);
    open();
    expect(await screen.findByText('Redis')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText('Video'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Redis')).not.toBeInTheDocument());
  });

  it('shows the stored title when something is already linked', () => {
    render(
      <LibraryPicker
        kind="video"
        label="Video"
        value="v1"
        valueTitle="Redis in Practice"
        onPick={() => {}}
      />,
    );
    expect(screen.getByText('Redis in Practice')).toBeInTheDocument();
    expect(screen.getByText('Change')).toBeInTheDocument();
  });
});
