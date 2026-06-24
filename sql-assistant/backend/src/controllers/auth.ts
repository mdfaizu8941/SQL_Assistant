import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
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
    } else {
      const requestedRole = String(role).toUpperCase();
      if (requestedRole === 'DATABASE_MANAGER') {
        assignedRole = 'DATABASE_MANAGER';
        status = 'PENDING';
      } else if (requestedRole === 'ADMIN') {
        // Prevent manual admin registration
        assignedRole = 'USER';
        status = 'ACTIVE';
      } else {
        assignedRole = 'USER';
        status = 'ACTIVE';
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { 
        email, 
        passwordHash,
        role: assignedRole,
        status: status
      },
    });

    const secret = process.env.JWT_SECRET || 'super-secret-key';
    const token = jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '24h' });

    res.status(201).json({ user: { id: user.id, email: user.email, role: user.role, status: user.status }, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || null;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await prisma.failedLogin.create({ data: { email, ipAddress } });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (user.status === 'DISABLED') {
      res.status(403).json({ error: 'Your account has been disabled. Please contact an administrator.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await prisma.failedLogin.create({ data: { email, ipAddress } });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'super-secret-key';
    const token = jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '24h' });

    res.status(200).json({ user: { id: user.id, email: user.email, role: user.role, status: user.status }, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
