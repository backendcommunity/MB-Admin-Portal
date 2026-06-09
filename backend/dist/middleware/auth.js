"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const requireAuth = async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header)
        return res.status(401).json({ error: 'missing auth' });
    const parts = header.split(' ');
    if (parts.length !== 2)
        return res.status(401).json({ error: 'invalid auth header' });
    const token = parts[1];
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await db_1.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user)
            return res.status(401).json({ error: 'user not found' });
        req.user = user;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'invalid token' });
    }
};
exports.requireAuth = requireAuth;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'missing user' });
        if (req.user.role !== role)
            return res.status(403).json({ error: 'forbidden' });
        next();
    };
};
exports.requireRole = requireRole;
