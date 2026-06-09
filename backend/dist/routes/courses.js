"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const router = express_1.default.Router();
const parseTags = (value) => value ? value.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
const normalizeTags = (value) => {
    if (Array.isArray(value))
        return value.map((tag) => String(tag).trim()).filter(Boolean).join(',');
    if (typeof value === 'string')
        return value;
    return null;
};
const toCourseResponse = (course, chaptersCount = 0) => ({
    id: course.id,
    title: course.title,
    description: course.description,
    category: course.category,
    instructor: course.instructor,
    tags: parseTags(course.tags),
    thumbnail: course.thumbnail,
    published: course.published,
    chaptersCount,
    enrolledCount: 0,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
});
router.get('/', async (req, res) => {
    const { q = '', page = '1', limit = '10', status = 'all', sort = 'id', order = 'asc' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const size = Math.max(1, parseInt(limit));
    const where = {};
    if (q) {
        where.OR = [
            { title: { contains: q } },
            { description: { contains: q } },
            { category: { contains: q } },
            { instructor: { contains: q } },
        ];
    }
    if (status === 'published')
        where.published = true;
    if (status === 'draft')
        where.published = false;
    const allowedSortFields = new Set(['id', 'title', 'category', 'instructor', 'published', 'createdAt', 'updatedAt']);
    const sortOrder = order === 'desc' ? 'desc' : 'asc';
    const orderBy = allowedSortFields.has(sort)
        ? { [sort]: sortOrder }
        : { id: 'asc' };
    const [courses, total] = await Promise.all([
        db_1.prisma.course.findMany({
            where,
            orderBy,
            skip: (pageNum - 1) * size,
            take: size,
            include: { _count: { select: { chapters: true } } },
        }),
        db_1.prisma.course.count({ where }),
    ]);
    res.json({ data: courses.map((course) => toCourseResponse(course, course._count.chapters)), total });
});
router.post('/', async (req, res) => {
    const { title, description, category, instructor, tags, thumbnail, published } = req.body;
    if (!title)
        return res.status(400).json({ error: 'title required' });
    try {
        const course = await db_1.prisma.course.create({
            data: {
                title,
                description,
                category,
                instructor,
                tags: normalizeTags(tags),
                thumbnail,
                published: Boolean(published),
            },
        });
        res.status(201).json(toCourseResponse(course));
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id))
        return res.status(400).json({ error: 'invalid id' });
    const course = await db_1.prisma.course.findUnique({
        where: { id },
        include: { _count: { select: { chapters: true } } },
    });
    if (!course)
        return res.status(404).json({ error: 'not found' });
    res.json(toCourseResponse(course, course._count.chapters));
});
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id))
        return res.status(400).json({ error: 'invalid id' });
    const { title, description, category, instructor, tags, thumbnail, published } = req.body;
    try {
        const updated = await db_1.prisma.course.update({
            where: { id },
            data: {
                title,
                description,
                category,
                instructor,
                tags: normalizeTags(tags),
                thumbnail,
                published,
            },
        });
        res.json(toCourseResponse(updated));
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.put('/', async (req, res) => {
    const { id, title, description, category, instructor, tags, thumbnail, published } = req.body;
    if (!id)
        return res.status(400).json({ error: 'id required' });
    try {
        const updated = await db_1.prisma.course.update({
            where: { id: Number(id) },
            data: {
                title,
                description,
                category,
                instructor,
                tags: normalizeTags(tags),
                thumbnail,
                published,
            },
        });
        res.json(toCourseResponse(updated));
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id))
        return res.status(400).json({ error: 'invalid id' });
    try {
        await db_1.prisma.course.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.delete('/', async (req, res) => {
    const id = Number(req.query.id);
    if (!id)
        return res.status(400).json({ error: 'id required' });
    try {
        await db_1.prisma.course.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.default = router;
