import { Router } from 'express';
import { register, login, forgotPassword, resetPassword, refreshTokens, logout } from '../controllers/auth';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh', refreshTokens);
router.post('/logout', authenticate, logout);

export default router;
