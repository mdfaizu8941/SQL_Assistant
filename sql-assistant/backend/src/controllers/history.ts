import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

export const getHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const history = await prisma.queryHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ history });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

export const getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const totalQueries = await prisma.queryHistory.count({ where: { userId } });
    const successfulQueries = await prisma.queryHistory.count({ where: { userId, status: 'SUCCESS' } });
    const successRate = totalQueries > 0 ? (successfulQueries / totalQueries) * 100 : 0;

    const recentQueries = await prisma.queryHistory.findMany({
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
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const auditLogs = await prisma.auditLog.findMany({
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

    const connections = await prisma.databaseConnection.findMany({
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
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

export const getSecurityStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { status: 'ACTIVE' } });
    const totalQueries = await prisma.auditLog.count({ where: { NOT: { status: 'BLOCKED' } } });
    const blockedCount = await prisma.auditLog.count({ where: { status: 'BLOCKED' } });
    const failedLogins = await prisma.failedLogin.count();
    const pendingApprovals = await prisma.user.count({ where: { role: 'DATABASE_MANAGER', status: 'PENDING' } });

    const recentAuditLogs = await prisma.auditLog.findMany({
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
  } catch (error) {
    console.error('Error fetching security stats:', error);
    res.status(500).json({ error: 'Failed to fetch security stats' });
  }
};
