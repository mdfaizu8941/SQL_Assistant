"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSchema = exports.testConnection = exports.getConnections = exports.addConnection = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const crypto_1 = require("../utils/crypto");
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
        const connections = await prisma_1.default.databaseConnection.findMany({
            where: { userId },
            select: { id: true, name: true, host: true, port: true, databaseName: true, createdAt: true },
        });
        res.json({ connections });
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
        const { connectionId } = req.params;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const dbConfig = await prisma_1.default.databaseConnection.findFirst({
            where: { id: Number(connectionId), userId },
        });
        if (!dbConfig) {
            res.status(404).json({ error: 'Connection not found' });
            return;
        }
        const connection = await promise_1.default.createConnection({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.dbUser,
            password: (0, crypto_1.decrypt)(dbConfig.dbPassword),
            database: dbConfig.databaseName,
            allowPublicKeyRetrieval: true,
        });
        const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
    `, [dbConfig.databaseName]);
        const schema = {};
        for (const table of tables) {
            const tableName = table.TABLE_NAME;
            const [columns] = await connection.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [dbConfig.databaseName, tableName]);
            schema[tableName] = columns;
        }
        await connection.end();
        res.json({ schema });
    }
    catch (error) {
        console.error('Error fetching schema:', error);
        res.status(500).json({ error: 'Failed to fetch schema' });
    }
};
exports.getSchema = getSchema;
