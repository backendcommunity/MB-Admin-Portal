'use client';

import { useState } from 'react';
import { RefreshCw, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { checkSlug } from '@/lib/api/courses';
import { slugify } from '@/lib/courses/import';

/**
 * Derives from the title until an author edits it by hand, checks availability on
 * blur, and locks once the course is live — changing a published slug breaks every
 * link to it, so that takes a deliberate unlock.
 */
export function SlugField({
  value,
  onChange,
  title,
  courseId,
  locked,
  onUnlock,
}: {
  value: string;
  onChange: (next: string) => void;
  title: string;
  courseId?: string;
  locked?: boolean;
  onUnlock?: () => void;
}) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const verify = async (slug: string) => {
    if (!slug) return;
    setStatus('checking');
    try {
      const result = await checkSlug(slug, courseId);
      setStatus(result.available ? 'free' : 'taken');
      setSuggestion(result.available ? null : result.suggestion);
    } catch {
      setStatus('idle');
    }
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor="course-slug" className="flex items-center gap-2 text-sm font-medium">
        Slug
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Lock className="h-3 w-3" /> locked
          </span>
        ) : null}
      </label>
      <div className="flex gap-2">
        <Input
          id="course-slug"
          value={value}
          disabled={locked}
          onChange={(event) => onChange(slugify(event.target.value))}
          onBlur={(event) => verify(event.target.value)}
          placeholder="distributed-systems-in-go"
        />
        {locked ? (
          <Button type="button" variant="outline" onClick={onUnlock}>
            Unlock
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            title="Re-derive from the title"
            onClick={() => {
              const next = slugify(title);
              onChange(next);
              void verify(next);
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>
      {locked ? (
        <p className="text-xs text-muted-foreground">
          This course is live. Changing the slug breaks existing links to it.
        </p>
      ) : status === 'taken' ? (
        <p className="text-xs text-destructive">
          Taken.{' '}
          {suggestion ? (
            <button type="button" className="underline" onClick={() => onChange(suggestion)}>
              Use {suggestion}
            </button>
          ) : null}
        </p>
      ) : status === 'free' ? (
        <p className="text-xs text-muted-foreground">Available.</p>
      ) : (
        <p className="text-xs text-muted-foreground">Derived from the title until you edit it.</p>
      )}
    </div>
  );
}
