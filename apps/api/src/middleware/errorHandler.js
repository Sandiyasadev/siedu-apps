const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method
    });

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            details: err.details
        });
    }

    // Database errors
    if (err.code && err.code.startsWith('23')) { // PostgreSQL constraint errors
        return res.status(400).json({
            error: 'Database constraint error',
            message: err.message
        });
    }

    // Default error
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// Custom error class
class AppError extends Error {
    constructor(message, status = 500) {
        super(message);
        this.status = status;
        this.name = 'AppError';
    }
}

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    AppError,
    asyncHandler
};
