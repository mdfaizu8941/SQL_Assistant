import { Request, Response } from 'express';
import { getAICompletion } from '../services/aiProvider';
import mysql from 'mysql2/promise';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { decrypt } from '../utils/crypto';
import { checkQueryPermissions, detectDangerousQuery } from '../utils/queryValidator';
import pool from '../utils/dbPool';
import {
  getAllowedTables,
  resolveTable,
  rewriteQuery,
  rewriteCreateTable,
  getDropTableLogicalName,
  getAuthorizedConnection,
  getAllowedDatabases,
  resolveDatabase,
  rewriteDatabaseQueries,
  rewriteCreateDatabase,
  getDropDatabaseLogicalName,
  DatabaseMetadata,
  TableMetadata
} from '../utils/queryRouter';

const fetchSchemaString = async (
  userId: number,
  role: string,
  connectionId: number,
  dbConfig: any
): Promise<string> => {
  let connection: any;
  let databaseName: string;
  let isSharedPool = false;

  if (connectionId === 9999) {
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
      password: decrypt(dbConfig.dbPassword),
      database: dbConfig.databaseName,
      allowPublicKeyRetrieval: true,
    } as any);
    databaseName = dbConfig.databaseName;
  }

  // Fetch allowed tables (browse-only, i.e., forExecution = false)
  const allowedTables = await getAllowedTables(userId, role, false);
  let schemaStr = '';

  for (const table of allowedTables) {
    const physicalName = table.physicalName;
    const logicalName = table.tableName;

    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `, [databaseName, physicalName]) as any[];

    schemaStr += `Table: ${logicalName}\nColumns:\n`;
    for (const col of columns) {
      schemaStr += `- ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'Nullable' : 'Not Null'}${col.COLUMN_KEY === 'PRI' ? ', Primary Key' : ''})\n`;
    }
    schemaStr += '\n';
  }

  // Fetch relationships (foreign keys)
  try {
    const [foreignKeys] = await connection.query(`
      SELECT 
        TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM 
        INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE 
        TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [databaseName]) as any[];

    const relationships: string[] = [];
    for (const fk of foreignKeys) {
      const matchTable = allowedTables.find(t => t.physicalName === fk.TABLE_NAME);
      const matchRefTable = allowedTables.find(t => t.physicalName === fk.REFERENCED_TABLE_NAME);
      if (matchTable && matchRefTable) {
        relationships.push(`- Table "${matchTable.tableName}" (column "${fk.COLUMN_NAME}") references Table "${matchRefTable.tableName}" (column "${fk.REFERENCED_COLUMN_NAME}")`);
      }
    }

    if (relationships.length > 0) {
      schemaStr += `Relationships:\n${relationships.join('\n')}\n\n`;
    }
  } catch (fkErr) {
    console.warn('Could not retrieve table relationships for prompt context:', fkErr);
  }

  if (isSharedPool) {
    connection.release();
  } else {
    await connection.end();
  }

  return schemaStr;
};

/**
 * Classifies the query risk using Gemini AI safety layer.
 */
export const classifyQueryRisk = async (
  sqlText: string
): Promise<{ riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; reasoning: string }> => {
  const dangerous = detectDangerousQuery(sqlText);
  try {
    const systemPrompt = `You are a database security assistant. Analyze the following SQL query for risk of data loss, database structural change, or performance issues.
Classify the risk level as one of: LOW, MEDIUM, HIGH, CRITICAL.
Provide a brief, single-sentence reasoning for the classification.
Format your response strictly as JSON:
{
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "reasoning": "the reason here"
}
Query: ${sqlText}`;

    const content = await getAICompletion([
      { role: 'system', content: systemPrompt }
    ]);

    let parsed = { riskLevel: 'LOW', reasoning: '' };
    try {
      const cleanJson = content.trim().replace(/^```json\s*/, '').replace(/```$/, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (err) {
      parsed = {
        riskLevel: dangerous.isDangerous ? 'HIGH' : 'LOW',
        reasoning: dangerous.warning || 'Failed to parse AI response. Utilizing heuristics.'
      };
    }

    // Force high or critical risk if the static rules engine flagged it
    if (dangerous.isDangerous && parsed.riskLevel !== 'HIGH' && parsed.riskLevel !== 'CRITICAL') {
      parsed.riskLevel = 'HIGH';
      parsed.reasoning = dangerous.warning || parsed.reasoning;
    }

    return parsed as any;
  } catch (error) {
    console.error('Error classifying query:', error);
    return {
      riskLevel: dangerous.isDangerous ? 'HIGH' : 'LOW',
      reasoning: dangerous.warning || 'AI analysis unavailable, using rules engine.'
    };
  }
};

export const generateQuery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { prompt, connectionId, history } = req.body;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || !connectionId || !prompt || !role) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    let dbConfig = null;
    if (Number(connectionId) !== 9999) {
      dbConfig = await getAuthorizedConnection(Number(connectionId), userId, role);

      if (!dbConfig) {
        res.status(404).json({ error: 'Connection not found or unauthorized' });
        return;
      }
    }

    const schemaStr = await fetchSchemaString(userId, role, Number(connectionId), dbConfig);

    const systemPrompt = `You are a highly capable, ChatGPT-like AI SQL Assistant for a MySQL database.
The database current logical schema and relationships are described below:
${schemaStr}

Return a valid JSON object matching this TypeScript interface:
interface AIResponse {
  message: string;      // A friendly, helpful chat message answering the query, explaining the expected output, and listing any potential side effects.
  sql: string;          // The generated MySQL query (MUST be valid MySQL matching the schema). Can create queries, views, indexes, stored procedures, or triggers.
  explanation: string;  // A detailed explanation of how the query works, explaining every SQL clause and function used.
  optimization: string; // Performance optimization suggestions, index suggestions (e.g. "Create index on table(column)"), or query efficiency advice.
  followUps: string[];  // 3-4 highly relevant, context-aware suggested follow-up questions/prompts the user might ask next.
}

Guidelines & Features to Support:
1. **Natural Language to SQL**: Translate general user request queries into precise, schema-valid MySQL.
2. **SQL to Natural Language / Fix incorrect SQL**: If the user provides a broken SQL query, explain the bug and write the corrected version.
3. **Clause-Level Explanations**: In "explanation", explain what every SELECT, JOIN, GROUP BY, WHERE, and HAVING clause does.
4. **Explain Expected Output & Side Effects**: In "message", explain what columns and formats the query returns, and what data changes occur.
5. **Warnings for Destructive Queries**: If generating an UPDATE, DELETE, DROP, ALTER, TRUNCATE, or INSERT query:
   - Provide a clear, bold WARNING inside "message" explaining the destructive side effects.
   - Explain why warning actions are dangerous (e.g. data loss, permanent schema modifications).
6. **Advanced SQL Generation**: Support generating Views, Stored Procedures, Triggers, Sample Data generation, CREATE TABLE and INSERT statements when prompted.
7. **No guessing**: Never guess table or column names. Always use the actual schema tables and columns provided above.
8. **Format**: Respond strictly with JSON. Do not wrap in markdown code block (like \`\`\`json).`;

    const messagesPayload: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messagesPayload.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.role === 'user' ? msg.content : `${msg.content}${msg.sql ? `\nGenerated SQL: ${msg.sql}` : ''}`
        });
      }
    }

    messagesPayload.push({ role: 'user', content: prompt });

    const responseContent = await getAICompletion(messagesPayload);

    let parsed: any;
    try {
      const cleanJson = responseContent.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (err) {
      // Manual extraction fallback
      let extractedSql = '';
      const sqlMatch = responseContent.match(/SELECT[\s\S]*?;/i);
      if (sqlMatch) {
        extractedSql = sqlMatch[0];
      }
      parsed = {
        message: responseContent,
        sql: extractedSql,
        explanation: 'AI generated response could not be parsed as structured JSON. Raw text is shown.',
        optimization: 'No optimizations available.',
        followUps: ['Explain query', 'Optimize query']
      };
    }

    let risk = { riskLevel: 'LOW', reasoning: '' };
    if (parsed.sql) {
      risk = await classifyQueryRisk(parsed.sql);
    }

    res.json({
      message: parsed.message || 'Here is the query you requested:',
      sql: parsed.sql || '',
      explanation: parsed.explanation || '',
      optimization: parsed.optimization || '',
      followUps: parsed.followUps || [],
      risk
    });
  } catch (error) {
    console.error('Error generating query:', error);
    res.status(500).json({ error: 'Failed to generate query' });
  }
};

export const explainQuery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sql } = req.body;
    
    if (!sql) {
      res.status(400).json({ error: 'SQL query is required' });
      return;
    }

    const systemPrompt = `You are a Database Assistant. Explain the following SQL query in simple English so a non-technical user can understand what it does. Keep it concise.
Query: ${sql}`;

    const responseContent = await getAICompletion([
      { role: 'system', content: systemPrompt }
    ]);

    res.json({ explanation: responseContent.trim() });
  } catch (error) {
    console.error('Error explaining query:', error);
    res.status(500).json({ error: 'Failed to explain query' });
  }
};

export const validateQuery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sql } = req.body;
    if (!sql) {
      res.status(400).json({ error: 'SQL query is required' });
      return;
    }
    const risk = await classifyQueryRisk(sql);
    res.json({ risk });
  } catch (error) {
    console.error('Error validating query:', error);
    res.status(500).json({ error: 'Failed to validate query' });
  }
};

export const executeQuery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sql, connectionId, prompt, dryRun, confirmed } = req.body;
    const userId = req.user?.id;
    const role = req.user?.role;
    const ipAddress = req.ip || req.socket.remoteAddress || null;

    if (!userId || !connectionId || !sql || !role) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    const normalizedSql = sql.trim().replace(/\s+/g, ' ');
    const lowerSql = normalizedSql.toLowerCase();

    // 1. Block INFORMATION_SCHEMA direct queries
    if (lowerSql.includes('information_schema')) {
      res.status(403).json({ error: 'Access Restricted: Directly querying INFORMATION_SCHEMA is prohibited.' });
      return;
    }

    // 2. Intercept and mock SHOW TABLES
    if (lowerSql === 'show tables' || lowerSql === 'show tables;') {
      const allowedTables = await getAllowedTables(userId, role, false); // Browse-only tables
      const dbUrl = process.env.DATABASE_URL || '';
      let databaseName = 'sql_assistant';
      try {
        const parsedUrl = new URL(dbUrl);
        databaseName = parsedUrl.pathname.replace(/^\//, '') || 'sql_assistant';
      } catch (err) {}
      
      const columnName = `Tables_in_${databaseName}`;
      const results = allowedTables.map(t => ({ [columnName]: t.tableName }));
      
      res.json({
        success: true,
        results,
        executionTimeMs: 0,
        dryRun: false,
        rowsAffected: results.length,
        riskLevel: 'LOW',
        reasoning: 'SHOW TABLES intercepted and filtered by metadata schema rules.'
      });
      return;
    }

    // 3. Fetch allowed tables for execution
    const allowedTables = await getAllowedTables(userId, role, true); // Execution-allowed tables (includes Admin)

    // 4. Block non-admin writes to Admin tables
    const isWrite = /\b(insert|update|delete|drop|alter|truncate|create)\b/.test(lowerSql);
    if (isWrite && role !== 'ADMIN') {
      const referencedAdminTable = allowedTables.find(t => {
        const regex = new RegExp(`\\b${t.tableName}\\b`, 'i');
        return t.ownerRole === 'ADMIN' && regex.test(lowerSql);
      });
      
      if (referencedAdminTable) {
        res.status(403).json({
          error: `Access Denied: Non-admin users are strictly prohibited from writing or modifying Admin master tables (${referencedAdminTable.tableName}).`
        });
        return;
      }
    }

    // If USER and not dryRun, enforce basic security block on dangerous queries
    if (role === 'USER') {
      const isDangerous = detectDangerousQuery(sql).isDangerous;
      if (isDangerous) {
        // Only allow dropping/truncating if it is their own table name
        const isOwnTableWrite = allowedTables.some(t => {
          const regex = new RegExp(`\\b${t.tableName}\\b`, 'i');
          return t.ownerId === userId && t.ownerRole === 'USER' && regex.test(lowerSql);
        });

        // Only allow dropping/truncating if it is their own database name
        const { getAllowedDatabases } = require('../utils/queryRouter');
        const allowedDbs = await getAllowedDatabases(userId, role, true);
        const isOwnDatabaseDrop = allowedDbs.some((d: any) => {
          const regex = new RegExp(`\\b${d.dbName}\\b`, 'i');
          return d.ownerId === userId && d.ownerRole === 'USER' && regex.test(lowerSql);
        });
        
        // If it's a CREATE TABLE, that's fine
        const isCreateTable = /\bcreate\s+table\b/i.test(lowerSql);

        if (!isOwnTableWrite && !isCreateTable && !isOwnDatabaseDrop) {
          await prisma.auditLog.create({
            data: {
              userId,
              email: req.user?.email || '',
              role,
              connectionId: Number(connectionId),
              query: sql,
              ipAddress,
              status: 'BLOCKED',
              rowsAffected: 0,
              ownerId: userId,
              ownerRole: role,
              visibility: 'PRIVATE',
              createdBy: req.user?.email || 'Unknown'
            },
          });
          res.status(403).json({ error: 'Blocked: Users with USER role are strictly prohibited from executing dangerous schema modifications or mass deletes/updates on non-owned tables/databases.' });
          return;
        }
      }
    }

    // 5. Check general permissions
    const permCheck = checkQueryPermissions(role, sql);
    if (!permCheck.allowed) {
      await prisma.auditLog.create({
        data: {
          userId,
          email: req.user?.email || '',
          role,
          connectionId: Number(connectionId),
          query: sql,
          ipAddress,
          status: 'BLOCKED',
          rowsAffected: 0,
        },
      });
      res.status(403).json({ error: permCheck.reason || 'RBAC validation failed.' });
      return;
    }

    // 6. Risk classification
    const risk = await classifyQueryRisk(sql);
    if ((risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL') && !confirmed && !dryRun) {
      res.status(200).json({
        success: false,
        requiresConfirmation: true,
        riskLevel: risk.riskLevel,
        reasoning: risk.reasoning,
        sql,
      });
      return;
    }

    // 7. Route and execute
    let connection: any;
    let isSharedPool = false;
    let databaseName = '';

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

    // Fetch allowed databases
    const allowedDbs = await getAllowedDatabases(userId, role, true);
    
    // Filter allowedTables to only include tables physically present in the connection's active database
    const [showTablesResult] = await connection.query('SHOW TABLES') as any[];
    const physicalTableNames = showTablesResult.map((r: any) => Object.values(r)[0] as string);
    const activeAllowedTables = allowedTables.filter(t => physicalTableNames.includes(t.physicalName));

    // Check if query is CREATE DATABASE or DROP DATABASE
    let ddlCreateDbResult = rewriteCreateDatabase(sql, userId, role);
    let ddlDropDbLogicalName: string | null = null;
    if (!ddlCreateDbResult) {
      ddlDropDbLogicalName = getDropDatabaseLogicalName(sql, allowedDbs);
    }

    // Rewrite query table names and database namespaces
    let rewrittenSql = sql;
    let ddlCreateResult = null;
    let ddlDropLogicalName: string | null = null;

    if (ddlCreateDbResult) {
      rewrittenSql = ddlCreateDbResult.rewrittenSql;
    } else {
      // First rewrite USE statement and dbName.tableName qualifiers
      rewrittenSql = rewriteDatabaseQueries(sql, allowedDbs, userId, role);
      
      ddlCreateResult = rewriteCreateTable(rewrittenSql, userId, role);
      if (ddlCreateResult) {
        rewrittenSql = ddlCreateResult.rewrittenSql;
        rewrittenSql = rewriteQuery(rewrittenSql, activeAllowedTables, userId, role);
      } else {
        ddlDropLogicalName = getDropTableLogicalName(rewrittenSql, activeAllowedTables);
        rewrittenSql = rewriteQuery(rewrittenSql, activeAllowedTables, userId, role);
      }
    }

    const startTime = Date.now();
    let results: any;
    let status = 'SUCCESS';
    let rowsAffected: number | null = null;

    try {
      if (dryRun) {
        await connection.beginTransaction();
        try {
          const [dryResults] = await connection.query(rewrittenSql);
          results = dryResults;
          if (results && typeof results === 'object') {
            if ('affectedRows' in results) {
              rowsAffected = results.affectedRows;
            } else if (Array.isArray(results)) {
              rowsAffected = results.length;
            }
          }
        } finally {
          await connection.rollback();
        }
      } else {
        const [execResults] = await connection.query(rewrittenSql);
        results = execResults;
        if (results && typeof results === 'object') {
          if ('affectedRows' in results) {
            rowsAffected = results.affectedRows;
          } else if (Array.isArray(results)) {
            rowsAffected = results.length;
          }
        }

        // Post-execution DDL metadata sync
        if (status === 'SUCCESS') {
          if (ddlCreateDbResult) {
            const { logicalName, physicalName } = ddlCreateDbResult;
            const existing = await prisma.databaseMetadata.findFirst({
              where: { ownerId: userId, dbName: logicalName }
            });
            if (!existing) {
              await prisma.databaseMetadata.create({
                data: {
                  dbName: logicalName,
                  physicalName,
                  ownerId: userId,
                  ownerRole: role,
                  visibility: role === 'ADMIN' ? 'SHARED' : 'PRIVATE',
                  createdBy: req.user?.email || 'Unknown'
                }
              });
            }
          } else if (ddlDropDbLogicalName) {
            const droppedDb = allowedDbs.find(d => d.dbName.toLowerCase() === ddlDropDbLogicalName!.toLowerCase());
            if (droppedDb) {
              await prisma.databaseMetadata.delete({
                where: { id: droppedDb.id }
              });
            }
          }

          if (ddlCreateResult) {
            const { logicalName, physicalName } = ddlCreateResult;
            
            // Verify physical existence
            const [showTablesResult] = await connection.query('SHOW TABLES') as any[];
            const physicalTableNames = showTablesResult.map((r: any) => Object.values(r)[0] as string);
            if (!physicalTableNames.includes(physicalName)) {
              throw new Error(`Physical table creation failed in MySQL connection.`);
            }

            const existing = await prisma.tableMetadata.findFirst({
              where: { ownerId: userId, tableName: logicalName }
            });
            if (!existing) {
              await prisma.tableMetadata.create({
                data: {
                  tableName: logicalName,
                  physicalName,
                  ownerId: userId,
                  ownerRole: role,
                  visibility: role === 'ADMIN' ? 'SHARED' : 'PRIVATE',
                  createdBy: req.user?.email || 'Unknown'
                }
              });
            }
          } else if (ddlDropLogicalName) {
            const droppedTable = allowedTables.find(t => t.tableName.toLowerCase() === ddlDropLogicalName!.toLowerCase());
            if (droppedTable) {
              await prisma.tableMetadata.delete({
                where: { id: droppedTable.id }
              });
            }
          }
        }
      }
    } catch (dbError: any) {
      status = 'ERROR';
      results = { error: dbError.message };
    } finally {
      if (isSharedPool) {
        connection.release();
      } else {
        await connection.end();
      }
    }

    const executionTimeMs = Date.now() - startTime;

    if (!dryRun) {
      const resultCount = results && Array.isArray(results) ? results.length : (rowsAffected || 0);

      await prisma.queryHistory.create({
        data: {
          userId,
          prompt: prompt || 'Direct execution',
          generatedSql: sql,
          executionTimeMs,
          status,
          ownerId: userId,
          ownerRole: role,
          visibility: 'PRIVATE',
          createdBy: req.user?.email || 'Unknown',
          isAiGenerated: !!prompt,
          databaseUsed: databaseName,
          resultCount
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          email: req.user?.email || '',
          role,
          connectionId: Number(connectionId),
          query: sql,
          ipAddress,
          status,
          rowsAffected: status === 'ERROR' ? 0 : rowsAffected,
          ownerId: userId,
          ownerRole: role,
          visibility: 'PRIVATE',
          createdBy: req.user?.email || 'Unknown'
        },
      });
    }

    if (status === 'ERROR') {
      res.status(400).json({ success: false, ...results });
    } else {
      res.json({
        success: true,
        results,
        executionTimeMs,
        dryRun,
        rowsAffected,
        riskLevel: risk.riskLevel,
        reasoning: risk.reasoning,
      });
    }
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).json({ error: 'Failed to execute query' });
  }
};

// Generate Schema DDL using Natural Language
export const generateSchema = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const systemPrompt = `You are a Senior Database Architect. Generate a complete MySQL database schema based on the user's prompt.
The database schema must be cohesive, correct, and self-contained.
Return a valid JSON object matching this TypeScript interface:
interface SchemaResponse {
  explanation: string;      // A description of the database design, tables, and relationship model.
  sql: string;              // The complete SQL script containing CREATE DATABASE, CREATE TABLE, ALTER TABLE (for foreign keys), CREATE INDEX, and sample INSERT INTO statements.
  proposedTables: {
    name: string;
    columns: { name: string; type: string; details: string }[];
  }[];
}
Respond strictly with JSON. Do not wrap in markdown code block (like \`\`\`json).`;

    const responseContent = await getAICompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]);

    let parsed: any;
    try {
      const cleanJson = responseContent.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (err) {
      throw new Error(`Failed to parse AI schema response: ${responseContent}`);
    }

    res.json(parsed);
  } catch (error: any) {
    console.error('Error generating schema:', error);
    res.status(500).json({ error: error.message || 'Failed to generate schema' });
  }
};

// Execute schema DDL statements and synchronize database/table metadatas
export const executeSchema = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role || 'USER';
    const { sql, connectionId } = req.body;

    if (!userId || !connectionId || !sql) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    const dbConfig = await getAuthorizedConnection(Number(connectionId), userId, role);
    if (!dbConfig) {
      res.status(404).json({ error: 'Connection target connectionId is unauthorized or not found' });
      return;
    }

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
        multipleStatements: true, // Enable multiple statements
        allowPublicKeyRetrieval: true,
      } as any);
    }

    // Split statements by semicolon to run DDLs sequentially and parse physical prefixes
    const statements = sql
      .split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    const executedSqls: string[] = [];
    const createdTables: { logicalName: string; physicalName: string }[] = [];
    const createdDbs: { logicalName: string; physicalName: string }[] = [];

    try {
      const allowedDbs = await getAllowedDatabases(userId, role, true);
      const allowedTables = await getAllowedTables(userId, role, false);

      const dynamicDbs: DatabaseMetadata[] = [...allowedDbs];
      const dynamicTables: TableMetadata[] = [...allowedTables];

      for (const statement of statements) {
        let rewrittenStatement = statement;

        // Rewrite USE statements and database qualifiers
        rewrittenStatement = rewriteDatabaseQueries(rewrittenStatement, dynamicDbs, userId, role);
        // Rewrite logical table names to physical table names
        rewrittenStatement = rewriteQuery(rewrittenStatement, dynamicTables, userId, role);

        // Check if database create DDL
        const createDbResult = rewriteCreateDatabase(rewrittenStatement, userId, role);
        if (createDbResult) {
          rewrittenStatement = createDbResult.rewrittenSql;
          createdDbs.push({ logicalName: createDbResult.logicalName, physicalName: createDbResult.physicalName });
          
          await connection.query(rewrittenStatement);
          executedSqls.push(rewrittenStatement);

          if (!dynamicDbs.some(d => d.dbName.toLowerCase() === createDbResult.logicalName.toLowerCase())) {
            dynamicDbs.push({
              id: 0,
              dbName: createDbResult.logicalName,
              physicalName: createDbResult.physicalName,
              ownerId: userId,
              ownerRole: role,
              visibility: 'PRIVATE',
              createdAt: new Date()
            });
          }
        } else {
          // Check if table create DDL
          const createTableResult = rewriteCreateTable(rewrittenStatement, userId, role);
          if (createTableResult) {
            rewrittenStatement = createTableResult.rewrittenSql;
            createdTables.push({ logicalName: createTableResult.logicalName, physicalName: createTableResult.physicalName });
            
            await connection.query(rewrittenStatement);
            executedSqls.push(rewrittenStatement);

            // Verify physical existence
            const [showTablesResult] = await connection.query('SHOW TABLES') as any[];
            const physicalTableNames = showTablesResult.map((r: any) => Object.values(r)[0] as string);
            if (!physicalTableNames.includes(createTableResult.physicalName)) {
              throw new Error(`Table "${createTableResult.logicalName}" was not successfully created physically in MySQL.`);
            }

            if (!dynamicTables.some(t => t.tableName.toLowerCase() === createTableResult.logicalName.toLowerCase())) {
              dynamicTables.push({
                id: 0,
                tableName: createTableResult.logicalName,
                physicalName: createTableResult.physicalName,
                ownerId: userId,
                ownerRole: role,
                visibility: 'PRIVATE',
                createdAt: new Date()
              });
            }
          } else {
            await connection.query(rewrittenStatement);
            executedSqls.push(rewrittenStatement);
          }
        }
      }

      // Sync logical database metadatas
      for (const dbInfo of createdDbs) {
        const existing = await prisma.databaseMetadata.findFirst({
          where: { ownerId: userId, dbName: dbInfo.logicalName }
        });
        if (!existing) {
          await prisma.databaseMetadata.create({
            data: {
              dbName: dbInfo.logicalName,
              physicalName: dbInfo.physicalName,
              ownerId: userId,
              ownerRole: role,
              visibility: 'PRIVATE',
              createdBy: req.user?.email || 'Unknown'
            }
          });
        }
      }

      // Sync logical table metadatas
      for (const tableInfo of createdTables) {
        const existing = await prisma.tableMetadata.findFirst({
          where: { ownerId: userId, tableName: tableInfo.logicalName }
        });
        if (!existing) {
          await prisma.tableMetadata.create({
            data: {
              tableName: tableInfo.logicalName,
              physicalName: tableInfo.physicalName,
              ownerId: userId,
              ownerRole: role,
              visibility: 'PRIVATE',
              createdBy: req.user?.email || 'Unknown'
            }
          });
        }
      }

      res.json({
        success: true,
        message: 'Schema successfully created and synchronized.',
        executedStatements: executedSqls.length
      });
    } catch (dbErr: any) {
      console.error('Database DDL execution error:', dbErr);
      res.status(400).json({ error: `Schema execution failed: ${dbErr.message}` });
    } finally {
      if (isSharedPool) {
        connection.release();
      } else {
        await connection.end();
      }
    }
  } catch (error: any) {
    console.error('Execute schema error:', error);
    res.status(500).json({ error: error.message || 'Failed to execute schema' });
  }
};
