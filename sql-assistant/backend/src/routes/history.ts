import { Router } from 'express';
import { getHistory, getAnalytics, getAuditLogs, getSecurityStats } from '../controllers/history';
import { authenticate } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

router.use(authenticate);

router.get('/', getHistory);
router.get('/analytics', getAnalytics);
router.get('/audit-logs', requireRole(['ADMIN']), getAuditLogs);
router.get('/security-stats', requireRole(['ADMIN']), getSecurityStats);

export default router;
