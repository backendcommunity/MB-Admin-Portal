'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { ReadinessPanel } from '@/components/shared/form/ReadinessPanel';
import {
  AccessSection,
  ClassificationSection,
  IdentitySection,
  MediaSection,
  emptyDraft,
  type CourseDraft,
} from '@/components/courses/CourseFormSections';
import ImportCourseModal from '@/components/courses/ImportCourseModal';
import { CataloguePreview } from '@/components/courses/CataloguePreview';
import { PayloadDialog } from '@/components/shared/PayloadDialog';
import { createCourse, fetchCategories, setCourseStatus, type Category } from '@/lib/api/courses';
import { evaluateReadiness } from '@/lib/courses/readiness';
import { stripPricingFields } from '@/lib/pricing-fields';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const SECTIONS = [
  ['identity', 'Identity'],
  ['classification', 'Classification'],
  ['access', 'Access & pricing'],
  ['media', 'Media'],
] as const;

/**
 * Draft-first: Save writes an unpublished course immediately and hands the author
 * the detail page, where the curriculum lives. Only a title is required to get
 * that far — a form that refuses to save loses work.
 */
export default function NewCourseClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.userRole);
  const authResolved = useAuthStore((s) => s.authResolved);
  // Fail closed: until the session check lands, treat the caller as non-staff
  // rather than trusting a possibly-stale cached role (see SuperAdminOnly).
  const isStaff = authResolved && (role === 'ADMIN' || role === 'SUPER_ADMIN');
  const [draft, setDraft] = useState<CourseDraft>(emptyDraft());
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [payloadOpen, setPayloadOpen] = useState(false);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const patch = (next: Partial<CourseDraft>) => setDraft((current) => ({ ...current, ...next }));

  // No chapters exist yet, so the curriculum rule always fails here; the panel
  // links on to the detail page where it can be satisfied.
  const rules = evaluateReadiness({ ...draft, chapters: [] });
  const ready = rules.every((rule) => rule.ok);

  const save = async (publish: boolean) => {
    if (!draft.title.trim()) {
      toast.error('A draft still needs a title.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        paddle_price_id: draft.paddle_price_id || null,
        preview: draft.preview || null,
        vimeoFolderId: draft.vimeoFolderId || null,
        waitingLink: draft.waitingLink || null,
      };
      const created = await createCourse(isStaff ? payload : stripPricingFields(payload));
      // The list's query has a 60s staleTime and lives on a different route's
      // component — a plain remount after navigating back would still serve
      // the pre-create cache without this.
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });

      if (publish) {
        try {
          await setCourseStatus(created.id, 'publish');
          toast.success('Published.');
        } catch {
          toast.message('Saved as a draft', {
            description: 'Add a chapter with content, then publish from the course page.',
          });
        }
      } else {
        toast.success('Draft saved. Add chapters next.');
      }

      router.push(`/courses/${created.id}`);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (error as Error).message;
      toast.error('Could not save the course', { description: message });
      setSaving(false);
    }
  };

  const sectionProps = {
    draft,
    patch,
    categories,
    isStaff,
    onCategoryCreated: (category: Category) => setCategories((all) => [...all, category]),
  };

  return (
    <div>
      <p className="mb-1 text-sm text-muted-foreground">
        <Link href="/courses" className="text-primary hover:underline">
          Courses
        </Link>{' '}
        / New
      </p>

      <PageHeader
        title={draft.title || 'Untitled course'}
        description="Draft — nothing is public until you publish."
        actions={
          <>
            <Button variant="ghost" onClick={() => router.push('/courses')} disabled={saving}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)} disabled={saving}>
              Paste JSON instead
            </Button>
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>
              Save draft
            </Button>
            <Button onClick={() => save(true)} disabled={saving || !ready}>
              Publish
            </Button>
          </>
        }
      />

      <nav className="mb-4 flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth' })
            }
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {label}
          </button>
        ))}
        <span
          className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground"
          title="Chapters are added on the course page, once the draft exists"
        >
          Curriculum · after save
        </span>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <IdentitySection {...sectionProps} />
          <ClassificationSection {...sectionProps} />
          <AccessSection {...sectionProps} />
          <MediaSection {...sectionProps} />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <ReadinessPanel rules={rules} />
          <CataloguePreview draft={draft} />
          <Card className="space-y-2 p-4">
            <h3 className="text-sm font-semibold">Payload</h3>
            <p className="text-xs text-muted-foreground">The exact body this form would POST.</p>
            <Button variant="outline" size="sm" onClick={() => setPayloadOpen(true)}>
              Inspect payload
            </Button>
          </Card>
        </aside>
      </div>

      <PayloadDialog
        open={payloadOpen}
        onClose={() => setPayloadOpen(false)}
        method="POST"
        path="/admin/courses"
        body={draft}
      />

      <ImportCourseModal
        open={importOpen}
        mode="course"
        onClose={() => setImportOpen(false)}
        onImported={(courseId) => router.push(`/courses/${courseId}`)}
      />
    </div>
  );
}
