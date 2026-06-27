import { Router } from 'express';
import { saveQuery, getSavedQueries, toggleFavorite, deleteSavedQuery } from '../controllers/savedQuery';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.post('/save', saveQuery);
router.get('/', getSavedQueries);
router.post('/:id/favorite', toggleFavorite);
router.delete('/:id', deleteSavedQuery);

export default router;
