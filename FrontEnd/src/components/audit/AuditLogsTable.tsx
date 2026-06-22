"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, SlidersHorizontal, RefreshCcw, FileJson } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuditLogs, type AuditLog } from "@/lib/api/auditLogs";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-500/10 text-green-600 dark:text-green-400",
  UPDATE: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  DELETE: "bg-red-500/10 text-red-600 dark:text-red-400",
  APPROVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  REJECT: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  SUSPEND: "bg-red-500/10 text-red-600 dark:text-red-400",
  RESTORE: "bg-green-500/10 text-green-600 dark:text-green-400",
  CANCEL: "bg-red-500/10 text-red-600 dark:text-red-400",
  GRANT: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

export default function AuditLogsTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["auditLogs", page, search, actionFilter, entityFilter],
    queryFn: () =>
      getAuditLogs({
        page,
        limit: 20,
        q: search || undefined,
        action: actionFilter !== "all" ? actionFilter : undefined,
        entityType: entityFilter !== "all" ? entityFilter : undefined,
      }),
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ID, email..."
              className="pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={actionFilter}
            onValueChange={(val) => {
              setActionFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
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
            <SelectTrigger className="w-[140px]">
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
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
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
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Failed to load audit logs.
                </TableCell>
              </TableRow>
            ) : !data?.data || data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No audit logs found.
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap font-medium text-muted-foreground">
                    {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{log.adminName}</span>
                      <span className="text-xs text-muted-foreground">{log.adminEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={ACTION_COLORS[log.action] ?? ""}>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{(page - 1) * 20 + 1}</span> to{" "}
            <span className="font-medium">{Math.min(page * 20, data.total)}</span> of{" "}
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

      {/* JSON Viewer Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
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
