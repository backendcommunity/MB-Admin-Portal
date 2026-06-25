'use client';

import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Roadmap } from '@/lib/api/roadmaps';
import { updateRoadmap } from '@/lib/api/roadmaps';

type Props = {
  open: boolean;
  roadmap?: Roadmap | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export default function EditRoadmapModal({ open, roadmap, onClose, onUpdated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [status, setStatus] = useState('DRAFT');
  const [estimatedWeeks, setEstimatedWeeks] = useState(0);
  const [hoursPerWeek, setHoursPerWeek] = useState(0);
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (!roadmap) return;
    setTitle(roadmap.title || '');
    setDescription(roadmap.description || '');
    setDifficulty(roadmap.difficulty || 'Beginner');
    setStatus(roadmap.status || 'DRAFT');
    setEstimatedWeeks(Number(roadmap.estimatedWeeks || 0));
    setHoursPerWeek(Number(roadmap.hoursPerWeek || 0));
    setTags((roadmap.tags || []).join(', '));
  }, [roadmap]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roadmap) return;

    try {
      await updateRoadmap({
        id: roadmap.id,
        title,
        description,
        difficulty,
        status: status as 'DRAFT' | 'PUBLISHED',
        estimatedWeeks,
        hoursPerWeek,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle>Edit Roadmap</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger id="difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="estimatedWeeks">Estimated Weeks</Label>
              <Input
                id="estimatedWeeks"
                type="number"
                value={estimatedWeeks}
                onChange={(e) => setEstimatedWeeks(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hoursPerWeek">Hours/Week</Label>
              <Input
                id="hoursPerWeek"
                type="number"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tags">Skills Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="nodejs,postgresql"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
