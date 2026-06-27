/**
 * Normalizes a SQL query by removing leading/trailing spaces and comments.
 */
export const normalizeSql = (sql: string): string => {
  // Remove block comments /* ... */
  let clean = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove inline comments -- ... or # ...
  clean = clean
    .split('\n')
    .map((line) => line.replace(/(--|#).*$/, ''))
    .join('\n');
  return clean.trim();
};

/**
 * Checks if the user role has permissions to run the normalized SQL query.
 */
export const checkQueryPermissions = (
  role: string,
  sql: string
): { allowed: boolean; reason?: string } => {
  const cleanSql = normalizeSql(sql).toLowerCase();
  if (!cleanSql) {
    return { allowed: false, reason: 'Empty SQL query.' };
  }

  const firstWord = cleanSql.split(/\s+/)[0];

  if (role === 'ADMIN') {
    return { allowed: true };
  }

  // Read-only User (USER) can execute SELECT and workspace queries
  if (role === 'USER') {
    const allowedCommands = [
      'select',
      'insert',
      'update',
      'delete',
      'show',
      'describe',
      'explain',
      'use',
      'create',
      'drop',
      'alter',
    ];
    if (allowedCommands.includes(firstWord)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `User role is restricted from executing '${firstWord.toUpperCase()}' commands.`,
    };
  }

  return { allowed: false, reason: 'Unknown or unauthorized role.' };
};

/**
 * Detects if a query contains high-risk operations or statements.
 * Returns risk details if a high-risk query is detected.
 */
export const detectDangerousQuery = (
  sql: string
): { isDangerous: boolean; warning?: string } => {
  const cleanSql = normalizeSql(sql).toLowerCase();

  // 1. DROP database/table
  if (/\b(drop\s+(database|table))\b/.test(cleanSql)) {
    return {
      isDangerous: true,
      warning: 'High Risk Query: Contains DROP DATABASE or DROP TABLE statement.',
    };
  }

  // 2. TRUNCATE table
  if (/\b(truncate\s+table|truncate)\b/.test(cleanSql)) {
    return {
      isDangerous: true,
      warning: 'High Risk Query: Contains TRUNCATE statement.',
    };
  }

  // 3. ALTER table
  if (/\b(alter\s+table)\b/.test(cleanSql)) {
    return {
      isDangerous: true,
      warning: 'High Risk Query: Contains ALTER TABLE statement.',
    };
  }

  // 4. DELETE without WHERE
  if (/\bdelete\b/.test(cleanSql) && !/\bwhere\b/.test(cleanSql)) {
    return {
      isDangerous: true,
      warning: 'High Risk Query: Contains DELETE statement without a WHERE clause.',
    };
  }

  // 5. UPDATE without WHERE
  if (/\bupdate\b/.test(cleanSql) && !/\bwhere\b/.test(cleanSql)) {
    return {
      isDangerous: true,
      warning: 'High Risk Query: Contains UPDATE statement without a WHERE clause.',
    };
  }

  return { isDangerous: false };
};
