'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useApiQuery } from '@/lib/api/query';
import { parseAttendeeCsv, type Attendee } from '@/lib/certificates/parseCsv';
import { createCertificateImport } from '@/lib/api/certificateImports';

type CourseOption = { id: string; title: string };

export function NewImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState('');
  const [filename, setFilename] = useState('');
  const [rows, setRows] = useState<Attendee[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const { data: coursesData } = useApiQuery<{ data: CourseOption[]; total: number }>(
    ['courses-for-cert-import'],
    '/admin/courses?page=1&limit=200',
  );
  const courseOptions = useMemo(() => coursesData?.data ?? [], [coursesData]);

  const onFile = async (file: File) => {
    setFilename(file.name);
    const text = await file.text();
    const result = parseAttendeeCsv(text);
    setRows(result.rows);
    setErrors(result.errors);
  };

  const mutation = useMutation({
    mutationFn: () => createCertificateImport({ courseId, filename, rows }),
    onSuccess: (data) => {
      toast.success(`Queued ${data.queued} attendees (${data.skippedInvalid} skipped)`);
      onClose();
      router.push(`/certifications/${data.importId}`);
    },
    onError: (err: unknown) => {
      const anyErr = err as { response?: { data?: { message?: string } } };
      toast.error(anyErr.response?.data?.message || 'Import failed');
    },
  });

  const canSubmit = courseId && rows.length > 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New certificate import</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Workshop course</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent>
              {courseOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Attendee CSV (name,email)</Label>
          <input
            type="file"
            accept=".csv"
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>

        {rows.length > 0 && (
          <p className="text-sm text-muted-foreground">{rows.length} valid rows ready.</p>
        )}
        {errors.length > 0 && (
          <div className="max-h-32 overflow-auto text-sm text-destructive">
            {errors.slice(0, 20).map((e, i) => (
              <div key={i}>{e}</div>
            ))}
            {errors.length > 20 && <div>…and {errors.length - 20} more</div>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Importing…' : `Import ${rows.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
