'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Papa from 'papaparse';
import { MoreHorizontal } from 'lucide-react';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterBar } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import ImportCourseModal from '@/components/courses/ImportCourseModal';
import {
  deleteCourse,
  fetchCategories,
  fetchCourses,
  setCourseStatus,
  type CourseListRow,
  type CourseListParams,
  type CourseStatus,
} from '@/lib/api/courses';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUSES: Array<{ value: CourseStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'WAITLIST', label: 'Waitlist' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const PRICING = [
  { value: 'ALL', label: 'Any price' },
  { value: 'false', label: 'Free' },
  { value: 'true', label: 'Premium' },
] as const;

function statusTone(status: CourseStatus): 'success' | 'neutral' | 'warning' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'DRAFT') return 'neutral';
  return 'warning';
}

function runtime(seconds: number): string {
  if (!seconds) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function CoursesTable() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CourseStatus | 'ALL'>('ALL');
  const [premium, setPremium] = useState<'ALL' | 'true' | 'false'>('ALL');
  const [categoryId, setCategoryId] = useState('ALL');
  const [sort, setSort] = useState<NonNullable<CourseListParams['sort']>>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [deleting, setDeleting] = useState<CourseListRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const params: CourseListParams = {
    page,
    limit,
    q: search || undefined,
    status: status === 'ALL' ? undefined : status,
    premium: premium === 'ALL' ? undefined : premium,
    categoryId: categoryId === 'ALL' ? undefined : categoryId,
    sort,
    order,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-courses', params],
    queryFn: () => fetchCourses(params),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: fetchCategories,
    staleTime: 300_000,
  });

  const rows = useMemo(() => data?.data ?? [], [data]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  const selectedRows = useMemo(
    () => rows.filter((_, index) => selection[String(index)]),
    [rows, selection],
  );

  const toggleSort = (field: NonNullable<CourseListParams['sort']>) => {
    if (sort === field) setOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(field);
      setOrder('desc');
    }
    setPage(1);
  };

  const bulk = async (action: 'publish' | 'unpublish' | 'archive') => {
    if (!selectedRows.length) return;
    setBusy(true);
    const skipped: string[] = [];
    let done = 0;

    for (const row of selectedRows) {
      try {
        await setCourseStatus(row.id, action);
        done += 1;
      } catch {
        skipped.push(row.title);
      }
    }

    setBusy(false);
    setSelection({});
    await refetch();

    if (skipped.length) {
      toast.warning(`${done} done, ${skipped.length} skipped`, {
        description:
          action === 'publish' ? `Not ready to publish: ${skipped.join(', ')}` : skipped.join(', '),
      });
    } else {
      toast.success(`${done} course${done === 1 ? '' : 's'} ${action}ed.`);
    }
  };

  const exportCsv = () => {
    const csv = Papa.unparse(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status,
        category: row.category?.name ?? '',
        level: row.level ?? '',
        premium: row.isPremium,
        amount: row.amount,
        chapters: row.counts.chapters,
        items: row.counts.items,
        enrolled: row.counts.enrolled,
        updatedAt: row.updatedAt,
      })),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `courses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<ColumnDef<CourseListRow>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            aria-label="Select page"
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.title}`}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          />
        ),
      },
      {
        accessorKey: 'title',
        header: 'Course',
        cell: ({ row }) => (
          <Link href={`/courses/${row.original.id}`} className="group block">
            <span className="block font-medium text-foreground group-hover:text-primary group-hover:underline">
              {row.original.title}
            </span>
            <span className="block font-mono text-xs text-muted-foreground">
              {row.original.slug}
            </span>
          </Link>
        ),
      },
      {
        id: 'category',
        header: 'Category',
        cell: ({ row }) =>
          row.original.category ? (
            row.original.category.name
          ) : (
            <span className="text-xs text-destructive">None</span>
          ),
      },
      {
        id: 'access',
        header: 'Access',
        cell: ({ row }) => (
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge label={row.original.status} tone={statusTone(row.original.status)} />
            <span className="text-xs text-muted-foreground">
              {row.original.isPremium ? `$${row.original.amount.toFixed(2)}` : 'Free'}
            </span>
          </span>
        ),
      },
      {
        id: 'content',
        header: 'Content',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.counts.chapters} ch · {row.original.counts.items} items
            <span className="block text-xs text-muted-foreground">
              {runtime(row.original.totalDuration)}
            </span>
          </span>
        ),
      },
      {
        id: 'enrolled',
        header: 'Learners',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.counts.enrolled ? row.original.counts.enrolled.toLocaleString() : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${row.original.title}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/courses/${row.original.id}`)}>
                Edit
              </DropdownMenuItem>
              {/*
                Keyed off isPublic, not status: a WAITLIST course is already
                public, so branching on status alone offered it "Publish" again.
                An archived course is offered neither — Restore first.
              */}
              {row.original.archivedAt ? null : row.original.isPublic ? (
                <DropdownMenuItem
                  onClick={async () => {
                    await setCourseStatus(row.original.id, 'unpublish');
                    await refetch();
                    toast.success('Unpublished.');
                  }}
                >
                  Unpublish
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await setCourseStatus(row.original.id, 'publish');
                      await refetch();
                      toast.success('Published.');
                    } catch (error) {
                      toast.error('Not ready to publish', {
                        description:
                          (error as { failures?: Array<{ message: string }> }).failures
                            ?.map((f) => f.message)
                            .join(' · ') ?? (error as Error).message,
                      });
                    }
                  }}
                >
                  Publish
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={async () => {
                  await setCourseStatus(
                    row.original.id,
                    row.original.archivedAt ? 'restore' : 'archive',
                  );
                  await refetch();
                  toast.success(row.original.archivedAt ? 'Restored.' : 'Archived.');
                }}
              >
                {row.original.archivedAt ? 'Restore' : 'Archive'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleting(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [refetch, router],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { rowSelection: selection },
    onRowSelectionChange: setSelection,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <PageHeader
        title="Courses"
        description={`${total} course${total === 1 ? '' : 's'}`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
              Export CSV
            </Button>
            <Button onClick={() => setImportOpen(true)}>Import course JSON</Button>
            <Button variant="outline" onClick={() => router.push('/courses/new')}>
              + New course
            </Button>
          </>
        }
      />

      <FilterBar className="mb-4">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search title, summary or slug…"
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setStatus(option.value);
                setPage(1);
              }}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs transition-colors',
                status === option.value
                  ? 'border-primary font-semibold text-primary'
                  : 'border-border text-foreground hover:border-primary hover:text-primary',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Select
          value={premium}
          onValueChange={(value) => {
            setPremium(value as typeof premium);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRICING.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={categoryId}
          onValueChange={(value) => {
            setCategoryId(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Any category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any category</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => toggleSort(value as typeof sort)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Newest</SelectItem>
            <SelectItem value="lastUpdated">Recently updated</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="enrolled">Learners</SelectItem>
            <SelectItem value="amount">Price</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {selectedRows.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <strong>{selectedRows.length} selected</strong>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk('publish')}>
            Publish
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk('unpublish')}>
            Unpublish
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk('archive')}>
            Archive
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelection({})}>
            Clear
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !rows.length ? (
        <EmptyState
          title={search || status !== 'ALL' ? 'No courses match those filters' : 'No courses yet'}
          description={
            search || status !== 'ALL'
              ? 'Loosen the filters or clear the search.'
              : 'Import one from JSON, or start from a blank form.'
          }
          action={
            search || status !== 'ALL' ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatus('ALL');
                  setPremium('ALL');
                  setCategoryId('ALL');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setImportOpen(true)}>Import a course from JSON</Button>
                <Button variant="outline" onClick={() => router.push('/courses/new')}>
                  Start from a blank form
                </Button>
              </div>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden p-0 md:p-0">
          <DataTable table={table} />
        </Card>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {total
            ? `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`
            : ''}
        </span>
        <div className="flex items-center gap-2">
          <Select
            value={String(limit)}
            onValueChange={(value) => {
              setLimit(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Prev
          </Button>
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <ConfirmDelete
        open={Boolean(deleting)}
        title="Delete course"
        description={
          deleting?.counts.enrolled
            ? `“${deleting.title}” has ${deleting.counts.enrolled.toLocaleString()} enrolments, so the API will refuse. Archive it instead.`
            : `Delete “${deleting?.title}”? Nobody is enrolled, so this is permanent and safe.`
        }
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteCourse(deleting.id);
            toast.success('Deleted.');
          } catch (error) {
            const response = (
              error as { response?: { status?: number; data?: { message?: string } } }
            ).response;
            toast.error(response?.status === 409 ? 'Cannot delete' : 'Delete failed', {
              description: response?.data?.message ?? (error as Error).message,
            });
          }
          setDeleting(null);
          await refetch();
        }}
      />

      <ImportCourseModal
        open={importOpen}
        mode="course"
        onClose={() => setImportOpen(false)}
        onImported={(courseId) => router.push(`/courses/${courseId}`)}
      />
    </div>
  );
}
