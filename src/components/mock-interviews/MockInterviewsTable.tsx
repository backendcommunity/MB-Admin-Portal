'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import ImportTemplatesModal from '@/components/mock-interviews/ImportTemplatesModal';
import { STYLES, CATEGORIES, DIFFICULTIES } from '@/lib/mockInterviews/constants';
import {
  deleteTemplate,
  fetchTemplates,
  type MockInterviewTemplate,
} from '@/lib/api/mockInterviews';

const PAGE = 25;

function difficultyTone(difficulty: string): 'success' | 'info' | 'warning' | 'neutral' {
  if (difficulty === 'Easy') return 'success';
  if (difficulty === 'Medium') return 'info';
  if (difficulty === 'Hard') return 'warning';
  return 'neutral';
}

export default function MockInterviewsTable() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [style, setStyle] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [difficulty, setDifficulty] = useState('ALL');
  const [status, setStatus] = useState<'ALL' | 'published' | 'draft'>('ALL');
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<MockInterviewTemplate | null>(null);
  const [importing, setImporting] = useState(false);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE,
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(style !== 'ALL' ? { style } : {}),
      ...(category !== 'ALL' ? { category } : {}),
      ...(difficulty !== 'ALL' ? { difficulty } : {}),
      ...(status !== 'ALL' ? { status } : {}),
    }),
    [q, style, category, difficulty, status, page],
  );

  const filtersActive =
    Boolean(q.trim()) ||
    style !== 'ALL' ||
    category !== 'ALL' ||
    difficulty !== 'ALL' ||
    status !== 'ALL';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-mock-interviews', params],
    queryFn: () => fetchTemplates({ ...params, scope: 'mine' }),
  });

  const rows = useMemo(() => data?.data ?? [], [data]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const columns = useMemo<ColumnDef<MockInterviewTemplate>[]>(
    () => [
      {
        id: 'template',
        header: 'Template',
        cell: ({ row }) => (
          <button
            type="button"
            className="block max-w-xs text-left"
            onClick={() => router.push(`/mock-interviews/${row.original.id}`)}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="block truncate font-medium">{row.original.name}</span>
              {row.original.isCustom ? <StatusBadge label="Custom" tone="info" /> : null}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {row.original.company ?? '—'} · {row.original.topics?.length ?? 0} topics
            </span>
          </button>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <span>
            <span className="block">{row.original.position ?? '—'}</span>
            <span className="block text-xs text-muted-foreground">
              {row.original.seniority ?? '—'}
            </span>
          </span>
        ),
      },
      {
        id: 'style',
        header: 'Style',
        cell: ({ row }) => <span>{row.original.style ?? '—'}</span>,
      },
      {
        id: 'difficulty',
        header: 'Difficulty',
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.difficulty}
            tone={difficultyTone(row.original.difficulty)}
          />
        ),
      },
      {
        id: 'attempts',
        header: 'Attempts',
        meta: { align: 'right' as const },
        cell: ({ row }) => <span className="tabular-nums">{row.original.attemptCount ?? 0}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.isPublic ? 'Published' : 'Draft'}
            tone={row.original.isPublic ? 'success' : 'warning'}
          />
        ),
      },
      {
        id: 'owner',
        header: 'Owner',
        // `addedBy` is just an id — this payload carries no role for whoever
        // it points to, so "Instructor" claimed a role the data does not
        // carry (an admin-authored template reads identically). "Authored"
        // says only what's actually known: someone owns this row.
        cell: ({ row }) => <span>{row.original.addedBy ? 'Authored' : 'Platform'}</span>,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${row.original.name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/mock-interviews/${row.original.id}`)}>
                Open
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setConfirming(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [router],
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  const filter = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    options: readonly string[],
    allLabel: string,
  ) => (
    <Select
      value={value}
      onValueChange={(next) => {
        onChange(next);
        // A narrower filter can leave the current page past the end.
        setPage(1);
      }}
    >
      <SelectTrigger className="w-auto min-w-36" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mock Interviews"
        description={`${total} template${total === 1 ? '' : 's'}. Practice interviews a learner attempts, judged against a rubric.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImporting(true)}>
              Import JSON
            </Button>
            <Button onClick={() => router.push('/mock-interviews/new')}>New template</Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
          placeholder="Search name or summary…"
          className="max-w-xs"
          aria-label="Search mock interview templates"
        />
        {filter('Filter by style', style, setStyle, STYLES, 'Any style')}
        {filter('Filter by category', category, setCategory, CATEGORIES, 'Any category')}
        {filter('Filter by difficulty', difficulty, setDifficulty, DIFFICULTIES, 'Any difficulty')}
        {filter(
          'Filter by status',
          status,
          (next) => setStatus(next as 'ALL' | 'published' | 'draft'),
          ['published', 'draft'],
          'Any status',
        )}
      </div>

      {isLoading ? <LoadingState /> : null}
      {isError ? <ErrorState onRetry={() => refetch()} /> : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <EmptyState
          title="No templates"
          description={
            filtersActive
              ? 'Nothing matches those filters.'
              : 'You have not authored a mock interview template yet.'
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <DataTable
            table={table}
            mobileTitle={(row) =>
              `${row.original.name} · ${
                row.original.position || row.original.seniority || 'Template'
              }`
            }
          />
        </Card>
      ) : null}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {pages} · {total} template{total === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDelete
        open={Boolean(confirming)}
        onCancel={() => setConfirming(null)}
        title={`Delete “${confirming?.name ?? ''}”?`}
        description="This removes the template. It is refused if any learner has attempted it."
        onConfirm={async () => {
          if (!confirming) return;
          try {
            await deleteTemplate(confirming.id);
            toast.success(`Deleted “${confirming.name}”.`);
            setConfirming(null);
            refetch();
          } catch (error) {
            toast.error('Could not delete it', {
              description:
                (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
                (error as Error).message,
            });
          }
        }}
      />

      <ImportTemplatesModal
        open={importing}
        onOpenChange={setImporting}
        onImported={() => {
          refetch();
        }}
      />
    </div>
  );
}
