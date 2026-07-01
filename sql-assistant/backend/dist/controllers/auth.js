"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refreshTokens = exports.resetPassword = exports.forgotPassword = exports.login = exports.register = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../utils/prisma"));
// Helper to generate access and refresh tokens
const generateTokens = (user) => {
    const secret = process.env.JWT_SECRET || 'super-secret-key';
    const accessToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, secret, { expiresIn: '1h' } // 1 hour access token
    );
    const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, secret, { expiresIn: '7d' } // 7 days refresh token
    );
    return { accessToken, refreshToken };
};
// 1. User Registration
const register = async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;
        if (!name || !email || !password || !confirmPassword) {
            res.status(400).json({ error: 'All fields are required.' });
            return;
        }
        if (password !== confirmPassword) {
            res.status(400).json({ error: 'Passwords do not match.' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters long.' });
            return;
        }
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(400).json({ error: 'Email address is already registered.' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.default.user.create({
            data: {
                email,
                name,
                passwordHash,
                role: 'USER',
                status: 'ACTIVE',
            }
        });
        const { accessToken, refreshToken } = generateTokens(user);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { refreshToken }
        });
        res.status(201).json({
            success: true,
            user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status },
            token: accessToken,
            refreshToken
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.register = register;
// 2. User Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required.' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
            res.status(400).json({ error: 'Invalid email or password.' });
            return;
        }
        if (user.status === 'DISABLED') {
            res.status(403).json({ error: 'Your account has been disabled. Please contact support.' });
            return;
        }
        const passwordMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!passwordMatch) {
            res.status(400).json({ error: 'Invalid email or password.' });
            return;
        }
        const { accessToken, refreshToken } = generateTokens(user);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { refreshToken }
        });
        res.status(200).json({
            success: true,
            user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status },
            token: accessToken,
            refreshToken
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.login = login;
// 3. Forgot Password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: 'Email is required.' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user) {
            // Standard security behavior to prevent account harvesting
            res.status(200).json({
                success: true,
                message: 'Password reset link generated. Check the server terminal console log to access.'
            });
            return;
        }
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { resetToken, resetExpiry }
        });
        const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
        console.log('\n=======================================');
        console.log(`[PASSWORD RESET DEV MODE] Reset link for ${email}:`);
        console.log(resetLink);
        console.log('=======================================\n');
        res.status(200).json({
            success: true,
            message: 'Password reset instructions have been generated. Please check the backend console log for the reset link.'
        });
    }
    catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.forgotPassword = forgotPassword;
// 4. Reset Password
const resetPassword = async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;
        if (!token || !password || !confirmPassword) {
            res.status(400).json({ error: 'All fields are required.' });
            return;
        }
        if (password !== confirmPassword) {
            res.status(400).json({ error: 'Passwords do not match.' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters long.' });
            return;
        }
        const user = await prisma_1.default.user.findFirst({
            where: {
                resetToken: token,
                resetExpiry: { gt: new Date() }
            }
        });
        if (!user) {
            res.status(400).json({ error: 'Invalid or expired reset token.' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                resetToken: null,
                resetExpiry: null,
                refreshToken: null // Revoke active sessions for security
            }
        });
        res.status(200).json({
            success: true,
            message: 'Password has been reset successfully. You can now log in.'
        });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.resetPassword = resetPassword;
// 5. Rotate tokens using Refresh Token
const refreshTokens = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            res.status(400).json({ error: 'Refresh token is required.' });
            return;
        }
        const secret = process.env.JWT_SECRET || 'super-secret-key';
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(refreshToken, secret);
        }
        catch (jwtErr) {
            res.status(401).json({ error: 'Invalid or expired refresh token.' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: decoded.id } });
        if (!user || user.refreshToken !== refreshToken) {
            res.status(401).json({ error: 'Session no longer exists or has expired.' });
            return;
        }
        if (user.status === 'DISABLED') {
            res.status(403).json({ error: 'Your account has been disabled.' });
            return;
        }
        const tokens = generateTokens(user);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { refreshToken: tokens.refreshToken }
        });
        res.status(200).json({
            success: true,
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });
    }
    catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.refreshTokens = refreshTokens;
// 6. Secure logout
const logout = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        await prisma_1.default.user.update({
            where: { id: userId },
            data: { refreshToken: null }
        });
        res.status(200).json({ success: true, message: 'Logged out successfully.' });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
};
exports.logout = logout;
