const { query, transaction } = require('../utils/db');
const { delByPattern } = require('../utils/cache');

const VALID_MODE = new Set(['skip_existing', 'reactivate_existing']);
const normalizeMode = (mode) => (VALID_MODE.has(mode) ? mode : 'skip_existing');

const invalidateBotCaches = async (botId) => {
    if (!botId) return;
    await delByPattern(`internal:template-taxonomy:${botId}:*`);
    await delByPattern(`internal:bot-templates:${botId}:*`);
};

/**
 * Load a preset bundle with all children (categories, subcategories, items)
 */
const getBundleWithAll = async (client, bundleId) => {
    const bundleResult = await client.query('SELECT * FROM preset_bundles WHERE id = $1', [bundleId]);
    if (bundleResult.rows.length === 0) {
        const err = new Error('Preset bundle not found');
        err.code = 'BUNDLE_NOT_FOUND';
        throw err;
    }
    const [categories, subcategories, items] = await Promise.all([
        client.query(
            `SELECT * FROM preset_categories WHERE bundle_id = $1
             ORDER BY sort_order ASC, label ASC, key ASC`, [bundleId]),
        client.query(
            `SELECT * FROM preset_subcategories WHERE bundle_id = $1
             ORDER BY category_key ASC, sort_order ASC, label ASC, key ASC`, [bundleId]),
        client.query(
            `SELECT * FROM preset_items WHERE bundle_id = $1
             ORDER BY sort_order ASC, category ASC, sub_category ASC NULLS LAST, name ASC`, [bundleId]),
    ]);
    return {
        bundle: bundleResult.rows[0],
        categories: categories.rows,
        subcategories: subcategories.rows,
        items: items.rows,
    };
};

/**
 * Apply a full preset bundle to a single bot:
 *  1. Upsert template_categories from preset_categories
 *  2. Upsert template_subcategories from preset_subcategories
 *  3. Upsert templates from preset_items
 */
async function applyBundleToBot(botId, bundleId, options = {}) {
    if (!botId) throw new Error('botId is required');
    if (!bundleId) throw new Error('bundleId is required');
    const mode = normalizeMode(options.mode);

    const summary = {
        bot_id: botId,
        bundle_id: bundleId,
        mode,
        // taxonomy
        categories_total: 0, categories_created: 0, categories_skipped: 0, categories_reactivated: 0,
        subcategories_total: 0, subcategories_created: 0, subcategories_skipped: 0, subcategories_reactivated: 0,
        // templates
        items_total: 0, items_created: 0, items_skipped_existing: 0,
        items_skipped_invalid: 0, items_skipped_missing_taxonomy: 0, items_reactivated: 0,
        by_intent: {},
    };

    const incIntent = (intent, key) => {
        const k = intent || '__no_intent__';
        if (!summary.by_intent[k]) {
            summary.by_intent[k] = { created: 0, skipped_existing: 0, skipped_invalid: 0, skipped_missing_taxonomy: 0, reactivated: 0 };
        }
        summary.by_intent[k][key] += 1;
    };

    await transaction(async (client) => {
        const { categories, subcategories, items } = await getBundleWithAll(client, bundleId);
        summary.categories_total = categories.length;
        summary.subcategories_total = subcategories.length;
        summary.items_total = items.length;

        // --- Apply categories ---
        for (const cat of categories) {
            const result = await client.query(
                `INSERT INTO template_categories (bot_id, key, label, description, sort_order, is_active)
                 VALUES ($1,$2,$3,$4,$5,$6)
                 ON CONFLICT (bot_id, key) DO NOTHING`,
                [botId, cat.key, cat.label, cat.description || null, cat.sort_order || 0, cat.is_active !== false]
            );
            summary.categories_created += result.rowCount || 0;
        }

        // --- Apply subcategories ---
        for (const sub of subcategories) {
            const result = await client.query(
                `INSERT INTO template_subcategories (
                    bot_id, category_key, key, label, description,
                    reply_mode, greeting_policy, default_template_count,
                    strategy_pool, sort_order, is_active
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
                ON CONFLICT (bot_id, key) DO NOTHING`,
                [
                    botId, sub.category_key, sub.key, sub.label, sub.description || null,
                    sub.reply_mode || 'continuation', sub.greeting_policy || 'forbidden',
                    sub.default_template_count || 3,
                    JSON.stringify(Array.isArray(sub.strategy_pool) ? sub.strategy_pool : []),
                    sub.sort_order || 0, sub.is_active !== false,
                ]
            );
            summary.subcategories_created += result.rowCount || 0;
        }

        // --- Reactivate if mode requires ---
        if (mode === 'reactivate_existing') {
            const activeCatKeys = categories.filter(c => c.is_active !== false).map(c => c.key);
            const activeSubKeys = subcategories.filter(s => s.is_active !== false).map(s => s.key);
            if (activeCatKeys.length > 0) {
                const r = await client.query(
                    `UPDATE template_categories SET is_active = true, updated_at = NOW()
                     WHERE bot_id = $1 AND key = ANY($2::text[]) AND is_active = false`,
                    [botId, activeCatKeys]
                );
                summary.categories_reactivated = r.rowCount || 0;
            }
            if (activeSubKeys.length > 0) {
                const r = await client.query(
                    `UPDATE template_subcategories SET is_active = true, updated_at = NOW()
                     WHERE bot_id = $1 AND key = ANY($2::text[]) AND is_active = false`,
                    [botId, activeSubKeys]
                );
                summary.subcategories_reactivated = r.rowCount || 0;
            }
        }

        summary.categories_skipped = Math.max(0, summary.categories_total - summary.categories_created);
        summary.subcategories_skipped = Math.max(0, summary.subcategories_total - summary.subcategories_created);

        // --- Apply template items ---
        const taxonomyRows = await client.query(
            'SELECT key FROM template_subcategories WHERE bot_id = $1', [botId]
        );
        const taxonomyKeySet = new Set(taxonomyRows.rows.map(r => r.key));

        for (const item of items) {
            const name = String(item.name || '').trim();
            const content = String(item.content || '').trim();
            const category = String(item.category || 'general').trim() || 'general';
            const subCategory = item.sub_category == null ? null : String(item.sub_category).trim() || null;
            const shortcut = item.shortcut == null ? null : String(item.shortcut).trim() || null;
            const isActive = item.is_active !== false;

            if (!name || !content) {
                summary.items_skipped_invalid += 1;
                incIntent(subCategory, 'skipped_invalid');
                continue;
            }
            if (subCategory && !taxonomyKeySet.has(subCategory)) {
                summary.items_skipped_missing_taxonomy += 1;
                incIntent(subCategory, 'skipped_missing_taxonomy');
                continue;
            }

            const existing = await client.query(
                `SELECT id, is_active FROM templates
                 WHERE bot_id = $1 AND COALESCE(sub_category, '') = COALESCE($2, '')
                   AND LOWER(name) = LOWER($3)
                 ORDER BY created_at ASC LIMIT 1`,
                [botId, subCategory, name]
            );

            if (existing.rows.length > 0) {
                summary.items_skipped_existing += 1;
                incIntent(subCategory, 'skipped_existing');
                if (mode === 'reactivate_existing' && existing.rows[0].is_active === false && isActive) {
                    await client.query(
                        'UPDATE templates SET is_active = true, updated_at = NOW() WHERE id = $1',
                        [existing.rows[0].id]
                    );
                    summary.items_reactivated += 1;
                    incIntent(subCategory, 'reactivated');
                }
                continue;
            }

            await client.query(
                `INSERT INTO templates (bot_id, name, content, category, sub_category, shortcut, is_active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [botId, name, content, category, subCategory, shortcut, isActive]
            );
            summary.items_created += 1;
            incIntent(subCategory, 'created');
        }
    });

    await invalidateBotCaches(botId);
    return summary;
}

/**
 * Preview (dry-run) applying a bundle to a bot — no mutations.
 */
async function previewBundleToBot(botId, bundleId, options = {}) {
    if (!botId) throw new Error('botId is required');
    if (!bundleId) throw new Error('bundleId is required');
    const mode = normalizeMode(options.mode);

    const summary = {
        bot_id: botId, bundle_id: bundleId, mode,
        categories_total: 0, categories_created: 0, categories_skipped: 0, categories_reactivated: 0,
        subcategories_total: 0, subcategories_created: 0, subcategories_skipped: 0, subcategories_reactivated: 0,
        items_total: 0, items_created: 0, items_skipped_existing: 0,
        items_skipped_invalid: 0, items_skipped_missing_taxonomy: 0, items_reactivated: 0,
        by_intent: {},
    };

    const incIntent = (intent, key) => {
        const k = intent || '__no_intent__';
        if (!summary.by_intent[k]) {
            summary.by_intent[k] = { created: 0, skipped_existing: 0, skipped_invalid: 0, skipped_missing_taxonomy: 0, reactivated: 0 };
        }
        summary.by_intent[k][key] += 1;
    };

    await transaction(async (client) => {
        const { categories, subcategories, items } = await getBundleWithAll(client, bundleId);
        summary.categories_total = categories.length;
        summary.subcategories_total = subcategories.length;
        summary.items_total = items.length;

        // Preview categories
        const existCats = await client.query('SELECT key, is_active FROM template_categories WHERE bot_id = $1', [botId]);
        const catMap = new Map(existCats.rows.map(r => [r.key, r]));
        for (const cat of categories) {
            const ex = catMap.get(cat.key);
            if (!ex) summary.categories_created += 1;
            else if (mode === 'reactivate_existing' && ex.is_active === false && cat.is_active !== false) summary.categories_reactivated += 1;
        }

        // Preview subcategories
        const existSubs = await client.query('SELECT key, is_active FROM template_subcategories WHERE bot_id = $1', [botId]);
        const subMap = new Map(existSubs.rows.map(r => [r.key, r]));
        for (const sub of subcategories) {
            const ex = subMap.get(sub.key);
            if (!ex) summary.subcategories_created += 1;
            else if (mode === 'reactivate_existing' && ex.is_active === false && sub.is_active !== false) summary.subcategories_reactivated += 1;
        }

        summary.categories_skipped = Math.max(0, summary.categories_total - summary.categories_created);
        summary.subcategories_skipped = Math.max(0, summary.subcategories_total - summary.subcategories_created);

        // Preview template items
        // Build the merged taxonomy set (existing + to-be-created)
        const allSubKeys = new Set([...subMap.keys(), ...subcategories.map(s => s.key)]);

        const existTemplates = await client.query(
            'SELECT id, is_active, sub_category, name FROM templates WHERE bot_id = $1', [botId]
        );
        const tplMap = new Map(
            existTemplates.rows.map(r => [
                `${String(r.sub_category || '').toLowerCase()}::${String(r.name || '').toLowerCase()}`, r
            ])
        );

        for (const item of items) {
            const name = String(item.name || '').trim();
            const content = String(item.content || '').trim();
            const subCategory = item.sub_category == null ? null : String(item.sub_category).trim() || null;
            const isActive = item.is_active !== false;

            if (!name || !content) {
                summary.items_skipped_invalid += 1;
                incIntent(subCategory, 'skipped_invalid');
                continue;
            }
            if (subCategory && !allSubKeys.has(subCategory)) {
                summary.items_skipped_missing_taxonomy += 1;
                incIntent(subCategory, 'skipped_missing_taxonomy');
                continue;
            }
            const dedupeKey = `${String(subCategory || '').toLowerCase()}::${name.toLowerCase()}`;
            const ex = tplMap.get(dedupeKey);
            if (ex) {
                summary.items_skipped_existing += 1;
                incIntent(subCategory, 'skipped_existing');
                if (mode === 'reactivate_existing' && ex.is_active === false && isActive) {
                    summary.items_reactivated += 1;
                    incIntent(subCategory, 'reactivated');
                }
                continue;
            }
            summary.items_created += 1;
            incIntent(subCategory, 'created');
        }
    });

    return summary;
}

/**
 * Aggregate preview results across bots.
 */
const buildWorkspacePreviewAggregate = (summary) => {
    const agg = {
        categories_created: 0, categories_reactivated: 0,
        subcategories_created: 0, subcategories_reactivated: 0,
        items_created: 0, items_reactivated: 0,
        items_skipped_existing: 0, items_skipped_missing_taxonomy: 0, items_skipped_invalid: 0,
    };
    for (const r of summary.bot_results || []) {
        if (!r.success) continue;
        agg.categories_created += r.categories_created || 0;
        agg.categories_reactivated += r.categories_reactivated || 0;
        agg.subcategories_created += r.subcategories_created || 0;
        agg.subcategories_reactivated += r.subcategories_reactivated || 0;
        agg.items_created += r.items_created || 0;
        agg.items_reactivated += r.items_reactivated || 0;
        agg.items_skipped_existing += r.items_skipped_existing || 0;
        agg.items_skipped_missing_taxonomy += r.items_skipped_missing_taxonomy || 0;
        agg.items_skipped_invalid += r.items_skipped_invalid || 0;
    }
    return agg;
};

/**
 * Preview applying a bundle to all bots in a workspace.
 */
async function previewBundleToWorkspace(workspaceId, bundleId, options = {}) {
    if (!workspaceId) throw new Error('workspaceId is required');
    if (!bundleId) throw new Error('bundleId is required');
    const mode = normalizeMode(options.mode);

    const botsResult = await query(
        'SELECT id, name FROM bots WHERE workspace_id = $1 ORDER BY created_at ASC',
        [workspaceId]
    );

    const summary = {
        workspace_id: workspaceId, bundle_id: bundleId, mode, preview: true,
        bots_total: botsResult.rows.length, bots_processed: 0, bots_failed: 0,
        bot_results: [], aggregate: null,
    };

    for (const bot of botsResult.rows) {
        const botResult = { bot_id: bot.id, bot_name: bot.name, success: true };
        try {
            const r = await previewBundleToBot(bot.id, bundleId, { mode });
            Object.assign(botResult, r);
            summary.bots_processed += 1;
        } catch (error) {
            botResult.success = false;
            botResult.error = error.message;
            summary.bots_failed += 1;
        }
        summary.bot_results.push(botResult);
    }

    summary.aggregate = buildWorkspacePreviewAggregate(summary);
    return summary;
}

/**
 * Log a preset apply action.
 */
async function logPresetApply({ workspaceId, botId, bundleId, mode, summary, createdBy }) {
    await query(
        `INSERT INTO preset_apply_logs (workspace_id, bot_id, bundle_id, mode, action_scope, summary_json, created_by)
         VALUES ($1,$2,$3,$4,'both',$5::jsonb,$6)`,
        [workspaceId || null, botId || null, bundleId || null, normalizeMode(mode), JSON.stringify(summary || {}), createdBy || null]
    );
}

/**
 * Apply a bundle to all bots in a workspace + log.
 */
async function applyBundleToWorkspace(workspaceId, bundleId, options = {}) {
    if (!workspaceId) throw new Error('workspaceId is required');
    if (!bundleId) throw new Error('bundleId is required');
    const mode = normalizeMode(options.mode);

    const botsResult = await query(
        'SELECT id, name FROM bots WHERE workspace_id = $1 ORDER BY created_at ASC',
        [workspaceId]
    );

    const summary = {
        workspace_id: workspaceId, bundle_id: bundleId, mode,
        bots_total: botsResult.rows.length, bots_processed: 0, bots_failed: 0,
        bot_results: [],
    };

    for (const bot of botsResult.rows) {
        const botResult = { bot_id: bot.id, bot_name: bot.name, success: true };
        try {
            const r = await applyBundleToBot(bot.id, bundleId, { mode });
            Object.assign(botResult, r);
            summary.bots_processed += 1;
        } catch (error) {
            botResult.success = false;
            botResult.error = error.message;
            summary.bots_failed += 1;
        }
        summary.bot_results.push(botResult);
    }

    await logPresetApply({
        workspaceId, botId: null, bundleId, mode, summary,
        createdBy: options.createdBy || null,
    });

    return summary;
}

module.exports = {
    getBundleWithAll,
    applyBundleToBot,
    previewBundleToBot,
    applyBundleToWorkspace,
    previewBundleToWorkspace,
    logPresetApply,
};
