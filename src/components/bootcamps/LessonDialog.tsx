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
import { RichTextField } from '@/components/shared/form/RichTextField';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import LibraryPicker from '@/components/bootcamps/LibraryPicker';
import {
  createLesson,
  updateLesson,
  LESSON_TYPES,
  LESSON_ITEM_KIND,
  type Lesson,
  type LessonType,
} from '@/lib/api/bootcamps';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohortId: string;
  weekId: string;
  lesson?: Lesson | null;
  onSaved: () => void;
};

const EMPTY = {
  title: '',
  summary: '',
  description: '',
  type: 'VIDEO' as LessonType,
  mb: 0,
  itemId: '',
  itemTitle: '',
};

export default function LessonDialog({
  open,
  onOpenChange,
  cohortId,
  weekId,
  lesson,
  onSaved,
}: Props) {
  const editing = Boolean(lesson);
  const [form, setForm] = useSeededForm(open ? (lesson?.id ?? 'new') : 'closed', () =>
    lesson
      ? {
          title: lesson.title,
          summary: lesson.summary,
          description: lesson.description,
          type: lesson.type,
          mb: lesson.mb,
          itemId: lesson.itemId,
          itemTitle: lesson.itemTitle,
        }
      : EMPTY,
  );
  const [saving, setSaving] = useState(false);

  // Only four of the seven types point at a library row. The other three are
  // self-contained, and the API refuses an item on them.
  const kind = LESSON_ITEM_KIND[form.type];

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        summary: form.summary,
        description: form.description,
        type: form.type,
        mb: form.mb,
        // A type that carries no item must clear whatever was linked before.
        itemId: kind ? form.itemId : '',
      };
      if (lesson) {
        await updateLesson(cohortId, weekId, lesson.id, payload);
      } else {
        await createLesson(cohortId, weekId, payload);
      }
      toast.success(editing ? 'Lesson saved.' : 'Lesson added.');
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error('Could not save the lesson', { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit lesson' : 'New lesson'}</DialogTitle>
          <DialogDescription>
            A lesson belongs to one week of one cohort. Its position in the week comes from
            dragging, not from a field.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="lesson-title">Title</Label>
            <Input
              id="lesson-title"
              value={form.title}
              onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
              placeholder="The Node.js runtime & event loop"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-type">Type</Label>
            <Select
              value={form.type}
              onValueChange={(value) =>
                setForm((f) => {
                  const type = value as LessonType;
                  // Changing away from a linked type drops the item with it.
                  const keeps = Boolean(LESSON_ITEM_KIND[type]);
                  return {
                    ...f,
                    type,
                    itemId: keeps ? f.itemId : '',
                    itemTitle: keeps ? f.itemTitle : '',
                  };
                })
              }
            >
              <SelectTrigger id="lesson-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LESSON_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-mb">Points (mb)</Label>
            <Input
              id="lesson-mb"
              type="number"
              min={0}
              value={form.mb}
              onChange={(event) => setForm((f) => ({ ...f, mb: Number(event.target.value) || 0 }))}
            />
          </div>

          <div className="sm:col-span-2">
            {kind ? (
              <LibraryPicker
                kind={kind}
                label={`Linked ${form.type.toLowerCase()}`}
                value={form.itemId}
                valueTitle={form.itemTitle}
                onPick={(row) =>
                  setForm((f) => ({
                    ...f,
                    itemId: row?.id ?? '',
                    itemTitle: row?.title ?? '',
                  }))
                }
                hint="Stored on itemId and on the typed column for this type."
              />
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                A {form.type.toLowerCase()} lesson is self-contained — nothing is linked, and it
                goes to the review queue when a learner submits.
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="lesson-summary">Summary</Label>
            <Input
              id="lesson-summary"
              value={form.summary}
              onChange={(event) => setForm((f) => ({ ...f, summary: event.target.value }))}
              placeholder="One line for the curriculum list"
            />
          </div>

          <div className="sm:col-span-2">
            <RichTextField
              value={form.description}
              onChange={(next) => setForm((f) => ({ ...f, description: next }))}
              label="Description"
              hint="What the learner has to do. For an assignment this is the whole lesson."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !form.title.trim()}>
            {saving ? 'Saving…' : editing ? 'Save' : 'Add lesson'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
