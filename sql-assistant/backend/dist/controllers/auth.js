"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const register = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(400).json({ error: 'User already exists' });
            return;
        }
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@system.com';
        let assignedRole = 'USER';
        let status = 'ACTIVE';
        if (email.toLowerCase() === adminEmail.toLowerCase()) {
            assignedRole = 'ADMIN';
            status = 'ACTIVE';
        }
        else {
            const requestedRole = String(role).toUpperCase();
            if (requestedRole === 'DATABASE_MANAGER') {
                assignedRole = 'DATABASE_MANAGER';
                status = 'PENDING';
            }
            else if (requestedRole === 'ADMIN') {
                // Prevent manual admin registration
                assignedRole = 'USER';
                status = 'ACTIVE';
            }
            else {
                assignedRole = 'USER';
                status = 'ACTIVE';
            }
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const user = await prisma_1.default.user.create({
            data: {
                email,
                passwordHash,
                role: assignedRole,
                status: status
            },
        });
        const secret = process.env.JWT_SECRET || 'super-secret-key';
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, secret, { expiresIn: '24h' });
        res.status(201).json({ user: { id: user.id, email: user.email, role: user.role, status: user.status }, token });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const ipAddress = req.ip || req.socket.remoteAddress || null;
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user) {
            await prisma_1.default.failedLogin.create({ data: { email, ipAddress } });
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        if (user.status === 'DISABLED') {
            res.status(403).json({ error: 'Your account has been disabled. Please contact an administrator.' });
            return;
        }
        const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            await prisma_1.default.failedLogin.create({ data: { email, ipAddress } });
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const secret = process.env.JWT_SECRET || 'super-secret-key';
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, secret, { expiresIn: '24h' });
        res.status(200).json({ user: { id: user.id, email: user.email, role: user.role, status: user.status }, token });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.login = login;
