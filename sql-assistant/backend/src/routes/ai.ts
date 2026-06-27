import { Router } from 'express';
import { generateQuery, explainQuery, executeQuery, validateQuery, generateSchema, executeSchema } from '../controllers/ai';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.post('/generate', generateQuery);
router.post('/explain', explainQuery);
router.post('/execute', executeQuery);
router.post('/validate', validateQuery);
router.post('/generate-schema', generateSchema);
router.post('/execute-schema', executeSchema);

export default router;
