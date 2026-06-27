"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteChat = exports.togglePinChat = exports.renameChat = exports.getChatById = exports.getChatHistory = exports.saveChat = exports.createChat = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const createChat = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const chat = await prisma_1.default.aIConversation.create({
            data: {
                userId,
                title: 'New Chat',
                messages: '[]',
                prompt: '',
                generatedSql: '',
                ownerId: userId,
                ownerRole: role,
                visibility: 'PRIVATE',
                createdBy: req.user?.email || 'Unknown'
            }
        });
        res.status(201).json({ success: true, chat });
    }
    catch (error) {
        console.error('Error creating chat:', error);
        res.status(500).json({ error: 'Failed to create new chat session' });
    }
};
exports.createChat = createChat;
const saveChat = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { chatId, messages, prompt, generatedSql, executionResult, databaseUsed } = req.body;
        const messagesStr = typeof messages === 'string' ? messages : JSON.stringify(messages || []);
        if (chatId) {
            // Update existing chat
            const chat = await prisma_1.default.aIConversation.update({
                where: { id: Number(chatId) },
                data: {
                    messages: messagesStr,
                    prompt: prompt || '',
                    generatedSql: generatedSql || '',
                    executionResult: executionResult ? String(executionResult) : null,
                    databaseUsed: databaseUsed ? String(databaseUsed) : null
                }
            });
            res.json({ success: true, chat });
        }
        else {
            // Create new chat
            const chat = await prisma_1.default.aIConversation.create({
                data: {
                    userId,
                    title: prompt ? (prompt.length > 30 ? prompt.substring(0, 27) + '...' : prompt) : 'New Chat',
                    messages: messagesStr,
                    prompt: prompt || '',
                    generatedSql: generatedSql || '',
                    executionResult: executionResult ? String(executionResult) : null,
                    databaseUsed: databaseUsed ? String(databaseUsed) : null,
                    ownerId: userId,
                    ownerRole: role,
                    visibility: 'PRIVATE',
                    createdBy: req.user?.email || 'Unknown'
                }
            });
            res.status(201).json({ success: true, chat });
        }
    }
    catch (error) {
        console.error('Error saving chat:', error);
        res.status(500).json({ error: 'Failed to save chat conversation' });
    }
};
exports.saveChat = saveChat;
const getChatHistory = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role || 'USER';
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { search } = req.query;
        const whereClause = {};
        if (role !== 'ADMIN') {
            whereClause.ownerId = userId;
        }
        if (search && typeof search === 'string') {
            whereClause.OR = [
                { title: { contains: search } },
                { prompt: { contains: search } },
                { messages: { contains: search } }
            ];
        }
        const chats = await prisma_1.default.aIConversation.findMany({
            where: whereClause,
            include: role === 'ADMIN' ? { user: { select: { email: true } } } : undefined,
            orderBy: [
                { isPinned: 'desc' },
                { updatedAt: 'desc' }
            ]
        });
        res.json({ chats });
    }
    catch (error) {
        console.error('Error getting chat history:', error);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
};
exports.getChatHistory = getChatHistory;
const getChatById = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const chat = await prisma_1.default.aIConversation.findUnique({
            where: { id: Number(id) }
        });
        if (!chat) {
            res.status(404).json({ error: 'Chat conversation not found' });
            return;
        }
        if (role !== 'ADMIN' && chat.ownerId !== userId) {
            res.status(403).json({ error: 'Forbidden: You do not have access to this chat session.' });
            return;
        }
        res.json({ chat });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to retrieve chat session' });
    }
};
exports.getChatById = getChatById;
const renameChat = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const { title } = req.body;
        if (!title || !title.trim()) {
            res.status(400).json({ error: 'Title is required' });
            return;
        }
        const chat = await prisma_1.default.aIConversation.findUnique({
            where: { id: Number(id) }
        });
        if (!chat) {
            res.status(404).json({ error: 'Chat not found' });
            return;
        }
        if (role !== 'ADMIN' && chat.ownerId !== userId) {
            res.status(403).json({ error: 'Forbidden: You do not own this chat.' });
            return;
        }
        const updated = await prisma_1.default.aIConversation.update({
            where: { id: Number(id) },
            data: { title: title.trim() }
        });
        res.json({ success: true, chat: updated });
    }
    catch (error) {
        console.error('Error renaming chat:', error);
        res.status(500).json({ error: 'Failed to rename chat' });
    }
};
exports.renameChat = renameChat;
const togglePinChat = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const chat = await prisma_1.default.aIConversation.findUnique({
            where: { id: Number(id) }
        });
        if (!chat) {
            res.status(404).json({ error: 'Chat not found' });
            return;
        }
        if (role !== 'ADMIN' && chat.ownerId !== userId) {
            res.status(403).json({ error: 'Forbidden: You do not own this chat.' });
            return;
        }
        const updated = await prisma_1.default.aIConversation.update({
            where: { id: Number(id) },
            data: { isPinned: !chat.isPinned }
        });
        res.json({ success: true, chat: updated });
    }
    catch (error) {
        console.error('Error pinning chat:', error);
        res.status(500).json({ error: 'Failed to pin chat' });
    }
};
exports.togglePinChat = togglePinChat;
const deleteChat = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const chat = await prisma_1.default.aIConversation.findUnique({
            where: { id: Number(id) }
        });
        if (!chat) {
            res.status(404).json({ error: 'Chat not found' });
            return;
        }
        if (role !== 'ADMIN' && chat.ownerId !== userId) {
            res.status(403).json({ error: 'Forbidden: You do not own this chat.' });
            return;
        }
        await prisma_1.default.aIConversation.delete({
            where: { id: Number(id) }
        });
        res.json({ success: true, message: 'Chat deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ error: 'Failed to delete chat' });
    }
};
exports.deleteChat = deleteChat;
