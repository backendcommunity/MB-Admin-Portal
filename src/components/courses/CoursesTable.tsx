'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useApiQuery } from '@/lib/api/query';
import {
  deleteCourse,
  updateCourse,
  type Course,
  type CoursesListResponse,
} from '@/lib/api/courses';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import AddCourseModal from '@/components/courses/AddCourseModal';
import EditCourseModal from '@/components/courses/EditCourseModal';
import ConfirmDelete from '@/components/users/ConfirmDelete';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
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
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';

function getCourseStatus(course: Course): 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' {
  const status = String(course.status || '').toUpperCase();
  if (status === 'ARCHIVED') return 'ARCHIVED';
  if (status === 'PUBLISHED') return 'PUBLISHED';
  return course.published ? 'PUBLISHED' : 'DRAFT';
}

function statusTone(status: string): 'success' | 'neutral' | 'warning' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'ARCHIVED') return 'neutral';
  return 'warning';
}

export default function CoursesTable() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  const sortParam = sorting[0]
    ? `&sort=${sorting[0].id}&order=${sorting[0].desc ? 'desc' : 'asc'}`
    : '';

  const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';

  const { data, isLoading, isError, refetch } = useApiQuery<CoursesListResponse>(
    ['courses', pageIndex, pageSize, globalFilter, statusFilter, sorting],
    `/admin/courses?page=${pageIndex + 1}&limit=${pageSize}&q=${encodeURIComponent(globalFilter)}${statusParam}${sortParam}`,
  );

  const courses: Course[] = data?.data || [];
  const total: number = data?.total || 0;

  const columns = useMemo<ColumnDef<Course, unknown>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        ),
      },
      { accessorKey: 'title', header: 'Title' },
      { accessorKey: 'category', header: 'Category' },
      { accessorKey: 'instructor', header: 'Instructor' },
      { accessorKey: 'chaptersCount', header: 'Chapters' },
      { accessorKey: 'enrolledCount', header: 'Enrolled' },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = getCourseStatus(row.original);
          return <StatusBadge label={status} tone={statusTone(status)} />;
        },
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
              <DropdownMenuItem asChild>
                <Link href={`/courses/${row.original.id}`}>View</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  try {
                    const current = getCourseStatus(row.original);
                    await updateCourse({
                      id: row.original.id,
                      status: current === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED',
                      published: current !== 'PUBLISHED',
                    });
                    await refetch();
                  } catch (error) {
                    console.error('Status update failed:', error);
                  }
                }}
              >
                {getCourseStatus(row.original) === 'PUBLISHED' ? 'Archive' : 'Publish'}
              </DropdownMenuItem>
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
    [refetch],
  );

  const table = useReactTable({
    data: courses,
    columns,
    pageCount: Math.ceil(total / pageSize) || -1,
    state: { pagination: { pageIndex, pageSize }, sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex ?? 0);
      setPageSize(next.pageSize ?? pageSize);
    },
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedCourses = useMemo(
    () => table.getSelectedRowModel().flatRows.map((row) => row.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, rowSelection, courses],
  );

  const bulkArchiveSelected = useCallback(async () => {
    if (!selectedCourses.length) return;
    setIsBulkBusy(true);
    try {
      await Promise.all(
        selectedCourses.map((course) =>
          updateCourse({ id: course.id, status: 'ARCHIVED', published: false }),
        ),
      );
      setRowSelection({});
      setPageIndex(0);
      await refetch();
    } catch (error) {
      console.error('Bulk archive failed:', error);
    } finally {
      setIsBulkBusy(false);
    }
  }, [selectedCourses, refetch]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Courses"
        description="Manage platform courses, categories, and publication status."
        actions={<Button onClick={() => setShowAdd(true)}>Add Course</Button>}
      />

      <Card className="p-4 sm:p-6">
        <div className="mb-4 space-y-3">
          <Input
            placeholder="Search by title, category, or instructor..."
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              setPageIndex(0);
            }}
            className="w-full"
          />

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPageIndex(0);
              }}
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => refetch()}
              variant="outline"
              className="col-span-2 sm:col-span-1"
            >
              Refresh
            </Button>

            {selectedCourses.length > 0 && (
              <Button
                onClick={bulkArchiveSelected}
                disabled={isBulkBusy}
                variant="outline"
                className="col-span-2 text-amber-600 sm:col-span-1"
              >
                Archive ({selectedCourses.length})
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <LoadingState label="Loading courses..." />
        ) : isError ? (
          <ErrorState message="Error loading courses. Please try again." onRetry={refetch} />
        ) : courses.length === 0 ? (
          <EmptyState
            title="No courses found"
            description="Try adjusting your search or filters."
          />
        ) : (
          <>
            <DataTable table={table} mobileTitle={(r) => r.original.title} />

            {/* Pagination */}
            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min(pageIndex * pageSize + 1, total)}–
                {Math.min((pageIndex + 1) * pageSize, total)} of {total} courses
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
      </Card>

      <AddCourseModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setPageIndex(0);
          refetch();
        }}
      />

      <EditCourseModal
        open={Boolean(editing)}
        course={editing}
        onClose={() => setEditing(null)}
        onUpdated={() => {
          setEditing(null);
          setPageIndex(0);
          refetch();
        }}
      />

      <ConfirmDelete
        open={Boolean(deletingId)}
        title="Delete course"
        description={`Permanently delete course ${deletingId}?`}
        onCancel={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await deleteCourse(deletingId);
            setDeletingId(null);
            setPageIndex(0);
            refetch();
          } catch (err) {
            console.error(err);
          }
        }}
      />
    </div>
  );
}
