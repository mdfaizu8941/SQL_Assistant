import { Router } from 'express';
import { 
  addConnection, 
  getConnections, 
  testConnection, 
  getSchema,
  createDatabase,
  deleteDatabase,
  getDatabasesMetadata,
  renameTable,
  deleteTable,
  renameColumn,
  deleteColumn,
  addColumn,
  exportSchema
} from '../controllers/database';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

// Database Connection Configurations (Accessible to any logged-in user)
router.post('/add', addConnection);
router.get('/', getConnections);
router.post('/test', testConnection);

// Schema explorer
router.get('/:connectionId/schema', getSchema);

// Logical Database management (Admin and User)
router.get('/metadata', getDatabasesMetadata);
router.post('/create-db', createDatabase);
router.post('/delete-db/:id', deleteDatabase);

// Table and Column operations (Schema editing/management)
router.post('/:connectionId/table/:tableName/rename', renameTable);
router.delete('/:connectionId/table/:tableName', deleteTable);
router.post('/:connectionId/table/:tableName/column/:columnName/rename', renameColumn);
router.delete('/:connectionId/table/:tableName/column/:columnName', deleteColumn);
router.post('/:connectionId/table/:tableName/column/add', addColumn);
router.get('/:connectionId/schema/export', exportSchema);

export default router;
