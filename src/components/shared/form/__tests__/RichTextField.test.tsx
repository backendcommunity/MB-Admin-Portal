import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const uploadProseMedia = vi.fn();

vi.mock('@/lib/api/courses', () => ({
  uploadProseMedia: (...args: unknown[]) => uploadProseMedia(...args),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

import { RichTextField } from '../RichTextField';
import { sanitizeHtml } from '@/lib/richtext';
import { toast } from 'sonner';

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <RichTextField value={value} onChange={setValue} label="Body" id="body" />;
}

/** Places a collapsed caret `offset` characters into the editor's first paragraph text. */
function placeCaret(editor: HTMLElement, offset: number) {
  const textNode = editor.querySelector('p')?.firstChild;
  if (!textNode) throw new Error('expected a text node to place the caret in');
  const range = document.createRange();
  range.setStart(textNode, offset);
  range.setEnd(textNode, offset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function makeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('RichTextField media uploads', () => {
  beforeEach(() => {
    uploadProseMedia.mockReset();
    (toast.error as ReturnType<typeof vi.fn>).mockReset();
  });

  it('inserts an uploaded image at the caret, not at the end', async () => {
    uploadProseMedia.mockResolvedValue('https://media.example.com/courses/media/a.png');
    render(<Harness initial="<p>Hello World</p>" />);

    const editor = screen.getByLabelText('Body');
    await waitFor(() => expect(editor.innerHTML).toBe('<p>Hello World</p>'));

    placeCaret(editor, 5); // caret between "Hello" and " World"
    fireEvent.click(screen.getByTitle('Insert image'));

    const input = screen.getByTestId('richtext-image-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('pic.png', 'image/png', 1024)] } });
    await flush();

    expect(editor.innerHTML).toBe(
      '<p>Hello<img src="https://media.example.com/courses/media/a.png" alt=""> World</p>',
    );
    // The whole point of the caret capture: it lands mid-sentence, not appended.
    expect(editor.innerHTML.endsWith('World</p>')).toBe(true);
  });

  it('inserts an uploaded video with controls, and it survives the sanitizer', async () => {
    uploadProseMedia.mockResolvedValue('https://media.example.com/courses/media/b.mp4');
    render(<Harness initial="<p>Watch this</p>" />);

    const editor = screen.getByLabelText('Body');
    await waitFor(() => expect(editor.innerHTML).toBe('<p>Watch this</p>'));
    placeCaret(editor, 10); // end of "Watch this"

    fireEvent.click(screen.getByTitle('Insert video'));
    const input = screen.getByTestId('richtext-video-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('clip.mp4', 'video/mp4', 2048)] } });
    await flush();

    expect(editor.innerHTML).toBe(
      '<p>Watch this<video src="https://media.example.com/courses/media/b.mp4" controls=""></video></p>',
    );
    expect(sanitizeHtml(editor.innerHTML)).toBe(editor.innerHTML);
  });

  it('inserts an uploaded image, and it survives the sanitizer', async () => {
    uploadProseMedia.mockResolvedValue('https://media.example.com/courses/media/c.webp');
    render(<Harness initial="<p>Body</p>" />);
    const editor = screen.getByLabelText('Body');
    await waitFor(() => expect(editor.innerHTML).toBe('<p>Body</p>'));
    placeCaret(editor, 4);

    fireEvent.click(screen.getByTitle('Insert image'));
    const input = screen.getByTestId('richtext-image-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('a.webp', 'image/webp', 10)] } });
    await flush();

    expect(editor.innerHTML).toContain('<img ');
    expect(sanitizeHtml(editor.innerHTML)).toBe(editor.innerHTML);
  });

  it('refuses an oversize image client-side and does not upload', async () => {
    render(<Harness initial="<p>Body</p>" />);
    const editor = screen.getByLabelText('Body');
    await waitFor(() => expect(editor.innerHTML).toBe('<p>Body</p>'));
    placeCaret(editor, 4);

    fireEvent.click(screen.getByTitle('Insert image'));
    const input = screen.getByTestId('richtext-image-input') as HTMLInputElement;
    const tooBig = makeFile('huge.png', 'image/png', 9 * 1024 * 1024); // > 8MB cap
    fireEvent.change(input, { target: { files: [tooBig] } });
    await flush();

    expect(uploadProseMedia).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/8MB or smaller/));
    expect(editor.innerHTML).toBe('<p>Body</p>');
  });

  it('surfaces the server error message and inserts nothing on failure', async () => {
    uploadProseMedia.mockRejectedValue({
      response: { data: { message: 'That file is not a PNG, JPEG, WebP, GIF or AVIF image' } },
    });
    render(<Harness initial="<p>Body</p>" />);
    const editor = screen.getByLabelText('Body');
    await waitFor(() => expect(editor.innerHTML).toBe('<p>Body</p>'));
    placeCaret(editor, 4);

    fireEvent.click(screen.getByTitle('Insert image'));
    const input = screen.getByTestId('richtext-image-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('a.png', 'image/png', 10)] } });
    await flush();

    expect(toast.error).toHaveBeenCalledWith(
      'That file is not a PNG, JPEG, WebP, GIF or AVIF image',
    );
    expect(editor.innerHTML).toBe('<p>Body</p>');
  });

  it('blocks a second upload while one is already in flight', async () => {
    let resolveUpload: (url: string) => void = () => {};
    uploadProseMedia.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    render(<Harness initial="<p>Body</p>" />);
    const editor = screen.getByLabelText('Body');
    await waitFor(() => expect(editor.innerHTML).toBe('<p>Body</p>'));
    placeCaret(editor, 4);

    fireEvent.click(screen.getByTitle('Insert image'));
    const imageInput = screen.getByTestId('richtext-image-input') as HTMLInputElement;
    fireEvent.change(imageInput, { target: { files: [makeFile('a.png', 'image/png', 10)] } });
    await flush();

    expect(uploadProseMedia).toHaveBeenCalledTimes(1);
    expect(screen.getByTitle('Insert image')).toBeDisabled();
    expect(screen.getByTitle('Insert video')).toBeDisabled();

    // Second attempt while the first is still in flight: the button is
    // disabled, but also fire the change event directly to prove the
    // handler itself refuses concurrent uploads — not merely the disabled attribute.
    fireEvent.click(screen.getByTitle('Insert image'));
    fireEvent.change(imageInput, { target: { files: [makeFile('b.png', 'image/png', 10)] } });
    await flush();

    expect(uploadProseMedia).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveUpload('https://media.example.com/courses/media/d.png');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTitle('Insert image')).not.toBeDisabled();
  });
});
