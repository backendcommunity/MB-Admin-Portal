'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import AddUserModal from '@/components/users/AddUserModal';
import {
  Avatar,
  FLAG_REASONS,
  FlagList,
  Streak,
  accessTone,
  filterByFlagReason,
  roleTone,
  statusTone,
} from '@/components/users/bits';
import {
  ACCESS,
  ROLES,
  SIGNUP_SOURCES,
  STATUSES,
  deleteUser,
  fetchFlagged,
  fetchUsers,
  type Paged,
  type UserFlag,
  type UserRow,
} from '@/lib/api/users';

/**
 * What the table renders is always this shape — `flags` is only ever
 * populated when the flagged endpoint filled it in, but keeping it on the
 * type (rather than reaching for `any`/a cast at the two call sites that need
 * it) is what lets the flags column and the reason filter read it safely.
 */
type FlaggableUserRow = UserRow & { flags?: UserFlag[] };

const PAGE = 25;

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function UsersTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [flagged, setFlagged] = useState(() => searchParams?.get('filter') === 'flagged');
  const [flagReason, setFlagReason] = useState('ALL');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [access, setAccess] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE,
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(role !== 'ALL' ? { role } : {}),
      ...(status !== 'ALL' ? { status } : {}),
      ...(access !== 'ALL' ? { access } : {}),
      ...(source !== 'ALL' ? { source } : {}),
    }),
    [q, role, status, access, source, page],
  );

  const { data, isLoading, isError, refetch } = useQuery<Paged<FlaggableUserRow>>({
    queryKey: flagged ? ['admin-users-flagged'] : ['admin-users', params],
    queryFn: async (): Promise<Paged<FlaggableUserRow>> => {
      if (!flagged) return fetchUsers(params);
      // The flagged endpoint isn't paged — it returns every flagged account —
      // so it is normalised to the same `Paged` shape the table already reads.
      const result = await fetchFlagged();
      return { data: result.data, total: result.total, page: 1, limit: result.total };
    },
  });

  const rows = useMemo(() => {
    const all = data?.data ?? [];
    // The reason filter only makes sense against flagged rows — every row has
    // `flags` there, which is what `filterByFlagReason` requires.
    if (!flagged) return all;
    return filterByFlagReason(all, flagReason);
  }, [data, flagged, flagReason]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const columns = useMemo<ColumnDef<FlaggableUserRow>[]>(() => {
    const remove = async (user: FlaggableUserRow) => {
      try {
        await deleteUser(user.id);
        toast.success(`Deleted ${user.email}.`, {
          description:
            'A soft delete — the account can be restored until the purge job removes it.',
        });
        refetch();
      } catch (error) {
        toast.error('Could not delete it', { description: (error as Error).message });
      }
    };

    return [
      {
        id: 'user',
        header: 'User',
        cell: ({ row }) => (
          <button
            type="button"
            className="flex max-w-xs items-center gap-2.5 text-left"
            onClick={() => router.push(`/users/${row.original.id}`)}
          >
            <Avatar name={row.original.name} src={row.original.avatar} />
            <span className="min-w-0">
              <span className="block truncate font-medium">{row.original.name || 'No name'}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {row.original.email}
              </span>
            </span>
          </button>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <StatusBadge label={row.original.role} tone={roleTone(row.original.role)} />
        ),
      },
      {
        id: 'access',
        header: 'Access',
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <StatusBadge label={row.original.access} tone={accessTone(row.original.access)} />
            {row.original.plan ? (
              <span className="truncate text-xs text-muted-foreground">{row.original.plan}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'points',
        header: 'Points',
        meta: { align: 'right' as const },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.points.toLocaleString()}</span>
        ),
      },
      {
        id: 'streak',
        header: 'Streak',
        meta: { align: 'right' as const },
        cell: ({ row }) => (
          <Streak current={row.original.currentStreak} longest={row.original.longestStreak} />
        ),
      },
      {
        id: 'joined',
        header: 'Signed up',
        cell: ({ row }) => (
          <span>
            <span className="block text-sm">{fmt(row.original.createdAt)}</span>
            <span className="block text-xs lowercase text-muted-foreground">
              {row.original.signedUpThrough}
            </span>
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge label={row.original.status} tone={statusTone(row.original.status)} />
        ),
      },
      ...(flagged
        ? [
            {
              id: 'flags',
              header: 'Flags',
              cell: ({ row }: { row: { original: FlaggableUserRow } }) => (
                <FlagList flags={row.original.flags ?? []} />
              ),
            } satisfies ColumnDef<FlaggableUserRow>,
          ]
        : []),
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${row.original.email}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/users/${row.original.id}`)}>
                Open
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => remove(row.original)}
                disabled={Boolean(row.original.deletedAt)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ];
  }, [router, refetch, flagged]);

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
        title="Users"
        description={
          flagged
            ? `${total} account${total === 1 ? '' : 's'} needing a decision — unverified addresses, stalled onboarding, suspensions, forced resets and live trials.`
            : `${total} account${total === 1 ? '' : 's'}. Suspending, granting access and changing a role all happen here.`
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant={flagged ? 'default' : 'outline'}
              onClick={() => {
                setFlagged((value) => !value);
                setPage(1);
              }}
            >
              Needs attention
            </Button>
            <Button onClick={() => setAdding(true)}>Add user</Button>
          </div>
        }
      />

      {flagged ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={flagReason} onValueChange={setFlagReason}>
            <SelectTrigger className="w-56" aria-label="Filter by reason">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FLAG_REASONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <StatusBadge
            label={`${rows.length} flagged`}
            tone={rows.length ? 'warning' : 'success'}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, email or username…"
            className="max-w-xs"
            aria-label="Search users"
          />
          {filter('Filter by role', role, setRole, ROLES, 'All roles')}
          {filter('Filter by status', status, setStatus, STATUSES, 'Any status')}
          {filter('Filter by access', access, setAccess, ACCESS, 'Any access')}
          {filter('Filter by signup', source, setSource, SIGNUP_SOURCES, 'Any signup')}
        </div>
      )}

      {isLoading ? <LoadingState /> : null}
      {isError ? <ErrorState onRetry={() => refetch()} /> : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <EmptyState title="Nobody matches" description="Try a different search or filter." />
      ) : null}

      {rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <DataTable table={table} mobileTitle={(row) => row.original.name || row.original.email} />
        </Card>
      ) : null}

      {!flagged && pages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {pages}
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

      <AddUserModal
        open={adding}
        onOpenChange={setAdding}
        onCreated={(id) => router.push(`/users/${id}`)}
      />
    </div>
  );
}
