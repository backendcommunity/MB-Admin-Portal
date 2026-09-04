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
import { richTextLength } from '@/lib/richtext';
import { RichTextField } from '@/components/shared/form/RichTextField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldGrid } from '@/components/shared/form/Section';
import LibraryPicker from '@/components/bootcamps/LibraryPicker';
import TaskTerminalSpecEditor from '@/components/projects/TaskTerminalSpecEditor';
import ApiSpecEditor, { emptySpec } from '@/components/projects/ApiSpecEditor';
import { useSeededForm } from '@/lib/forms/useSeededForm';
import {
  TASK_TYPES,
  createTask,
  updateTask,
  type ApiSpec,
  type Mode,
  type Task,
  type TaskType,
  type TerminalSpec,
} from '@/lib/api/projects';

export default function TaskDialog({
  open,
  onOpenChange,
  projectId,
  projectTaskId,
  mode,
  task,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTaskId: string;
  /** Decides which grading contract this task can carry. */
  mode: Mode;
  task: Task | null;
  onSaved: () => void;
}) {
  const editing = Boolean(task);
  const [form, setForm] = useSeededForm(open ? (task?.id ?? 'new') : 'closed', () => ({
    title: task?.title ?? '',
    description: task?.description ?? '',
    slug: task?.slug ?? '',
    type: (task?.type ?? 'TASK') as TaskType,
    required: task?.required ?? true,
    isPremium: task?.isPremium ?? false,
    mb: task?.mb ?? 10,
    answer: task?.answer ?? '',
    videoId: task?.videoId ?? '',
    articleId: task?.articleId ?? '',
    chapterId: task?.chapterId ?? '',
    videoTitle: task?.videoTitle ?? '',
    articleTitle: task?.articleTitle ?? '',
    chapterTitle: task?.chapterTitle ?? '',
    apiSpec: (task?.apiSpec ?? null) as ApiSpec | null,
    terminalSpec: (task?.terminalSpec ?? null) as TerminalSpec | null,
  }));
  const [saving, setSaving] = useState(false);

  // Only a TASK is machine-checked, and only in a mode that reads a contract.
  const graded = form.type === 'TASK' && mode !== 'frontend';

  const submit = async () => {
    if (!form.title.trim() || !richTextLength(form.description)) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        slug: form.slug,
        type: form.type,
        required: form.required,
        isPremium: form.isPremium,
        mb: form.mb,
        answer: form.answer,
        videoId: form.videoId,
        articleId: form.articleId,
        chapterId: form.chapterId,
        // Send only the contract this mode reads; the API refuses the other.
        apiSpec: graded && mode === 'rest-api' ? form.apiSpec : null,
        terminalSpec: graded && mode === 'terminal' ? form.terminalSpec : null,
      };

      if (task) await updateTask(projectId, projectTaskId, task.id, payload);
      else await createTask(projectId, projectTaskId, payload);

      toast.success(editing ? 'Task saved.' : 'Task added.');
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error('Could not save the task', { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit task' : 'New task'}</DialogTitle>
          <DialogDescription>
            A task is what gets graded. Which contract it needs is decided by the project&apos;s
            playground mode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Title" htmlFor="t-title" required>
            <Input
              id="t-title"
              value={form.title}
              onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
            />
          </Field>

          <FieldGrid>
            <Field
              label="Type"
              htmlFor="t-type"
              required
              hint="TASK is checked by the runner. QUIZ is answered. ACTIVITY and EXERCISE are marked by hand."
            >
              <Select
                value={form.type}
                onValueChange={(value) => setForm((f) => ({ ...f, type: value as TaskType }))}
              >
                <SelectTrigger id="t-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Points (mb)" htmlFor="t-mb">
              <Input
                id="t-mb"
                type="number"
                min={0}
                value={form.mb}
                onChange={(event) =>
                  setForm((f) => ({ ...f, mb: Number(event.target.value) || 0 }))
                }
              />
            </Field>

            <Field label="Slug" htmlFor="t-slug" hint="Derived from the title when blank.">
              <Input
                id="t-slug"
                value={form.slug}
                onChange={(event) => setForm((f) => ({ ...f, slug: event.target.value }))}
                className="font-mono text-sm"
              />
            </Field>
          </FieldGrid>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span>
                <span className="block text-sm font-medium">Required</span>
                <span className="block text-xs text-muted-foreground">
                  An optional task does not block finishing the ProjectTask.
                </span>
              </span>
              <Switch
                checked={form.required}
                onCheckedChange={(next) => setForm((f) => ({ ...f, required: next }))}
                aria-label="Required"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span>
                <span className="block text-sm font-medium">Premium</span>
                <span className="block text-xs text-muted-foreground">
                  Needs an entitlement even when the ProjectTask is free.
                </span>
              </span>
              <Switch
                checked={form.isPremium}
                onCheckedChange={(next) => setForm((f) => ({ ...f, isPremium: next }))}
                aria-label="Premium"
              />
            </label>
          </div>

          {/* The playground renders the instruction as markup, so it is
              authored as rich text — headings, lists and inline code are what
              an instruction is actually made of. */}
          <RichTextField
            id="t-desc"
            label="Description"
            required
            hint="What the builder has to make true."
            value={form.description}
            onChange={(description) => setForm((f) => ({ ...f, description }))}
            minHeight={140}
          />

          {/* A task can point at existing content instead of describing the
              work inline — three separate nullable columns, one per kind. */}
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Linked content
            </p>
            <LibraryPicker
              kind="video"
              label="Video"
              value={form.videoId}
              valueTitle={form.videoTitle}
              onPick={(row) =>
                setForm((f) => ({ ...f, videoId: row?.id ?? '', videoTitle: row?.title ?? '' }))
              }
            />
            <LibraryPicker
              kind="article"
              label="Article"
              value={form.articleId}
              valueTitle={form.articleTitle}
              onPick={(row) =>
                setForm((f) => ({ ...f, articleId: row?.id ?? '', articleTitle: row?.title ?? '' }))
              }
            />
            <LibraryPicker
              kind="chapter"
              label="Chapter"
              value={form.chapterId}
              valueTitle={form.chapterTitle}
              onPick={(row) =>
                setForm((f) => ({ ...f, chapterId: row?.id ?? '', chapterTitle: row?.title ?? '' }))
              }
            />
          </div>

          {/* ── the grading contract ── */}
          {form.type !== 'TASK' ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              {form.type === 'QUIZ'
                ? 'A quiz stores its questions as JSON on the task and is answered rather than run.'
                : `An ${form.type.toLowerCase()} is not machine-checked — a reviewer marks it.`}
            </p>
          ) : mode === 'frontend' ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Frontend mode has no grading contract, so this task is marked complete by the builder.
            </p>
          ) : mode === 'terminal' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                terminalSpec feeds each line to the entrypoint on stdin, then compares what it
                printed to expectedOutput.
              </p>
              <TaskTerminalSpecEditor
                value={form.terminalSpec ?? { stdin: [], expectedOutput: '' }}
                onChange={(next) => setForm((f) => ({ ...f, terminalSpec: next }))}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                apiSpec drives the runner: the request we send, and the response it asserts on.
              </p>
              <ApiSpecEditor
                value={form.apiSpec ?? emptySpec()}
                onChange={(next) => setForm((f) => ({ ...f, apiSpec: next }))}
              />
            </div>
          )}

          <Field
            label="Answer"
            htmlFor="t-answer"
            hint="The reference answer. Never sent to the builder before they submit."
          >
            <textarea
              id="t-answer"
              value={form.answer}
              rows={2}
              onChange={(event) => setForm((f) => ({ ...f, answer: event.target.value }))}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !form.title.trim() || !richTextLength(form.description)}
          >
            {saving ? 'Saving…' : editing ? 'Save' : 'Add task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
