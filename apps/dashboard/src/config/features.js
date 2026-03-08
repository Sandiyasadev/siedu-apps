/**
 * Feature flags controlled via environment variables.
 * Set VITE_ENABLE_HANDOFF_QUEUE=true in .env to enable the handoff queue page.
 */
export const FEATURES = {
    HANDOFF_QUEUE: import.meta.env.VITE_ENABLE_HANDOFF_QUEUE === 'true',
};
