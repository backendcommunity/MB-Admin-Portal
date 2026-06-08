import express from 'express';
import cors from 'cors';
import users from './routes/users';
import courses from './routes/courses';
import auth from './routes/auth';
import bootcamps from './routes/bootcamps';
import cohorts from './routes/cohorts';
import chapters from './routes/chapters';
import exportRoutes from './routes/export';
import { prisma } from './db';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/users', users);
app.use('/api/courses', courses);
app.use('/api/auth', auth);
app.use('/api/bootcamps', bootcamps);
app.use('/api/cohorts', cohorts);
app.use('/api/courses', chapters); // chapters nested under /api/courses/:courseId/chapters
app.use('/api/export', exportRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
