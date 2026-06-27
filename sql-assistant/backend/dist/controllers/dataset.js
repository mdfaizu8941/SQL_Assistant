"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatasets = exports.exportDataset = exports.importDataset = exports.analyzeDataset = void 0;
const stream_1 = require("stream");
const csv_parser_1 = __importDefault(require("csv-parser"));
const xlsx_1 = __importDefault(require("xlsx"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const queryRouter_1 = require("../utils/queryRouter");
const dbPool_1 = __importDefault(require("../utils/dbPool"));
const promise_1 = __importDefault(require("mysql2/promise"));
const crypto_1 = require("../utils/crypto");
// Type inference helper
function inferType(val) {
    if (val === undefined || val === null || String(val).trim() === '') {
        return 'VARCHAR(255)';
    }
    const str = String(val).trim();
    if (/^-?\d+$/.test(str))
        return 'INT';
    if (/^-?\d*\.\d+$/.test(str))
        return 'DOUBLE';
    return 'VARCHAR(255)';
}
// Step 1: Analyze dataset (CSV/Excel) and infer schema columns and types
const analyzeDataset = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }
        let parsedRows = [];
        const fileBuffer = req.file.buffer;
        const originalName = req.file.originalname;
        // Parse CSV or Excel
        if (originalName.endsWith('.csv')) {
            const csvStr = fileBuffer.toString('utf-8');
            parsedRows = await new Promise((resolve, reject) => {
                const rows = [];
                const stream = stream_1.Readable.from(csvStr);
                stream.pipe((0, csv_parser_1.default)())
                    .on('data', (data) => rows.push(data))
                    .on('end', () => resolve(rows))
                    .on('error', (err) => reject(err));
            });
        }
        else if (originalName.endsWith('.xlsx') || originalName.endsWith('.xls')) {
            const workbook = xlsx_1.default.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            parsedRows = xlsx_1.default.utils.sheet_to_json(sheet);
        }
        else {
            res.status(400).json({ error: 'Unsupported file format. Please upload CSV or Excel (.xls, .xlsx) files.' });
            return;
        }
        if (parsedRows.length === 0) {
            res.status(400).json({ error: 'Uploaded file contains no data rows.' });
            return;
        }
        const rawHeaders = Object.keys(parsedRows[0]);
        const cleanHeaders = rawHeaders.map(h => h.trim().replace(/[^a-zA-Z0-9_]/g, '_'));
        // Infer column datatypes
        const columns = cleanHeaders.map((header, idx) => {
            const rawHeader = rawHeaders[idx];
            let inferred = 'INT';
            for (const row of parsedRows) {
                const val = row[rawHeader];
                const type = inferType(val);
                if (type === 'VARCHAR(255)') {
                    inferred = 'VARCHAR(255)';
                    break;
                }
                else if (type === 'DOUBLE' && inferred === 'INT') {
                    inferred = 'DOUBLE';
                }
            }
            return { logical: header, raw: rawHeader, type: inferred };
        });
        // Derive suggested table name from filename
        const suggestedTableName = originalName
            .substring(0, originalName.lastIndexOf('.'))
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_');
        res.json({
            success: true,
            columns,
            rows: parsedRows,
            suggestedTableName,
            fileName: originalName,
            fileSize: req.file.size
        });
    }
    catch (error) {
        console.error('Error analyzing dataset:', error);
        res.status(500).json({ error: 'Failed to analyze and parse dataset file' });
    }
};
exports.analyzeDataset = analyzeDataset;
// Step 2: Create custom table and insert data
const importDataset = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role || 'USER';
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { tableName: logicalTableName, connectionId: connIdStr, columns, rows, fileName, fileSize } = req.body;
        if (!logicalTableName || !connIdStr || !columns || !rows || !Array.isArray(columns) || !Array.isArray(rows)) {
            res.status(400).json({ error: 'Missing required parameters. Table name, connection, columns and rows are required.' });
            return;
        }
        const connectionId = Number(connIdStr);
        if (!/^[a-zA-Z0-9_]+$/.test(logicalTableName)) {
            res.status(400).json({ error: 'Table name must be alphanumeric with no spaces or special characters.' });
            return;
        }
        const dbConfig = await (0, queryRouter_1.getAuthorizedConnection)(connectionId, userId, role);
        if (!dbConfig) {
            res.status(404).json({ error: 'Connection target unauthorized or not found' });
            return;
        }
        const prefix = `db_user_${userId}_`;
        const physicalTableName = `${prefix}${logicalTableName}`;
        let dbName = '';
        let connection;
        if (connectionId === 9999) {
            connection = await dbPool_1.default.getConnection();
            const dbUrl = process.env.DATABASE_URL || '';
            try {
                const parsedUrl = new URL(dbUrl);
                dbName = parsedUrl.pathname.replace(/^\//, '') || 'sql_assistant';
            }
            catch (err) {
                dbName = 'sql_assistant';
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
            dbName = dbConfig.databaseName;
        }
        try {
            const existingMeta = await prisma_1.default.tableMetadata.findFirst({
                where: { ownerId: userId, tableName: logicalTableName }
            });
            if (existingMeta) {
                res.status(400).json({ error: `Table "${logicalTableName}" already exists in your workspace.` });
                return;
            }
            // CREATE TABLE query using custom data types
            const colsSql = columns.map((col) => `\`${col.logical}\` ${col.type}`).join(', ');
            await connection.query(`CREATE TABLE \`${physicalTableName}\` (${colsSql});`);
            // Map rows to table columns
            const bulkValues = rows.map((row) => {
                return columns.map((col) => {
                    const val = row[col.raw];
                    return val === undefined ? null : val;
                });
            });
            const insertHeaders = columns.map((col) => `\`${col.logical}\``).join(', ');
            const chunkSize = 500;
            for (let i = 0; i < bulkValues.length; i += chunkSize) {
                const chunk = bulkValues.slice(i, i + chunkSize);
                await connection.query(`INSERT INTO \`${physicalTableName}\` (${insertHeaders}) VALUES ?`, [chunk]);
            }
            // Save TableMetadata
            await prisma_1.default.tableMetadata.create({
                data: {
                    tableName: logicalTableName,
                    physicalName: physicalTableName,
                    ownerId: userId,
                    ownerRole: role,
                    visibility: 'PRIVATE',
                    createdBy: req.user?.email || 'Unknown'
                }
            });
            // Save Dataset metadata
            const dataset = await prisma_1.default.dataset.create({
                data: {
                    userId: userId,
                    fileName: fileName || 'Uploaded_Dataset',
                    tableName: logicalTableName,
                    rowCount: rows.length,
                    fileSize: fileSize ? Number(fileSize) : 0,
                    ownerId: userId,
                    ownerRole: role,
                    visibility: 'PRIVATE',
                    createdBy: req.user?.email || 'Unknown'
                }
            });
            res.status(201).json({
                success: true,
                message: `Dataset successfully imported into table "${logicalTableName}"`,
                dataset
            });
        }
        catch (dbErr) {
            console.error('Database execution error during custom import:', dbErr);
            res.status(400).json({ error: `Import failed: ${dbErr.message}` });
        }
        finally {
            if (connectionId === 9999) {
                connection.release();
            }
            else {
                await connection.end();
            }
        }
    }
    catch (error) {
        console.error('Error importing dataset:', error);
        res.status(500).json({ error: 'Failed to import dataset' });
    }
};
exports.importDataset = importDataset;
const exportDataset = async (req, res) => {
    try {
        const { format, results } = req.body;
        if (!format || !results || !Array.isArray(results)) {
            res.status(400).json({ error: 'Results array and export Format are required.' });
            return;
        }
        if (results.length === 0) {
            res.status(400).json({ error: 'Cannot export empty results.' });
            return;
        }
        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=query_export.json');
            res.send(JSON.stringify(results, null, 2));
            return;
        }
        const headers = Object.keys(results[0]);
        if (format === 'csv') {
            let csvContent = headers.join(',') + '\n';
            results.forEach(row => {
                const line = headers.map(h => {
                    let cell = row[h] === null || row[h] === undefined ? '' : String(row[h]);
                    // Escape quotes and wrap with quotes if comma present
                    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                        cell = `"${cell.replace(/"/g, '""')}"`;
                    }
                    return cell;
                }).join(',');
                csvContent += line + '\n';
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=query_export.csv');
            res.send(csvContent);
            return;
        }
        if (format === 'xlsx') {
            const worksheet = xlsx_1.default.utils.json_to_sheet(results);
            const workbook = xlsx_1.default.utils.book_new();
            xlsx_1.default.utils.book_append_sheet(workbook, worksheet, 'Results');
            const buffer = xlsx_1.default.write(workbook, { bookType: 'xlsx', type: 'buffer' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=query_export.xlsx');
            res.send(buffer);
            return;
        }
        res.status(400).json({ error: 'Invalid export format. Must be "csv", "xlsx", or "json".' });
    }
    catch (error) {
        console.error('Error exporting dataset:', error);
        res.status(500).json({ error: 'Failed to export query results' });
    }
};
exports.exportDataset = exportDataset;
const getDatasets = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role || 'USER';
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        let datasets = [];
        if (role === 'ADMIN') {
            datasets = await prisma_1.default.dataset.findMany({
                include: {
                    user: { select: { email: true } }
                }
            });
        }
        else {
            datasets = await prisma_1.default.dataset.findMany({
                where: {
                    OR: [
                        { ownerId: userId, ownerRole: 'USER' },
                        { visibility: 'SHARED' },
                        { visibility: 'PUBLIC' }
                    ]
                },
                include: {
                    user: { select: { email: true } }
                }
            });
        }
        res.json({ datasets });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve datasets' });
    }
};
exports.getDatasets = getDatasets;
