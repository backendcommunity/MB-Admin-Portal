import express from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = express.Router();

router.get('/', async (req, res) => {
  const data = await prisma.cohort.findMany({ include: { enrollments: true } });
  res.json({ data });
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name, bootcampId } = req.body;
  if (!name || !bootcampId) return res.status(400).json({ error: 'name and bootcampId required' });
  const cohort = await prisma.cohort.create({ data: { name, bootcampId: Number(bootcampId) } });
  res.status(201).json(cohort);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const cohort = await prisma.cohort.findUnique({ where: { id }, include: { enrollments: true } });
  if (!cohort) return res.status(404).json({ error: 'not found' });
  res.json(cohort);
});

router.put('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body;
  try {
    const updated = await prisma.cohort.update({ where: { id }, data: { name } });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.cohort.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Enrollment management
router.post('/:id/enroll', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const cohortId = Number(req.params.id);
  const { userId, role = 'student' } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const enrollment = await prisma.enrollment.create({ data: { userId: Number(userId), cohortId, role } });
    res.status(201).json(enrollment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/enroll/:enrollmentId', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const enrollmentId = Number(req.params.enrollmentId);
  try {
    await prisma.enrollment.delete({ where: { id: enrollmentId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
