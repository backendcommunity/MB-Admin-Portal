"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const users_1 = __importDefault(require("./routes/users"));
const courses_1 = __importDefault(require("./routes/courses"));
const auth_1 = __importDefault(require("./routes/auth"));
const bootcamps_1 = __importDefault(require("./routes/bootcamps"));
const cohorts_1 = __importDefault(require("./routes/cohorts"));
const chapters_1 = __importDefault(require("./routes/chapters"));
const export_1 = __importDefault(require("./routes/export"));
const db_1 = require("./db");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/users', users_1.default);
app.use('/api/courses', courses_1.default);
app.use('/api/auth', auth_1.default);
app.use('/api/bootcamps', bootcamps_1.default);
app.use('/api/cohorts', cohorts_1.default);
app.use('/api/courses', chapters_1.default); // chapters nested under /api/courses/:courseId/chapters
app.use('/api/export', export_1.default);
app.get('/api/health', async (req, res) => {
    try {
        await db_1.prisma.$queryRaw `SELECT 1`;
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: String(err) });
    }
});
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
