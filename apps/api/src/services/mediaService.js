const axios = require('axios');
const sharp = require('sharp');
const path = require('path');
const mime = require('mime-types');
const { v4: uuidv4 } = require('uuid');
const { uploadMedia } = require('../utils/storage');

// Max image dimension for compression
const MAX_IMAGE_WIDTH = 1280;
const IMAGE_QUALITY = 80;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * Download media from Meta (WhatsApp) and upload to MinIO
 * 
 * Flow:
 * 1. Get temporary download URL from Meta using media_id
 * 2. Download the file
 * 3. Optimize if image (resize + compress)
 * 4. Upload to MinIO whatsapp-media bucket
 * 5. Return object key and metadata
 * 
 * @param {string} mediaId - WhatsApp media ID
 * @param {string} mediaType - Type: image, video, document, audio, sticker
 * @param {string} accessToken - Meta access token
 * @param {Object} [extraMeta] - Extra metadata (filename, caption, etc.)
 * @returns {Promise<{objectKey, mimeType, fileSize, originalName}>}
 */
async function downloadAndStoreMedia(mediaId, mediaType, accessToken, extraMeta = {}) {
    console.log(`[Media] Processing ${mediaType} - media_id: ${mediaId}`);

    try {
        // Step 1: Get download URL from Meta
        const metaUrl = `https://graph.facebook.com/v18.0/${mediaId}`;
        const urlResponse = await axios.get(metaUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const downloadUrl = urlResponse.data.url;
        const metaMimeType = urlResponse.data.mime_type || 'application/octet-stream';

        console.log(`[Media] Download URL obtained, mime: ${metaMimeType}`);

        // Step 2: Download the file
        const fileResponse = await axios.get(downloadUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            responseType: 'arraybuffer',
            maxContentLength: MAX_FILE_SIZE,
            timeout: 30000 // 30 second timeout
        });

        let buffer = Buffer.from(fileResponse.data);
        let finalMimeType = metaMimeType;
        let fileSize = buffer.length;

        console.log(`[Media] Downloaded: ${(fileSize / 1024).toFixed(1)}KB`);

        // Step 3: Optimize if image
        if (mediaType === 'image' && !metaMimeType.includes('webp')) {
            try {
                const metadata = await sharp(buffer).metadata();

                if (metadata.width > MAX_IMAGE_WIDTH) {
                    buffer = await sharp(buffer)
                        .resize(MAX_IMAGE_WIDTH, null, { withoutEnlargement: true })
                        .jpeg({ quality: IMAGE_QUALITY })
                        .toBuffer();

                    finalMimeType = 'image/jpeg';
                    console.log(`[Media] Image resized: ${(fileSize / 1024).toFixed(1)}KB -> ${(buffer.length / 1024).toFixed(1)}KB`);
                    fileSize = buffer.length;
                }
            } catch (sharpErr) {
                console.warn(`[Media] Sharp optimization skipped:`, sharpErr.message);
                // Continue with original buffer
            }
        }

        // Step 3b: Convert sticker (webp) to png for display
        if (mediaType === 'sticker') {
            try {
                buffer = await sharp(buffer)
                    .png()
                    .toBuffer();

                finalMimeType = 'image/png';
                fileSize = buffer.length;
                console.log(`[Media] Sticker converted to PNG: ${(fileSize / 1024).toFixed(1)}KB`);
            } catch (sharpErr) {
                console.warn(`[Media] Sticker conversion skipped:`, sharpErr.message);
            }
        }

        // Step 4: Generate object key with date-based path
        const now = new Date();
        const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
        const ext = mime.extension(finalMimeType) || getExtFromType(mediaType);
        const fileName = extraMeta.filename || `${uuidv4()}.${ext}`;
        const objectKey = `${datePath}/${uuidv4()}-${sanitizeFilename(fileName)}`;

        // Step 5: Upload to MinIO
        await uploadMedia(objectKey, buffer, finalMimeType);
        console.log(`[Media] Uploaded to MinIO: ${objectKey}`);

        return {
            objectKey,
            mimeType: finalMimeType,
            fileSize,
            originalName: extraMeta.filename || fileName,
            caption: extraMeta.caption || null
        };

    } catch (error) {
        console.error(`[Media] Failed to process ${mediaType}:`, error.message);

        // Return null instead of throwing - message will be saved with placeholder
        return null;
    }
}

/**
 * Extract media info from a WhatsApp message object
 * @param {Object} msg - WhatsApp message object from webhook
 * @returns {{ mediaId, mediaType, caption, filename } | null}
 */
function extractMediaInfo(msg) {
    if (!msg || !msg.type) return null;

    const type = msg.type;
    const mediaObj = msg[type]; // msg.image, msg.video, msg.document, etc.

    if (!mediaObj || !mediaObj.id) return null;

    return {
        mediaId: mediaObj.id,
        mediaType: type,
        mimeType: mediaObj.mime_type || null,
        caption: mediaObj.caption || null,
        filename: mediaObj.filename || null, // Only for documents
        sha256: mediaObj.sha256 || null
    };
}

/**
 * Build content string for database storage
 * Format: "media::<type>::<objectKey>" or "media::<type>::<objectKey>::<caption>"
 */
function buildMediaContent(mediaType, objectKey, caption) {
    const parts = ['media', mediaType, objectKey];
    if (caption) parts.push(caption);
    return parts.join('::');
}

/**
 * Parse media content string from database
 * @param {string} content - Content string from messages table
 * @returns {{ isMedia, mediaType, objectKey, caption } | { isMedia: false }}
 */
function parseMediaContent(content) {
    if (!content || !content.startsWith('media::')) {
        return { isMedia: false };
    }

    const parts = content.split('::');
    return {
        isMedia: true,
        mediaType: parts[1] || 'unknown',
        objectKey: parts[2] || '',
        caption: parts[3] || null
    };
}

/**
 * Upload media to Meta (WhatsApp) for outbound sending
 * Meta requires uploading to their servers first, returns media_id
 *
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type
 * @param {Object} config - { phone_number_id, access_token }
 * @returns {Promise<string>} media_id from Meta
 */
async function uploadToMeta(buffer, mimeType, config) {
    const { phone_number_id, access_token } = config;

    const url = `https://graph.facebook.com/v18.0/${phone_number_id}/media`;

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);
    form.append('file', new Blob([buffer], { type: mimeType }), 'file');

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${access_token}` },
        body: form
    });

    const data = await response.json();

    if (!data.id) {
        throw new Error(`Meta upload failed: ${data.error?.message || 'no media_id returned'}`);
    }

    console.log(`[Media] Uploaded to Meta: media_id=${data.id}`);
    return data.id;
}

/**
 * Store outbound media (agent-sent files) in MinIO
 * Optimizes images before storing.
 *
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} mimeType - MIME type
 * @returns {Promise<{objectKey, mimeType, fileSize}>}
 */
async function storeOutboundMedia(buffer, originalName, mimeType) {
    let processedBuffer = buffer;
    let finalMimeType = mimeType;

    // Optimize images (skip webp)
    if (mimeType.startsWith('image/') && !mimeType.includes('webp')) {
        try {
            const metadata = await sharp(processedBuffer).metadata();
            if (metadata.width > MAX_IMAGE_WIDTH) {
                processedBuffer = await sharp(processedBuffer)
                    .resize(MAX_IMAGE_WIDTH, null, { withoutEnlargement: true })
                    .jpeg({ quality: IMAGE_QUALITY })
                    .toBuffer();
                finalMimeType = 'image/jpeg';
                console.log(`[Media] Outbound image resized: ${(buffer.length / 1024).toFixed(1)}KB -> ${(processedBuffer.length / 1024).toFixed(1)}KB`);
            }
        } catch (err) {
            console.warn(`[Media] Outbound image optimization skipped:`, err.message);
        }
    }

    const now = new Date();
    const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const ext = mime.extension(finalMimeType) || 'bin';
    const fileName = `${uuidv4()}-${sanitizeFilename(originalName || `file.${ext}`)}`;
    const objectKey = `${datePath}/${fileName}`;

    await uploadMedia(objectKey, processedBuffer, finalMimeType);
    console.log(`[Media] Outbound stored in MinIO: ${objectKey}`);

    return {
        objectKey,
        mimeType: finalMimeType,
        fileSize: processedBuffer.length
    };
}

/**
 * Get WhatsApp media type from MIME type
 */
function getWhatsAppMediaType(mimeType) {
    if (!mimeType) return 'document';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
}

/**
 * Download media from Telegram and upload to MinIO
 *
 * Flow:
 * 1. Call getFile to get file_path
 * 2. Download binary from https://api.telegram.org/file/bot<token>/<file_path>
 * 3. Optimize if image
 * 4. Upload to MinIO
 *
 * @param {string} fileId - Telegram file_id
 * @param {string} mediaType - image, video, audio, voice, document, sticker
 * @param {string} botToken - Telegram bot token
 * @param {Object} [extraMeta] - { filename, caption, mimeType }
 * @returns {Promise<{objectKey, mimeType, fileSize, originalName, caption}|null>}
 */
async function downloadTelegramMedia(fileId, mediaType, botToken, extraMeta = {}) {
    console.log(`[Media:Telegram] Processing ${mediaType} - file_id: ${fileId}`);

    try {
        // Step 1: Get file path from Telegram
        const fileInfoRes = await axios.get(
            `https://api.telegram.org/bot${botToken}/getFile`,
            { params: { file_id: fileId }, timeout: 10000 }
        );

        if (!fileInfoRes.data.ok || !fileInfoRes.data.result?.file_path) {
            console.error('[Media:Telegram] getFile failed:', fileInfoRes.data);
            return null;
        }

        const filePath = fileInfoRes.data.result.file_path;
        const telegramFileSize = fileInfoRes.data.result.file_size || 0;
        console.log(`[Media:Telegram] file_path: ${filePath}, size: ${(telegramFileSize / 1024).toFixed(1)}KB`);

        // Step 2: Download file
        const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
        const fileResponse = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            maxContentLength: MAX_FILE_SIZE,
            timeout: 30000
        });

        let buffer = Buffer.from(fileResponse.data);
        // Infer MIME type: prefer extraMeta, then from file extension
        let finalMimeType = extraMeta.mimeType
            || mime.lookup(filePath)
            || 'application/octet-stream';
        let fileSize = buffer.length;

        console.log(`[Media:Telegram] Downloaded: ${(fileSize / 1024).toFixed(1)}KB, mime: ${finalMimeType}`);

        // Step 3: Optimize images (skip webp/sticker for now)
        if (mediaType === 'image' && !finalMimeType.includes('webp')) {
            try {
                const metadata = await sharp(buffer).metadata();
                if (metadata.width > MAX_IMAGE_WIDTH) {
                    buffer = await sharp(buffer)
                        .resize(MAX_IMAGE_WIDTH, null, { withoutEnlargement: true })
                        .jpeg({ quality: IMAGE_QUALITY })
                        .toBuffer();
                    finalMimeType = 'image/jpeg';
                    console.log(`[Media:Telegram] Image resized: ${(fileSize / 1024).toFixed(1)}KB -> ${(buffer.length / 1024).toFixed(1)}KB`);
                    fileSize = buffer.length;
                }
            } catch (sharpErr) {
                console.warn('[Media:Telegram] Sharp optimization skipped:', sharpErr.message);
            }
        }

        // Convert sticker (webp) to png
        if (mediaType === 'sticker') {
            try {
                buffer = await sharp(buffer).png().toBuffer();
                finalMimeType = 'image/png';
                fileSize = buffer.length;
                console.log(`[Media:Telegram] Sticker converted to PNG: ${(fileSize / 1024).toFixed(1)}KB`);
            } catch (sharpErr) {
                console.warn('[Media:Telegram] Sticker conversion skipped:', sharpErr.message);
            }
        }

        // Voice notes are .oga (ogg+opus) - keep as is
        if (mediaType === 'voice') {
            finalMimeType = 'audio/ogg';
        }

        // Step 4: Generate object key
        const now = new Date();
        const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
        const ext = mime.extension(finalMimeType) || getExtFromType(mediaType);
        const originalName = extraMeta.filename || path.basename(filePath) || `${uuidv4()}.${ext}`;
        const objectKey = `${datePath}/${uuidv4()}-${sanitizeFilename(originalName)}`;

        // Step 5: Upload to MinIO
        await uploadMedia(objectKey, buffer, finalMimeType);
        console.log(`[Media:Telegram] Uploaded to MinIO: ${objectKey}`);

        return {
            objectKey,
            mimeType: finalMimeType,
            fileSize,
            originalName,
            caption: extraMeta.caption || null
        };
    } catch (error) {
        console.error(`[Media:Telegram] Failed to process ${mediaType}:`, error.message);
        return null;
    }
}

// Helpers
function getExtFromType(mediaType) {
    const map = {
        image: 'jpg',
        video: 'mp4',
        audio: 'ogg',
        document: 'bin',
        sticker: 'png'
    };
    return map[mediaType] || 'bin';
}

function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
}

module.exports = {
    downloadAndStoreMedia,
    downloadTelegramMedia,
    extractMediaInfo,
    buildMediaContent,
    parseMediaContent,
    uploadToMeta,
    storeOutboundMedia,
    getWhatsAppMediaType
};
