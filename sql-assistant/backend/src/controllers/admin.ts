import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, role, status } = req.query;

    const whereClause: any = {};

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

    const users = await prisma.user.findMany({
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
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['USER', 'DATABASE_MANAGER', 'ADMIN'].includes(role)) {
      res.status(400).json({ error: 'Invalid role selection' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { role },
    });

    res.json({ success: true, message: `User role updated to ${role}`, user });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'DISABLED'].includes(status)) {
      res.status(400).json({ error: 'Invalid status selection' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { status },
    });

    res.json({ success: true, message: `User status updated to ${status}`, user });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // cascading delete relations manually to avoid db issues
    await prisma.queryHistory.deleteMany({ where: { userId: Number(id) } });
    await prisma.databaseConnection.deleteMany({ where: { userId: Number(id) } });
    await prisma.auditLog.deleteMany({ where: { userId: Number(id) } });

    await prisma.user.delete({
      where: { id: Number(id) },
    });

    res.json({ success: true, message: 'User account deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
