import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string; status: string };
}

export const authenticateJWT = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'super-secret-key';
    const decoded = jwt.verify(token, secret) as { id: number; role: string };

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
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
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authenticate = authenticateJWT;

export const requireUser = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
};

export const requireManager = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const { role, status } = req.user;
  if (role === 'ADMIN') {
    next();
    return;
  }
  if (role === 'DATABASE_MANAGER' && status === 'APPROVED') {
    next();
    return;
  }
  res.status(403).json({ error: 'Forbidden: Requires approved Database Manager privileges.' });
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden: Requires Administrator privileges.' });
    return;
  }
  next();
};
