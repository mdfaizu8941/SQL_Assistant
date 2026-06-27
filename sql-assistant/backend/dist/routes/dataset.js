"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const dataset_1 = require("../controllers/dataset");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Multer memory configuration (limiting to 10MB per upload)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});
router.use(auth_1.authenticate);
router.post('/analyze', upload.single('file'), dataset_1.analyzeDataset);
router.post('/import', dataset_1.importDataset);
router.post('/export', dataset_1.exportDataset);
router.get('/', dataset_1.getDatasets);
exports.default = router;
