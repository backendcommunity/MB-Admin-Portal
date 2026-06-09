import express from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';

const router = express.Router();

// List users with optional search
router.get('/', async (req, res) => {
  const { q, role, active, page = '1', pageSize, limit = '20', sort = 'id', order = 'asc' } = req.query as Record<string, string>;
  const where = q
    ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] }
    : {} as any;

  if (role) {
    (where as any).role = role;
  }
  if (active === 'true') {
    (where as any).active = true;
  }
  if (active === 'false') {
    (where as any).active = false;
  }

  const pageNum = Math.max(1, parseInt(page));
  const size = Math.max(1, parseInt(pageSize || limit));

  const allowedSortFields = new Set(['id', 'name', 'email', 'role', 'active', 'createdAt', 'updatedAt']);
  const sortOrder: Prisma.SortOrder = order === 'desc' ? 'desc' : 'asc';
  const orderBy: Prisma.UserOrderByWithRelationInput = allowedSortFields.has(sort)
    ? ({ [sort]: sortOrder } as Prisma.UserOrderByWithRelationInput)
    : { id: 'asc' };

  const users = await prisma.user.findMany({
    where,
    orderBy,
    skip: (pageNum - 1) * size,
    take: size,
  });

  const total = await prisma.user.count({ where });

  res.json({ data: users, total });
});

// Create
router.post('/', async (req, res) => {
  const { email, name, role } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const user = await prisma.user.create({ data: { email, name, role } });
    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get by id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json(user);
});

// Update by id (PUT /:id) or by body id (PUT /)
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  const { email, name, role, active } = req.body;
  try {
    const updated = await prisma.user.update({
      where: { id },
      data: { email, name, role, active },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  const { id, email, name, role, active } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    const updated = await prisma.user.update({
      where: { id: Number(id) },
      data: { email, name, role, active },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Patch actions e.g., suspend
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  const { action } = req.body;
  try {
    if (action === 'suspend') {
      const { active } = req.body;
      const user = await prisma.user.update({ where: { id }, data: { active } });
      return res.json(user);
    }
    if (action === 'role') {
      const { role } = req.body;
      const user = await prisma.user.update({ where: { id }, data: { role } });
      return res.json(user);
    }
    res.status(400).json({ error: 'unknown action' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/', async (req, res) => {
  const id = Number(req.query.id as string);
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
