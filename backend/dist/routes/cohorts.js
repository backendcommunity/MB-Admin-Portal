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
    const data = await db_1.prisma.cohort.findMany({ include: { enrollments: true } });
    res.json({ data });
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const { name, bootcampId } = req.body;
    if (!name || !bootcampId)
        return res.status(400).json({ error: 'name and bootcampId required' });
    const cohort = await db_1.prisma.cohort.create({ data: { name, bootcampId: Number(bootcampId) } });
    res.status(201).json(cohort);
});
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const cohort = await db_1.prisma.cohort.findUnique({ where: { id }, include: { enrollments: true } });
    if (!cohort)
        return res.status(404).json({ error: 'not found' });
    res.json(cohort);
});
router.put('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const id = Number(req.params.id);
    const { name } = req.body;
    try {
        const updated = await db_1.prisma.cohort.update({ where: { id }, data: { name } });
        res.json(updated);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.delete('/:id', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const id = Number(req.params.id);
    try {
        await db_1.prisma.cohort.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// Enrollment management
router.post('/:id/enroll', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const cohortId = Number(req.params.id);
    const { userId, role = 'student' } = req.body;
    if (!userId)
        return res.status(400).json({ error: 'userId required' });
    try {
        const enrollment = await db_1.prisma.enrollment.create({ data: { userId: Number(userId), cohortId, role } });
        res.status(201).json(enrollment);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.delete('/:id/enroll/:enrollmentId', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const enrollmentId = Number(req.params.enrollmentId);
    try {
        await db_1.prisma.enrollment.delete({ where: { id: enrollmentId } });
        res.json({ success: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.default = router;
