'use client';

import React, { useEffect, useState } from 'react';
import { useApiMutation } from '@/lib/api/query';
import type { Cohort } from '@/lib/api/cohorts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

type Props = { open: boolean; cohort?: Cohort | null; onClose: () => void; onUpdated?: () => void };

export default function EditCohortModal({ open, cohort, onClose, onUpdated }: Props) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (cohort) {
      setName(cohort.name || '');
      setStartDate(cohort.startDate || '');
      setEndDate(cohort.endDate || '');
      setActive(Boolean(cohort.active));
    }
  }, [cohort]);

  const mutation = useApiMutation<
    Cohort,
    { id: string; name?: string; startDate?: string; endDate?: string; active?: boolean }
  >({ url: '/cohorts', method: 'put' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cohort) return;
    try {
      await mutation.mutateAsync({ id: cohort.id, name, startDate, endDate, active });
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle>Edit Cohort</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cohort-name">Name</Label>
            <Input id="cohort-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cohort-start-date">Start Date</Label>
            <Input
              id="cohort-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cohort-end-date">End Date</Label>
            <Input
              id="cohort-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="active_cohort"
              checked={active}
              onCheckedChange={(checked) => setActive(Boolean(checked))}
            />
            <Label htmlFor="active_cohort">Active</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation?.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
