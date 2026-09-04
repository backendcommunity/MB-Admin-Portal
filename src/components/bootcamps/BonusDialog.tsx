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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import LibraryPicker from '@/components/bootcamps/LibraryPicker';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import {
  BONUS_KINDS,
  BONUS_SOURCE,
  createBonus,
  updateBonus,
  type Bonus,
  type BonusKind,
} from '@/lib/api/bootcamps';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohortId: string;
  bonus?: Bonus | null;
  onSaved: () => void;
};

/** A UI-only fourth choice — not a real `kind` the API accepts. Picking it
 * means "no linked item," which the payload expresses by omitting `kind`
 * and `itemId` entirely, not by sending the literal string. */
type BonusChoice = BonusKind | 'custom';

export default function BonusDialog({ open, onOpenChange, cohortId, bonus, onSaved }: Props) {
  const editing = Boolean(bonus);
  const [form, setForm] = useSeededForm(open ? (bonus?.id ?? 'new') : 'closed', () => ({
    // A bonus with no `itemId` on the server is a custom one — nothing else
    // distinguishes the two shapes.
    kind: (bonus && !bonus.itemId ? 'custom' : (bonus?.kind ?? 'course')) as BonusChoice,
    itemId: bonus?.itemId ?? '',
    itemTitle: bonus?.itemTitle ?? '',
    topic: bonus?.topic ?? '',
    summary: bonus?.summary ?? '',
  }));
  const [saving, setSaving] = useState(false);

  const isCustom = form.kind === 'custom';
  const canSubmit = isCustom
    ? Boolean(form.topic.trim()) && Boolean(form.summary.trim())
    : Boolean(form.itemId);

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      // A LINK (kind+itemId, always together — the id lands in a different
      // column per kind) or a CUSTOM bonus (title+description, no linked
      // entity) — exactly one of the two, never both, never neither.
      const payload = isCustom
        ? { topic: form.topic, summary: form.summary }
        : {
            kind: form.kind as BonusKind,
            itemId: form.itemId,
            topic: form.topic,
            summary: form.summary,
          };
      if (bonus) {
        await updateBonus(cohortId, bonus.id, payload);
      } else {
        await createBonus(cohortId, payload);
      }
      toast.success(editing ? 'Bonus saved.' : 'Bonus added.');
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error('Could not save the bonus', { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit bonus' : 'Add a bonus'}</DialogTitle>
          <DialogDescription>
            An extra for this cohort, pointing at one course, resource or video.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bonus-kind">Points at</Label>
            <Select
              value={form.kind}
              onValueChange={(value) =>
                // Switching kind switches library (or drops it), so the old
                // pick cannot stand.
                setForm((f) => ({ ...f, kind: value as BonusChoice, itemId: '', itemTitle: '' }))
              }
            >
              <SelectTrigger id="bonus-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BONUS_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {kind}
                  </SelectItem>
                ))}
                <SelectItem value="custom">custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCustom ? null : (
            <LibraryPicker
              kind={BONUS_SOURCE[form.kind as BonusKind]}
              label={form.kind.charAt(0).toUpperCase() + form.kind.slice(1)}
              value={form.itemId}
              valueTitle={form.itemTitle}
              onPick={(row) =>
                setForm((f) => ({ ...f, itemId: row?.id ?? '', itemTitle: row?.title ?? '' }))
              }
              hint={`Stored as ${form.kind}Id.`}
            />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="bonus-topic">
              {isCustom ? 'Title' : 'Topic'}{' '}
              {isCustom ? <span className="text-destructive">*</span> : null}
            </Label>
            <Input
              id="bonus-topic"
              value={form.topic}
              onChange={(event) => setForm((f) => ({ ...f, topic: event.target.value }))}
              placeholder="Caching, Queues…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bonus-summary">
              {isCustom ? 'Description' : 'Summary'}{' '}
              {isCustom ? <span className="text-destructive">*</span> : null}
            </Label>
            <Input
              id="bonus-summary"
              value={form.summary}
              onChange={(event) => setForm((f) => ({ ...f, summary: event.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !canSubmit}>
            {saving ? 'Saving…' : editing ? 'Save' : 'Add bonus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
