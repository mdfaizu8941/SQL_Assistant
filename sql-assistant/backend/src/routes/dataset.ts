import { Router } from 'express';
import multer from 'multer';
import { analyzeDataset, importDataset, exportDataset, getDatasets } from '../controllers/dataset';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Multer memory configuration (limiting to 10MB per upload)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.use(authenticate);

router.post('/analyze', upload.single('file'), analyzeDataset);
router.post('/import', importDataset);
router.post('/export', exportDataset);
router.get('/', getDatasets);

export default router;
