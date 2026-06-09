"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router({ mergeParams: true });
// List chapters for a course
router.get('/:courseId/chapters', async (req, res) => {
    const courseId = Number(req.params.courseId);
    const chapters = await db_1.prisma.chapter.findMany({ where: { courseId }, include: { lessons: true }, orderBy: { order: 'asc' } });
    res.json({ data: chapters });
});
router.post('/:courseId/chapters', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const courseId = Number(req.params.courseId);
    const { title, order = 0 } = req.body;
    if (!title)
        return res.status(400).json({ error: 'title required' });
    const chapter = await db_1.prisma.chapter.create({ data: { title, courseId, order: Number(order) } });
    res.status(201).json(chapter);
});
router.put('/:courseId/chapters/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const id = Number(req.params.id);
    const { title, order } = req.body;
    try {
        const updated = await db_1.prisma.chapter.update({ where: { id }, data: { title, order } });
        res.json(updated);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.delete('/:courseId/chapters/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const id = Number(req.params.id);
    try {
        await db_1.prisma.chapter.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// Lessons CRUD
router.post('/:courseId/chapters/:chapterId/lessons', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const { chapterId } = req.params;
    const { title, content, order = 0 } = req.body;
    if (!title)
        return res.status(400).json({ error: 'title required' });
    const lesson = await db_1.prisma.lesson.create({ data: { title, content, chapterId: Number(chapterId), order: Number(order) } });
    res.status(201).json(lesson);
});
router.put('/:courseId/chapters/:chapterId/lessons/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const id = Number(req.params.id);
    const { title, content, order } = req.body;
    try {
        const updated = await db_1.prisma.lesson.update({ where: { id }, data: { title, content, order } });
        res.json(updated);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.delete('/:courseId/chapters/:chapterId/lessons/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const id = Number(req.params.id);
    try {
        await db_1.prisma.lesson.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.default = router;
