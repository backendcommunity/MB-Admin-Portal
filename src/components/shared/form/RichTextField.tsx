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
 * A caret position stored as a route through the tree (child indices from the
 * editor root) plus an offset, rather than as a live `Range`.
 *
 * This matters because of the file picker. Opening it blurs the editor, the
 * blur handler runs, and anything that assigns `innerHTML` — even the same
 * markup — destroys every node the old `Range` pointed at. The browser does
 * not invalidate the Range; it silently re-anchors it to the start of the
 * editor, so an insert "succeeds" at entirely the wrong place. That was the
 * reported bug: a caret in the middle of the second paragraph produced an
 * image at the very top of the document.
 *
 * A path is just numbers, so it survives the round trip and re-resolves
 * against whatever tree exists when the upload finishes.
 */
type CaretPath = { path: number[]; offset: number };

function caretPathFrom(root: HTMLElement): CaretPath | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;

  const path: number[] = [];
  let node: Node = range.startContainer;
  while (node !== root) {
    const parent: Node | null = node.parentNode;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, node));
    node = parent;
  }
  return { path, offset: range.startOffset };
}

/** Resolves a stored path back to a live range, or null if the tree moved under it. */
function rangeFromCaretPath(root: HTMLElement, caret: CaretPath | null): Range | null {
  if (!caret) return null;
  let node: Node = root;
  for (const index of caret.path) {
    const next: Node | undefined = node.childNodes[index];
    if (!next) return null;
    node = next;
  }
  const limit =
    node.nodeType === Node.TEXT_NODE ? (node.textContent?.length ?? 0) : node.childNodes.length;
  const range = document.createRange();
  range.setStart(node, Math.min(caret.offset, limit));
  range.collapse(true);
  return range;
}

/**
 * Places `el` at the stored caret and leaves the cursor just after it. Falls
 * back to the end of the document only when the path no longer resolves —
 * the author edited elsewhere, or the content changed shape while the upload
 * was in flight.
 */
function insertNodeAtCaret(node: HTMLDivElement, caret: CaretPath | null, el: HTMLElement) {
  node.focus();
  const selection = window.getSelection();
  if (!selection) return;

  let target = rangeFromCaretPath(node, caret);
  if (!target || !node.contains(target.startContainer)) {
    target = document.createRange();
    target.selectNodeContents(node);
    target.collapse(false);
  }

  target.insertNode(el);
  target.setStartAfter(el);
  target.setEndAfter(el);
  selection.removeAllRanges();
  selection.addRange(target);
}

/**
 * `<video>` is not draggable by default the way `<img>` is, so inside a
 * contentEditable an author can select a clip but never move it — the second
 * reported bug. The attribute is set on the live DOM rather than written into
 * the stored markup: it is an editing affordance, not content, and the
 * sanitiser would strip it on save anyway.
 */
function makeVideosDraggable(root: HTMLElement) {
  root.querySelectorAll('video').forEach((video) => {
    video.draggable = true;
  });
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
  const pendingCaretRef = useRef<CaretPath | null>(null);
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
    if (!node) return;
    if (document.activeElement !== node && node.innerHTML !== value) {
      node.innerHTML = value ?? '';
    }
    makeVideosDraggable(node);
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
      pendingCaretRef.current = caretPathFrom(node);
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
      pendingCaretRef.current = null;
      return;
    }

    if (uploadingRef.current) {
      // Buttons are disabled while an upload is in flight, so this is a
      // belt-and-braces guard rather than a reachable UI path.
      pendingCaretRef.current = null;
      return;
    }

    const maxBytes = kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > maxBytes) {
      pendingCaretRef.current = null;
      toast.error(
        `${kind === 'image' ? 'Images' : 'Videos'} must be ${Math.round(
          maxBytes / (1024 * 1024),
        )}MB or smaller.`,
      );
      return;
    }

    const caret = pendingCaretRef.current;
    pendingCaretRef.current = null;
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

      insertNodeAtCaret(node, caret, el);
      makeVideosDraggable(node);
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
            onInput={(event) => onChange(event.currentTarget.innerHTML)}
            onBlur={(event) => {
              // `currentTarget`, never `target`. React's onBlur is focusout,
              // which BUBBLES: clicking a <video controls> moves focus to the
              // video, so `target` was the video and `target.innerHTML` the
              // empty string — the handler saved "" and wiped the whole field.
              // That was the reported data loss.
              const node = event.currentTarget;

              // Focus moving to something inside the editor (a video, a link)
              // is not the author leaving the field.
              const next = event.relatedTarget as Node | null;
              if (next && node.contains(next)) return;

              const clean = sanitizeHtml(node.innerHTML);

              // Reconcile the DOM too, so what the author sees matches what
              // would be stored — EXCEPT while a caret is being held for an
              // upload. Assigning innerHTML re-creates every node, and the
              // file picker's own blur lands here: doing it then is what sent
              // an uploaded image to the top of the document instead of the
              // caret. The caret path survives that, but there is no reason to
              // churn the DOM underneath it.
              if (pendingCaretRef.current === null && clean !== node.innerHTML) {
                node.innerHTML = clean;
              }
              if (clean !== value) onChange(clean);
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
