const express = require('express');
const mime = require('mime-types');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { getFileStream, getFileStat, MEDIA_PREFIX } = require('../utils/storage');
const { parseMediaContent } = require('../services/mediaService');

const router = express.Router();

// All media routes require authentication
router.use(authenticate);

/**
 * GET /v1/media/:year/:month/:filename
 * 
 * Stream media file directly from MinIO to browser.
 * This avoids the issue where presigned URLs point to internal Docker hostnames
 * (e.g., minio:9000) that the browser cannot reach.
 */
router.get('/:year/:month/:filename', asyncHandler(async (req, res) => {
    const { year, month, filename } = req.params;
    const objectKey = MEDIA_PREFIX + `${year}/${month}/${filename}`;

    // Verify media belongs to user's workspace
    const { query } = require('../utils/db');
    const ownerCheck = await query(
        `SELECT m.id FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         JOIN bots b ON b.id = c.bot_id
         WHERE m.content LIKE $1 AND b.workspace_id = $2
         LIMIT 1`,
        [`%${objectKey}%`, req.user.workspace_id]
    );

    if (ownerCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        // Get file metadata for content-type and size
        const stat = await getFileStat(objectKey);
        const contentType = stat.metaData?.['content-type'] || mime.lookup(filename) || 'application/octet-stream';

        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache 1 hour

        // Stream the file directly to the response
        const stream = await getFileStream(objectKey);
        stream.pipe(res);

    } catch (error) {
        console.error(`[Media] Failed to stream ${objectKey}:`, error.message);
        res.status(404).json({ error: 'Media not found or expired' });
    }
}));

/**
 * GET /v1/media/resolve
 * 
 * Resolve a media content string to a direct API URL.
 * Frontend uses this to get the streaming URL for media messages.
 * Query param: ?content=media::image::2026/02/abc.jpg
 */
router.get('/resolve', asyncHandler(async (req, res) => {
    const { content } = req.query;

    if (!content) {
        return res.status(400).json({ error: 'content parameter required' });
    }

    const parsed = parseMediaContent(content);
    if (!parsed.isMedia) {
        return res.status(400).json({ error: 'Not a media content string' });
    }

    // Return a direct API streaming URL instead of a MinIO presigned URL
    res.json({
        url: `/v1/media/${parsed.objectKey}`,
        mediaType: parsed.mediaType,
        objectKey: parsed.objectKey,
        caption: parsed.caption
    });
}));

module.exports = router;
