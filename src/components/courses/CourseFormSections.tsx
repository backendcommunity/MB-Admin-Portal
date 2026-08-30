'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Section } from '@/components/shared/form/Section';
import { TagInput } from '@/components/shared/form/TagInput';
import { SlugField } from '@/components/shared/form/SlugField';
import { MediaField } from '@/components/shared/form/MediaField';
import { RichTextField } from '@/components/shared/form/RichTextField';
import { createCategory, type Category, type CourseType, type Level } from '@/lib/api/courses';
import { MIN_SUMMARY } from '@/lib/courses/readiness';
import { toast } from 'sonner';

export type CourseDraft = {
  title: string;
  slug: string;
  summary: string;
  description: string;
  type: CourseType;
  categoryId: string | null;
  level: Level | null;
  tags: string[];
  languages: string[];
  isPremium: boolean;
  amount: number;
  paddle_price_id: string | null;
  paddlePlanCode: number | null;
  banner: string;
  preview: string | null;
  vimeoFolderId: string | null;
  isWaiting: boolean;
  waitingLink: string | null;
};

export const emptyDraft = (): CourseDraft => ({
  title: '',
  slug: '',
  summary: '',
  description: '',
  type: 'VIDEO',
  categoryId: null,
  level: null,
  tags: [],
  languages: [],
  isPremium: false,
  amount: 0,
  paddle_price_id: null,
  paddlePlanCode: null,
  banner: '',
  preview: null,
  vimeoFolderId: null,
  isWaiting: false,
  waitingLink: null,
});

const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced'];
const TYPES: CourseType[] = ['VIDEO', 'TEXT', 'WORKSHOP'];

type SectionProps = {
  draft: CourseDraft;
  patch: (next: Partial<CourseDraft>) => void;
  categories: Category[];
  onCategoryCreated?: (category: Category) => void;
  courseId?: string;
  /** Slug locks once the course is public; unlocking is deliberate. */
  slugLocked?: boolean;
};

export function IdentitySection({ draft, patch, courseId, slugLocked }: SectionProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.slug));

  return (
    <Section title="Identity" id="section-identity">
      <div className="space-y-1.5">
        <Label htmlFor="course-title">
          Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="course-title"
          value={draft.title}
          placeholder="Distributed Systems in Go"
          onChange={(event) => {
            const title = event.target.value;
            patch(
              slugTouched
                ? { title }
                : {
                    title,
                    slug: title
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/\s+/g, '-')
                      .replace(/-+/g, '-'),
                  },
            );
          }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div onBlurCapture={() => setSlugTouched(true)}>
          <SlugField
            value={draft.slug}
            onChange={(slug) => {
              setSlugTouched(true);
              patch({ slug });
            }}
            title={draft.title}
            courseId={courseId}
            locked={Boolean(slugLocked) && !unlocked}
            onUnlock={() => setUnlocked(true)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="course-type">
            Course type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={draft.type}
            onValueChange={(value) => patch({ type: value as CourseType })}
          >
            <SelectTrigger id="course-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="course-summary">
          Summary <span className="text-destructive">*</span>
        </Label>
        <textarea
          id="course-summary"
          value={draft.summary}
          onChange={(event) => patch({ summary: event.target.value })}
          placeholder="One or two sentences — this is the catalogue card copy."
          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/40"
        />
        <p className="text-xs text-muted-foreground">
          <span className="tabular-nums">{draft.summary.length}</span> / {MIN_SUMMARY} characters
          minimum to publish
        </p>
      </div>

      <RichTextField
        id="course-description"
        label="Description"
        value={draft.description}
        onChange={(description) => patch({ description })}
      />
    </Section>
  );
}

export function ClassificationSection({
  draft,
  patch,
  categories,
  onCategoryCreated,
}: SectionProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    try {
      const category = await createCategory(name.trim());
      onCategoryCreated?.(category);
      patch({ categoryId: category.id });
      setName('');
      setCreating(false);
      toast.success(`Category "${category.name}" created.`);
    } catch (error) {
      toast.error('Could not create the category', { description: (error as Error).message });
    }
  };

  return (
    <Section title="Classification" id="section-classification">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="course-category">Category</Label>
          {creating ? (
            <div className="flex gap-2">
              <Input
                value={name}
                autoFocus
                placeholder="New category name"
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void create();
                  }
                }}
              />
              <Button type="button" onClick={create}>
                Add
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select
                value={draft.categoryId ?? ''}
                onValueChange={(value) => patch({ categoryId: value })}
              >
                <SelectTrigger id="course-category" className="flex-1">
                  <SelectValue placeholder="Pick a category…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => setCreating(true)}>
                New
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="course-level">Level</Label>
          <Select
            value={draft.level ?? ''}
            onValueChange={(value) => patch({ level: value as Level })}
          >
            <SelectTrigger id="course-level">
              <SelectValue placeholder="Pick a level…" />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="course-languages">Languages</Label>
        <TagInput
          id="course-languages"
          value={draft.languages}
          onChange={(languages) => patch({ languages })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="course-tags">Tags</Label>
        <TagInput id="course-tags" value={draft.tags} onChange={(tags) => patch({ tags })} />
      </div>
    </Section>
  );
}

export function AccessSection({ draft, patch }: SectionProps) {
  return (
    <Section title="Access & pricing" id="section-access">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="course-premium">Premium</Label>
          <p className="text-xs text-muted-foreground">Requires payment to enrol.</p>
        </div>
        <Switch
          id="course-premium"
          checked={draft.isPremium}
          onCheckedChange={(isPremium) =>
            patch(
              isPremium
                ? { isPremium }
                : { isPremium, amount: 0, paddle_price_id: null, paddlePlanCode: null },
            )
          }
        />
      </div>

      {draft.isPremium ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="course-amount">
              Price (USD) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="course-amount"
              type="number"
              min={0}
              step="0.01"
              value={draft.amount}
              onChange={(event) => patch({ amount: Number(event.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="course-paddle">
              Paddle price ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="course-paddle"
              value={draft.paddle_price_id ?? ''}
              placeholder="pri_01h…"
              onChange={(event) => patch({ paddle_price_id: event.target.value })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="course-plan-code">Paddle plan code</Label>
            <Input
              id="course-plan-code"
              inputMode="numeric"
              value={draft.paddlePlanCode ?? ''}
              placeholder="legacy checkout only"
              onChange={(event) =>
                patch({
                  paddlePlanCode: event.target.value ? Number(event.target.value) : null,
                })
              }
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Free course — pricing fields stay out of the payload.
        </p>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <div>
          <Label htmlFor="course-waitlist">Waitlist mode</Label>
          <p className="text-xs text-muted-foreground">Collect signups instead of enrolments.</p>
        </div>
        <Switch
          id="course-waitlist"
          checked={draft.isWaiting}
          onCheckedChange={(isWaiting) =>
            patch(isWaiting ? { isWaiting } : { isWaiting, waitingLink: null })
          }
        />
      </div>

      {draft.isWaiting ? (
        <div className="space-y-1.5">
          <Label htmlFor="course-waitlink">
            Waitlist link <span className="text-destructive">*</span>
          </Label>
          <Input
            id="course-waitlink"
            value={draft.waitingLink ?? ''}
            placeholder="https://masteringbackend.com/waitlist/…"
            onChange={(event) => patch({ waitingLink: event.target.value })}
          />
        </div>
      ) : null}
    </Section>
  );
}

export function MediaSection({ draft, patch, courseId }: SectionProps) {
  return (
    <Section title="Media" id="section-media">
      <MediaField
        label="Banner"
        required
        scope="course-banner"
        ownerId={courseId}
        value={draft.banner}
        onChange={(banner) => patch({ banner })}
        hint="Upload asks the API for a signed R2 URL, then PUTs the file."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="course-preview">Preview video</Label>
          <Input
            id="course-preview"
            value={draft.preview ?? ''}
            placeholder="Vimeo id or URL"
            onChange={(event) => patch({ preview: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="course-vimeo">Vimeo folder ID</Label>
          <Input
            id="course-vimeo"
            value={draft.vimeoFolderId ?? ''}
            placeholder="1188221"
            onChange={(event) => patch({ vimeoFolderId: event.target.value })}
          />
        </div>
      </div>
    </Section>
  );
}
