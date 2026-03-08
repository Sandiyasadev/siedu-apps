const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { query } = require("../utils/db");
const logger = require("../utils/logger");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.fatal('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "1h";
const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || "7", 10);

const WORKSPACE_OVERRIDE_HEADER = "x-workspace-id";

const buildWorkspaceContext = ({
  actorWorkspaceId,
  effectiveWorkspaceId,
  overrideRequested = false,
  overrideApplied = false,
  overrideWorkspace = null,
}) => ({
  actorWorkspaceId,
  effectiveWorkspaceId,
  overrideRequested,
  overrideApplied,
  overrideWorkspace,
});

const normalizeWorkspaceOverrideHeader = (value) => {
  if (Array.isArray(value)) {
    return normalizeWorkspaceOverrideHeader(value[0]);
  }
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
};

const resolveEffectiveWorkspace = async (req) => {
  const actorWorkspaceId = req.user?.workspace_id || null;
  const requestedWorkspaceId = normalizeWorkspaceOverrideHeader(
    req.headers?.[WORKSPACE_OVERRIDE_HEADER],
  );

  if (!requestedWorkspaceId) {
    return buildWorkspaceContext({
      actorWorkspaceId,
      effectiveWorkspaceId: actorWorkspaceId,
    });
  }

  if (!req.user) {
    const error = new Error("Not authenticated");
    error.status = 401;
    throw error;
  }

  if (req.user.role !== "super_admin") {
    const error = new Error("Workspace override is only allowed for super_admin");
    error.status = 403;
    error.code = "WORKSPACE_OVERRIDE_FORBIDDEN";
    throw error;
  }

  const workspaceResult = await query(
    "SELECT id, name, slug FROM workspaces WHERE id = $1 LIMIT 1",
    [requestedWorkspaceId],
  );

  if (workspaceResult.rows.length === 0) {
    const error = new Error("Workspace override target not found");
    error.status = 404;
    error.code = "WORKSPACE_OVERRIDE_NOT_FOUND";
    throw error;
  }

  const workspace = workspaceResult.rows[0];
  const overrideApplied = workspace.id !== actorWorkspaceId;

  return buildWorkspaceContext({
    actorWorkspaceId,
    effectiveWorkspaceId: workspace.id,
    overrideRequested: true,
    overrideApplied,
    overrideWorkspace: workspace,
  });
};

const getEffectiveWorkspaceId = (req) => (
  req?.effectiveWorkspaceId || req?.workspaceContext?.effectiveWorkspaceId || req?.user?.workspace_id || null
);

const logWorkspaceOverrideAccess = async (req) => {
  const ctx = req?.workspaceContext;
  if (!req?.user || !ctx?.overrideRequested || !ctx?.overrideApplied || !ctx?.effectiveWorkspaceId) {
    return;
  }
  const method = String(req.method || "").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return;
  }

  try {
    await query(
      `
      INSERT INTO audit_log (
        workspace_id, actor, action, entity_type, entity_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        ctx.effectiveWorkspaceId,
        req.user.email || req.user.id || null,
        "super_admin_workspace_override_access",
        "http_request",
        `${method || "UNKNOWN"} ${req.originalUrl || req.url || "/"}`,
        JSON.stringify({
          actor_user_id: req.user.id,
          actor_role: req.user.role,
          actor_workspace_id: ctx.actorWorkspaceId || null,
          target_workspace_id: ctx.effectiveWorkspaceId,
          target_workspace_name: ctx.overrideWorkspace?.name || null,
          target_workspace_slug: ctx.overrideWorkspace?.slug || null,
          method: method || null,
          path: req.originalUrl || req.url || null,
        }),
      ],
    );
  } catch (auditError) {
    logger.error({
      err: auditError.message,
      actor_user_id: req.user.id,
      target_workspace_id: ctx.effectiveWorkspaceId,
      path: req.originalUrl || req.url || null,
    }, '[Auth] Failed to write workspace override audit log');
  }
};

// Authenticate JWT access token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user from database
    const result = await query(
      "SELECT id, email, name, role, workspace_id FROM users WHERE id = $1 AND is_active = true",
      [decoded.userId],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    req.user = result.rows[0];

    const workspaceContext = await resolveEffectiveWorkspace(req);
    req.workspaceContext = workspaceContext;
    req.effectiveWorkspaceId = workspaceContext.effectiveWorkspaceId;
    await logWorkspaceOverrideAccess(req);

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        code: error.code || undefined,
      });
    }
    next(error);
  }
};

// Check if user has required role
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (req.user.role === "super_admin") {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};

// Generate short-lived access token (1h default)
const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, workspace_id: user.workspace_id },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
};

// Backward-compat alias
const generateToken = generateAccessToken;

// Generate refresh token + store in DB
const generateRefreshToken = async (user, req = {}) => {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const ip = req.ip || req.headers?.['x-forwarded-for'] || null;
  const userAgent = req.headers?.['user-agent'] || null;

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, tokenHash, expiresAt, ip, userAgent]
  );

  return rawToken;
};

// Validate and consume refresh token (rotation: old token is revoked)
const validateRefreshToken = async (rawToken) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const result = await query(
    `SELECT rt.*, u.id as uid, u.email, u.name, u.role, u.workspace_id, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  if (!row.is_active) {
    // User deactivated — revoke all their tokens
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [row.user_id]);
    return null;
  }

  // Revoke this token (rotation)
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [row.id]);

  return {
    id: row.uid,
    email: row.email,
    name: row.name,
    role: row.role,
    workspace_id: row.workspace_id,
  };
};

// Revoke refresh token(s)
const revokeRefreshToken = async (rawToken) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [tokenHash]);
};

const revokeAllUserRefreshTokens = async (userId) => {
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
};

// Password validation policy
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true };
};

// Update last login info
const updateLastLogin = async (userId, req = {}) => {
  const ip = req.ip || req.headers?.['x-forwarded-for'] || null;
  await query(
    'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
    [ip, userId]
  );
};

module.exports = {
  authenticate,
  requireRole,
  generateToken,
  generateAccessToken,
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  validatePassword,
  updateLastLogin,
  resolveEffectiveWorkspace,
  getEffectiveWorkspaceId,
};
