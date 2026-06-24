/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';


const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL environment variable is not defined.');
}

// Parse the DATABASE_URL connection string into connection options
const parsedUrl = new URL(dbUrl);
const config = {
  host: parsedUrl.hostname,
  port: parseInt(parsedUrl.port || '3306'),
  user: parsedUrl.username,
  password: decodeURIComponent(parsedUrl.password || ''),
  database: parsedUrl.pathname.replace(/^\//, ''),
  allowPublicKeyRetrieval: true,
  connectionLimit: 10,
};

const adapter = new PrismaMariaDb(config);
const prisma = new PrismaClient({ adapter });

export default prisma;
