import { kindIsCreatable, searchLibrary, type ItemKind } from '@/lib/api/paths';
import type { ImportTopic } from '@/lib/paths/import';

/**
 * Match an import payload's items against the library BEFORE anything is
 * written.
 *
 * Every one of the kinds is a join table, so an import can only ever link
 * content that already exists — it cannot create a course. Doing that lookup
 * during the import meant the path and its topics were created first and the
 * attachments failed afterwards, leaving a half-built path and a toast. The
 * panel promises nothing is written until Import is pressed; this is what makes
 * that true for attachments too.
 */
export type ResolvedItem = {
  kind: ItemKind;
  title: string;
  /** The library row it matched, or null when nothing matches. */
  id: string | null;
  isOptional?: boolean;
  order?: number;
  type?: 'CHAT' | 'AUDIO' | 'VIDEO';
  /** Present on a resource the import will create. */
  link?: string;
};

export type Resolution = {
  /** Keyed `kind:title` so a topic can look its own items back up. */
  byKey: Map<string, ResolvedItem>;
  found: number;
  /** Not in the library, but the import can make them — resources with a link. */
  creatable: Array<{ kind: string; title: string }>;
  /** Not in the library and not creatable: these will be skipped. */
  missing: Array<{ kind: string; title: string }>;
};

const key = (kind: string, title: string) => `${kind}:${title.toLowerCase()}`;

export async function resolveImportItems(topics: ImportTopic[]): Promise<Resolution> {
  const byKey = new Map<string, ResolvedItem>();
  const missing: Array<{ kind: string; title: string }> = [];
  const creatable: Array<{ kind: string; title: string }> = [];

  // One lookup per distinct kind+title, however many topics reference it.
  const wanted = new Map<string, { kind: ItemKind; title: string; link?: string }>();
  topics.forEach((topic) =>
    topic.items.forEach((item) => {
      wanted.set(key(item.kind, item.title), {
        kind: item.kind,
        title: item.title,
        link: item.link,
      });
    }),
  );

  await Promise.all(
    [...wanted.entries()].map(async ([k, { kind, title, link }]) => {
      let id: string | null = null;
      try {
        const rows = await searchLibrary(kind, title);
        // Exact title first; a single search hit is accepted as the intent.
        const exact = rows.find((row) => row.title.toLowerCase() === title.toLowerCase());
        id = exact?.id ?? (rows.length === 1 ? rows[0].id : null);
      } catch {
        id = null; // a failed lookup is "not found", not a crash
      }
      byKey.set(k, { kind, title, id, link });
      if (id) return;
      // A resource with a link is not missing — the import will create it.
      if (kindIsCreatable(kind) && link) creatable.push({ kind, title });
      else missing.push({ kind, title });
    }),
  );

  return {
    byKey,
    found: wanted.size - missing.length - creatable.length,
    creatable,
    missing,
  };
}

export function resolvedId(resolution: Resolution, kind: string, title: string): string | null {
  return resolution.byKey.get(key(kind, title))?.id ?? null;
}
