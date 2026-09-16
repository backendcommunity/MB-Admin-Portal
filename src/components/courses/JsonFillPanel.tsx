'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { CodeArea } from '@/components/shared/form/CodeArea';
import { cn } from '@/lib/utils';
import { fillFromJson, itemPrompt, itemSample } from '@/lib/courses/item-fill';
import { ITEM_LABELS, type ItemKind } from '@/lib/courses/items';

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied.`);
  } catch {
    // Clipboard access is denied outside a secure context and in some
    // browsers' permission states. Failing loudly beats a button that looks
    // like it worked.
    toast.error(`Could not copy the ${what.toLowerCase()} — select it and copy by hand.`);
  }
}

/**
 * Paste a JSON object, fill the open item form.
 *
 * Presentational on purpose: it parses, reports, and hands the caller a patch.
 * It never writes to the form itself and never saves — what lands in the form
 * is the caller's business, and what reaches the API stays the author's
 * decision, made by pressing Save with the filled fields in front of them.
 *
 * Collapsed by default. This is a shortcut for authors who already have the
 * content, not a step in the normal flow, and an expanded code box above the
 * title would push the actual form below the fold for everyone else.
 */
export function JsonFillPanel({
  kind,
  onFill,
  disabled,
}: {
  kind: ItemKind;
  /** Receives only the fields the JSON provided, ready to merge into the form. */
  onFill: (patch: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const label = ITEM_LABELS[kind].toLowerCase();

  const apply = () => {
    const result = fillFromJson(kind, text);

    if (result.error) {
      toast.error('Nothing filled', { description: result.error });
      return;
    }

    onFill(result.patch);

    const count = result.filled.length;
    toast.success(`Filled ${count} ${count === 1 ? 'field' : 'fields'}.`, {
      // Unrecognised keys are the difference between "the paste worked" and
      // "the paste worked and quietly dropped your grader config".
      description: result.ignored.length
        ? `Ignored: ${result.ignored.join(', ')}.`
        : 'Review them, then Save.',
    });

    result.notes.forEach((note) => toast.warning(note));

    setText('');
    setOpen(false);
  };

  return (
    <div className="rounded-md border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-medium text-foreground">
          Fill from JSON
          <span className="ml-2 font-normal text-muted-foreground">
            paste a {label} and every matching field fills in
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div className="space-y-2 border-t border-border p-3">
          <CodeArea
            value={text}
            onChange={setText}
            ariaLabel={`${ITEM_LABELS[kind]} JSON`}
            minHeight={160}
            placeholder={`{ "title": "…" }  — only the keys you include are filled`}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={apply} disabled={disabled || !text.trim()}>
              Fill fields
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setText(itemSample(kind))}
            >
              Insert sample
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => copy(itemSample(kind), 'Sample JSON')}
            >
              Copy sample
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => copy(itemPrompt(kind), 'Prompt')}
            >
              Copy prompt
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Fields you leave out keep their current value. Nothing is saved until you press Save.
            &ldquo;Copy prompt&rdquo; gives you an instruction to paste into an assistant to get
            JSON in this shape back.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default JsonFillPanel;
