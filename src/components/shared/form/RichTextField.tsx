'use client';

import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { markdownToHtml, sanitizeHtml, looksLikeHtml, looksLikeMarkdown } from '@/lib/richtext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Mode = 'write' | 'markdown' | 'html';

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
];

const SAFE_LINK = /^(?:https?:\/\/|mailto:|\/|#)/i;

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
  const editorRef = useRef<HTMLDivElement>(null);

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
            {TOOLBAR.map((button) => (
              <button
                key={button.cmd}
                type="button"
                title={button.title}
                // mousedown default would blur the editor and drop the selection
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => exec(button.cmd)}
                className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-primary"
              >
                {button.label}
              </button>
            ))}
          </div>
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
