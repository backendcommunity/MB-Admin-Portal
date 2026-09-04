import { searchLibrary, type LibraryKind } from '@/lib/api/bootcamps';
import type { ImportDocument } from '@/lib/projects/import';

/**
 * Match every library reference in the payload BEFORE anything is written.
 *
 * A task names its video, article or chapter by title, and none of them can be
 * created by this import — they are existing rows. Looking them up during the
 * import meant the project and half its tasks were already created when the
 * first miss appeared. The panel promises nothing is written until Import is
 * pressed; this is what makes that true for references too.
 */

export type Resolved = {
  /** Keyed `kind:title`. */
  byKey: Map<string, string>;
  found: Array<{ kind: LibraryKind; title: string }>;
  /** Named in the payload, absent from the library — the task imports unlinked. */
  missing: Array<{ kind: LibraryKind; title: string; where: string }>;
};

const key = (kind: string, title: string) => `${kind}:${title.toLowerCase()}`;

export function resolvedId(resolution: Resolved, kind: LibraryKind, title: string) {
  return resolution.byKey.get(key(kind, title)) ?? null;
}

export async function resolveProjectRefs(doc: ImportDocument): Promise<Resolved> {
  const wanted = new Map<string, { kind: LibraryKind; title: string; where: string }>();

  doc.projectTasks.forEach((pt) => {
    pt.tasks.forEach((task) => {
      (['video', 'article', 'chapter'] as const).forEach((kind) => {
        const title = task[kind];
        if (!title) return;
        wanted.set(key(kind, title), {
          kind,
          title,
          where: `${pt.title} → “${task.title}”`,
        });
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
        // A failed lookup is "not found", not a crash — and it is reported as
        // a miss rather than silently importing the task unlinked.
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
