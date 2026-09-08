'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/shared/PageHeader';
import { Section } from '@/components/shared/form/Section';
import {
  IdentityFields,
  RoleFields,
  InterviewFields,
} from '@/components/mock-interviews/fields/TemplateFields';
import { TopicsField } from '@/components/mock-interviews/fields/TopicsField';
import { RubricEditor } from '@/components/mock-interviews/fields/RubricEditor';
import { createTemplate, type TemplateInput } from '@/lib/api/mockInterviews';
import { SERVER_LIMITS } from '@/lib/mockInterviews/constants';
import { useAuthStore } from '@/store/authStore';

const emptyForm = (): TemplateInput => ({
  name: '',
  summary: '',
  description: '',
  company: '',
  position: '',
  seniority: '',
  style: 'Technical',
  format: 'Chat',
  category: '',
  difficulty: 'Medium',
  duration: 30,
  questions: 8,
  topics: [],
  evaluationRubric: [],
  isPublic: false,
});

/**
 * The full form, not a stub. A template has no dependent sub-resource that
 * can only exist after the row does (unlike a project's tasks/playground),
 * so every writable field is knowable — and asked for — at authoring time.
 */
export default function NewTemplateClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.userRole);
  const authResolved = useAuthStore((s) => s.authResolved);
  // Fail closed: until the session check lands, treat the caller as unable
  // to publish rather than trusting a possibly-stale cached role.
  const canPublish = authResolved && (role === 'ADMIN' || role === 'SUPER_ADMIN');

  const [form, setForm] = useState<TemplateInput>(emptyForm());
  const [saving, setSaving] = useState(false);

  const patch = (next: TemplateInput) => setForm((f) => ({ ...f, ...next }));

  const rubricValid = (form.evaluationRubric ?? []).every(
    (r) => Number(r.weight) >= SERVER_LIMITS.RUBRIC_MIN_WEIGHT,
  );
  const valid = Boolean(form.name?.trim()) && Number(form.duration) > 0 && rubricValid;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const created = await createTemplate({
        ...form,
        name: form.name!.trim(),
        isPublic: canPublish ? Boolean(form.isPublic) : false,
      });
      toast.success(form.evaluationRubric?.length ? 'Created.' : 'Created. It has no rubric yet.');
      // The list has a 60s staleTime and lives on another route, so it needs
      // its own invalidation to show this on return rather than serving
      // stale cache.
      queryClient.invalidateQueries({ queryKey: ['admin-mock-interviews'] });
      router.push(`/mock-interviews/${created.id}`);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (error as Error).message;
      toast.error('Could not create the template', { description: message });
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="mb-1 text-sm text-muted-foreground">
        <Link href="/mock-interviews" className="text-primary hover:underline">
          Mock Interviews
        </Link>{' '}
        / New
      </p>

      <PageHeader
        title={form.name || 'Untitled template'}
        description="Every writable field is here — there is no follow-up resource to fill this in later."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => router.push('/mock-interviews')}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !valid}>
              Create
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        <Section title="Identity">
          <IdentityFields value={form} onChange={patch} disabled={saving} />
        </Section>

        <Section title="Role">
          <RoleFields value={form} onChange={patch} disabled={saving} />
        </Section>

        <Section title="Interview">
          <InterviewFields value={form} onChange={patch} disabled={saving} />
        </Section>

        <Section title="Topics">
          <TopicsField
            value={form.topics ?? []}
            onChange={(topics) => patch({ topics })}
            disabled={saving}
          />
        </Section>

        <Section title="Evaluation rubric">
          <RubricEditor
            value={form.evaluationRubric ?? []}
            onChange={(evaluationRubric) => patch({ evaluationRubric })}
            disabled={saving}
          />
        </Section>

        <Section title="Access">
          {canPublish ? (
            <div className="flex items-start gap-2">
              <Checkbox
                id="mi-publish"
                checked={Boolean(form.isPublic)}
                disabled={saving}
                onCheckedChange={(next) => patch({ isPublic: next === true })}
              />
              {/*
                The hint sits OUTSIDE the <label> deliberately: its copy
                mentions "topics", which would otherwise become part of this
                checkbox's accessible name (label text = everything inside
                the label) and collide with the Topics field's own
                `getByLabelText(/topics/i)` query. Keeping the label to just
                "Publish immediately" avoids that collision and gives the
                checkbox a precise name besides.
              */}
              <div>
                <label htmlFor="mi-publish" className="cursor-pointer text-sm font-medium">
                  Publish immediately
                </label>
                <p className="text-xs text-muted-foreground">
                  Off by default. Most templates want topics and a rubric before a learner sees
                  them.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Created as a draft. An instructor submits for review; an admin publishes — the flag is
              refused server-side, not merely hidden here.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
