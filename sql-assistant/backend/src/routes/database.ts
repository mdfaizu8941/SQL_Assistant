import { Router } from 'express';
import { addConnection, getConnections, testConnection, getSchema } from '../controllers/database';
import { authenticate } from '../middlewares/auth';
import { requireManager } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.post('/add', requireManager, addConnection);
router.get('/', getConnections);
router.post('/test', requireManager, testConnection);
router.get('/:connectionId/schema', getSchema);

export default router;
