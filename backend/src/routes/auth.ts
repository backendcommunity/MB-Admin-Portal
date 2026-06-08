import express from 'express';
import { prisma } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Register (admin-only in production) - for dev we allow open register
router.post('/register', async (req, res) => {
  const { email, password, name, role = 'student' } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const normalizedRole = typeof role === 'string' ? role.toUpperCase() : role;
    const user = await prisma.user.create({ data: { email, password: hash, name, role: normalizedRole } });
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) return res.status(401).json({ error: 'invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, role: user.role, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

export default router;
