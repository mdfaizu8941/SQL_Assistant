"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportSchema = exports.addColumn = exports.deleteColumn = exports.renameColumn = exports.deleteTable = exports.renameTable = exports.getDatabasesMetadata = exports.deleteDatabase = exports.createDatabase = exports.getSchema = exports.testConnection = exports.getConnections = exports.addConnection = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const crypto_1 = require("../utils/crypto");
const dbPool_1 = __importDefault(require("../utils/dbPool"));
const queryRouter_1 = require("../utils/queryRouter");
const addConnection = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { name, host, port, dbUser, dbPassword, databaseName } = req.body;
        const connection = await prisma_1.default.databaseConnection.create({
            data: {
                userId,
                name,
                host,
                port: port || 3306,
                dbUser,
                dbPassword: (0, crypto_1.encrypt)(dbPassword),
                databaseName,
                ownerId: userId,
                ownerRole: req.user?.role || 'USER',
                visibility: req.user?.role === 'ADMIN' ? 'SHARED' : 'PRIVATE',
                createdBy: req.user?.email || 'Unknown'
            },
        });
        res.status(201).json({ connection: { id: connection.id, name: connection.name, host: connection.host, databaseName: connection.databaseName } });
    }
    catch (error) {
        console.error('Error adding connection:', error);
        res.status(500).json({ error: 'Failed to add connection' });
    }
};
exports.addConnection = addConnection;
const getConnections = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const defaultConnection = {
            id: 9999,
            name: 'Shared Database',
            host: 'localhost',
            port: 3306,
            databaseName: 'sql_assistant',
            createdAt: new Date()
        };
        const connections = await prisma_1.default.databaseConnection.findMany({
            where: { userId },
            select: { id: true, name: true, host: true, port: true, databaseName: true, createdAt: true },
        });
        const logicalDbs = await prisma_1.default.databaseMetadata.findMany({
            where: { ownerId: userId }
        });
        const logicalDbConnections = logicalDbs.map(db => ({
            id: 100000 + db.id,
            name: db.dbName,
            host: 'localhost',
            port: 3306,
            databaseName: db.physicalName,
            createdAt: db.createdAt
        }));
        res.json({ connections: [defaultConnection, ...logicalDbConnections, ...connections] });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch connections' });
    }
};
exports.getConnections = getConnections;
const testConnection = async (req, res) => {
    try {
        const { host, port, dbUser, dbPassword, databaseName } = req.body;
        const connection = await promise_1.default.createConnection({
            host,
            port: port || 3306,
            user: dbUser,
            password: dbPassword,
            database: databaseName,
            allowPublicKeyRetrieval: true,
        });
        await connection.ping();
        await connection.end();
        res.json({ success: true, message: 'Connection successful' });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
exports.testConnection = testConnection;
const getSchema = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        const { connectionId } = req.params;
        if (!userId || !role) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        let connection;
        let databaseName;
        let isSharedPool = false;
        const dbConfig = await (0, queryRouter_1.getAuthorizedConnection)(Number(connectionId), userId, role);
        if (!dbConfig) {
            res.status(404).json({ error: 'Connection not found or unauthorized' });
            return;
        }
        if (Number(connectionId) === 9999) {
            isSharedPool = true;
            connection = await dbPool_1.default.getConnection();
            const dbUrl = process.env.DATABASE_URL || '';
            try {
                const parsedUrl = new URL(dbUrl);
                databaseName = parsedUrl.pathname.replace(/^\//, '') || 'sql_assistant';
            }
            catch (err) {
                databaseName = 'sql_assistant';
            }
        }
        else {
            connection = await promise_1.default.createConnection({
                host: dbConfig.host,
                port: dbConfig.port,
                user: dbConfig.dbUser,
                password: (0, crypto_1.decrypt)(dbConfig.dbPassword),
                database: dbConfig.databaseName,
                allowPublicKeyRetrieval: true,
            });
            databaseName = dbConfig.databaseName;
        }
        // Fetch allowed tables for browsing (forExecution = false)
        const allowedTables = await (0, queryRouter_1.getAllowedTables)(userId, role, false);
        const schema = {};
        for (const table of allowedTables) {
            const physicalName = table.physicalName;
            const logicalName = table.tableName;
            const [columns] = await connection.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [databaseName, physicalName]);
            const [indexes] = await connection.query(`
        SELECT DISTINCT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [databaseName, physicalName]);
            schema[logicalName] = {
                columns,
                indexes: indexes || []
            };
        }
        if (isSharedPool) {
            connection.release();
        }
        else {
            await connection.end();
        }
        res.json({ schema });
    }
    catch (error) {
        console.error('Error fetching schema:', error);
        res.status(500).json({ error: 'Failed to fetch schema' });
    }
};
exports.getSchema = getSchema;
const createDatabase = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { dbName, connectionId } = req.body;
        if (!dbName || !connectionId) {
            res.status(400).json({ error: 'Database Name and Connection ID are required.' });
            return;
        }
        // Validate database name format
        if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
            res.status(400).json({ error: 'Database name must be alphanumeric and contain no spaces or special characters.' });
            return;
        }
        // Authorize connection
        const dbConfig = await (0, queryRouter_1.getAuthorizedConnection)(Number(connectionId), userId, role);
        if (!dbConfig) {
            res.status(404).json({ error: 'Connection target unauthorized or not found' });
            return;
        }
        const prefix = role === 'ADMIN' ? 'wp_admin_' : `wp_user_${userId}_`;
        const physicalName = `${prefix}${dbName}`;
        // Check for logical db conflicts
        const existing = await prisma_1.default.databaseMetadata.findFirst({
            where: { ownerId: userId, dbName }
        });
        if (existing) {
            res.status(400).json({ error: `Database "${dbName}" already exists in your workspace.` });
            return;
        }
        // Execute physical creation on target connection
        let connection;
        if (Number(connectionId) === 9999) {
            connection = await dbPool_1.default.getConnection();
        }
        else {
            connection = await promise_1.default.createConnection({
                host: dbConfig.host,
                port: dbConfig.port,
                user: dbConfig.dbUser,
                password: (0, crypto_1.decrypt)(dbConfig.dbPassword),
                allowPublicKeyRetrieval: true,
            });
        }
        try {
            await connection.query(`CREATE DATABASE \`${physicalName}\`;`);
        }
        catch (dbErr) {
            res.status(400).json({ error: `MySQL Error: ${dbErr.message}` });
            return;
        }
        finally {
            if (Number(connectionId) === 9999) {
                connection.release();
            }
            else {
                await connection.end();
            }
        }
        // Register logical metadata mapping
        const dbMeta = await prisma_1.default.databaseMetadata.create({
            data: {
                dbName,
                physicalName,
                ownerId: userId,
                ownerRole: role,
                visibility: role === 'ADMIN' ? 'SHARED' : 'PRIVATE',
                createdBy: req.user?.email || 'Unknown'
            }
        });
        res.status(201).json({ success: true, database: dbMeta });
    }
    catch (error) {
        console.error('Error creating database:', error);
        res.status(500).json({ error: 'Failed to create database' });
    }
};
exports.createDatabase = createDatabase;
const deleteDatabase = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const { connectionId } = req.body;
        if (!connectionId) {
            res.status(400).json({ error: 'Connection target connectionId is required.' });
            return;
        }
        const dbMeta = await prisma_1.default.databaseMetadata.findUnique({
            where: { id: Number(id) }
        });
        if (!dbMeta) {
            res.status(404).json({ error: 'Database metadata not found' });
            return;
        }
        // Authorization: User can only delete own databases, Admin can delete any
        if (role !== 'ADMIN' && dbMeta.ownerId !== userId) {
            res.status(403).json({ error: 'Forbidden: You do not have permission to delete this database.' });
            return;
        }
        const dbConfig = await (0, queryRouter_1.getAuthorizedConnection)(Number(connectionId), userId, role);
        if (!dbConfig) {
            res.status(404).json({ error: 'Connection target unauthorized or not found' });
            return;
        }
        // Execute physical deletion
        let connection;
        if (Number(connectionId) === 9999) {
            connection = await dbPool_1.default.getConnection();
        }
        else {
            connection = await promise_1.default.createConnection({
                host: dbConfig.host,
                port: dbConfig.port,
                user: dbConfig.dbUser,
                password: (0, crypto_1.decrypt)(dbConfig.dbPassword),
                allowPublicKeyRetrieval: true,
            });
        }
        try {
            await connection.query(`DROP DATABASE \`${dbMeta.physicalName}\`;`);
        }
        catch (dbErr) {
            console.warn(`Physical database drop warning: ${dbErr.message}`);
        }
        finally {
            if (Number(connectionId) === 9999) {
                connection.release();
            }
            else {
                await connection.end();
            }
        }
        // Cascade delete related logical tables
        const prefixPattern = dbMeta.ownerRole === 'ADMIN' ? 'db_admin_' : `db_user_${dbMeta.ownerId}_`;
        await prisma_1.default.tableMetadata.deleteMany({
            where: {
                ownerId: dbMeta.ownerId,
                physicalName: {
                    startsWith: prefixPattern
                }
            }
        });
        // Delete logical metadata record
        await prisma_1.default.databaseMetadata.delete({
            where: { id: dbMeta.id }
        });
        res.json({ success: true, message: `Database "${dbMeta.dbName}" deleted successfully.` });
    }
    catch (error) {
        console.error('Error deleting database:', error);
        res.status(500).json({ error: 'Failed to delete database' });
    }
};
exports.deleteDatabase = deleteDatabase;
const getDatabasesMetadata = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const databases = await prisma_1.default.databaseMetadata.findMany({
            where: {
                OR: [
                    { ownerId: userId },
                    { visibility: 'PUBLIC' }
                ]
            },
            include: {
                user: {
                    select: { email: true }
                }
            }
        });
        res.json({ databases });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch database metadata' });
    }
};
exports.getDatabasesMetadata = getDatabasesMetadata;
// Helper for schema modifications
const executeOnConnection = async (connectionId, userId, role, query) => {
    let connection;
    let isSharedPool = false;
    const dbConfig = await (0, queryRouter_1.getAuthorizedConnection)(connectionId, userId, role);
    if (!dbConfig)
        throw new Error('Unauthorized database connection target');
    if (connectionId === 9999) {
        isSharedPool = true;
        connection = await dbPool_1.default.getConnection();
    }
    else {
        connection = await promise_1.default.createConnection({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.dbUser,
            password: (0, crypto_1.decrypt)(dbConfig.dbPassword),
            database: dbConfig.databaseName,
            allowPublicKeyRetrieval: true,
        });
    }
    try {
        const [results] = await connection.query(query);
        return results;
    }
    finally {
        if (isSharedPool) {
            connection.release();
        }
        else {
            await connection.end();
        }
    }
};
// Rename Table
const renameTable = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role || 'USER';
        const { connectionId, tableName } = req.params;
        const { newTableName } = req.body;
        if (!userId || !tableName || !newTableName) {
            res.status(400).json({ error: 'Missing required parameters' });
            return;
        }
        const allowedTables = await (0, queryRouter_1.getAllowedTables)(userId, role, false);
        const physicalOld = (0, queryRouter_1.resolveTable)(tableName, allowedTables, userId, role);
        if (!physicalOld) {
            res.status(404).json({ error: 'Table not found or unauthorized' });
            return;
        }
        const prefix = `db_user_${userId}_`;
        const physicalNew = `${prefix}${newTableName}`;
        const existing = await prisma_1.default.tableMetadata.findFirst({
            where: { ownerId: userId, tableName: newTableName }
        });
        if (existing) {
            res.status(400).json({ error: `Table "${newTableName}" already exists.` });
            return;
        }
        await executeOnConnection(Number(connectionId), userId, role, `RENAME TABLE \`${physicalOld}\` TO \`${physicalNew}\`;`);
        const meta = await prisma_1.default.tableMetadata.findFirst({
            where: { ownerId: userId, tableName: tableName }
        });
        if (meta) {
            await prisma_1.default.tableMetadata.update({
                where: { id: meta.id },
                data: { tableName: newTableName, physicalName: physicalNew }
            });
        }
        const dataset = await prisma_1.default.dataset.findFirst({
            where: { userId, tableName: tableName }
        });
        if (dataset) {
            await prisma_1.default.dataset.update({
                where: { id: dataset.id },
                data: { tableName: newTableName }
            });
        }
        res.json({ success: true, message: 'Table renamed successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.renameTable = renameTable;
// Delete Table
const deleteTable = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role || 'USER';
        const { connectionId, tableName } = req.params;
        if (!userId || !tableName) {
            res.status(400).json({ error: 'Missing required parameters' });
            return;
        }
        const allowedTables = await (0, queryRouter_1.getAllowedTables)(userId, role, false);
        const physicalName = (0, queryRouter_1.resolveTable)(tableName, allowedTables, userId, role);
        if (!physicalName) {
            res.status(404).json({ error: 'Table not found or unauthorized' });
            return;
        }
        await executeOnConnection(Number(connectionId), userId, role, `DROP TABLE \`${physicalName}\`;`);
        await prisma_1.default.tableMetadata.deleteMany({
            where: { ownerId: userId, tableName: tableName }
        });
        await prisma_1.default.dataset.deleteMany({
            where: { userId, tableName: tableName }
        });
        res.json({ success: true, message: 'Table deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.deleteTable = deleteTable;
// Rename Column
const renameColumn = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role || 'USER';
        const { connectionId, tableName, columnName } = req.params;
        const { newColumnName, dataType } = req.body;
        if (!userId || !tableName || !columnName || !newColumnName) {
            res.status(400).json({ error: 'Missing required parameters' });
            return;
        }
        const allowedTables = await (0, queryRouter_1.getAllowedTables)(userId, role, false);
        const physicalTable = (0, queryRouter_1.resolveTable)(tableName, allowedTables, userId, role);
        if (!physicalTable) {
            res.status(404).json({ error: 'Table not found or unauthorized' });
            return;
        }
        const typeStr = dataType || 'VARCHAR(255)';
        await executeOnConnection(Number(connectionId), userId, role, `ALTER TABLE \`${physicalTable}\` CHANGE COLUMN \`${columnName}\` \`${newColumnName}\` ${typeStr};`);
        res.json({ success: true, message: 'Column renamed successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.renameColumn = renameColumn;
// Delete Column
const deleteColumn = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role || 'USER';
        const { connectionId, tableName, columnName } = req.params;
        if (!userId || !tableName || !columnName) {
            res.status(400).json({ error: 'Missing required parameters' });
            return;
        }
        const allowedTables = await (0, queryRouter_1.getAllowedTables)(userId, role, false);
        const physicalTable = (0, queryRouter_1.resolveTable)(tableName, allowedTables, userId, role);
        if (!physicalTable) {
            res.status(404).json({ error: 'Table not found or unauthorized' });
            return;
        }
        await executeOnConnection(Number(connectionId), userId, role, `ALTER TABLE \`${physicalTable}\` DROP COLUMN \`${columnName}\`;`);
        res.json({ success: true, message: 'Column deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.deleteColumn = deleteColumn;
// Add Column
const addColumn = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role || 'USER';
        const { connectionId, tableName } = req.params;
        const { columnName, dataType, isNullable } = req.body;
        if (!userId || !tableName || !columnName || !dataType) {
            res.status(400).json({ error: 'Missing required parameters' });
            return;
        }
        const allowedTables = await (0, queryRouter_1.getAllowedTables)(userId, role, false);
        const physicalTable = (0, queryRouter_1.resolveTable)(tableName, allowedTables, userId, role);
        if (!physicalTable) {
            res.status(404).json({ error: 'Table not found or unauthorized' });
            return;
        }
        const nullableStr = isNullable ? 'NULL' : 'NOT NULL';
        await executeOnConnection(Number(connectionId), userId, role, `ALTER TABLE \`${physicalTable}\` ADD COLUMN \`${columnName}\` ${dataType} ${nullableStr};`);
        res.json({ success: true, message: 'Column added successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.addColumn = addColumn;
// Export Schema as SQL script
const exportSchema = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role || 'USER';
        const { connectionId } = req.params;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const dbConfig = await (0, queryRouter_1.getAuthorizedConnection)(Number(connectionId), userId, role);
        if (!dbConfig) {
            res.status(404).json({ error: 'Connection not found or unauthorized' });
            return;
        }
        const allowedTables = await (0, queryRouter_1.getAllowedTables)(userId, role, false);
        let sqlScript = `-- Database Schema Export for ${dbConfig.name}\n`;
        sqlScript += `-- Exported on ${new Date().toLocaleString()}\n\n`;
        let connection;
        let isSharedPool = false;
        if (Number(connectionId) === 9999) {
            isSharedPool = true;
            connection = await dbPool_1.default.getConnection();
        }
        else {
            connection = await promise_1.default.createConnection({
                host: dbConfig.host,
                port: dbConfig.port,
                user: dbConfig.dbUser,
                password: (0, crypto_1.decrypt)(dbConfig.dbPassword),
                database: dbConfig.databaseName,
                allowPublicKeyRetrieval: true,
            });
        }
        try {
            for (const table of allowedTables) {
                const [ddlResults] = await connection.query(`SHOW CREATE TABLE \`${table.physicalName}\``);
                if (ddlResults && ddlResults[0]) {
                    const rawDdl = ddlResults[0]['Create Table'];
                    const logicalDdl = rawDdl.replace(new RegExp(`\`?${table.physicalName}\`?`, 'g'), `\`${table.tableName}\``);
                    sqlScript += `${logicalDdl};\n\n`;
                }
            }
        }
        finally {
            if (isSharedPool) {
                connection.release();
            }
            else {
                await connection.end();
            }
        }
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=schema_export_${dbConfig.databaseName || 'db'}.sql`);
        res.send(sqlScript);
    }
    catch (err) {
        res.status(500).json({ error: `Export failed: ${err.message}` });
    }
};
exports.exportSchema = exportSchema;
