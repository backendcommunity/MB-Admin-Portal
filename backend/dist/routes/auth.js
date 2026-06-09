"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = express_1.default.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
// Register (admin-only in production) - for dev we allow open register
router.post('/register', async (req, res) => {
    const { email, password, name, role = 'student' } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'email and password required' });
    const hash = await bcryptjs_1.default.hash(password, 10);
    try {
        const normalizedRole = typeof role === 'string' ? role.toUpperCase() : role;
        const user = await db_1.prisma.user.create({ data: { email, password: hash, name, role: normalizedRole } });
        res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'email and password required' });
    const user = await db_1.prisma.user.findUnique({ where: { email } });
    if (!user || !user.password)
        return res.status(401).json({ error: 'invalid credentials' });
    const match = await bcryptjs_1.default.compare(password, user.password);
    if (!match)
        return res.status(401).json({ error: 'invalid credentials' });
    const token = jsonwebtoken_1.default.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, role: user.role, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});
exports.default = router;
