'use client';

import { useMemo, useState } from 'react';
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
import {
  createEvent,
  updateEvent,
  EVENT_TYPES,
  EVENT_STATUSES,
  type BootcampEvent,
  type EventStatus,
  type EventType,
  type Week,
} from '@/lib/api/bootcamps';
import { useSeededForm } from '@/lib/forms/useSeededForm';

/** Split a stored timestamp into the two inputs the form uses. */
function dayOf(iso: string) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}
function clockOf(iso: string) {
  return iso ? new Date(iso).toISOString().slice(11, 16) : '';
}
/** Put them back together — the API stores full timestamps, not times of day. */
function stamp(day: string, clock: string) {
  return new Date(`${day}T${clock || '00:00'}:00.000Z`).toISOString();
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohortId: string;
  weeks: Week[];
  event?: BootcampEvent | null;
  onSaved: () => void;
};

export default function EventDialog({
  open,
  onOpenChange,
  cohortId,
  weeks,
  event,
  onSaved,
}: Props) {
  const editing = Boolean(event);
  const [form, setForm] = useSeededForm(open ? (event?.id ?? 'new') : 'closed', () => ({
    weekId: event?.weekId ?? weeks[0]?.id ?? '',
    lessonId: event?.lessonId ?? '',
    title: event?.title ?? '',
    description: event?.description ?? '',
    eventType: (event?.eventType ?? 'LIVE_SESSION') as EventType,
    status: (event?.status ?? 'SCHEDULED') as EventStatus,
    day: event ? dayOf(event.eventDate) : '',
    start: event ? clockOf(event.startTime) : '17:00',
    end: event ? clockOf(event.endTime) : '18:00',
    timezone: event?.timezone ?? 'UTC',
    location: event?.location ?? '',
    meetingUrl: event?.meetingUrl ?? '',
    recordingUrl: event?.recordingUrl ?? '',
  }));
  const [saving, setSaving] = useState(false);

  // A lesson belongs to exactly one week, so the list refills when the week
  // changes and a pin that no longer fits is dropped.
  const lessons = useMemo(
    () => weeks.find((week) => week.id === form.weekId)?.lessons ?? [],
    [weeks, form.weekId],
  );

  const problems: string[] = [];
  if (form.title.trim() && form.title.trim().length < 3) {
    problems.push('The title needs at least 3 characters.');
  }
  if (!form.weekId) problems.push('Pick the week this belongs to.');
  if (form.end <= form.start) problems.push('The end time must be later than the start.');

  const submit = async () => {
    if (problems.length || !form.title.trim() || !form.day) return;
    setSaving(true);
    try {
      const payload = {
        weekId: form.weekId,
        lessonId: form.lessonId || null,
        title: form.title.trim(),
        description: form.description,
        eventType: form.eventType,
        status: form.status,
        eventDate: stamp(form.day, '00:00'),
        startTime: stamp(form.day, form.start),
        endTime: stamp(form.day, form.end),
        timezone: form.timezone || 'UTC',
        location: form.location,
        meetingUrl: form.meetingUrl,
        recordingUrl: form.recordingUrl,
      };
      if (event) {
        await updateEvent(cohortId, event.id, payload);
      } else {
        await createEvent(cohortId, payload);
      }
      toast.success(editing ? 'Event saved.' : 'Scheduled.');
      onSaved();
      onOpenChange(false);
    } catch (error) {
      // A 409 here is the overlap check — two sessions in one cohort at once.
      toast.error('Could not save the event', { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit event' : 'Schedule an event'}</DialogTitle>
          <DialogDescription>
            An event sits in a week of this cohort, and can be pinned to one of its lessons.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="event-week">Week</Label>
            <Select
              value={form.weekId}
              onValueChange={(value) => setForm((f) => ({ ...f, weekId: value, lessonId: '' }))}
            >
              <SelectTrigger id="event-week">
                <SelectValue placeholder="Pick a week" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((week, index) => (
                  <SelectItem key={week.id} value={week.id}>
                    {index + 1}. {week.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-lesson">Lesson</Label>
            <Select
              value={form.lessonId || 'none'}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, lessonId: value === 'none' ? '' : value }))
              }
            >
              <SelectTrigger id="event-lesson">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not pinned to a lesson</SelectItem>
                {lessons.map((lesson, index) => (
                  <SelectItem key={lesson.id} value={lesson.id}>
                    {index + 1}. {lesson.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Optional — a kickoff or demo day need not belong to one.
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Kickoff & orientation"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-type">Type</Label>
            <Select
              value={form.eventType}
              onValueChange={(value) => setForm((f) => ({ ...f, eventType: value as EventType }))}
            >
              <SelectTrigger id="event-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, ' ').toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm((f) => ({ ...f, status: value as EventStatus }))}
            >
              <SelectTrigger id="event-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace(/_/g, ' ').toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-day">Date</Label>
            <Input
              id="event-day"
              type="date"
              value={form.day}
              onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-tz">Timezone</Label>
            <Input
              id="event-tz"
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              placeholder="UTC"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-start">Starts</Label>
            <Input
              id="event-start"
              type="time"
              value={form.start}
              onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-end">Ends</Label>
            <Input
              id="event-end"
              type="time"
              value={form.end}
              onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="event-meeting">Meeting URL</Label>
            <Input
              id="event-meeting"
              value={form.meetingUrl}
              onChange={(e) => setForm((f) => ({ ...f, meetingUrl: e.target.value }))}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Room, or a meeting link"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-recording">Recording URL</Label>
            <Input
              id="event-recording"
              value={form.recordingUrl}
              onChange={(e) => setForm((f) => ({ ...f, recordingUrl: e.target.value }))}
              placeholder="Added after the session"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="event-description">Description</Label>
            <Input
              id="event-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>

        {problems.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-warning bg-warning-wash p-3 text-xs text-warning">
            {problems.map((problem) => (
              <p key={problem}>{problem}</p>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving || problems.length > 0 || !form.title.trim() || !form.day}
          >
            {saving ? 'Saving…' : editing ? 'Save' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
