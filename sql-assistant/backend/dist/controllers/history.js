"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecurityStats = exports.getAuditLogs = exports.getAnalytics = exports.getHistory = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const getHistory = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const history = await prisma_1.default.queryHistory.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({ history });
    }
    catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
};
exports.getHistory = getHistory;
const getAnalytics = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const totalQueries = await prisma_1.default.queryHistory.count({ where: { userId } });
        const successfulQueries = await prisma_1.default.queryHistory.count({ where: { userId, status: 'SUCCESS' } });
        const successRate = totalQueries > 0 ? (successfulQueries / totalQueries) * 100 : 0;
        const recentQueries = await prisma_1.default.queryHistory.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
        });
        res.json({
            totalQueries,
            successfulQueries,
            successRate: Math.round(successRate * 100) / 100,
            recentQueries
        });
    }
    catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
};
exports.getAnalytics = getAnalytics;
const getAuditLogs = async (req, res) => {
    try {
        const auditLogs = await prisma_1.default.auditLog.findMany({
            include: {
                user: {
                    select: {
                        email: true,
                        role: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        const connections = await prisma_1.default.databaseConnection.findMany({
            select: {
                id: true,
                name: true
            }
        });
        const connectionMap = new Map(connections.map(c => [c.id, c.name]));
        const mappedLogs = auditLogs.map(log => ({
            ...log,
            connectionName: log.connectionId ? connectionMap.get(log.connectionId) || 'Unknown DB' : 'None'
        }));
        res.json({ auditLogs: mappedLogs });
    }
    catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
};
exports.getAuditLogs = getAuditLogs;
const getSecurityStats = async (req, res) => {
    try {
        const totalUsers = await prisma_1.default.user.count();
        const activeUsers = await prisma_1.default.user.count({ where: { status: 'ACTIVE' } });
        const totalQueries = await prisma_1.default.auditLog.count({ where: { NOT: { status: 'BLOCKED' } } });
        const blockedCount = await prisma_1.default.auditLog.count({ where: { status: 'BLOCKED' } });
        const failedLogins = await prisma_1.default.failedLogin.count();
        const pendingApprovals = await prisma_1.default.user.count({ where: { role: 'DATABASE_MANAGER', status: 'PENDING' } });
        const recentAuditLogs = await prisma_1.default.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        res.json({
            totalUsers,
            activeUsers,
            totalQueries,
            blockedCount,
            failedLogins,
            pendingApprovals,
            recentAuditLogs
        });
    }
    catch (error) {
        console.error('Error fetching security stats:', error);
        res.status(500).json({ error: 'Failed to fetch security stats' });
    }
};
exports.getSecurityStats = getSecurityStats;
