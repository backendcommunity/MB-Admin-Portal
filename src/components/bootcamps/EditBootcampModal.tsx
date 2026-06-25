'use client';

import React, { useEffect, useState } from 'react';
import type { Bootcamp } from '@/lib/api/bootcamps';
import { updateBootcamp } from '@/lib/api/bootcamps';
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

type Props = {
  open: boolean;
  bootcamp?: Bootcamp | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export default function EditBootcampModal({ open, bootcamp, onClose, onUpdated }: Props) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (bootcamp) {
      setName(bootcamp.name || '');
      setLocation(bootcamp.location || '');
      setActive(Boolean(bootcamp.active));
    }
  }, [bootcamp]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bootcamp) return;
    try {
      await updateBootcamp({ id: bootcamp.id, name, location, active });
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
          <DialogTitle>Edit Bootcamp</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bc-name">Name</Label>
            <Input id="bc-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc-location">Location</Label>
            <Input
              id="bc-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="active_bc"
              checked={active}
              onCheckedChange={(checked) => setActive(Boolean(checked))}
            />
            <Label htmlFor="active_bc">Active</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
