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
    const failedQueries = await prisma.queryHistory.count({ where: { userId, status: 'ERROR' } });
    const successRate = totalQueries > 0 ? (successfulQueries / totalQueries) * 100 : 0;

    const recentQueries = await prisma.queryHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const totalDatabases = await prisma.databaseMetadata.count({
      where: { ownerId: userId }
    });

    const totalTables = await prisma.tableMetadata.count({
      where: { ownerId: userId }
    });

    const aiChatsCount = await prisma.aIConversation.count({
      where: { userId }
    });

    const totalDatasets = await prisma.dataset.count({
      where: { userId }
    });

    // Get distinct databases used recently from history or metadata
    const distinctDbs = await prisma.databaseMetadata.findMany({
      where: { ownerId: userId },
      select: { dbName: true, physicalName: true },
      take: 5
    });
    const recentlyUsedDatabases = distinctDbs.map(d => d.dbName);

    // Calculate daily trend data for the last 7 active days (or 7 calendar days)
    const historyForTrend = await prisma.queryHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, status: true, executionTimeMs: true }
    });

    const dailyStats: Record<string, { success: number; failed: number; totalTime: number; count: number }> = {};
    for (const item of historyForTrend) {
      const dateStr = item.createdAt.toISOString().split('T')[0];
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = { success: 0, failed: 0, totalTime: 0, count: 0 };
      }
      if (item.status === 'SUCCESS') {
        dailyStats[dateStr].success++;
      } else if (item.status === 'ERROR') {
        dailyStats[dateStr].failed++;
      }
      if (item.executionTimeMs) {
        dailyStats[dateStr].totalTime += item.executionTimeMs;
        dailyStats[dateStr].count++;
      }
    }

    const trendData = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      success: stats.success,
      failed: stats.failed,
      avgTimeMs: stats.count > 0 ? Math.round(stats.totalTime / stats.count) : 0,
      successRate: (stats.success + stats.failed) > 0 ? Math.round((stats.success / (stats.success + stats.failed)) * 100) : 0
    })).slice(-7); // take last 7 days

    res.json({
      totalQueries,
      successfulQueries,
      failedQueries,
      successRate: Math.round(successRate * 100) / 100,
      recentQueries,
      totalDatabases,
      totalTables,
      aiChatsCount,
      totalDatasets,
      recentlyUsedDatabases,
      trendData
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

export const deleteHistoryItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const record = await prisma.queryHistory.findUnique({
      where: { id: Number(id) }
    });

    if (!record) {
      res.status(404).json({ error: 'History record not found' });
      return;
    }

    if (record.userId !== userId) {
      res.status(403).json({ error: 'Forbidden: You do not own this history item.' });
      return;
    }

    await prisma.queryHistory.delete({
      where: { id: Number(id) }
    });

    res.json({ success: true, message: 'History item deleted successfully' });
  } catch (error) {
    console.error('Error deleting history item:', error);
    res.status(500).json({ error: 'Failed to delete history item' });
  }
};

export const clearHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await prisma.queryHistory.deleteMany({
      where: { userId }
    });

    res.json({ success: true, message: 'History cleared successfully' });
  } catch (error) {
    console.error('Error clearing history:', error);
    res.status(500).json({ error: 'Failed to clear history' });
  }
};
