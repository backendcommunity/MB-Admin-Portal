'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { Field, FieldGrid, Section } from '@/components/shared/form/Section';
import { LEVELS, MODES, createProject, type Level, type Mode } from '@/lib/api/projects';

type ProjectDraft = {
  title: string;
  summary: string;
  level: Level;
  mode: Mode;
  language: string;
  entrypoint: string;
};

const emptyDraft = (): ProjectDraft => ({
  title: '',
  summary: '',
  level: 'Beginner',
  mode: 'rest-api',
  language: 'node',
  entrypoint: 'index.js',
});

/**
 * Full create page, same shape as `courses/new`: enough to create a draft
 * project immediately, then hand off to the detail page for the brief, the
 * playground and the curriculum. Used to be a dialog (`NewProjectModal`) —
 * moved here so creating a project feels like every other content type
 * instead of popping a dialog before a page.
 */
export default function NewProjectClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProjectDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const valid = form.title.trim().length > 0 && form.summary.trim().length > 0;

  const save = async () => {
    if (!valid) return;
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
      // Same fix as courses/bootcamps: the list's query has a 60s staleTime
      // and lives on a different route's component, so it needs its own
      // invalidation to show this on return rather than serving stale cache.
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      router.push(`/projects/${created.id}`);
    } catch (error) {
      toast.error('Could not create the project', { description: (error as Error).message });
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="mb-1 text-sm text-muted-foreground">
        <Link href="/projects" className="text-primary hover:underline">
          Projects
        </Link>{' '}
        / New
      </p>

      <PageHeader
        title={form.title || 'Untitled project'}
        description="Enough to create it. The brief, the playground and the curriculum are built inside."
        actions={
          <>
            <Button variant="ghost" onClick={() => router.push('/projects')} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !valid}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        <Section title="Identity" id="section-identity">
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
        </Section>

        <Section title="Playground" id="section-playground">
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
        </Section>
      </div>
    </div>
  );
}
