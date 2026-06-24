import { Request, Response } from 'express';
import mysql from 'mysql2/promise';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { encrypt, decrypt } from '../utils/crypto';

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

    const connections = await prisma.databaseConnection.findMany({
      where: { userId },
      select: { id: true, name: true, host: true, port: true, databaseName: true, createdAt: true },
    });

    res.json({ connections });
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
    const { connectionId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const dbConfig = await prisma.databaseConnection.findFirst({
      where: { id: Number(connectionId), userId },
    });

    if (!dbConfig) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.dbUser,
      password: decrypt(dbConfig.dbPassword),
      database: dbConfig.databaseName,
      allowPublicKeyRetrieval: true,
    } as any);

    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
    `, [dbConfig.databaseName]) as any[];

    const schema: any = {};

    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [dbConfig.databaseName, tableName]) as any[];

      schema[tableName] = columns;
    }

    await connection.end();

    res.json({ schema });
  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({ error: 'Failed to fetch schema' });
  }
};
