import { Request, Response } from 'express';
import { getAICompletion } from '../services/aiProvider';
import mysql from 'mysql2/promise';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { decrypt } from '../utils/crypto';
import { checkQueryPermissions, detectDangerousQuery } from '../utils/queryValidator';

const fetchSchemaString = async (dbConfig: any): Promise<string> => {
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

  let schemaStr = '';

  for (const table of tables) {
    const tableName = table.TABLE_NAME;
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `, [dbConfig.databaseName, tableName]) as any[];

    schemaStr += `Table: ${tableName}\nColumns:\n`;
    for (const col of columns) {
      schemaStr += `- ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'Nullable' : 'Not Null'}${col.COLUMN_KEY === 'PRI' ? ', Primary Key' : ''})\n`;
    }
    schemaStr += '\n';
  }

  await connection.end();
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
    const { prompt, connectionId } = req.body;
    const userId = req.user?.id;

    if (!userId || !connectionId || !prompt) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    const dbConfig = await prisma.databaseConnection.findFirst({
      where: { id: Number(connectionId), userId },
    });

    if (!dbConfig) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    const schemaStr = await fetchSchemaString(dbConfig);

    const systemPrompt = `You are an expert SQL Generator. Given the following MySQL database schema, generate a valid SQL query to answer the user's request. 
IMPORTANT: Return ONLY the raw SQL query. Do not include markdown formatting (like \`\`\`sql), explanations, or any other text.
Schema:
${schemaStr}`;

    const responseContent = await getAICompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]);

    let generatedSql = responseContent.trim();
    // Clean up markdown if the model still outputs it
    if (generatedSql.startsWith('```sql')) {
      generatedSql = generatedSql.replace(/^```sql\n/, '').replace(/\n```$/, '');
    } else if (generatedSql.startsWith('```')) {
      generatedSql = generatedSql.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    // Determine risk of generated query
    const risk = await classifyQueryRisk(generatedSql);

    res.json({ sql: generatedSql, risk });
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

    // If USER, block dangerous queries completely
    if (role === 'USER') {
      const isDangerous = detectDangerousQuery(sql).isDangerous;
      if (isDangerous) {
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
        res.status(403).json({ error: 'Blocked: Users with USER role are strictly prohibited from executing dangerous schema modifications or mass deletes/updates.' });
        return;
      }
    }

    // 1. Check query permissions per user role
    const permCheck = checkQueryPermissions(role, sql);
    if (!permCheck.allowed) {
      // Log BLOCKED attempt in audit logs
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

    // 2. Perform AI risk classification
    const risk = await classifyQueryRisk(sql);

    // If query is HIGH or CRITICAL risk, requires confirmation unless it's a dryRun
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

    // Find database configuration
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

    const startTime = Date.now();
    let results: any;
    let status = 'SUCCESS';
    let rowsAffected: number | null = null;

    try {
      if (dryRun) {
        // Run inside transaction and rollback immediately
        await connection.beginTransaction();
        try {
          const [dryResults] = await connection.query(sql);
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
        const [execResults] = await connection.query(sql);
        results = execResults;
        if (results && typeof results === 'object') {
          if ('affectedRows' in results) {
            rowsAffected = results.affectedRows;
          } else if (Array.isArray(results)) {
            rowsAffected = results.length;
          }
        }
      }
    } catch (dbError: any) {
      status = 'ERROR';
      results = { error: dbError.message };
    } finally {
      await connection.end();
    }

    const executionTimeMs = Date.now() - startTime;

    // Persist execution details (only for actual executions, not dry-runs)
    if (!dryRun) {
      await prisma.queryHistory.create({
        data: {
          userId,
          prompt: prompt || 'Direct execution',
          generatedSql: sql,
          executionTimeMs,
          status,
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
