"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSavedQuery = exports.toggleFavorite = exports.getSavedQueries = exports.saveQuery = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const saveQuery = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { queryName, sql } = req.body;
        if (!queryName || !sql) {
            res.status(400).json({ error: 'Query Name and SQL content are required.' });
            return;
        }
        const saved = await prisma_1.default.savedQuery.create({
            data: {
                userId,
                queryName,
                sql,
                isFavorite: false,
                ownerId: userId,
                ownerRole: role,
                visibility: 'PRIVATE',
                createdBy: req.user?.email || 'Unknown'
            }
        });
        res.status(201).json({ success: true, savedQuery: saved });
    }
    catch (error) {
        console.error('Error saving query:', error);
        res.status(500).json({ error: 'Failed to save query' });
    }
};
exports.saveQuery = saveQuery;
const getSavedQueries = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role || 'USER';
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        let savedQueries = [];
        if (role === 'ADMIN') {
            savedQueries = await prisma_1.default.savedQuery.findMany({
                include: {
                    user: { select: { email: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }
        else {
            savedQueries = await prisma_1.default.savedQuery.findMany({
                where: { ownerId: userId },
                orderBy: { createdAt: 'desc' }
            });
        }
        res.json({ savedQueries });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve saved queries' });
    }
};
exports.getSavedQueries = getSavedQueries;
const toggleFavorite = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const saved = await prisma_1.default.savedQuery.findUnique({
            where: { id: Number(id) }
        });
        if (!saved) {
            res.status(404).json({ error: 'Saved query not found' });
            return;
        }
        if (role !== 'ADMIN' && saved.ownerId !== userId) {
            res.status(403).json({ error: 'Forbidden: You do not own this query.' });
            return;
        }
        const updated = await prisma_1.default.savedQuery.update({
            where: { id: saved.id },
            data: { isFavorite: !saved.isFavorite }
        });
        res.json({ success: true, savedQuery: updated });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to toggle favorite status' });
    }
};
exports.toggleFavorite = toggleFavorite;
const deleteSavedQuery = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const saved = await prisma_1.default.savedQuery.findUnique({
            where: { id: Number(id) }
        });
        if (!saved) {
            res.status(404).json({ error: 'Saved query not found' });
            return;
        }
        if (role !== 'ADMIN' && saved.ownerId !== userId) {
            res.status(403).json({ error: 'Forbidden: You do not have permission to delete this query.' });
            return;
        }
        await prisma_1.default.savedQuery.delete({
            where: { id: saved.id }
        });
        res.json({ success: true, message: 'Saved query deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete query' });
    }
};
exports.deleteSavedQuery = deleteSavedQuery;
