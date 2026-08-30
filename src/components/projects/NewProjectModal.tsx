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
import { useSeededForm } from '@/lib/forms/useSeededForm';
import { LEVELS, MODES, createProject, type Level, type Mode } from '@/lib/api/projects';

/** Enough to create it. The brief, playground and curriculum are built inside. */
export default function NewProjectModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useSeededForm(open ? 'open' : 'closed', () => ({
    title: '',
    summary: '',
    level: 'Beginner' as Level,
    mode: 'rest-api' as Mode,
    language: 'node',
    entrypoint: 'index.js',
  }));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.title.trim() || !form.summary.trim()) return;
    setSaving(true);
    try {
      const created = await createProject({
        title: form.title.trim(),
        summary: form.summary.trim(),
        level: form.level,
        playgroundConfig:
          form.mode === 'terminal'
            ? { mode: form.mode, language: form.language, entrypoint: form.entrypoint }
            : { mode: form.mode },
      });
      toast.success('Created as a draft.', {
        description: 'Clear the waitlist flag on the Overview tab to publish it.',
      });
      onOpenChange(false);
      onCreated(created.id);
    } catch (error) {
      toast.error('Could not create the project', { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Enough to create it. The brief, the playground and the curriculum are built inside.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Title" htmlFor="np-title" required>
            <Input
              id="np-title"
              value={form.title}
              onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
              placeholder="Ship a Job Queue"
            />
          </Field>

          <Field
            label="Summary"
            htmlFor="np-summary"
            required
            hint="The column is NOT NULL, so there is no summary-less draft."
          >
            <textarea
              id="np-summary"
              value={form.summary}
              rows={2}
              onChange={(event) => setForm((f) => ({ ...f, summary: event.target.value }))}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </Field>

          <FieldGrid>
            <Field label="Level" htmlFor="np-level" required>
              <Select
                value={form.level}
                onValueChange={(value) => setForm((f) => ({ ...f, level: value as Level }))}
              >
                <SelectTrigger id="np-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Playground"
              htmlFor="np-mode"
              required
              hint="Changeable later, but it decides what every task's test looks like."
            >
              <Select
                value={form.mode}
                onValueChange={(value) => setForm((f) => ({ ...f, mode: value as Mode }))}
              >
                <SelectTrigger id="np-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGrid>

          {form.mode === 'terminal' ? (
            <FieldGrid>
              <Field label="Language" htmlFor="np-lang" required>
                <Select
                  value={form.language}
                  onValueChange={(value) => setForm((f) => ({ ...f, language: value }))}
                >
                  <SelectTrigger id="np-lang">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="node">node</SelectItem>
                    <SelectItem value="python">python</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Entrypoint"
                htmlFor="np-entry"
                required
                hint="A relative path with no '..' segments."
              >
                <Input
                  id="np-entry"
                  value={form.entrypoint}
                  onChange={(event) => setForm((f) => ({ ...f, entrypoint: event.target.value }))}
                  className="font-mono text-sm"
                />
              </Field>
            </FieldGrid>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !form.title.trim() || !form.summary.trim()}>
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
