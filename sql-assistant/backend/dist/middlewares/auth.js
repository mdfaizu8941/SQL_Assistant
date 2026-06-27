"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireUser = exports.authenticate = exports.authenticateJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const authenticateJWT = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    try {
        const secret = process.env.JWT_SECRET || 'super-secret-key';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        const user = await prisma_1.default.user.findUnique({ where: { id: decoded.id } });
        if (!user) {
            res.status(401).json({ error: 'User no longer exists' });
            return;
        }
        if (user.status === 'DISABLED') {
            res.status(403).json({ error: 'Your account has been disabled. Please contact an administrator.' });
            return;
        }
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            status: user.status
        };
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};
exports.authenticateJWT = authenticateJWT;
exports.authenticate = exports.authenticateJWT;
const requireUser = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    next();
};
exports.requireUser = requireUser;
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
