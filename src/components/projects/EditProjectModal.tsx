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
import type { Project } from '@/lib/api/projects';
import { updateProject } from '@/lib/api/projects';

type Props = {
  open: boolean;
  project?: Project | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export default function EditProjectModal({ open, project, onClose, onUpdated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [status, setStatus] = useState('DRAFT');
  const [tags, setTags] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [thumbnail, setThumbnail] = useState('');

  useEffect(() => {
    if (!project) return;
    setTitle(project.title || '');
    setDescription(project.description || '');
    setDifficulty(project.difficulty || 'Beginner');
    setStatus(project.status || 'DRAFT');
    setTags((project.tags || []).join(', '));
    setGithubUrl(project.githubUrl || '');
    setLiveUrl(project.liveUrl || '');
    setThumbnail(project.thumbnail || '');
  }, [project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;

    try {
      await updateProject({
        id: project.id,
        title,
        description,
        difficulty,
        status: status as 'DRAFT' | 'PUBLISHED',
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        githubUrl,
        liveUrl,
        thumbnail,
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
          <DialogTitle>Edit Project</DialogTitle>
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
          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="nodejs,postgresql"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="githubUrl">GitHub URL</Label>
            <Input
              id="githubUrl"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="liveUrl">Live URL</Label>
            <Input id="liveUrl" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="thumbnail">Thumbnail URL</Label>
            <Input
              id="thumbnail"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
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
