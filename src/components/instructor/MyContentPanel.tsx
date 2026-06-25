'use client';

import React, { useMemo, useState } from 'react';

import {
  submitMyContentForReview,
  createInstructorContent,
  type MyContentItem,
} from '@/lib/api/instructor';
import { useApiQuery } from '@/lib/api/query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';

function contentStatusTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING_REVIEW') return 'warning';
  return 'neutral';
}

export default function MyContentPanel() {
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newContentType, setNewContentType] = useState('COURSE');
  const [newContentTitle, setNewContentTitle] = useState('');
  const [newContentDesc, setNewContentDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading, isError, refetch } = useApiQuery<{
    data: { courses: MyContentItem[]; projects: MyContentItem[]; roadmaps: MyContentItem[] };
  }>(['instructor-my-content'], '/instructor/my-content');

  const rows = useMemo(
    () => [
      ...(data?.data?.courses || []),
      ...(data?.data?.projects || []),
      ...(data?.data?.roadmaps || []),
    ],
    [data],
  );

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">My Content</h2>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={() => setIsCreateModalOpen(true)}>
            Create Content
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Loading your content..." />
      ) : isError ? (
        <ErrorState message="Failed to load your content." onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No content yet"
          description="No content found for your instructor account yet."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="min-w-64">Review Notes</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.type}-${row.id}`} className="align-top">
                <TableCell className="text-sm text-foreground">{row.type}</TableCell>
                <TableCell className="text-sm">
                  <div className="font-medium text-foreground">{row.title}</div>
                  {row.feedback && row.status !== 'APPROVED' && (
                    <div className="text-xs text-destructive mt-1">Feedback: {row.feedback}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm text-foreground">{row.difficulty || '-'}</TableCell>
                <TableCell className="text-sm">
                  <StatusBadge
                    label={row.status.replace('_', ' ')}
                    tone={contentStatusTone(row.status)}
                  />
                </TableCell>
                <TableCell className="text-sm text-foreground">{row.progress}%</TableCell>
                <TableCell className="text-sm min-w-64">
                  <textarea
                    className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    placeholder="Optional note to reviewer"
                    value={notesById[row.id] ?? ''}
                    onChange={(e) =>
                      setNotesById((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                  />
                </TableCell>
                <TableCell className="text-sm">
                  <Button
                    size="sm"
                    variant={
                      row.status === 'PENDING_REVIEW' || row.status === 'APPROVED'
                        ? 'outline'
                        : 'default'
                    }
                    disabled={row.status === 'PENDING_REVIEW' || row.status === 'APPROVED'}
                    onClick={async () => {
                      if (
                        !window.confirm('Are you sure you want to submit this content for review?')
                      )
                        return;

                      try {
                        await submitMyContentForReview({
                          id: row.id,
                          type: row.type,
                          notes: notesById[row.id],
                        });
                        await refetch();
                        alert('Successfully submitted for review!');
                      } catch (err: unknown) {
                        const apiErr = err as { response?: { data?: { message?: string } } };
                        alert(apiErr?.response?.data?.message || 'Failed to submit for review.');
                      }
                    }}
                  >
                    {row.status === 'PENDING_REVIEW'
                      ? 'Pending Review'
                      : row.status === 'APPROVED'
                        ? 'Approved'
                        : 'Submit for Review'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create Content Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Create Content</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newContentType} onValueChange={setNewContentType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COURSE">Course</SelectItem>
                  <SelectItem value="PROJECT">Project</SelectItem>
                  <SelectItem value="ROADMAP">Roadmap</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                type="text"
                placeholder="Enter title..."
                value={newContentTitle}
                onChange={(e) => setNewContentTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Enter short description..."
                value={newContentDesc}
                onChange={(e) => setNewContentDesc(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={isCreating || !newContentTitle.trim()}
              onClick={async () => {
                try {
                  setIsCreating(true);
                  await createInstructorContent({
                    type: newContentType,
                    title: newContentTitle,
                    description: newContentDesc,
                  });
                  await refetch();
                  setIsCreateModalOpen(false);
                  setNewContentTitle('');
                  setNewContentDesc('');
                } catch (err: unknown) {
                  const apiErr = err as { response?: { data?: { message?: string } } };
                  alert(apiErr?.response?.data?.message || 'Failed to create content');
                } finally {
                  setIsCreating(false);
                }
              }}
            >
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
