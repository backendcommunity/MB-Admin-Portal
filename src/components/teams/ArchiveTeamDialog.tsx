'use client';

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/form/Section';

type Props = {
  open: boolean;
  teamName: string;
  memberCount: number;
  pathCount?: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

/**
 * Archive requires typing the exact team name — the same "type to confirm"
 * pattern as a destructive delete, because archiving cuts billing and
 * visibility immediately even though the underlying rows survive.
 */
export default function ArchiveTeamDialog({
  open,
  teamName,
  memberCount,
  pathCount,
  onClose,
  onConfirm,
}: Props) {
  const [value, setValue] = useState('');
  const [archiving, setArchiving] = useState(false);
  const matches = value.length > 0 && value === teamName;

  const close = () => {
    setValue('');
    onClose();
  };

  const confirm = async () => {
    if (!matches) return;
    setArchiving(true);
    try {
      await onConfirm();
      setValue('');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle>Archive {teamName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Archiving stops billing and pulls the team&apos;s entitlement and visibility immediately.
          Nothing is deleted: {memberCount} member{memberCount === 1 ? '' : 's'}, their progress,
          groups, assignments, team paths
          {typeof pathCount === 'number' ? ` (${pathCount})` : ''}, and invite history all survive
          and come back exactly as they were on restore.
        </p>
        <Field label={`Type the team name to confirm — "${teamName}"`} htmlFor="archive-confirm">
          <Input
            id="archive-confirm"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={archiving}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!matches || archiving} onClick={confirm}>
            {archiving ? 'Archiving…' : 'Archive team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
