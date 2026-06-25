'use client';

import React, { useState, useEffect } from 'react';
import type { Course } from '@/lib/api/courses';
import { updateCourse } from '@/lib/api/courses';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  course?: Course | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export default function EditCourseModal({ open, course, onClose, onUpdated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [instructor, setInstructor] = useState('');
  const [tags, setTags] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [status, setStatus] = useState('DRAFT');

  useEffect(() => {
    if (course) {
      setTitle(course.title || '');
      setDescription(course.description || '');
      setCategory(course.category || '');
      setInstructor(course.instructor || '');
      setTags((course.tags || []).join(', '));
      setThumbnail(course.thumbnail || '');
      setStatus(course.status || (course.published ? 'PUBLISHED' : 'DRAFT'));
    }
  }, [course]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!course) return;
    try {
      await updateCourse({
        id: course.id,
        title,
        description,
        category,
        instructor,
        thumbnail,
        status,
        published: status === 'PUBLISHED',
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
      <DialogContent className="max-w-xl w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-course-title">Title</Label>
            <Input
              id="edit-course-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-course-category">Category</Label>
              <Input
                id="edit-course-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-course-instructor">Instructor</Label>
              <Input
                id="edit-course-instructor"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-course-thumbnail">Thumbnail URL</Label>
            <Input
              id="edit-course-thumbnail"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-course-tags">Tags</Label>
            <Input
              id="edit-course-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="react,frontend"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-course-description">Description</Label>
            <textarea
              id="edit-course-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-course-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="edit-course-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
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
