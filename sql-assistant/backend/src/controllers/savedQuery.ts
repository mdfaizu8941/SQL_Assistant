import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

export const saveQuery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId || !role) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { queryName, sql } = req.body;
    if (!queryName || !sql) {
      res.status(400).json({ error: 'Query Name and SQL content are required.' });
      return;
    }

    const saved = await prisma.savedQuery.create({
      data: {
        userId,
        queryName,
        sql,
        isFavorite: false,
        ownerId: userId,
        ownerRole: role,
        visibility: 'PRIVATE',
        createdBy: req.user?.email || 'Unknown'
      }
    });

    res.status(201).json({ success: true, savedQuery: saved });
  } catch (error) {
    console.error('Error saving query:', error);
    res.status(500).json({ error: 'Failed to save query' });
  }
};

export const getSavedQueries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role || 'USER';
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let savedQueries = [];
    if (role === 'ADMIN') {
      savedQueries = await prisma.savedQuery.findMany({
        include: {
          user: { select: { email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      savedQueries = await prisma.savedQuery.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' }
      });
    }

    res.json({ savedQueries });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve saved queries' });
  }
};

export const toggleFavorite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId || !role) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const saved = await prisma.savedQuery.findUnique({
      where: { id: Number(id) }
    });

    if (!saved) {
      res.status(404).json({ error: 'Saved query not found' });
      return;
    }

    if (role !== 'ADMIN' && saved.ownerId !== userId) {
      res.status(403).json({ error: 'Forbidden: You do not own this query.' });
      return;
    }

    const updated = await prisma.savedQuery.update({
      where: { id: saved.id },
      data: { isFavorite: !saved.isFavorite }
    });

    res.json({ success: true, savedQuery: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle favorite status' });
  }
};

export const deleteSavedQuery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId || !role) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const saved = await prisma.savedQuery.findUnique({
      where: { id: Number(id) }
    });

    if (!saved) {
      res.status(404).json({ error: 'Saved query not found' });
      return;
    }

    if (role !== 'ADMIN' && saved.ownerId !== userId) {
      res.status(403).json({ error: 'Forbidden: You do not have permission to delete this query.' });
      return;
    }

    await prisma.savedQuery.delete({
      where: { id: saved.id }
    });

    res.json({ success: true, message: 'Saved query deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete query' });
  }
};
