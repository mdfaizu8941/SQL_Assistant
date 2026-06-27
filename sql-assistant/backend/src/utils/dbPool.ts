import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL environment variable is not defined.');
}

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

const pool = mysql.createPool(config);
export default pool;
