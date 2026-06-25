'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search, RefreshCcw, FileJson } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { getAuditLogs, type AuditLog } from '@/lib/api/auditLogs';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';

// Action → StatusBadge-like tone classes using semantic design tokens only
const ACTION_CLASSES: Record<string, string> = {
  CREATE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  UPDATE: 'bg-primary/10 text-primary',
  DELETE: 'bg-destructive/10 text-destructive',
  APPROVE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  REJECT: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  SUSPEND: 'bg-destructive/10 text-destructive',
  RESTORE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  CANCEL: 'bg-destructive/10 text-destructive',
  GRANT: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
};

export default function AuditLogsTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['auditLogs', page, search, actionFilter, entityFilter],
    queryFn: () =>
      getAuditLogs({
        page,
        limit: 20,
        q: search || undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        entityType: entityFilter !== 'all' ? entityFilter : undefined,
      }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Logs"
        description="Immutable record of all administrative actions across the platform."
      />

      <Card className="p-4 sm:p-6">
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ID, email..."
              className="w-full pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Select
              value={actionFilter}
              onValueChange={(val) => {
                setActionFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
                <SelectItem value="APPROVE">Approve</SelectItem>
                <SelectItem value="REJECT">Reject</SelectItem>
                <SelectItem value="SUSPEND">Suspend</SelectItem>
                <SelectItem value="RESTORE">Restore</SelectItem>
                <SelectItem value="GRANT">Grant</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={entityFilter}
              onValueChange={(val) => {
                setEntityFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Course">Course</SelectItem>
                <SelectItem value="Plan">Plan</SelectItem>
                <SelectItem value="Subscription">Subscription</SelectItem>
                <SelectItem value="ContentApproval">Approval</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              className="col-span-2 sm:col-span-1 w-full sm:w-auto"
            >
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <LoadingState label="Loading audit logs..." />
        ) : isError ? (
          <ErrorState message="Failed to load audit logs." onRetry={refetch} />
        ) : !data?.data || data.data.length === 0 ? (
          <EmptyState
            title="No audit logs found"
            description="Try adjusting your search or filters."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap font-medium text-muted-foreground">
                        {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{log.adminName}</span>
                          <span className="text-xs text-muted-foreground">{log.adminEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={ACTION_CLASSES[log.action] ?? ''}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-muted-foreground">
                        {log.entityType}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {log.entityId.slice(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedLog(log)}
                          disabled={!log.before && !log.after}
                        >
                          <FileJson className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {data.total > 0 && (
              <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-medium">{(page - 1) * 20 + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(page * 20, data.total)}</span> of{' '}
                  <span className="font-medium">{data.total}</span> logs
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * 20 >= data.total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* JSON Viewer Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="grid gap-4 sm:grid-cols-2">
              {selectedLog.before && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Before</h4>
                  <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-4 text-xs">
                    {JSON.stringify(selectedLog.before, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.after && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">After</h4>
                  <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-4 text-xs">
                    {JSON.stringify(selectedLog.after, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
