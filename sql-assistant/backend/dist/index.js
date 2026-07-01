"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});
app.use(express_1.default.json());
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per 15 minutes
    message: { error: 'Too many login or registration attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
const aiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per minute
    message: { error: 'Too many AI requests. Please try again after a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'SQL Assistant API is running' });
});
const auth_1 = __importDefault(require("./routes/auth"));
const database_1 = __importDefault(require("./routes/database"));
const ai_1 = __importDefault(require("./routes/ai"));
const history_1 = __importDefault(require("./routes/history"));
const dataset_1 = __importDefault(require("./routes/dataset"));
const savedQuery_1 = __importDefault(require("./routes/savedQuery"));
const aiChat_1 = __importDefault(require("./routes/aiChat"));
app.use('/api/auth', authLimiter, auth_1.default);
app.use('/api/database', database_1.default);
app.use('/api/ai', aiLimiter, ai_1.default);
app.use('/api/history', history_1.default);
app.use('/api/dataset', dataset_1.default);
app.use('/api/saved-query', savedQuery_1.default);
app.use('/api/ai-chat', aiChat_1.default);
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
// Keepalive interval to ensure the Node process stays alive in the runner environment
setInterval(() => { }, 60000);
// Trigger nodemon reload after script update
