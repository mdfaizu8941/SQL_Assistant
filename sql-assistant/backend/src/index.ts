import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per 15 minutes
  message: { error: 'Too many login or registration attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute
  message: { error: 'Too many AI requests. Please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'SQL Assistant API is running' });
});

import authRoutes from './routes/auth';
import databaseRoutes from './routes/database';
import aiRoutes from './routes/ai';
import historyRoutes from './routes/history';
import datasetRoutes from './routes/dataset';
import savedQueryRoutes from './routes/savedQuery';
import aiChatRoutes from './routes/aiChat';

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/dataset', datasetRoutes);
app.use('/api/saved-query', savedQueryRoutes);
app.use('/api/ai-chat', aiChatRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Keepalive interval to ensure the Node process stays alive in the runner environment
setInterval(() => {}, 60000);
// Trigger nodemon reload after script update
