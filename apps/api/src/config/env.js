/**
 * Centralized Environment Configuration
 * 
 * Validates all required environment variables at startup.
 * Fails fast if any critical variable is missing.
 */

const REQUIRED_VARS = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'INTERNAL_API_KEY',
    'MINIO_ENDPOINT',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
];

const INSECURE_DEFAULTS = {
    JWT_SECRET: 'change-me-in-production',
    INTERNAL_API_KEY: 'change-me-in-production',
};

/**
 * Validate environment variables on startup.
 * In production, missing or insecure values will cause immediate exit.
 */
function validateEnv() {
    const isProduction = process.env.NODE_ENV === 'production';
    const errors = [];
    const warnings = [];

    // Check required variables
    for (const varName of REQUIRED_VARS) {
        if (!process.env[varName]) {
            errors.push(`❌ Missing required env var: ${varName}`);
        }
    }

    // Check for insecure default values in production
    if (isProduction) {
        for (const [varName, insecureValue] of Object.entries(INSECURE_DEFAULTS)) {
            if (process.env[varName] === insecureValue) {
                errors.push(`❌ INSECURE: ${varName} is using default value. Change it immediately!`);
            }
        }
    } else {
        for (const [varName, insecureValue] of Object.entries(INSECURE_DEFAULTS)) {
            if (process.env[varName] === insecureValue) {
                warnings.push(`⚠️  ${varName} is using default value (OK for development)`);
            }
        }
    }

    // Print warnings
    if (warnings.length > 0) {
        console.log('\n🔶 Environment Warnings:');
        warnings.forEach(w => console.log(`   ${w}`));
        console.log('');
    }

    // Handle errors
    if (errors.length > 0) {
        console.error('\n🚨 Environment Configuration Errors:');
        errors.forEach(e => console.error(`   ${e}`));

        if (isProduction) {
            console.error('\n💀 Cannot start in production with invalid configuration. Exiting.\n');
            process.exit(1);
        } else {
            console.warn('\n⚠️  Running in development mode with missing vars. Some features may not work.\n');
        }
    } else {
        console.log('✅ Environment configuration validated successfully');
    }
}

module.exports = { validateEnv };
