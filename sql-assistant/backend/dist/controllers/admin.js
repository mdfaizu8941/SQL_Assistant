"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUserStatus = exports.updateUserRole = exports.listUsers = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const listUsers = async (req, res) => {
    try {
        const { search, role, status } = req.query;
        const whereClause = {};
        if (search) {
            whereClause.email = {
                contains: String(search),
            };
        }
        if (role && role !== 'ALL') {
            whereClause.role = String(role);
        }
        if (status && status !== 'ALL') {
            whereClause.status = String(status);
        }
        const users = await prisma_1.default.user.findMany({
            where: whereClause,
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        res.json({ users });
    }
    catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
};
exports.listUsers = listUsers;
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        if (!['USER', 'DATABASE_MANAGER', 'ADMIN'].includes(role)) {
            res.status(400).json({ error: 'Invalid role selection' });
            return;
        }
        const user = await prisma_1.default.user.update({
            where: { id: Number(id) },
            data: { role },
        });
        res.json({ success: true, message: `User role updated to ${role}`, user });
    }
    catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
};
exports.updateUserRole = updateUserRole;
const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'DISABLED'].includes(status)) {
            res.status(400).json({ error: 'Invalid status selection' });
            return;
        }
        const user = await prisma_1.default.user.update({
            where: { id: Number(id) },
            data: { status },
        });
        res.json({ success: true, message: `User status updated to ${status}`, user });
    }
    catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
};
exports.updateUserStatus = updateUserStatus;
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        // cascading delete relations manually to avoid db issues
        await prisma_1.default.queryHistory.deleteMany({ where: { userId: Number(id) } });
        await prisma_1.default.databaseConnection.deleteMany({ where: { userId: Number(id) } });
        await prisma_1.default.auditLog.deleteMany({ where: { userId: Number(id) } });
        await prisma_1.default.user.delete({
            where: { id: Number(id) },
        });
        res.json({ success: true, message: 'User account deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
exports.deleteUser = deleteUser;
