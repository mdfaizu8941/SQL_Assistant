import prisma from './prisma';

export interface TableMetadata {
  id: number;
  tableName: string;
  physicalName: string;
  ownerId: number;
  ownerRole: string;
  visibility: string;
  createdBy?: string | null;
  createdAt: Date;
}

export interface DatabaseMetadata {
  id: number;
  dbName: string;
  physicalName: string;
  ownerId: number;
  ownerRole: string;
  visibility: string;
  createdBy?: string | null;
  createdAt: Date;
}

/**
 * Resolves whether a connection configuration is authorized for a specific user role.
 */
export async function getAuthorizedConnection(
  connectionId: number,
  userId: number,
  role?: string
): Promise<any> {
  if (Number(connectionId) === 9999) {
    return {
      id: 9999,
      name: 'Shared Database',
      host: 'localhost',
      port: 3306,
      databaseName: 'sql_assistant'
    };
  }

  // Resolve logical database configurations (IDs >= 100000)
  if (Number(connectionId) >= 100000) {
    const dbId = Number(connectionId) - 100000;
    const dbMeta = await prisma.databaseMetadata.findFirst({
      where: { id: dbId, ownerId: userId }
    });
    if (dbMeta) {
      const dbUrl = process.env.DATABASE_URL || '';
      let host = 'localhost';
      let port = 3306;
      let dbUser = 'root';
      let dbPassword = '';
      try {
        const parsedUrl = new URL(dbUrl);
        host = parsedUrl.hostname || 'localhost';
        port = parseInt(parsedUrl.port || '3306');
        dbUser = parsedUrl.username || 'root';
        dbPassword = decodeURIComponent(parsedUrl.password || '');
      } catch (err) {}

      const { encrypt } = require('./crypto');

      return {
        id: connectionId,
        name: dbMeta.dbName,
        host,
        port,
        dbUser,
        dbPassword: encrypt(dbPassword),
        databaseName: dbMeta.physicalName
      };
    }
  }

  return await prisma.databaseConnection.findFirst({
    where: { id: Number(connectionId), userId }
  });
}

/**
 * Fetches tables the user is authorized to access.
 */
export async function getAllowedTables(
  userId: number,
  role?: string,
  forExecution: boolean = false
): Promise<TableMetadata[]> {
  // USER - Own tables OR SHARED/PUBLIC tables
  return await prisma.tableMetadata.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { visibility: 'SHARED' },
        { visibility: 'PUBLIC' },
      ],
    },
  });
}

/**
 * Resolves a logical table name to its correct physical table name.
 */
export function resolveTable(
  logicalName: string,
  allowedTables: TableMetadata[],
  userId: number,
  role?: string
): string | null {
  const matches = allowedTables.filter(
    (t) => t.tableName.toLowerCase() === logicalName.toLowerCase()
  );
  if (matches.length === 0) return null;

  // Security isolation filter
  const allowedMatches = matches.filter(t => {
    return t.ownerId === userId || t.visibility === 'SHARED' || t.visibility === 'PUBLIC';
  });
  if (allowedMatches.length === 0) return null;

  const getPriority = (table: TableMetadata) => {
    const isOwn = table.ownerId === userId;
    if (isOwn) return 1;
    if (table.visibility === 'SHARED' || table.visibility === 'PUBLIC') return 2;
    return 3;
  };

  allowedMatches.sort((a, b) => getPriority(a) - getPriority(b));
  return allowedMatches[0].physicalName;
}

/**
 * Fetches databases the user is authorized to access.
 */
export async function getAllowedDatabases(
  userId: number,
  role?: string,
  forExecution: boolean = false
): Promise<DatabaseMetadata[]> {
  // USER - Own databases OR SHARED/PUBLIC databases
  return await prisma.databaseMetadata.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { visibility: 'SHARED' },
        { visibility: 'PUBLIC' },
      ],
    },
  });
}

/**
 * Resolves a logical database name to its correct physical database name.
 */
export function resolveDatabase(
  logicalDbName: string,
  allowedDbs: DatabaseMetadata[],
  userId: number,
  role?: string
): string | null {
  const matches = allowedDbs.filter(
    (d) => d.dbName.toLowerCase() === logicalDbName.toLowerCase()
  );
  if (matches.length === 0) return null;

  // Security isolation filter
  const allowedMatches = matches.filter(d => {
    return d.ownerId === userId || d.visibility === 'SHARED' || d.visibility === 'PUBLIC';
  });
  if (allowedMatches.length === 0) return null;

  const getPriority = (db: DatabaseMetadata) => {
    const isOwn = db.ownerId === userId;
    if (isOwn) return 1;
    if (db.visibility === 'SHARED' || db.visibility === 'PUBLIC') return 2;
    return 3;
  };

  allowedMatches.sort((a, b) => getPriority(a) - getPriority(b));
  return allowedMatches[0].physicalName;
}

/**
 * Temporarily extracts string literals to prevent replacement inside quote values.
 */
function cleanAndExtractLiterals(sql: string): { cleanedSql: string; literals: string[] } {
  const literals: string[] = [];
  const literalRegex = /(['"`])((?:\\.|[^\\])*?)\1/g;
  
  const cleanedSql = sql.replace(literalRegex, (match) => {
    literals.push(match);
    return `__LITERAL_${literals.length - 1}__`;
  });

  return { cleanedSql, literals };
}

/**
 * Restores string literals to the SQL query.
 */
function restoreLiterals(sql: string, literals: string[]): string {
  let restored = sql;
  for (let i = 0; i < literals.length; i++) {
    restored = restored.replace(`__LITERAL_${i}__`, () => literals[i]);
  }
  return restored;
}

/**
 * Rewrites database queries (USE statements and qualifiers).
 */
export function rewriteDatabaseQueries(
  sql: string,
  allowedDbs: DatabaseMetadata[],
  userId: number,
  role: string
): string {
  const sortedDbs = [...allowedDbs].sort((a, b) => b.dbName.length - a.dbName.length);
  const logicalDbNames = Array.from(new Set(sortedDbs.map((d) => d.dbName)));

  let { cleanedSql, literals } = cleanAndExtractLiterals(sql);

  // 1. Rewrite USE statements
  for (const dbName of logicalDbNames) {
    const physicalName = resolveDatabase(dbName, allowedDbs, userId, role);
    if (physicalName) {
      const useRegex = new RegExp(`\\buse\\s+([\`"']?)${dbName}\\1`, 'gi');
      cleanedSql = cleanedSql.replace(useRegex, `USE $1${physicalName}$1`);
    }
  }

  // 2. Rewrite database qualifiers (dbName.tableName -> physicalName.tableName)
  for (const dbName of logicalDbNames) {
    const physicalName = resolveDatabase(dbName, allowedDbs, userId, role);
    if (physicalName) {
      const qualifierRegex = new RegExp(`\\b${dbName}\\.`, 'gi');
      cleanedSql = cleanedSql.replace(qualifierRegex, `${physicalName}.`);
    }
  }

  return restoreLiterals(cleanedSql, literals);
}

/**
 * Rewrites a SQL query by replacing logical table names with their namespaced physical names.
 */
export function rewriteQuery(
  sql: string,
  allowedTables: TableMetadata[],
  userId: number,
  role: string
): string {
  const sortedTables = [...allowedTables].sort((a, b) => b.tableName.length - a.tableName.length);
  const logicalTableNames = Array.from(new Set(sortedTables.map((t) => t.tableName)));

  let { cleanedSql, literals } = cleanAndExtractLiterals(sql);

  for (const logicalName of logicalTableNames) {
    const physicalName = resolveTable(logicalName, allowedTables, userId, role);
    if (physicalName) {
      const regex = new RegExp(`\\b${logicalName}\\b`, 'gi');
      cleanedSql = cleanedSql.replace(regex, physicalName);
    }
  }

  return restoreLiterals(cleanedSql, literals);
}

/**
 * Intercepts a CREATE TABLE statement to namespace the new table name and return metadata details.
 */
export function rewriteCreateTable(
  sql: string,
  userId: number,
  role?: string
): { logicalName: string; physicalName: string; rewrittenSql: string } | null {
  const normalized = sql.replace(/\s+/g, ' ');
  const match = normalized.match(/\bcreate\s+(?:temporary\s+)?table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_`"]+)/i);
  if (!match) return null;

  const logicalName = match[1].replace(/[`"']/g, '');
  const prefix = `db_user_${userId}_`;
  const physicalName = `${prefix}${logicalName}`;

  const escapedName = logicalName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const replaceRegex = new RegExp(`(\\bcreate\\s+(?:temporary\\s+)?table\\s+(?:if\\s+not\\s+exists\\s+)?)([\`"']?)${escapedName}\\2`, 'i');
  
  const rewrittenSql = sql.replace(replaceRegex, `$1$2${physicalName}$2`);

  return { logicalName, physicalName, rewrittenSql };
}

/**
 * Intercepts a DROP TABLE statement to return the logical table name being dropped.
 */
export function getDropTableLogicalName(sql: string, allowedTables: TableMetadata[]): string | null {
  const normalized = sql.replace(/\s+/g, ' ').toLowerCase();
  const match = normalized.match(/\bdrop\s+table\s+(?:if\s+exists\s+)?([a-zA-Z0-9_`"]+)/i);
  if (!match) return null;

  const nameInput = match[1].replace(/[`"']/g, '');
  const table = allowedTables.find(t => t.tableName.toLowerCase() === nameInput.toLowerCase());
  return table ? table.tableName : null;
}

/**
 * Intercepts a CREATE DATABASE statement.
 */
export function rewriteCreateDatabase(
  sql: string,
  userId: number,
  role?: string
): { logicalName: string; physicalName: string; rewrittenSql: string } | null {
  const normalized = sql.replace(/\s+/g, ' ');
  const match = normalized.match(/\bcreate\s+database\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_`"]+)/i);
  if (!match) return null;

  const logicalName = match[1].replace(/[`"']/g, '');
  const prefix = `wp_user_${userId}_`;
  const physicalName = `${prefix}${logicalName}`;

  const escapedName = logicalName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const replaceRegex = new RegExp(`(\\bcreate\\s+database\\s+(?:if\\s+not\\s+exists\\s+)?)([\`"']?)${escapedName}\\2`, 'i');
  const rewrittenSql = sql.replace(replaceRegex, `$1$2${physicalName}$2`);

  return { logicalName, physicalName, rewrittenSql };
}

/**
 * Intercepts a DROP DATABASE statement.
 */
export function getDropDatabaseLogicalName(sql: string, allowedDbs: DatabaseMetadata[]): string | null {
  const normalized = sql.replace(/\s+/g, ' ').toLowerCase();
  const match = normalized.match(/\bdrop\s+database\s+(?:if\s+exists\s+)?([a-zA-Z0-9_`"]+)/i);
  if (!match) return null;

  const nameInput = match[1].replace(/[`"']/g, '');
  const db = allowedDbs.find(d => d.dbName.toLowerCase() === nameInput.toLowerCase());
  return db ? db.dbName : null;
}
