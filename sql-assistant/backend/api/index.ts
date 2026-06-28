// Vercel Serverless Function entry point
// This wraps the Express app for Vercel's serverless environment

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});
app.use(express.json());

import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login or registration attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: 'Too many AI requests. Please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'SQL Assistant API is running' });
});

import authRoutes from '../src/routes/auth';
import databaseRoutes from '../src/routes/database';
import aiRoutes from '../src/routes/ai';
import historyRoutes from '../src/routes/history';
import datasetRoutes from '../src/routes/dataset';
import savedQueryRoutes from '../src/routes/savedQuery';
import aiChatRoutes from '../src/routes/aiChat';

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/dataset', datasetRoutes);
app.use('/api/saved-query', savedQueryRoutes);
app.use('/api/ai-chat', aiChatRoutes);

export default app;
