import {
  BONUS_SOURCE,
  LESSON_ITEM_KIND,
  searchLibrary,
  type LibraryKind,
} from '@/lib/api/bootcamps';
import type { ImportDocument } from '@/lib/bootcamps/import';

/**
 * Match every library reference in the payload BEFORE anything is written.
 *
 * A lesson names its video by title and a bonus names its course by title, and
 * neither can be created by this import — they are existing rows. Looking them
 * up during the import meant the bootcamp, its cohorts and half its weeks were
 * already created when the first miss appeared, leaving a half-built bootcamp
 * and a toast. The panel promises nothing is written until Import is pressed;
 * this is what makes that true for references too.
 */

export type Resolved = {
  /** Keyed `kind:title` so a lesson or bonus can look its own id back up. */
  byKey: Map<string, string>;
  found: Array<{ kind: LibraryKind; title: string }>;
  /** Named in the payload, absent from the library. These are skipped. */
  missing: Array<{ kind: LibraryKind; title: string; where: string }>;
};

const key = (kind: string, title: string) => `${kind}:${title.toLowerCase()}`;

export function resolvedId(resolution: Resolved, kind: LibraryKind, title: string) {
  return resolution.byKey.get(key(kind, title)) ?? null;
}

export async function resolveBootcampRefs(doc: ImportDocument): Promise<Resolved> {
  // One lookup per distinct kind+title, however many rows reference it.
  const wanted = new Map<string, { kind: LibraryKind; title: string; where: string }>();

  doc.cohorts.forEach((cohort) => {
    cohort.weeks.forEach((week, weekIndex) => {
      week.lessons.forEach((lesson) => {
        if (!lesson.item) return;
        const kind = LESSON_ITEM_KIND[lesson.type];
        if (!kind) return;
        wanted.set(key(kind, lesson.item), {
          kind,
          title: lesson.item,
          where: `${cohort.name}, week ${weekIndex + 1}, “${lesson.title}”`,
        });
      });
    });
    cohort.bonuses.forEach((bonus) => {
      const kind = BONUS_SOURCE[bonus.kind];
      wanted.set(key(kind, bonus.item), {
        kind,
        title: bonus.item,
        where: `${cohort.name}, bonus`,
      });
    });
  });

  const byKey = new Map<string, string>();
  const found: Resolved['found'] = [];
  const missing: Resolved['missing'] = [];

  await Promise.all(
    [...wanted.entries()].map(async ([k, want]) => {
      let id: string | null = null;
      try {
        const rows = await searchLibrary(want.kind, want.title);
        // An exact title wins; a single hit is accepted as the intent.
        const exact = rows.find((row) => row.title.toLowerCase() === want.title.toLowerCase());
        id = exact?.id ?? (rows.length === 1 ? rows[0].id : null);
      } catch {
        // A failed lookup is "not found", not a crash — and it is reported as a
        // miss rather than silently importing the lesson unlinked.
        id = null;
      }
      if (id) {
        byKey.set(k, id);
        found.push({ kind: want.kind, title: want.title });
      } else {
        missing.push(want);
      }
    }),
  );

  return { byKey, found, missing };
}
