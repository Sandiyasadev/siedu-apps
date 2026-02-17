const Minio = require('minio');

// Parse MINIO_ENDPOINT - can be "hostname", "hostname:port", or "http://hostname:port"
const parseEndpoint = (endpoint) => {
    if (!endpoint) return { host: 'localhost', port: 9000, useSSL: false };

    // Remove protocol if present
    let host = endpoint.replace(/^https?:\/\//, '');
    const useSSL = endpoint.startsWith('https://') || host.includes('amazonaws.com');

    // Extract port if present
    let port = useSSL ? 443 : 9000;
    if (host.includes(':')) {
        const parts = host.split(':');
        host = parts[0];
        port = parseInt(parts[1]) || port;
    }

    return { host, port, useSSL };
};

const endpointConfig = parseEndpoint(process.env.MINIO_ENDPOINT);

// Build client config - works with both MinIO and AWS S3
const clientConfig = {
    endPoint: endpointConfig.host,
    port: parseInt(process.env.MINIO_PORT) || endpointConfig.port,
    useSSL: process.env.MINIO_USE_SSL === 'true' || endpointConfig.useSSL,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
};

// Add region for AWS S3 (required for correct request signing)
if (process.env.AWS_REGION) {
    clientConfig.region = process.env.AWS_REGION;
}

// Log storage config on startup (hide secrets)
console.log(`[Storage] Endpoint: ${clientConfig.endPoint} | Region: ${clientConfig.region || 'default'} | SSL: ${clientConfig.useSSL}`);
console.log(`[Storage] Access Key: ${clientConfig.accessKey ? '***' + clientConfig.accessKey.slice(-4) : 'NOT SET ⚠️'}`);

const minioClient = new Minio.Client(clientConfig);

// Single bucket for all storage, separated by prefix (subfolder)
const BUCKET = process.env.MINIO_BUCKET || 'chat-backend-storage';
const MEDIA_PREFIX = 'media/';   // Subfolder for WhatsApp media
const KB_PREFIX = '';             // KB files at root level (backward compatible)

console.log(`[Storage] Bucket: ${BUCKET}`);

// Ensure bucket exists (skip creation for pre-existing buckets)
const ensureBucket = async () => {
    try {
        const exists = await minioClient.bucketExists(BUCKET);
        if (exists) {
            console.log(`[Storage] ✅ Bucket "${BUCKET}" connected`);
        } else {
            console.warn(`[Storage] ⚠️ Bucket "${BUCKET}" not found. Please create it via AWS Console.`);
        }
    } catch (error) {
        console.error(`[Storage] ❌ Failed to check bucket "${BUCKET}":`, error.message);
    }
};

// Initialize storage - verify bucket access and set media lifecycle
const initMediaBucket = async () => {
    try {
        await ensureBucket();

        // Set lifecycle policy - auto-delete media files after 30 days
        const lifecycleConfig = {
            Rule: [
                {
                    ID: 'expire-media-30-days',
                    Status: 'Enabled',
                    Filter: { Prefix: MEDIA_PREFIX },
                    Expiration: { Days: 30 }
                }
            ]
        };

        await minioClient.setBucketLifecycle(BUCKET, lifecycleConfig);
        console.log(`[Storage] ✅ Media lifecycle set (${MEDIA_PREFIX}* → auto-delete after 30 days)`);
    } catch (error) {
        console.error('[Storage] ❌ Failed to init storage:', error.message);
    }
};

// Upload KB file (at root level of bucket)
const uploadFile = async (objectName, buffer, contentType) => {
    await minioClient.putObject(BUCKET, objectName, buffer, buffer.length, {
        'Content-Type': contentType
    });
    console.log(`[Storage] Uploaded KB: ${objectName} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return objectName;
};

// Upload media file (under media/ prefix)
const uploadMedia = async (objectName, buffer, contentType) => {
    const key = MEDIA_PREFIX + objectName;
    await minioClient.putObject(BUCKET, key, buffer, buffer.length, {
        'Content-Type': contentType
    });
    console.log(`[Storage] Uploaded media: ${key} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return key;
};

// Get presigned upload URL (KB files)
const getPresignedUploadUrl = async (objectName, expirySeconds = 3600) => {
    return await minioClient.presignedPutObject(BUCKET, objectName, expirySeconds);
};

// Get presigned download URL (KB files)
const getPresignedDownloadUrl = async (objectName, expirySeconds = 3600) => {
    return await minioClient.presignedGetObject(BUCKET, objectName, expirySeconds);
};

// Get presigned download URL for media files
const getMediaUrl = async (objectName, expirySeconds = 3600) => {
    // If objectName already includes prefix, use as-is; otherwise add prefix
    const key = objectName.startsWith(MEDIA_PREFIX) ? objectName : MEDIA_PREFIX + objectName;
    return await minioClient.presignedGetObject(BUCKET, key, expirySeconds);
};

// Delete file
const deleteFile = async (objectName) => {
    await minioClient.removeObject(BUCKET, objectName);
};

// Get file stream
const getFileStream = async (objectName) => {
    return await minioClient.getObject(BUCKET, objectName);
};

// Get file stat (for content-type, size)
const getFileStat = async (objectName) => {
    return await minioClient.statObject(BUCKET, objectName);
};

module.exports = {
    minioClient,
    uploadFile,
    uploadMedia,
    getPresignedUploadUrl,
    getPresignedDownloadUrl,
    getMediaUrl,
    deleteFile,
    getFileStream,
    getFileStat,
    initMediaBucket,
    BUCKET,
    MEDIA_PREFIX
};
