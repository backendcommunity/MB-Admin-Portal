import express from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = express.Router();

function toCsv(rows: any[], headers?: string[]) {
  if (!rows.length) return '';
  const keys = headers || Object.keys(rows[0]);
  const lines = [keys.join(',')];
  for (const r of rows) {
    const vals = keys.map(k => {
      const v = r[k];
      if (v === null || v === undefined) return '';
      return String(v).replace(/"/g, '""');
    });
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}

router.get('/users', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const users = await prisma.user.findMany();
  const csv = toCsv(users, ['id', 'email', 'name', 'role', 'active', 'createdAt']);
  res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

router.get('/courses', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const courses = await prisma.course.findMany();
  const csv = toCsv(courses, ['id', 'title', 'description', 'createdAt']);
  res.setHeader('Content-Disposition', 'attachment; filename="courses.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

export default router;
