import express from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = express.Router();

router.get('/', async (req, res) => {
  const { q = '', page = '1', limit = '10', status = 'all', sort = 'id', order = 'asc' } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const size = Math.max(1, parseInt(limit));
  const where: any = {};

  if (q) {
    where.OR = [{ name: { contains: q } }, { location: { contains: q } }];
  }

  if (status === 'active') where.active = true;
  if (status === 'inactive') where.active = false;

  const allowedSortFields = new Set(['id', 'name', 'location', 'active', 'createdAt', 'updatedAt']);
  const sortOrder: Prisma.SortOrder = order === 'desc' ? 'desc' : 'asc';
  const orderBy: Prisma.BootcampOrderByWithRelationInput = allowedSortFields.has(sort)
    ? ({ [sort]: sortOrder } as Prisma.BootcampOrderByWithRelationInput)
    : { id: 'asc' };

  const [data, total] = await Promise.all([
    prisma.bootcamp.findMany({
      where,
      include: { cohorts: true },
      orderBy,
      skip: (pageNum - 1) * size,
      take: size,
    }),
    prisma.bootcamp.count({ where }),
  ]);

  res.json({ data, total });
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name, description, location, active } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const bootcamp = await prisma.bootcamp.create({
    data: {
      name,
      description,
      location,
      active: typeof active === 'boolean' ? active : true,
    },
  });
  res.status(201).json(bootcamp);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  const bootcamp = await prisma.bootcamp.findUnique({ where: { id }, include: { cohorts: true } });
  if (!bootcamp) return res.status(404).json({ error: 'not found' });
  res.json(bootcamp);
});

router.put('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  const { name, description, location, active } = req.body;
  try {
    const updated = await prisma.bootcamp.update({
      where: { id },
      data: { name, description, location, active },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    await prisma.bootcamp.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
