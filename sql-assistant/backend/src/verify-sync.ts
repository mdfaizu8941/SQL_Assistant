import dotenv from 'dotenv';
dotenv.config();

import {
  getAllowedDatabases,
  resolveDatabase,
  rewriteDatabaseQueries,
  rewriteCreateDatabase,
  getDropDatabaseLogicalName,
  DatabaseMetadata
} from './utils/queryRouter';

function runSyncTests() {
  console.log('=== STARTING HIERARCHICAL DATABASE SYNC VERIFICATION ===');

  const mockAllowedDbs: DatabaseMetadata[] = [
    { id: 1, dbName: 'master_db', physicalName: 'wp_admin_master_db', ownerId: 5, ownerRole: 'ADMIN', visibility: 'PUBLIC', createdAt: new Date() },
    { id: 2, dbName: 'user2_db', physicalName: 'wp_user_7_user2_db', ownerId: 7, ownerRole: 'USER', visibility: 'PRIVATE', createdAt: new Date() },
    { id: 3, dbName: 'user_db', physicalName: 'wp_user_12_user_db', ownerId: 12, ownerRole: 'USER', visibility: 'PRIVATE', createdAt: new Date() },
  ];

  let passed = 0;
  let total = 0;

  function assertEqual(actual: string | null, expected: string | null, testName: string) {
    total++;
    if (actual === expected) {
      passed++;
      console.log(`✅ PASS: ${testName}`);
    } else {
      console.error(`❌ FAIL: ${testName}\n   Expected: "${expected}"\n   Got:      "${actual}"`);
    }
  }

  // Test 1: USER 12 database resolution (can resolve own and Admin, but NOT other User 7)
  assertEqual(resolveDatabase('user_db', mockAllowedDbs, 12, 'USER'), 'wp_user_12_user_db', 'USER 12 resolves own database');
  assertEqual(resolveDatabase('master_db', mockAllowedDbs, 12, 'USER'), 'wp_admin_master_db', 'USER 12 resolves ADMIN database (upward sharing)');
  assertEqual(resolveDatabase('user2_db', mockAllowedDbs, 12, 'USER'), null, 'USER 12 CANNOT resolve another user\'s database (isolation check)');

  // Test 2: ADMIN 5 database resolution (can resolve own and all Users\' databases)
  assertEqual(resolveDatabase('master_db', mockAllowedDbs, 5, 'ADMIN'), 'wp_admin_master_db', 'ADMIN resolves own database');
  assertEqual(resolveDatabase('user_db', mockAllowedDbs, 5, 'ADMIN'), 'wp_user_12_user_db', 'ADMIN resolves USER 12 database');
  assertEqual(resolveDatabase('user2_db', mockAllowedDbs, 5, 'ADMIN'), 'wp_user_7_user2_db', 'ADMIN resolves USER 7 database');

  // Test 3: USE statement rewriting
  const userSql = 'USE user_db; SELECT * FROM user_db.Customers JOIN master_db.Products;';
  const expectedRewritten = 'USE wp_user_12_user_db; SELECT * FROM wp_user_12_user_db.Customers JOIN wp_admin_master_db.Products;';
  const actualRewritten = rewriteDatabaseQueries(userSql, mockAllowedDbs, 12, 'USER');
  assertEqual(actualRewritten, expectedRewritten, 'USE statement and database qualifiers rewriting');

  // Test 4: CREATE DATABASE namespacing for User 7
  const createDbSql = 'CREATE DATABASE IF NOT EXISTS sales_db';
  const expectedCreateDbSql = 'CREATE DATABASE IF NOT EXISTS wp_user_7_sales_db';
  const createResult = rewriteCreateDatabase(createDbSql, 7, 'USER');
  assertEqual(createResult?.rewrittenSql || null, expectedCreateDbSql, 'CREATE DATABASE statement rewriting');
  assertEqual(createResult?.physicalName || null, 'wp_user_7_sales_db', 'CREATE DATABASE physical name generation');

  // Test 5: DROP DATABASE logical name extraction
  const dropDbSql = 'DROP DATABASE user2_db;';
  const dropLogical = getDropDatabaseLogicalName(dropDbSql, mockAllowedDbs);
  assertEqual(dropLogical, 'user2_db', 'DROP DATABASE logical name extraction');

  console.log(`\n=== RESULTS: Passed ${passed}/${total} assertions ===`);
}

runSyncTests();
