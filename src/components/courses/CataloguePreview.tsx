'use client';

import { Card } from '@/components/ui/card';
import type { CourseDraft } from '@/components/courses/CourseFormSections';

/**
 * What the course will look like on the catalogue card, updating as the form is
 * filled. It exists so the summary and banner are written for where they land,
 * not for the form field they are typed into.
 */
export function CataloguePreview({ draft }: { draft: CourseDraft }) {
  const meta = [
    draft.level ?? 'level?',
    draft.languages[0] ?? draft.type.charAt(0) + draft.type.slice(1).toLowerCase(),
    draft.isPremium ? `$${Number(draft.amount || 0).toFixed(2)}` : 'Free',
  ].join(' · ');

  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">Catalogue preview</h3>
      <div className="overflow-hidden rounded-lg border border-border">
        {draft.banner ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN hosts
          <img
            src={draft.banner}
            alt=""
            className="h-20 w-full bg-muted object-cover"
            onError={(event) => {
              (event.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="grid h-20 place-items-center bg-accent text-xs text-muted-foreground">
            no banner
          </div>
        )}
        <div className="space-y-1 px-3 py-2">
          <p className="text-sm font-semibold leading-tight">{draft.title || 'Untitled course'}</p>
          <p className="text-xs text-muted-foreground">{meta}</p>
        </div>
      </div>
    </Card>
  );
}
