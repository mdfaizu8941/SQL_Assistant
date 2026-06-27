import { Response } from 'express';
import mysql from 'mysql2/promise';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { encrypt, decrypt } from '../utils/crypto';
import pool from '../utils/dbPool';
import { getAllowedTables, getAuthorizedConnection, resolveTable } from '../utils/queryRouter';

export const addConnection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, host, port, dbUser, dbPassword, databaseName } = req.body;

    const connection = await prisma.databaseConnection.create({
      data: {
        userId,
        name,
        host,
        port: port || 3306,
        dbUser,
        dbPassword: encrypt(dbPassword),
        databaseName,
        ownerId: userId,
        ownerRole: req.user?.role || 'USER',
        visibility: req.user?.role === 'ADMIN' ? 'SHARED' : 'PRIVATE',
        createdBy: req.user?.email || 'Unknown'
      },
    });

    res.status(201).json({ connection: { id: connection.id, name: connection.name, host: connection.host, databaseName: connection.databaseName } });
  } catch (error) {
    console.error('Error adding connection:', error);
    res.status(500).json({ error: 'Failed to add connection' });
  }
};

export const getConnections = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const connections = await prisma.databaseConnection.findMany({
      where: { userId },
      select: { id: true, name: true, host: true, port: true, databaseName: true, createdAt: true },
    });

    const logicalDbs = await prisma.databaseMetadata.findMany({
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
};

export const testConnection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { host, port, dbUser, dbPassword, databaseName } = req.body;

    const connection = await mysql.createConnection({
      host,
      port: port || 3306,
      user: dbUser,
      password: dbPassword,
      database: databaseName,
      allowPublicKeyRetrieval: true,
    } as any);

    await connection.ping();
    await connection.end();

    res.json({ success: true, message: 'Connection successful' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getSchema = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { connectionId } = req.params;

    if (!userId || !role) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let connection: any;
    let databaseName: string;
    let isSharedPool = false;

    const dbConfig = await getAuthorizedConnection(Number(connectionId), userId, role);
    if (!dbConfig) {
      res.status(404).json({ error: 'Connection not found or unauthorized' });
      return;
    }

    if (Number(connectionId) === 9999) {
      isSharedPool = true;
      connection = await pool.getConnection();
      
      const dbUrl = process.env.DATABASE_URL || '';
      try {
        const parsedUrl = new URL(dbUrl);
        databaseName = parsedUrl.pathname.replace(/^\//, '') || 'sql_assistant';
      } catch (err) {
        databaseName = 'sql_assistant';
      }
    } else {
      connection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.dbUser,
        password: decrypt(dbConfig.dbPassword!),
        database: dbConfig.databaseName,
        allowPublicKeyRetrieval: true,
      } as any);
      databaseName = dbConfig.databaseName;
    }

    // Fetch allowed tables for browsing (forExecution = false)
    const allowedTables = await getAllowedTables(userId, role, false);
    const schema: any = {};

    for (const table of allowedTables) {
      const physicalName = table.physicalName;
      const logicalName = table.tableName;

      const [columns] = await connection.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [databaseName, physicalName]) as any[];

      const [indexes] = await connection.query(`
        SELECT DISTINCT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [databaseName, physicalName]) as any[];

      schema[logicalName] = {
        columns,
        indexes: indexes || []
      };
    }

    if (isSharedPool) {
      connection.release();
    } else {
      await connection.end();
    }

    res.json({ schema });
  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({ error: 'Failed to fetch schema' });
  }
};

export const createDatabase = async (req: AuthRequest, res: Response): Promise<void> => {
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
    const dbConfig = await getAuthorizedConnection(Number(connectionId), userId, role);
    if (!dbConfig) {
      res.status(404).json({ error: 'Connection target unauthorized or not found' });
      return;
    }

    const prefix = role === 'ADMIN' ? 'wp_admin_' : `wp_user_${userId}_`;
    const physicalName = `${prefix}${dbName}`;

    // Check for logical db conflicts
    const existing = await prisma.databaseMetadata.findFirst({
      where: { ownerId: userId, dbName }
    });
    if (existing) {
      res.status(400).json({ error: `Database "${dbName}" already exists in your workspace.` });
      return;
    }

    // Execute physical creation on target connection
    let connection: any;
    if (Number(connectionId) === 9999) {
      connection = await pool.getConnection();
    } else {
      connection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.dbUser,
        password: decrypt(dbConfig.dbPassword!),
        allowPublicKeyRetrieval: true,
      } as any);
    }

    try {
      await connection.query(`CREATE DATABASE \`${physicalName}\`;`);
    } catch (dbErr: any) {
      res.status(400).json({ error: `MySQL Error: ${dbErr.message}` });
      return;
    } finally {
      if (Number(connectionId) === 9999) {
        connection.release();
      } else {
        await connection.end();
      }
    }

    // Register logical metadata mapping
    const dbMeta = await prisma.databaseMetadata.create({
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
  } catch (error: any) {
    console.error('Error creating database:', error);
    res.status(500).json({ error: 'Failed to create database' });
  }
};

export const deleteDatabase = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const dbMeta = await prisma.databaseMetadata.findUnique({
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

    const dbConfig = await getAuthorizedConnection(Number(connectionId), userId, role);
    if (!dbConfig) {
      res.status(404).json({ error: 'Connection target unauthorized or not found' });
      return;
    }

    // Execute physical deletion
    let connection: any;
    if (Number(connectionId) === 9999) {
      connection = await pool.getConnection();
    } else {
      connection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.dbUser,
        password: decrypt(dbConfig.dbPassword!),
        allowPublicKeyRetrieval: true,
      } as any);
    }

    try {
      await connection.query(`DROP DATABASE \`${dbMeta.physicalName}\`;`);
    } catch (dbErr: any) {
      console.warn(`Physical database drop warning: ${dbErr.message}`);
    } finally {
      if (Number(connectionId) === 9999) {
        connection.release();
      } else {
        await connection.end();
      }
    }

    // Cascade delete related logical tables
    const prefixPattern = dbMeta.ownerRole === 'ADMIN' ? 'db_admin_' : `db_user_${dbMeta.ownerId}_`;
    await prisma.tableMetadata.deleteMany({
      where: {
        ownerId: dbMeta.ownerId,
        physicalName: {
          startsWith: prefixPattern
        }
      }
    });

    // Delete logical metadata record
    await prisma.databaseMetadata.delete({
      where: { id: dbMeta.id }
    });

    res.json({ success: true, message: `Database "${dbMeta.dbName}" deleted successfully.` });
  } catch (error) {
    console.error('Error deleting database:', error);
    res.status(500).json({ error: 'Failed to delete database' });
  }
};

export const getDatabasesMetadata = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const databases = await prisma.databaseMetadata.findMany({
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch database metadata' });
  }
};

// Helper for schema modifications
const executeOnConnection = async (connectionId: number, userId: number, role: string, query: string) => {
  let connection: any;
  let isSharedPool = false;
  const dbConfig = await getAuthorizedConnection(connectionId, userId, role);
  if (!dbConfig) throw new Error('Unauthorized database connection target');

  if (connectionId === 9999) {
    isSharedPool = true;
    connection = await pool.getConnection();
  } else {
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.dbUser,
      password: decrypt(dbConfig.dbPassword!),
      database: dbConfig.databaseName,
      allowPublicKeyRetrieval: true,
    } as any);
  }

  try {
    const [results] = await connection.query(query);
    return results;
  } finally {
    if (isSharedPool) {
      connection.release();
    } else {
      await connection.end();
    }
  }
};

// Rename Table
export const renameTable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role || 'USER';
    const { connectionId, tableName } = req.params;
    const { newTableName } = req.body;
    if (!userId || !tableName || !newTableName) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    const allowedTables = await getAllowedTables(userId, role, false);
    const physicalOld = resolveTable(tableName as string, allowedTables, userId, role);
    if (!physicalOld) {
      res.status(404).json({ error: 'Table not found or unauthorized' });
      return;
    }
    const prefix = `db_user_${userId}_`;
    const physicalNew = `${prefix}${newTableName}`;

    const existing = await prisma.tableMetadata.findFirst({
      where: { ownerId: userId, tableName: newTableName }
    });
    if (existing) {
      res.status(400).json({ error: `Table "${newTableName}" already exists.` });
      return;
    }

    await executeOnConnection(Number(connectionId), userId, role, `RENAME TABLE \`${physicalOld}\` TO \`${physicalNew}\`;`);

    const meta = await prisma.tableMetadata.findFirst({
      where: { ownerId: userId, tableName: tableName as string }
    });
    if (meta) {
      await prisma.tableMetadata.update({
        where: { id: meta.id },
        data: { tableName: newTableName, physicalName: physicalNew }
      });
    }
    const dataset = await prisma.dataset.findFirst({
      where: { userId, tableName: tableName as string }
    });
    if (dataset) {
      await prisma.dataset.update({
        where: { id: dataset.id },
        data: { tableName: newTableName }
      });
    }

    res.json({ success: true, message: 'Table renamed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Delete Table
export const deleteTable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role || 'USER';
    const { connectionId, tableName } = req.params;
    if (!userId || !tableName) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    const allowedTables = await getAllowedTables(userId, role, false);
    const physicalName = resolveTable(tableName as string, allowedTables, userId, role);
    if (!physicalName) {
      res.status(404).json({ error: 'Table not found or unauthorized' });
      return;
    }

    await executeOnConnection(Number(connectionId), userId, role, `DROP TABLE \`${physicalName}\`;`);

    await prisma.tableMetadata.deleteMany({
      where: { ownerId: userId, tableName: tableName as string }
    });
    await prisma.dataset.deleteMany({
      where: { userId, tableName: tableName as string }
    });

    res.json({ success: true, message: 'Table deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Rename Column
export const renameColumn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role || 'USER';
    const { connectionId, tableName, columnName } = req.params;
    const { newColumnName, dataType } = req.body;
    if (!userId || !tableName || !columnName || !newColumnName) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    const allowedTables = await getAllowedTables(userId, role, false);
    const physicalTable = resolveTable(tableName as string, allowedTables, userId, role);
    if (!physicalTable) {
      res.status(404).json({ error: 'Table not found or unauthorized' });
      return;
    }

    const typeStr = dataType || 'VARCHAR(255)';
    await executeOnConnection(Number(connectionId), userId, role, `ALTER TABLE \`${physicalTable}\` CHANGE COLUMN \`${columnName}\` \`${newColumnName}\` ${typeStr};`);

    res.json({ success: true, message: 'Column renamed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Delete Column
export const deleteColumn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role || 'USER';
    const { connectionId, tableName, columnName } = req.params;
    if (!userId || !tableName || !columnName) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    const allowedTables = await getAllowedTables(userId, role, false);
    const physicalTable = resolveTable(tableName as string, allowedTables, userId, role);
    if (!physicalTable) {
      res.status(404).json({ error: 'Table not found or unauthorized' });
      return;
    }

    await executeOnConnection(Number(connectionId), userId, role, `ALTER TABLE \`${physicalTable}\` DROP COLUMN \`${columnName}\`;`);

    res.json({ success: true, message: 'Column deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Add Column
export const addColumn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role || 'USER';
    const { connectionId, tableName } = req.params;
    const { columnName, dataType, isNullable } = req.body;
    if (!userId || !tableName || !columnName || !dataType) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    const allowedTables = await getAllowedTables(userId, role, false);
    const physicalTable = resolveTable(tableName as string, allowedTables, userId, role);
    if (!physicalTable) {
      res.status(404).json({ error: 'Table not found or unauthorized' });
      return;
    }

    const nullableStr = isNullable ? 'NULL' : 'NOT NULL';
    await executeOnConnection(Number(connectionId), userId, role, `ALTER TABLE \`${physicalTable}\` ADD COLUMN \`${columnName}\` ${dataType} ${nullableStr};`);

    res.json({ success: true, message: 'Column added successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Export Schema as SQL script
export const exportSchema = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role || 'USER';
    const { connectionId } = req.params;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const dbConfig = await getAuthorizedConnection(Number(connectionId), userId, role);
    if (!dbConfig) {
      res.status(404).json({ error: 'Connection not found or unauthorized' });
      return;
    }

    const allowedTables = await getAllowedTables(userId, role, false);
    let sqlScript = `-- Database Schema Export for ${dbConfig.name}\n`;
    sqlScript += `-- Exported on ${new Date().toLocaleString()}\n\n`;

    let connection: any;
    let isSharedPool = false;
    if (Number(connectionId) === 9999) {
      isSharedPool = true;
      connection = await pool.getConnection();
    } else {
      connection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.dbUser,
        password: decrypt(dbConfig.dbPassword!),
        database: dbConfig.databaseName,
        allowPublicKeyRetrieval: true,
      } as any);
    }

    try {
      for (const table of allowedTables) {
        const [ddlResults] = await connection.query(`SHOW CREATE TABLE \`${table.physicalName}\``) as any[];
        if (ddlResults && ddlResults[0]) {
          const rawDdl = ddlResults[0]['Create Table'];
          const logicalDdl = rawDdl.replace(new RegExp(`\`?${table.physicalName}\`?`, 'g'), `\`${table.tableName}\``);
          sqlScript += `${logicalDdl};\n\n`;
        }
      }
    } finally {
      if (isSharedPool) {
        connection.release();
      } else {
        await connection.end();
      }
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=schema_export_${dbConfig.databaseName || 'db'}.sql`);
    res.send(sqlScript);
  } catch (err: any) {
    res.status(500).json({ error: `Export failed: ${err.message}` });
  }
};
