'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldGrid } from '@/components/shared/form/Section';
import LibraryPicker from '@/components/bootcamps/LibraryPicker';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import type { LibraryKind } from '@/lib/api/bootcamps';
import { ENTITLEMENT_TYPES, grantEntitlement, type EntitlementType } from '@/lib/api/users';

/**
 * Which entitlement types can be searched by name.
 *
 * The rest still work — the id is typed in — but only these have a library the
 * search endpoint knows about, and picking beats pasting a uuid.
 */
const SEARCHABLE: Partial<Record<EntitlementType, LibraryKind>> = {
  COURSE: 'course',
  PROJECT: 'project',
  QUIZ: 'quiz',
  EXERCISE: 'exercise',
  CHAPTER: 'chapter',
  VIDEO: 'video',
  ARTICLE: 'article',
  RESOURCE: 'resource',
};

export default function GrantAccessDialog({
  open,
  onOpenChange,
  userId,
  onGranted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onGranted: () => void;
}) {
  const [form, setForm] = useSeededForm(open ? 'open' : 'closed', () => ({
    itemType: 'COURSE' as EntitlementType,
    itemId: '',
    itemTitle: '',
    expiresAt: '',
  }));
  const [busy, setBusy] = useState(false);

  const kind = SEARCHABLE[form.itemType];

  const submit = async () => {
    if (!form.itemId.trim()) return;
    setBusy(true);
    try {
      await grantEntitlement(userId, {
        itemType: form.itemType,
        itemId: form.itemId.trim(),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      });
      toast.success('Granted.', { description: 'They can open it immediately.' });
      onGranted();
      onOpenChange(false);
    } catch (error) {
      toast.error('Could not grant it', { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant access</DialogTitle>
          <DialogDescription>
            Writes one entitlement with source ADMIN — the only source this console can revoke
            later. Everything else is owned by the subscription, offer or purchase behind it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FieldGrid>
            <Field label="Content type" htmlFor="grant-type" required>
              <Select
                value={form.itemType}
                onValueChange={(value) =>
                  // A different type means a different library, so the pick cannot stand.
                  setForm((f) => ({
                    ...f,
                    itemType: value as EntitlementType,
                    itemId: '',
                    itemTitle: '',
                  }))
                }
              >
                <SelectTrigger id="grant-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITLEMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ').toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Expires" htmlFor="grant-expires" hint="Leave blank for permanent access.">
              <Input
                id="grant-expires"
                type="date"
                value={form.expiresAt}
                onChange={(event) => setForm((f) => ({ ...f, expiresAt: event.target.value }))}
              />
            </Field>
          </FieldGrid>

          {kind ? (
            <LibraryPicker
              kind={kind}
              label={form.itemType.replace(/_/g, ' ').toLowerCase()}
              value={form.itemId}
              valueTitle={form.itemTitle}
              onPick={(row) =>
                setForm((f) => ({ ...f, itemId: row?.id ?? '', itemTitle: row?.title ?? '' }))
              }
            />
          ) : (
            <Field
              label="Item id"
              htmlFor="grant-id"
              required
              hint={`There is no searchable library for ${form.itemType.replace(/_/g, ' ').toLowerCase()}, so paste the id.`}
            >
              <Input
                id="grant-id"
                value={form.itemId}
                onChange={(event) => setForm((f) => ({ ...f, itemId: event.target.value }))}
                className="font-mono text-sm"
              />
            </Field>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !form.itemId.trim()}>
            {busy ? 'Granting…' : 'Grant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
