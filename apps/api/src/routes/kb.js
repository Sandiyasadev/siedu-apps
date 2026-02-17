const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../utils/db');
const { uploadFile, getPresignedUploadUrl, deleteFile } = require('../utils/storage');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, TXT, DOC, DOCX are allowed.'));
        }
    }
});

// All routes require authentication
router.use(authenticate);

// GET /v1/kb/sources - List KB sources for a bot
router.get('/sources', asyncHandler(async (req, res) => {
    const { bot_id } = req.query;

    if (!bot_id) {
        return res.status(400).json({ error: 'bot_id is required' });
    }

    // Verify bot belongs to user's workspace
    const botCheck = await query(
        'SELECT id FROM bots WHERE id = $1 AND workspace_id = $2',
        [bot_id, req.user.workspace_id]
    );

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const result = await query(
        `SELECT id, filename, original_filename, content_type, status, 
            error_message, chunk_count, kb_type, category, language, created_at, indexed_at
     FROM kb_sources 
     WHERE bot_id = $1 AND status != 'deleted'
     ORDER BY created_at DESC`,
        [bot_id]
    );

    res.json({ sources: result.rows });
}));

// POST /v1/kb/upload - Upload file to KB
router.post('/upload', uploadLimiter, upload.single('file'), asyncHandler(async (req, res) => {
    const { bot_id, kb_type, category, language } = req.body;

    if (!bot_id) {
        return res.status(400).json({ error: 'bot_id is required' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
    }

    // Verify bot belongs to user's workspace
    const botCheck = await query(
        'SELECT id, n8n_config FROM bots WHERE id = $1 AND workspace_id = $2',
        [bot_id, req.user.workspace_id]
    );

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    // Generate unique object key
    const now = new Date();
    const objectKey = `uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${uuidv4()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Upload to MinIO
    await uploadFile(objectKey, req.file.buffer, req.file.mimetype);

    // Create KB source record with categorization
    const result = await query(
        `INSERT INTO kb_sources (bot_id, source_type, filename, original_filename, 
                             content_type, object_key, file_size, status, kb_type, category, language)
     VALUES ($1, 'file', $2, $3, $4, $5, $6, 'processing', $7, $8, $9)
     RETURNING id, filename, original_filename, status, kb_type, category, language, created_at`,
        [bot_id, req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'),
            req.file.originalname, req.file.mimetype, objectKey, req.file.size,
            kb_type || 'facts', category || 'general', language || 'id']
    );

    // Trigger n8n workflow via webhook (async)
    const n8nBase = botCheck.rows[0].n8n_config?.webhook_base_url || process.env.N8N_WEBHOOK_BASE;
    const n8nWebhookUrl = `${n8nBase}/kb-upload`;

    // Fire and forget - don't wait for n8n
    fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source_id: result.rows[0].id,
            bot_id,
            object_key: objectKey,
            filename: req.file.originalname,
            // New categorization fields
            kb_type: kb_type || 'facts',
            category: category || 'general',
            language: language || 'id'
        })
    }).catch(err => console.error('n8n webhook error:', err.message));

    res.status(201).json({
        success: true,
        source: result.rows[0],
        message: 'File uploaded and queued for processing'
    });
}));

// GET /v1/kb/upload/presigned - Get presigned upload URL
router.get('/upload/presigned', asyncHandler(async (req, res) => {
    const { bot_id, filename, content_type } = req.query;

    if (!bot_id || !filename) {
        return res.status(400).json({ error: 'bot_id and filename are required' });
    }

    // Verify bot belongs to user's workspace
    const botCheck = await query(
        'SELECT id FROM bots WHERE id = $1 AND workspace_id = $2',
        [bot_id, req.user.workspace_id]
    );

    if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    const now = new Date();
    const objectKey = `uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${uuidv4()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const presignedUrl = await getPresignedUploadUrl(objectKey);

    res.json({
        upload_url: presignedUrl,
        object_key: objectKey,
        expires_in: 3600
    });
}));

// DELETE /v1/kb/sources/:id - Delete KB source
router.delete('/sources/:id', asyncHandler(async (req, res) => {
    // Get source and verify ownership
    const sourceResult = await query(
        `SELECT ks.id, ks.object_key, ks.filename, b.workspace_id
     FROM kb_sources ks
     JOIN bots b ON ks.bot_id = b.id
     WHERE ks.id = $1`,
        [req.params.id]
    );

    if (sourceResult.rows.length === 0) {
        return res.status(404).json({ error: 'Source not found' });
    }

    if (sourceResult.rows[0].workspace_id !== req.user.workspace_id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const source = sourceResult.rows[0];
    console.log(`[KB DELETE] Starting delete for source_id: ${req.params.id}`);

    // Delete from MinIO
    try {
        await deleteFile(source.object_key);
        console.log(`[KB DELETE] MinIO file deleted: ${source.object_key}`);
    } catch (err) {
        console.error('[KB DELETE] MinIO delete error:', err.message);
    }

    // Delete embeddings from both tables
    const kbResult = await query('DELETE FROM kb_embeddings WHERE source_id = $1', [req.params.id]);
    console.log(`[KB DELETE] Deleted ${kbResult.rowCount} rows from kb_embeddings`);

    // Also delete from n8n_vectors (where n8n PGVector stores embeddings)
    const n8nResult = await query("DELETE FROM n8n_vectors WHERE metadata->>'source_id' = $1", [req.params.id]);
    console.log(`[KB DELETE] Deleted ${n8nResult.rowCount} rows from n8n_vectors`);

    // Mark source as deleted
    await query(
        "UPDATE kb_sources SET status = 'deleted' WHERE id = $1",
        [req.params.id]
    );
    console.log(`[KB DELETE] Source marked as deleted: ${req.params.id}`);

    // Audit log
    await query(
        `INSERT INTO audit_log (workspace_id, actor, action, entity_type, entity_id)
     VALUES ($1, $2, 'kb_delete', 'kb_source', $3)`,
        [req.user.workspace_id, req.user.email, req.params.id]
    );

    res.json({ success: true, message: 'Source deleted' });
}));

module.exports = router;
