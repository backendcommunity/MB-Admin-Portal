'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useApiQuery } from '@/lib/api/query';
import { retryCertificateImport, type CertificateImportDetail } from '@/lib/api/certificateImports';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Tone = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

function importStatusTone(status: string): Tone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'PROCESSING') return 'info';
  if (status === 'FAILED') return 'danger';
  return 'neutral';
}

function rowStatusTone(status: string): Tone {
  if (status === 'ISSUED') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'QUEUED') return 'neutral';
  return 'neutral';
}

export function ImportDetailClient() {
  const params = useParams();
  const id = String(params.id);
  const qc = useQueryClient();

  // normalizeQueryResponse unwraps the { success, data } envelope, so `batch`
  // is already the CertificateImportDetail object (not wrapped).
  const {
    data: batch,
    isLoading,
    isError,
  } = useApiQuery<CertificateImportDetail>(
    ['certificateImport', id],
    `/admin/certificate-imports/${id}`,
    undefined,
    {
      enabled: Boolean(id),
      // Poll every 3 s while the batch is still processing; stop when settled.
      refetchInterval: (query: { state: { data?: CertificateImportDetail } }) =>
        query.state.data?.status === 'PROCESSING' ? 3000 : false,
    },
  );

  const retry = useMutation({
    mutationFn: () => retryCertificateImport(id),
    onSuccess: (r: { requeued: number }) => {
      toast.success(`Requeued ${r.requeued} failed row${r.requeued !== 1 ? 's' : ''}`);
      qc.invalidateQueries({ queryKey: ['certificateImport', id] });
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
        <Link href="/certifications" className="underline">
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

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: batch.totalRows },
          { label: 'Issued', value: batch.issued },
          { label: 'New users', value: batch.newUsers },
          { label: 'Failed', value: batch.failed },
        ].map(({ label, value }) => (
          <Card key={label} className="flex flex-col items-center p-4 text-center">
            <span className="text-2xl font-bold">{value}</span>
            <span className="mt-1 text-xs text-muted-foreground">{label}</span>
          </Card>
        ))}
      </div>

      {/* Rows table */}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Cert code</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {batch.rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3">
                  {row.name}
                  {row.isNewUser && (
                    <span className="ml-2 text-xs text-muted-foreground">(new)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.email}</td>
                <td className="px-4 py-3">
                  <StatusBadge label={row.status} tone={rowStatusTone(row.status)} />
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {row.certCode ?? <span className="text-muted-foreground">—</span>}
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
          <Link href="/certifications">← Back to imports</Link>
        </Button>
      </div>
    </div>
  );
}
