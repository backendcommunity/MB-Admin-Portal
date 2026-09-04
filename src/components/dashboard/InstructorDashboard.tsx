'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  BookOpen,
  GraduationCap,
  FolderKanban,
  Map,
  Tag,
  Wallet,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Stat, StatRow } from '@/components/shared/Stat';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { fmtMoney, relativeTime } from '@/components/analytics/AnalyticsDashboard';

import { fetchCourses } from '@/lib/api/courses';
import { fetchPaths } from '@/lib/api/paths';
import { fetchProjects } from '@/lib/api/projects';
import { fetchBootcamps } from '@/lib/api/bootcamps';
import { getOffers } from '@/lib/api/offers';
import { fetchEarningsSummary } from '@/lib/api/instructor';

/* ────────────────────────────── shared shapes ────────────────────────────── */

type RecentItem = {
  id: string;
  title: string;
  kindLabel: string;
  updatedAt: string;
  href: string;
};

type KindSummary = {
  /** How many the instructor has authored, in total (not just this page). */
  total: number;
  /**
   * How many of those are still unpublished, or `null` when this kind's list
   * row doesn't expose a publish-state field at all — that's the case for
   * Bootcamp, so its card shows a count with no draft badge rather than a
   * guess.
   */
  draftTotal: number | null;
  recent: RecentItem[];
};

function byMostRecentlyUpdated(a: RecentItem, b: RecentItem) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

/* ────────────────────────────── data hooks ────────────────────────────────
 *
 * Every admin list endpoint is author-scoped for an instructor, so a plain
 * `?limit=1` already returns their own total — no new API work. Only Course
 * and Path expose a `status` filter, so their draft counts come from a
 * second, cheap `status=DRAFT` request; Project's `status` filter uses a
 * lowercase value (`draft`/`published`). Offer has neither a status filter
 * nor a sort param, so its draft count and "recent" ordering are both
 * computed client-side from the same fetched page.
 *
 * `limit: 100` is generous enough to cover a real instructor's catalogue in
 * one page — comfortably above what any of the accounts this was built
 * against actually hold — so the "recent" ordering and (for courses) the
 * learners-reached sum are correct in the overwhelmingly common case. Beyond
 * that page, both would quietly undercount; see the written report for that
 * tradeoff instead of a note buried in code no one will reread.
 */

function useCoursesSummary() {
  return useQuery({
    queryKey: ['instructor-dashboard', 'courses'],
    queryFn: async () => {
      const [all, drafts] = await Promise.all([
        fetchCourses({ limit: 100, sort: 'lastUpdated', order: 'desc' }),
        fetchCourses({ status: 'DRAFT', limit: 1 }),
      ]);
      const learners = all.data.reduce((sum, c) => sum + (c.counts?.enrolled ?? 0), 0);
      const recent: RecentItem[] = all.data.map((c) => ({
        id: c.id,
        title: c.title,
        kindLabel: 'Course',
        updatedAt: c.updatedAt,
        href: `/courses/${c.id}`,
      }));
      const summary: KindSummary & { learners: number } = {
        total: all.total,
        draftTotal: drafts.total,
        recent,
        learners,
      };
      return summary;
    },
  });
}

function usePathsSummary() {
  return useQuery({
    queryKey: ['instructor-dashboard', 'paths'],
    queryFn: async () => {
      const [all, drafts] = await Promise.all([
        fetchPaths({ limit: 100, sort: 'updatedAt', order: 'desc' }),
        fetchPaths({ status: 'DRAFT', limit: 1 }),
      ]);
      const recent: RecentItem[] = all.data.map((p) => ({
        id: p.id,
        title: p.title,
        kindLabel: 'Path',
        updatedAt: p.updatedAt,
        href: `/paths/${p.id}`,
      }));
      const summary: KindSummary = { total: all.total, draftTotal: drafts.total, recent };
      return summary;
    },
  });
}

function useProjectsSummary() {
  return useQuery({
    queryKey: ['instructor-dashboard', 'projects'],
    queryFn: async () => {
      const [all, drafts] = await Promise.all([
        fetchProjects({ limit: 100 }),
        fetchProjects({ status: 'draft', limit: 1 }),
      ]);
      const recent: RecentItem[] = all.data.map((p) => ({
        id: p.id,
        title: p.title,
        kindLabel: 'Project',
        updatedAt: p.updatedAt ?? p.createdAt ?? '',
        href: `/projects/${p.id}`,
      }));
      const summary: KindSummary = { total: all.total, draftTotal: drafts.total, recent };
      return summary;
    },
  });
}

function useBootcampsSummary() {
  return useQuery({
    queryKey: ['instructor-dashboard', 'bootcamps'],
    queryFn: async () => {
      const all = await fetchBootcamps({ limit: 100 });
      const recent: RecentItem[] = all.data.map((b) => ({
        id: b.id,
        title: b.title,
        kindLabel: 'Bootcamp',
        updatedAt: b.updatedAt ?? b.createdAt ?? '',
        href: `/bootcamps/${b.id}`,
      }));
      // Bootcamp (the shell) carries no isWaiting/isPublic/status field in
      // the admin API client — only its Cohorts do, and a cohort's OPEN /
      // STARTED / CLOSED status doesn't mean "draft" either. Rather than
      // guess, this kind reports a total with no draft figure.
      const summary: KindSummary = { total: all.total, draftTotal: null, recent };
      return summary;
    },
  });
}

function useOffersSummary() {
  return useQuery({
    queryKey: ['instructor-dashboard', 'offers'],
    queryFn: async () => {
      const all = await getOffers({ limit: 100 });
      const recent: RecentItem[] = all.data.map((o) => ({
        id: o.id,
        title: o.title,
        kindLabel: 'Ship',
        updatedAt: o.updatedAt,
        href: '/offers',
      }));
      // No status filter on this endpoint, so the draft count is only as
      // complete as the page fetched above (see the note on `limit: 100`).
      const draftTotal = all.data.filter((o) => o.isWaiting).length;
      const summary: KindSummary = { total: all.total, draftTotal, recent };
      return summary;
    },
  });
}

function useEarningsSummary() {
  return useQuery({
    queryKey: ['instructor-dashboard', 'earnings'],
    queryFn: fetchEarningsSummary,
  });
}

/* ────────────────────────────── presentation ─────────────────────────────── */

function draftBadge(draftTotal: number | null) {
  if (draftTotal === null) return null;
  if (draftTotal === 0) return <StatusBadge tone="success" label="All published" />;
  return (
    <StatusBadge tone="warning" label={`${draftTotal} ${draftTotal === 1 ? 'draft' : 'drafts'}`} />
  );
}

function KindCard({
  title,
  icon: Icon,
  href,
  query,
  extra,
}: {
  title: string;
  icon: LucideIcon;
  href: string;
  query: UseQueryResult<KindSummary>;
  /** Courses also show learners reached, folded into the same card. */
  extra?: { label: string; value: string };
}) {
  return (
    <Card className="flex flex-col gap-3 p-5" data-testid={`kind-card-${title.toLowerCase()}`}>
      <div className="flex items-center justify-between">
        <Link href={href} className="flex items-center gap-2 text-sm font-medium hover:underline">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </Link>
      </div>

      {query.isLoading ? (
        <LoadingState label={`Loading ${title.toLowerCase()}…`} />
      ) : query.isError ? (
        <ErrorState
          message={`Couldn't load ${title.toLowerCase()}.`}
          onRetry={() => query.refetch()}
        />
      ) : (
        <>
          <StatRow>
            <Stat label={title} value={String(query.data?.total ?? 0)} />
            {extra ? <Stat label={extra.label} value={extra.value} /> : null}
          </StatRow>
          {draftBadge(query.data?.draftTotal ?? null)}
        </>
      )}
    </Card>
  );
}

function EarningsCard({
  query,
}: {
  query: UseQueryResult<Awaited<ReturnType<typeof fetchEarningsSummary>>>;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5" data-testid="earnings-card">
      <Link
        href="/earnings"
        className="flex items-center gap-2 text-sm font-medium hover:underline"
      >
        <Wallet className="h-4 w-4 text-primary" />
        Earnings
      </Link>

      {query.isLoading ? (
        <LoadingState label="Loading earnings…" />
      ) : query.isError ? (
        <ErrorState message="Couldn't load earnings." onRetry={() => query.refetch()} />
      ) : (
        <StatRow>
          <Stat label="Total earned" value={fmtMoney(query.data?.totalEarned ?? 0, 'USD')} />
          <Stat label="Current balance" value={fmtMoney(query.data?.currentBalance ?? 0, 'USD')} />
          <Stat label="Pending payout" value={fmtMoney(query.data?.pendingPayout ?? 0, 'USD')} />
        </StatRow>
      )}
    </Card>
  );
}

/* ────────────────────────────── main component ───────────────────────────── */

export default function InstructorDashboard() {
  const coursesQuery = useCoursesSummary();
  const pathsQuery = usePathsSummary();
  const projectsQuery = useProjectsSummary();
  const bootcampsQuery = useBootcampsSummary();
  const offersQuery = useOffersSummary();
  const earningsQuery = useEarningsSummary();

  const contentQueries = [coursesQuery, bootcampsQuery, projectsQuery, pathsQuery, offersQuery];
  const allContentLoaded = contentQueries.every((q) => q.isSuccess);
  const allContentEmpty = contentQueries.every((q) => (q.data?.total ?? 0) === 0);
  const showEmptyState = allContentLoaded && allContentEmpty;

  const recentItems = useMemo(() => {
    return contentQueries
      .flatMap((q) => q.data?.recent ?? [])
      .filter((item) => item.updatedAt)
      .sort(byMostRecentlyUpdated)
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    coursesQuery.data,
    bootcampsQuery.data,
    projectsQuery.data,
    pathsQuery.data,
    offersQuery.data,
  ]);

  const anyContentLoading = contentQueries.some((q) => q.isLoading);

  return (
    <section className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          What you have authored, what is still a draft, and what you have earned.
        </p>
      </header>

      {showEmptyState ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Nothing published yet"
          description="Create your first course, bootcamp, project, path, or Ship to see your stats here."
          action={
            <Button asChild>
              <Link href="/courses/new">Create a course</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KindCard
              title="Courses"
              icon={BookOpen}
              href="/courses"
              query={coursesQuery}
              extra={
                coursesQuery.data
                  ? { label: 'Learners reached', value: String(coursesQuery.data.learners) }
                  : undefined
              }
            />
            <KindCard
              title="Bootcamps"
              icon={GraduationCap}
              href="/bootcamps"
              query={bootcampsQuery}
            />
            <KindCard title="Projects" icon={FolderKanban} href="/projects" query={projectsQuery} />
            <KindCard title="Paths" icon={Map} href="/paths" query={pathsQuery} />
            <KindCard title="Ships" icon={Tag} href="/offers" query={offersQuery} />
          </div>

          <EarningsCard query={earningsQuery} />

          <Card className="p-5" data-testid="recent-updated">
            <h2 className="mb-3 text-base font-semibold text-foreground">Recently updated</h2>
            {anyContentLoading && recentItems.length === 0 ? (
              <LoadingState label="Loading recent activity…" />
            ) : recentItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No updates yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentItems.map((item) => (
                  <li key={`${item.kindLabel}-${item.id}`}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm hover:underline"
                    >
                      <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {item.kindLabel}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {relativeTime(item.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </section>
  );
}
