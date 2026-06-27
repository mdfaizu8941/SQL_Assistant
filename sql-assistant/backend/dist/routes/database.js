"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../controllers/database");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Database Connection Configurations (Accessible to any logged-in user)
router.post('/add', database_1.addConnection);
router.get('/', database_1.getConnections);
router.post('/test', database_1.testConnection);
// Schema explorer
router.get('/:connectionId/schema', database_1.getSchema);
// Logical Database management (Admin and User)
router.get('/metadata', database_1.getDatabasesMetadata);
router.post('/create-db', database_1.createDatabase);
router.post('/delete-db/:id', database_1.deleteDatabase);
// Table and Column operations (Schema editing/management)
router.post('/:connectionId/table/:tableName/rename', database_1.renameTable);
router.delete('/:connectionId/table/:tableName', database_1.deleteTable);
router.post('/:connectionId/table/:tableName/column/:columnName/rename', database_1.renameColumn);
router.delete('/:connectionId/table/:tableName/column/:columnName', database_1.deleteColumn);
router.post('/:connectionId/table/:tableName/column/add', database_1.addColumn);
router.get('/:connectionId/schema/export', database_1.exportSchema);
exports.default = router;
