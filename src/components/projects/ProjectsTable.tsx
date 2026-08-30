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
import NewProjectModal from '@/components/projects/NewProjectModal';
import ImportProjectModal from '@/components/projects/ImportProjectModal';
import { LEVELS, MODES, deleteProject, fetchProjects, type Project } from '@/lib/api/projects';

const PAGE = 25;

function levelTone(level: string): 'success' | 'info' | 'warning' | 'neutral' {
  if (level === 'Beginner') return 'success';
  if (level === 'Intermediate') return 'info';
  if (level === 'Advanced') return 'warning';
  return 'neutral';
}

export default function ProjectsTable() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('ALL');
  const [mode, setMode] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirming, setConfirming] = useState<Project | null>(null);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE,
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(level !== 'ALL' ? { level } : {}),
      ...(mode !== 'ALL' ? { mode } : {}),
      ...(status !== 'ALL' ? { status } : {}),
    }),
    [q, level, mode, status, page],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-projects', params],
    queryFn: () => fetchProjects(params),
  });

  const rows = useMemo(() => data?.data ?? [], [data]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const columns = useMemo<ColumnDef<Project>[]>(
    () => [
      {
        id: 'project',
        header: 'Project',
        cell: ({ row }) => (
          <button
            type="button"
            className="block max-w-xs text-left"
            onClick={() => router.push(`/projects/${row.original.id}`)}
          >
            <span className="block truncate font-medium">{row.original.title}</span>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              /{row.original.slug}
            </span>
          </button>
        ),
      },
      {
        id: 'playground',
        header: 'Playground',
        cell: ({ row }) => (
          <span>
            <span className="block font-mono text-xs">{row.original.mode}</span>
            {row.original.mode === 'terminal' && row.original.language ? (
              <span className="block text-xs text-muted-foreground">
                {row.original.language} · {row.original.entrypoint}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'level',
        header: 'Level',
        cell: ({ row }) => (
          <StatusBadge label={row.original.level || '—'} tone={levelTone(row.original.level)} />
        ),
      },
      {
        id: 'projectTasks',
        header: 'ProjectTasks',
        meta: { align: 'right' as const },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.projectTaskCount ?? 0}</span>
        ),
      },
      {
        id: 'learners',
        header: 'Builders',
        meta: { align: 'right' as const },
        cell: ({ row }) => <span className="tabular-nums">{row.original.learnerCount ?? 0}</span>,
      },
      {
        id: 'solutions',
        header: 'Solutions',
        meta: { align: 'right' as const },
        cell: ({ row }) => <span className="tabular-nums">{row.original.solutionCount ?? 0}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.status}
            tone={row.original.status === 'published' ? 'success' : 'warning'}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${row.original.title}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/projects/${row.original.id}`)}>
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
        title="Projects"
        description={`${total} project${total === 1 ? '' : 's'}. Something a builder ships, graded task by task inside a playground.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImporting(true)}>
              Import JSON
            </Button>
            <Button onClick={() => setCreating(true)}>New project</Button>
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
          placeholder="Search title or summary…"
          className="max-w-xs"
          aria-label="Search projects"
        />
        {filter('Filter by playground', mode, setMode, MODES, 'Any playground')}
        {filter('Filter by level', level, setLevel, LEVELS, 'Any level')}
        {filter('Filter by status', status, setStatus, ['published', 'draft'], 'Any status')}
      </div>

      {isLoading ? <LoadingState /> : null}
      {isError ? <ErrorState onRetry={() => refetch()} /> : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <EmptyState title="No projects" description="Nothing matches those filters." />
      ) : null}

      {rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <DataTable table={table} mobileTitle={(row) => row.original.title} />
        </Card>
      ) : null}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {pages} · {total} project{total === 1 ? '' : 's'}
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

      <ImportProjectModal
        open={importing}
        onOpenChange={setImporting}
        onImported={(id) => {
          refetch();
          router.push(`/projects/${id}`);
        }}
      />

      <NewProjectModal
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => router.push(`/projects/${id}`)}
      />

      <ConfirmDelete
        open={Boolean(confirming)}
        onCancel={() => setConfirming(null)}
        title={`Delete “${confirming?.title ?? ''}”?`}
        description="This removes the project with its ProjectTasks and Tasks. It is refused if any builder has started it or any solution references it."
        onConfirm={async () => {
          if (!confirming) return;
          try {
            await deleteProject(confirming.id);
            toast.success(`Deleted “${confirming.title}”.`);
            setConfirming(null);
            refetch();
          } catch (error) {
            toast.error('Could not delete it', { description: (error as Error).message });
          }
        }}
      />
    </div>
  );
}
