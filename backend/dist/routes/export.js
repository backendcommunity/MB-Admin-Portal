"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
function toCsv(rows, headers) {
    if (!rows.length)
        return '';
    const keys = headers || Object.keys(rows[0]);
    const lines = [keys.join(',')];
    for (const r of rows) {
        const vals = keys.map(k => {
            const v = r[k];
            if (v === null || v === undefined)
                return '';
            return String(v).replace(/"/g, '""');
        });
        lines.push(vals.join(','));
    }
    return lines.join('\n');
}
router.get('/users', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const users = await db_1.prisma.user.findMany();
    const csv = toCsv(users, ['id', 'email', 'name', 'role', 'active', 'createdAt']);
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
});
router.get('/courses', auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const courses = await db_1.prisma.course.findMany();
    const csv = toCsv(courses, ['id', 'title', 'description', 'createdAt']);
    res.setHeader('Content-Disposition', 'attachment; filename="courses.csv"');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
});
exports.default = router;
