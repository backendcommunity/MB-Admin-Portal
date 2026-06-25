'use client';

import React, { useMemo, useState } from 'react';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';

import { useApiQuery } from '@/lib/api/query';
import { deleteRoadmap, type Roadmap, type RoadmapsListResponse } from '@/lib/api/roadmaps';
import AddRoadmapModal from '@/components/roadmaps/AddRoadmapModal';
import EditRoadmapModal from '@/components/roadmaps/EditRoadmapModal';
import TopicManagerModal from '@/components/roadmaps/TopicManagerModal';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

export default function RoadmapsTable() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [sorting, setSorting] = useState<SortingState>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Roadmap | null>(null);
  const [managingTopicsFor, setManagingTopicsFor] = useState<Roadmap | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortParam = sorting[0]
    ? `&sort=${sorting[0].id}&order=${sorting[0].desc ? 'desc' : 'asc'}`
    : '';
  const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
  const difficultyParam = difficultyFilter !== 'all' ? `&difficulty=${difficultyFilter}` : '';

  const { data, isLoading, isError, refetch } = useApiQuery<RoadmapsListResponse>(
    ['roadmaps', pageIndex, pageSize, q, statusFilter, difficultyFilter, sorting],
    `/admin/roadmaps?page=${pageIndex + 1}&limit=${pageSize}&q=${encodeURIComponent(q)}${statusParam}${difficultyParam}${sortParam}`,
  );

  const roadmaps = data?.data || [];
  const total = data?.total || 0;

  const columns = useMemo<ColumnDef<Roadmap, unknown>[]>(
    () => [
      { accessorKey: 'title', header: 'Title' },
      { accessorKey: 'difficulty', header: 'Difficulty' },
      { accessorKey: 'topicsCount', header: 'Topics' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.status}
            tone={row.original.status === 'PUBLISHED' ? 'success' : 'warning'}
          />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setManagingTopicsFor(row.original)}>
                Topics
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setDeletingId(row.original.id)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: roadmaps,
    columns,
    pageCount: Math.ceil(total / pageSize) || -1,
    state: { pagination: { pageIndex, pageSize }, sorting },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex ?? 0);
      setPageSize(next.pageSize ?? pageSize);
    },
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card className="p-6">
      <PageHeader
        title="Roadmaps"
        actions={<Button onClick={() => setShowAdd(true)}>New Roadmap</Button>}
      />

      <FilterBar className="mb-6">
        <Input
          placeholder="Search roadmaps"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPageIndex(0);
          }}
          className="flex-1"
        />

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={difficultyFilter}
          onValueChange={(v) => {
            setDifficultyFilter(v);
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All difficulty</SelectItem>
            <SelectItem value="Beginner">Beginner</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </FilterBar>

      {isLoading ? (
        <LoadingState label="Loading roadmaps..." />
      ) : isError ? (
        <ErrorState message="Error loading roadmaps." onRetry={refetch} />
      ) : roadmaps.length === 0 ? (
        <EmptyState
          title="No roadmaps found"
          description="Try adjusting your filters or create a new one."
        />
      ) : (
        <>
          <DataTable table={table} mobileTitle={(r) => r.original.title} />

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <div className="text-sm text-muted-foreground">
              Showing {Math.min(pageIndex * pageSize + 1, total)}–
              {Math.min((pageIndex + 1) * pageSize, total)} of {total} roadmaps
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  table.setPageSize(Number(v));
                  setPageIndex(0);
                }}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                disabled={pageIndex === 0}
              >
                Previous
              </Button>

              <span className="text-sm text-muted-foreground">
                Page {pageIndex + 1} of {Math.ceil(total / pageSize) || 1}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageIndex(pageIndex + 1)}
                disabled={(pageIndex + 1) * pageSize >= total}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <AddRoadmapModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false);
          setPageIndex(0);
          refetch();
        }}
      />

      <EditRoadmapModal
        open={Boolean(editing)}
        roadmap={editing}
        onClose={() => setEditing(null)}
        onUpdated={() => {
          setEditing(null);
          refetch();
        }}
      />

      {managingTopicsFor ? (
        <TopicManagerModal
          open={Boolean(managingTopicsFor)}
          roadmapId={managingTopicsFor.id}
          onClose={() => {
            setManagingTopicsFor(null);
            refetch();
          }}
        />
      ) : null}

      <ConfirmDelete
        open={Boolean(deletingId)}
        title="Delete roadmap"
        description={`Permanently delete roadmap ${deletingId}?`}
        onCancel={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await deleteRoadmap(deletingId);
            setDeletingId(null);
            setPageIndex(0);
            refetch();
          } catch (err) {
            console.error(err);
          }
        }}
      />
    </Card>
  );
}
