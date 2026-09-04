'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useApiQuery } from '@/lib/api/query';
import { retryUserImport, type UserImportDetail } from '@/lib/api/userImports';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * The results view spec §8 calls for: per-row outcome and a retry for
 * failures. Mirrors certifications' ImportDetailClient — same shape of
 * import (created via a modal, processed asynchronously, retryable by
 * row) — down to the polling interval and summary-card layout.
 */

type Tone = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

function importStatusTone(status: string): Tone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'PROCESSING') return 'info';
  if (status === 'FAILED') return 'danger';
  return 'neutral';
}

function rowStatusTone(status: string): Tone {
  if (status === 'CREATED') return 'success';
  if (status === 'ALREADY_REGISTERED') return 'info';
  if (status === 'FAILED') return 'danger';
  if (status === 'SKIPPED') return 'warning';
  return 'neutral';
}

export function UserImportDetailClient() {
  const params = useParams();
  const id = String(params.id);
  const qc = useQueryClient();

  const {
    data: batch,
    isLoading,
    isError,
  } = useApiQuery<UserImportDetail>(['userImport', id], `/admin/user-imports/${id}`, undefined, {
    enabled: Boolean(id),
    // Poll while the batch is still processing; stop once it settles.
    refetchInterval: (query: { state: { data?: UserImportDetail } }) =>
      query.state.data?.status === 'PROCESSING' ? 3000 : false,
  });

  const retry = useMutation({
    mutationFn: () => retryUserImport(id),
    onSuccess: (r: { requeued: number; stillFailed: number }) => {
      toast.success(`Requeued ${r.requeued} failed row${r.requeued !== 1 ? 's' : ''}`);
      qc.invalidateQueries({ queryKey: ['userImport', id] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Retry failed'),
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (isError || !batch) {
    return (
      <div className="p-6 text-sm text-destructive">
        Failed to load import details.{' '}
        <Link href="/users/imports" className="underline">
          Go back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.filename}
        description={`Created ${new Date(batch.createdAt).toLocaleDateString()}`}
        actions={
          <>
            <StatusBadge label={batch.status} tone={importStatusTone(batch.status)} />
            {batch.failed > 0 && (
              <Button size="sm" disabled={retry.isPending} onClick={() => retry.mutate()}>
                {retry.isPending ? 'Retrying…' : 'Retry failed'}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Total', value: batch.totalRows },
          { label: 'Created', value: batch.created },
          { label: 'Already registered', value: batch.alreadyRegistered },
          { label: 'Skipped', value: batch.skipped },
          { label: 'Failed', value: batch.failed },
        ].map(({ label, value }) => (
          <Card key={label} className="flex flex-col items-center p-4 text-center">
            <span className="text-2xl font-bold">{value}</span>
            <span className="mt-1 text-xs text-muted-foreground">{label}</span>
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {batch.rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3">
                  {row.name}
                  {row.nameWasDerived && (
                    <span className="ml-2 rounded bg-muted px-1 py-0.5 text-[10px] uppercase text-muted-foreground">
                      derived
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.email}</td>
                <td className="px-4 py-3">
                  <StatusBadge label={row.status} tone={rowStatusTone(row.status)} />
                </td>
                <td className="px-4 py-3 text-destructive">{row.error ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {batch.rows.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No rows found.</div>
        )}
      </Card>

      <div className="flex">
        <Button variant="outline" size="sm" asChild>
          <Link href="/users/imports">← Back to imports</Link>
        </Button>
      </div>
    </div>
  );
}
