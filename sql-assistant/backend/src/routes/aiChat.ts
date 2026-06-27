import { Router } from 'express';
import { saveChat, getChatHistory, getChatById, createChat, renameChat, togglePinChat, deleteChat } from '../controllers/aiChat';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.post('/create', createChat);
router.post('/save', saveChat);
router.get('/', getChatHistory);
router.get('/:id', getChatById);
router.put('/:id/rename', renameChat);
router.post('/:id/pin', togglePinChat);
router.delete('/:id', deleteChat);

export default router;
