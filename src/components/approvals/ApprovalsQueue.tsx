'use client';

import React, { useState } from 'react';

import {
  approvalAction,
  type ApprovalItem,
  type ApprovalType,
  type ApprovalsResponse,
} from '@/lib/api/approvals';
import { useApiQuery } from '@/lib/api/query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilterBar } from '@/components/shared/FilterBar';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClipboardList } from 'lucide-react';

export default function ApprovalsQueue() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | ApprovalType>('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});

  const { data, isLoading, isError, refetch } = useApiQuery<ApprovalsResponse>(
    ['approvals', q, type, pageIndex, pageSize],
    `/admin/approvals?q=${encodeURIComponent(q)}&type=${type}&page=${pageIndex + 1}&limit=${pageSize}`,
  );

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  async function runAction(item: ApprovalItem, action: 'approve' | 'reject' | 'request-changes') {
    await approvalAction({
      type: item.type,
      id: item.id,
      action,
      feedback: feedbackById[item.id],
    });
    await refetch();
  }

  return (
    <Card className="p-6 space-y-4">
      {/* ── Filter Toolbar ────────────────────────────────────────────────────── */}
      <FilterBar>
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPageIndex(0);
          }}
          placeholder="Search pending approvals"
          className="w-80"
        />
        <Select
          value={type}
          onValueChange={(val) => {
            setType(val as 'all' | ApprovalType);
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="COURSE">Course</SelectItem>
            <SelectItem value="PROJECT">Project</SelectItem>
            <SelectItem value="ROADMAP">Roadmap</SelectItem>
            <SelectItem value="OFFER">Offer</SelectItem>
            <SelectItem value="SOLUTION">Solution</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </FilterBar>

      {/* ── Content States ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingState label="Loading approvals..." />
      ) : isError ? (
        <ErrorState message="Error loading approvals." onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No pending approvals"
          description="All caught up! New submissions will appear here."
        />
      ) : (
        <>
          {/* ── Approvals Table ──────────────────────────────────────────────── */}
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="text-sm font-semibold text-foreground">Type</TableHead>
                  <TableHead className="text-sm font-semibold text-foreground">Title</TableHead>
                  <TableHead className="text-sm font-semibold text-foreground">
                    Submitted By
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-foreground">Submitted</TableHead>
                  <TableHead className="text-sm font-semibold text-foreground">Feedback</TableHead>
                  <TableHead className="text-sm font-semibold text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow key={`${item.type}-${item.id}`} className="align-top">
                    <TableCell className="text-sm">
                      <StatusBadge label={item.type} tone="info" />
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      <div className="font-medium">{item.title}</div>
                      {item.feedback ? (
                        <div className="text-xs text-muted-foreground mt-1">
                          Last note: {item.feedback}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {item.submittedBy || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-sm min-w-64">
                      <textarea
                        className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
                        placeholder="Optional feedback"
                        value={feedbackById[item.id] ?? ''}
                        onChange={(e) =>
                          setFeedbackById((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-2 min-w-36">
                        <Button size="sm" onClick={() => runAction(item, 'approve')}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runAction(item, 'request-changes')}
                        >
                          Request Changes
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => runAction(item, 'reject')}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* ── Pagination ────────────────────────────────────────────────────── */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Showing {Math.min(pageIndex * pageSize + 1, total)}–
              {Math.min((pageIndex + 1) * pageSize, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPageIndex(0);
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={(pageIndex + 1) * pageSize >= total}
                onClick={() => setPageIndex((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
