import { Router } from 'express';
import { listUsers, updateUserRole, updateUserStatus, deleteUser } from '../controllers/admin';
import { authenticateJWT, requireAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT);
router.use(requireAdmin);

router.get('/users', listUsers);
router.post('/users/:id/role', updateUserRole);
router.post('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

export default router;
