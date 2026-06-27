import { Router } from 'express';
import { getHistory, getAnalytics, deleteHistoryItem, clearHistory } from '../controllers/history';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getHistory);
router.get('/analytics', getAnalytics);
router.delete('/:id', deleteHistoryItem);
router.delete('/', clearHistory);

export default router;
