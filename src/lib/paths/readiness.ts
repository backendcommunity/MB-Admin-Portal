import type { PathDetail, Topic } from '@/lib/api/paths';

/**
 * The same rules the API enforces before it will publish.
 *
 * Duplicated on purpose: the panel has to tell an author what is missing while
 * they type, and a round trip per keystroke is not that. The server pass is
 * still the one that decides — this only has to agree with it.
 */
export type Rule = { id: string; label: string; ok: boolean; detail?: string };

const MIN_SUMMARY = 40;

export function evaluatePathReadiness(
  path: Pick<PathDetail, 'title' | 'slug' | 'summary' | 'estimatedWeeks' | 'isPremium' | 'amount'>,
  topics: Topic[],
): Rule[] {
  const untitled = topics.filter((t) => !t.title.trim());
  const empty = topics.filter((t) => t.items.length === 0);

  return [
    { id: 'title', label: 'Title', ok: Boolean(path.title?.trim()) },
    { id: 'slug', label: 'Slug', ok: Boolean(path.slug?.trim()) },
    {
      id: 'summary',
      label: 'Summary',
      ok: (path.summary ?? '').trim().length >= MIN_SUMMARY,
      detail: `The catalogue card needs at least ${MIN_SUMMARY} characters.`,
    },
    {
      id: 'estimatedWeeks',
      label: 'Estimated weeks',
      ok: Number(path.estimatedWeeks ?? 0) > 0,
    },
    { id: 'topics', label: 'At least one topic', ok: topics.length > 0 },
    {
      id: 'titled',
      label: 'Every topic is titled',
      ok: untitled.length === 0,
      detail: untitled.length ? `${untitled.length} without a title.` : undefined,
    },
    {
      id: 'content',
      label: 'Every topic has content',
      ok: empty.length === 0,
      // An empty topic is a dead end: the learner opens it and there is
      // nothing to do.
      detail: empty.length ? empty.map((t) => `“${t.title || 'Untitled'}”`).join(', ') : undefined,
    },
    {
      id: 'price',
      label: path.isPremium ? 'Premium path has a price' : 'Pricing',
      ok: !path.isPremium || Number(path.amount ?? 0) > 0,
    },
  ];
}

export function isReady(rules: Rule[]): boolean {
  return rules.every((rule) => rule.ok);
}
