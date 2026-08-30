'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SlugField } from '@/components/shared/form/SlugField';
import { TagInput } from '@/components/shared/form/TagInput';
import { MediaField } from '@/components/shared/form/MediaField';
import { RichTextField } from '@/components/shared/form/RichTextField';
import { checkPathSlug, updateTopic, type Topic, type TopicInput } from '@/lib/api/paths';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

/**
 * Every field a topic has, in the sidebar — the same split the course editor
 * uses for a chapter: the common edits inline on the page, everything else here.
 */
export default function TopicDrawer({
  open,
  pathId,
  topic,
  onClose,
  onSaved,
}: {
  open: boolean;
  pathId: string;
  topic: Topic | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<TopicInput>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);

  // Adjusting state during render rather than in an effect: no cascading render,
  // and an edit in progress survives a background refetch of the same topic.
  if (open && topic && loadedFor !== topic.id) {
    setLoadedFor(topic.id);
    setAdvanced(false);
    setDraft({
      title: topic.title,
      slug: topic.slug,
      summary: topic.summary,
      description: topic.description,
      banner: topic.banner,
      level: topic.level,
      duration: topic.duration,
      outcomes: topic.outcomes,
      recommendation: topic.recommendation,
      reference: topic.reference,
      isPremium: topic.isPremium,
    });
  }
  if (!open && loadedFor !== null) setLoadedFor(null);

  if (!topic) return null;

  const patch = (next: TopicInput) => setDraft((current) => ({ ...current, ...next }));

  const save = async () => {
    setBusy(true);
    try {
      await updateTopic(pathId, topic.id, draft);
      toast.success('Topic saved.');
      onSaved();
      onClose();
    } catch (error) {
      const body = (error as { response?: { data?: { message?: string } } }).response?.data;
      toast.error('Could not save the topic', {
        description: body?.message ?? (error as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Edit topic</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="topic-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="topic-title"
                value={draft.title ?? ''}
                onChange={(event) => patch({ title: event.target.value })}
                maxLength={100}
              />
            </div>

            <SlugField
              id="topic-slug"
              noun="topic"
              value={draft.slug ?? ''}
              onChange={(next) => patch({ slug: next })}
              title={draft.title ?? ''}
              courseId={topic.id}
              check={(slug, excludeId) => checkPathSlug(slug, 'topic', excludeId)}
              hint="Topics are shared between paths, so this has to be unique everywhere."
            />

            <div className="space-y-1.5">
              <Label htmlFor="topic-level">Level</Label>
              <Select
                value={draft.level || 'none'}
                onValueChange={(value) => patch({ level: value === 'none' ? '' : value })}
              >
                <SelectTrigger id="topic-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="topic-duration">Duration (hours)</Label>
              <Input
                id="topic-duration"
                type="number"
                min={0}
                value={draft.duration ?? 0}
                onChange={(event) => patch({ duration: Number(event.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="topic-summary">Summary</Label>
            <Input
              id="topic-summary"
              value={draft.summary ?? ''}
              onChange={(event) => patch({ summary: event.target.value })}
              placeholder="One line under the topic title."
            />
          </div>

          <RichTextField
            id="topic-description"
            label="Description"
            value={draft.description ?? ''}
            onChange={(next) => patch({ description: next })}
            hint="Paste markdown here and it converts as it lands."
          />

          <MediaField
            label="Banner"
            scope="topic-banner"
            ownerId={topic.id}
            value={draft.banner ?? ''}
            onChange={(next) => patch({ banner: next })}
          />

          <div className="space-y-1.5">
            <Label htmlFor="topic-outcomes">Outcomes</Label>
            <TagInput
              id="topic-outcomes"
              value={draft.outcomes ?? []}
              onChange={(next) => patch({ outcomes: next })}
              placeholder="What the learner can do after this topic"
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Premium in this path</p>
              <p className="text-xs text-muted-foreground">
                Stored on the path-to-topic link, not the topic, so the same topic can be free in
                one path and paid in another.
              </p>
            </div>
            <Switch
              checked={Boolean(draft.isPremium)}
              onCheckedChange={(next) => patch({ isPremium: next })}
              aria-label="Premium in this path"
            />
          </div>

          <details open={advanced} onToggle={(e) => setAdvanced(e.currentTarget.open)}>
            <summary className="cursor-pointer py-2 text-sm font-medium">Advanced</summary>
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="topic-recommendation">Recommendation weight</Label>
                <Input
                  id="topic-recommendation"
                  type="number"
                  min={0}
                  value={draft.recommendation ?? 1}
                  onChange={(event) => patch({ recommendation: Number(event.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  Higher surfaces the topic sooner in recommendations.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="topic-reference">Reference</Label>
                <Input
                  id="topic-reference"
                  value={draft.reference ?? ''}
                  onChange={(event) => patch({ reference: event.target.value })}
                  maxLength={36}
                />
                <p className="text-xs text-muted-foreground">
                  Fixed-width column — trimmed on read, so it round-trips.
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Order</Label>
                <p className="text-xs text-muted-foreground">
                  Set by dragging the spine. It is stored on this path&apos;s link to the topic, so
                  moving it here never moves it in another path.
                </p>
              </div>
            </div>
          </details>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save topic'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
