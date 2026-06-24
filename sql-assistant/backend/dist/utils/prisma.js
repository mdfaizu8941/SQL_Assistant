"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="node" />
const client_1 = require("@prisma/client");
const adapter_mariadb_1 = require("@prisma/adapter-mariadb");
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
const adapter = new adapter_mariadb_1.PrismaMariaDb(config);
const prisma = new client_1.PrismaClient({ adapter });
exports.default = prisma;
