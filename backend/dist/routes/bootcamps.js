"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/', async (req, res) => {
    const { q = '', page = '1', limit = '10', status = 'all', sort = 'id', order = 'asc' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const size = Math.max(1, parseInt(limit));
    const where = {};
    if (q) {
        where.OR = [{ name: { contains: q } }, { location: { contains: q } }];
    }
    if (status === 'active')
        where.active = true;
    if (status === 'inactive')
        where.active = false;
    const allowedSortFields = new Set(['id', 'name', 'location', 'active', 'createdAt', 'updatedAt']);
    const sortOrder = order === 'desc' ? 'desc' : 'asc';
    const orderBy = allowedSortFields.has(sort)
        ? { [sort]: sortOrder }
        : { id: 'asc' };
    const [data, total] = await Promise.all([
        db_1.prisma.bootcamp.findMany({
            where,
            include: { cohorts: true },
            orderBy,
            skip: (pageNum - 1) * size,
            take: size,
        }),
        db_1.prisma.bootcamp.count({ where }),
    ]);
    res.json({ data, total });
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const { name, description, location, active } = req.body;
    if (!name)
        return res.status(400).json({ error: 'name required' });
    const bootcamp = await db_1.prisma.bootcamp.create({
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
    if (Number.isNaN(id))
        return res.status(400).json({ error: 'invalid id' });
    const bootcamp = await db_1.prisma.bootcamp.findUnique({ where: { id }, include: { cohorts: true } });
    if (!bootcamp)
        return res.status(404).json({ error: 'not found' });
    res.json(bootcamp);
});
router.put('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id))
        return res.status(400).json({ error: 'invalid id' });
    const { name, description, location, active } = req.body;
    try {
        const updated = await db_1.prisma.bootcamp.update({
            where: { id },
            data: { name, description, location, active },
        });
        res.json(updated);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.delete('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id))
        return res.status(400).json({ error: 'invalid id' });
    try {
        await db_1.prisma.bootcamp.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.default = router;
