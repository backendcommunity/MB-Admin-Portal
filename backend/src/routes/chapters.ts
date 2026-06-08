import express from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = express.Router({ mergeParams: true });

// List chapters for a course
router.get('/:courseId/chapters', async (req, res) => {
  const courseId = Number(req.params.courseId);
  const chapters = await prisma.chapter.findMany({ where: { courseId }, include: { lessons: true }, orderBy: { order: 'asc' } });
  res.json({ data: chapters });
});

router.post('/:courseId/chapters', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const courseId = Number(req.params.courseId);
  const { title, order = 0 } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const chapter = await prisma.chapter.create({ data: { title, courseId, order: Number(order) } });
  res.status(201).json(chapter);
});

router.put('/:courseId/chapters/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const { title, order } = req.body;
  try {
    const updated = await prisma.chapter.update({ where: { id }, data: { title, order } });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:courseId/chapters/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.chapter.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Lessons CRUD
router.post('/:courseId/chapters/:chapterId/lessons', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { chapterId } = req.params;
  const { title, content, order = 0 } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const lesson = await prisma.lesson.create({ data: { title, content, chapterId: Number(chapterId), order: Number(order) } });
  res.status(201).json(lesson);
});

router.put('/:courseId/chapters/:chapterId/lessons/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const { title, content, order } = req.body;
  try {
    const updated = await prisma.lesson.update({ where: { id }, data: { title, content, order } });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:courseId/chapters/:chapterId/lessons/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.lesson.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
