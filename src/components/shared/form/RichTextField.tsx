'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { markdownToHtml, sanitizeHtml, looksLikeHtml, looksLikeMarkdown } from '@/lib/richtext';
import { uploadProseMedia } from '@/lib/api/courses';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Mode = 'write' | 'markdown' | 'html';
type MediaKind = 'image' | 'video';

const TOOLBAR: Array<{ cmd: string; label: string; title: string }> = [
  { cmd: 'h2', label: 'H2', title: 'Heading' },
  { cmd: 'h3', label: 'H3', title: 'Sub-heading' },
  { cmd: 'bold', label: 'B', title: 'Bold' },
  { cmd: 'italic', label: 'I', title: 'Italic' },
  { cmd: 'code', label: '‹›', title: 'Inline code' },
  { cmd: 'ul', label: '• List', title: 'Bulleted list' },
  { cmd: 'ol', label: '1. List', title: 'Numbered list' },
  { cmd: 'quote', label: '❝', title: 'Quote' },
  { cmd: 'link', label: 'Link', title: 'Link' },
  { cmd: 'hr', label: '―', title: 'Divider' },
  { cmd: 'image', label: 'Image', title: 'Insert image' },
  { cmd: 'video', label: 'Video', title: 'Insert video' },
];

const SAFE_LINK = /^(?:https?:\/\/|mailto:|\/|#)/i;

// Mirrors the API's per-kind caps (src/modules/admin/uploads.ts) so an
// oversize file is rejected before the network round trip, with the same
// numbers the server will otherwise enforce anyway.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/avif';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';

/**
 * Places `el` at `range` inside `node` and leaves the caret just after it.
 * `range` is null (or stale — pointing at nodes no longer in the tree, e.g.
 * because a blur mid-upload re-sanitised and replaced innerHTML) whenever the
 * original caret position could not be preserved; the fallback is the end of
 * the document, which is always a valid place to land.
 */
function insertNodeAtRange(node: HTMLDivElement, range: Range | null, el: HTMLElement) {
  node.focus();
  const selection = window.getSelection();
  if (!selection) return;

  let target = range;
  if (!target || !node.contains(target.startContainer)) {
    target = document.createRange();
    target.selectNodeContents(node);
    target.collapse(false);
  }

  target.deleteContents();
  target.insertNode(el);
  target.setStartAfter(el);
  target.setEndAfter(el);
  selection.removeAllRanges();
  selection.addRange(target);
}

/** Snapshots the live caret/selection so it can be restored after an async upload. */
function captureRange(node: HTMLDivElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!node.contains(range.commonAncestorContainer)) return null;
  return range.cloneRange();
}

/**
 * Long-form fields store HTML. Authors arrive with it three ways — typed, pasted
 * as markdown, or pasted as HTML out of a doc — so the control offers all three
 * and normalises to the same value. The sanitiser here mirrors the API's exactly,
 * so what the preview shows is what gets stored; the server pass is still the one
 * that decides.
 */
export function RichTextField({
  value,
  onChange,
  label,
  required,
  hint,
  id,
  minHeight = 160,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  required?: boolean;
  hint?: string;
  id?: string;
  minHeight?: number;
}) {
  const [mode, setMode] = useState<Mode>('write');
  const [markdown, setMarkdown] = useState('');
  const [uploading, setUploading] = useState<MediaKind | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  // Captured the instant the toolbar button is pressed — before the file
  // picker opens and steals focus/selection from the contentEditable.
  const pendingRangeRef = useRef<Range | null>(null);
  // A ref alongside the `uploading` state: state updates are async, so a
  // second upload fired between click and re-render would race past a
  // `uploading !== null` check on state alone.
  const uploadingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // The editor is uncontrolled while focused — writing innerHTML on every render
  // would collapse the caret to the start on each keystroke.
  useEffect(() => {
    if (mode !== 'write') return;
    const node = editorRef.current;
    if (node && document.activeElement !== node && node.innerHTML !== value) {
      node.innerHTML = value ?? '';
    }
  }, [value, mode]);

  const preview = useMemo(
    () => (mode === 'markdown' ? sanitizeHtml(markdownToHtml(markdown)) : value),
    [mode, markdown, value],
  );

  const exec = (cmd: string) => {
    const node = editorRef.current;
    if (!node) return;
    node.focus();

    if (cmd === 'image' || cmd === 'video') {
      if (uploadingRef.current) return;
      // Capture now, synchronously, while the editor still has focus/selection
      // — opening the OS file picker blurs the contentEditable and the
      // selection goes with it.
      pendingRangeRef.current = captureRange(node);
      (cmd === 'image' ? imageInputRef : videoInputRef).current?.click();
      return;
    }

    try {
      if (cmd === 'bold' || cmd === 'italic') document.execCommand(cmd);
      else if (cmd === 'h2') document.execCommand('formatBlock', false, 'h2');
      else if (cmd === 'h3') document.execCommand('formatBlock', false, 'h3');
      else if (cmd === 'quote') document.execCommand('formatBlock', false, 'blockquote');
      else if (cmd === 'ul') document.execCommand('insertUnorderedList');
      else if (cmd === 'ol') document.execCommand('insertOrderedList');
      else if (cmd === 'hr') document.execCommand('insertHorizontalRule');
      else if (cmd === 'code') {
        const selected = String(window.getSelection() ?? '');
        document.execCommand('insertHTML', false, `<code>${selected || 'code'}</code>`);
      } else if (cmd === 'link') {
        const url = window.prompt('Link URL', 'https://');
        if (!url) return;
        if (!SAFE_LINK.test(url)) {
          toast.error('Only http, https, mailto and relative links are allowed.');
          return;
        }
        document.execCommand('createLink', false, url);
      }
    } catch {
      toast.error('That formatting command is not available in this browser.');
    }
    onChange(sanitizeHtml(node.innerHTML));
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData('text/plain');
    const html = event.clipboardData.getData('text/html');

    let insert: string | null = null;
    let note: string | null = null;

    if (text && looksLikeMarkdown(text)) {
      insert = sanitizeHtml(markdownToHtml(text));
      note = 'Markdown converted on paste.';
    } else if (html) {
      insert = sanitizeHtml(html);
      note = 'Pasted HTML cleaned.';
    } else if (text) {
      insert = text
        .split(/\n{2,}/)
        .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
        .join('');
    }
    if (insert === null) return;

    event.preventDefault();
    document.execCommand('insertHTML', false, insert);
    const node = editorRef.current;
    if (node) onChange(sanitizeHtml(node.innerHTML));
    if (note) toast.success(note);
  };

  /**
   * Fires once the OS file picker resolves. The caret was captured in `exec`
   * before the picker opened; it is restored here — right before insertion —
   * so the image/video lands where the author's cursor actually was, not
   * wherever focus happens to be after an async round trip.
   */
  const handleMediaSelected = async (event: ChangeEvent<HTMLInputElement>, kind: MediaKind) => {
    const input = event.target;
    const file = input.files?.[0] ?? null;
    // Reset so picking the same file twice in a row still fires onChange.
    input.value = '';
    if (!file) {
      pendingRangeRef.current = null;
      return;
    }

    if (uploadingRef.current) {
      // Buttons are disabled while an upload is in flight, so this is a
      // belt-and-braces guard rather than a reachable UI path.
      pendingRangeRef.current = null;
      return;
    }

    const maxBytes = kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > maxBytes) {
      pendingRangeRef.current = null;
      toast.error(
        `${kind === 'image' ? 'Images' : 'Videos'} must be ${Math.round(
          maxBytes / (1024 * 1024),
        )}MB or smaller.`,
      );
      return;
    }

    const range = pendingRangeRef.current;
    pendingRangeRef.current = null;
    uploadingRef.current = true;
    setUploading(kind);

    try {
      const url = await uploadProseMedia(file);
      // The editor may have unmounted while the request was in flight.
      if (!mountedRef.current) return;
      const node = editorRef.current;
      if (!node) return;

      const el = document.createElement(kind === 'image' ? 'img' : 'video');
      el.setAttribute('src', url);
      if (kind === 'image') el.setAttribute('alt', '');
      else el.setAttribute('controls', '');

      insertNodeAtRange(node, range, el);
      onChange(sanitizeHtml(node.innerHTML));
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Upload failed.';
      toast.error(message);
    } finally {
      uploadingRef.current = false;
      if (mountedRef.current) setUploading(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label} {required ? <span className="text-destructive">*</span> : null}
        </label>
        <div className="inline-flex">
          {(['write', 'markdown', 'html'] as Mode[]).map((candidate, index) => (
            <button
              key={candidate}
              type="button"
              onClick={() => {
                if (candidate === 'markdown')
                  setMarkdown(looksLikeHtml(value) ? '' : (value ?? ''));
                setMode(candidate);
              }}
              className={cn(
                'border border-border px-2.5 py-1 text-xs capitalize transition-colors',
                index === 0 && 'rounded-l-md',
                index === 2 && 'rounded-r-md',
                mode === candidate
                  ? 'border-primary font-semibold text-primary'
                  : 'text-foreground hover:text-primary',
              )}
            >
              {candidate}
            </button>
          ))}
        </div>
      </div>

      {mode === 'write' ? (
        <div>
          <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-input bg-muted p-1">
            {TOOLBAR.map((button) => {
              const isActiveUpload = uploading === button.cmd;
              return (
                <button
                  key={button.cmd}
                  type="button"
                  title={button.title}
                  // mousedown default would blur the editor and drop the selection
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => exec(button.cmd)}
                  disabled={uploading !== null}
                  aria-busy={isActiveUpload}
                  className={cn(
                    'rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-primary',
                    uploading !== null &&
                      'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground',
                  )}
                >
                  {isActiveUpload ? 'Uploading…' : button.label}
                </button>
              );
            })}
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            data-testid="richtext-image-input"
            className="hidden"
            onChange={(event) => {
              void handleMediaSelected(event, 'image');
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept={VIDEO_ACCEPT}
            data-testid="richtext-video-input"
            className="hidden"
            onChange={(event) => {
              void handleMediaSelected(event, 'video');
            }}
          />
          <div
            id={id}
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-label={label}
            suppressContentEditableWarning
            onInput={(event) => onChange((event.target as HTMLDivElement).innerHTML)}
            onBlur={(event) => {
              const clean = sanitizeHtml((event.target as HTMLDivElement).innerHTML);
              (event.target as HTMLDivElement).innerHTML = clean;
              onChange(clean);
            }}
            onPaste={onPaste}
            style={{ minHeight }}
            className="prose-editor overflow-y-auto rounded-b-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/40"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {hint ?? 'Paste markdown here and it converts as it lands.'}
          </p>
        </div>
      ) : null}

      {mode === 'markdown' ? (
        <div className="space-y-2">
          <textarea
            value={markdown}
            onChange={(event) => {
              setMarkdown(event.target.value);
              onChange(sanitizeHtml(markdownToHtml(event.target.value)));
            }}
            spellCheck={false}
            style={{ minHeight }}
            placeholder={'## Heading\n\nPaste or write markdown — it converts live.'}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/40"
          />
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <div
              className="prose-editor rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm"
              dangerouslySetInnerHTML={{
                __html: preview || '<p class="opacity-60">Nothing yet.</p>',
              }}
            />
          </div>
        </div>
      ) : null}

      {mode === 'html' ? (
        <div className="space-y-1">
          <textarea
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            onBlur={(event) => {
              const clean = sanitizeHtml(event.target.value);
              if (clean !== event.target.value) {
                toast.message('HTML cleaned', {
                  description: 'Disallowed tags or attributes were stripped.',
                });
              }
              onChange(clean);
            }}
            spellCheck={false}
            style={{ minHeight }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/40"
          />
          <p className="text-xs text-muted-foreground">
            Saved through an allowlist — script, style, iframe and event handlers are stripped.
          </p>
        </div>
      ) : null}
    </div>
  );
}
