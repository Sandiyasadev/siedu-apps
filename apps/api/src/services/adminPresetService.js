const { transaction } = require('../utils/db');
const {
    DEFAULT_TEMPLATE_CATEGORIES,
    DEFAULT_TEMPLATE_SUBCATEGORIES,
} = require('./templateTaxonomyDefaults');
const { loadTemplatePreset } = require('./templateDefaults');

const DEFAULT_BUNDLE_KEY = 'default-v1';
const DEFAULT_BUNDLE_VERSION = 1;

const normalizeScopeWorkspaceId = (value) => (value ? value : null);

/**
 * Upsert a preset_bundles row — find by (workspace_id, key, version) or insert.
 */
const getOrCreateBundleRow = async (client, payload) => {
    const existing = await client.query(
        `SELECT id FROM preset_bundles
         WHERE workspace_id IS NOT DISTINCT FROM $1
           AND key = $2 AND version = $3
         LIMIT 1`,
        [payload.workspace_id, payload.key, payload.version]
    );

    if (existing.rows.length > 0) {
        const updated = await client.query(
            `UPDATE preset_bundles
             SET name = $1, status = $2, description = $3,
                 metadata = $4::jsonb, updated_by = $5, updated_at = NOW()
             WHERE id = $6
             RETURNING *`,
            [
                payload.name,
                payload.status,
                payload.description,
                JSON.stringify(payload.metadata || {}),
                payload.actor_user_id || null,
                existing.rows[0].id,
            ]
        );
        return { row: updated.rows[0], created: false };
    }

    const inserted = await client.query(
        `INSERT INTO preset_bundles (
            workspace_id, key, name, version, status, description, metadata, created_by, updated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
        RETURNING *`,
        [
            payload.workspace_id,
            payload.key,
            payload.name,
            payload.version,
            payload.status,
            payload.description,
            JSON.stringify(payload.metadata || {}),
            payload.actor_user_id || null,
            payload.actor_user_id || null,
        ]
    );
    return { row: inserted.rows[0], created: true };
};

/**
 * Bootstrap a full preset bundle from runtime defaults:
 *   1. Upsert preset_bundles row
 *   2. Seed preset_categories from DEFAULT_TEMPLATE_CATEGORIES
 *   3. Seed preset_subcategories from DEFAULT_TEMPLATE_SUBCATEGORIES
 *   4. Seed preset_items from local JSON file
 *
 * Replaces: upsertTaxonomyPresetFromDefaults + upsertTemplatePresetFromLocalFile
 */
const bootstrapBundleFromDefaults = async ({
    workspaceId = null,
    actorUserId = null,
    key = DEFAULT_BUNDLE_KEY,
    version = DEFAULT_BUNDLE_VERSION,
    status = 'published',
    name = 'Default Preset Bundle',
    description = 'Default preset bundle seeded from runtime defaults + local JSON',
} = {}) => {
    const scopeWorkspaceId = normalizeScopeWorkspaceId(workspaceId);

    // Pre-flight: load template items from JSON
    const loaded = loadTemplatePreset(key);
    const templates = Array.isArray(loaded.templates) ? loaded.templates : [];

    const presetVersion = Number.isInteger(version) && version > 0
        ? version
        : (Number.isInteger(loaded.preset_version) ? loaded.preset_version : DEFAULT_BUNDLE_VERSION);

    return transaction(async (client) => {
        // 1. Upsert bundle row
        const { row: bundleRow, created } = await getOrCreateBundleRow(client, {
            workspace_id: scopeWorkspaceId,
            key,
            version: presetVersion,
            status,
            name,
            description,
            metadata: {
                source: 'runtime-defaults',
                categories_total: DEFAULT_TEMPLATE_CATEGORIES.length,
                subcategories_total: DEFAULT_TEMPLATE_SUBCATEGORIES.length,
                items_total: templates.length,
                template_source: loaded.preset_key || key,
                quality_report: Array.isArray(loaded.quality_report) ? loaded.quality_report : [],
            },
            actor_user_id: actorUserId,
        });

        const bundleId = bundleRow.id;

        // 2. Seed categories (delete + re-insert)
        await client.query('DELETE FROM preset_subcategories WHERE bundle_id = $1', [bundleId]);
        await client.query('DELETE FROM preset_categories WHERE bundle_id = $1', [bundleId]);
        await client.query('DELETE FROM preset_items WHERE bundle_id = $1', [bundleId]);

        for (const cat of DEFAULT_TEMPLATE_CATEGORIES) {
            await client.query(
                `INSERT INTO preset_categories (
                    bundle_id, key, label, description, sort_order, is_active, metadata
                ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
                [
                    bundleId,
                    cat.key,
                    cat.label,
                    cat.description || null,
                    cat.sort_order || 0,
                    cat.is_active !== false,
                    JSON.stringify({ source: 'runtime-defaults' }),
                ]
            );
        }

        // 3. Seed subcategories
        for (const sub of DEFAULT_TEMPLATE_SUBCATEGORIES) {
            await client.query(
                `INSERT INTO preset_subcategories (
                    bundle_id, category_key, key, label, description,
                    reply_mode, greeting_policy, default_template_count,
                    strategy_pool, sort_order, is_active, metadata
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb)`,
                [
                    bundleId,
                    sub.category_key,
                    sub.key,
                    sub.label,
                    sub.description || null,
                    sub.reply_mode || 'continuation',
                    sub.greeting_policy || 'forbidden',
                    sub.default_template_count || 3,
                    JSON.stringify(Array.isArray(sub.strategy_pool) ? sub.strategy_pool : []),
                    sub.sort_order || 0,
                    sub.is_active !== false,
                    JSON.stringify({ source: 'runtime-defaults' }),
                ]
            );
        }

        // 4. Seed template items from JSON
        let itemsInserted = 0;
        for (let idx = 0; idx < templates.length; idx += 1) {
            const item = templates[idx] || {};
            const nameVal = String(item.name || '').trim();
            const contentVal = String(item.content || '').trim();
            const categoryVal = String(item.category || 'general').trim() || 'general';
            const subCategoryVal = item.sub_category == null ? null : String(item.sub_category).trim() || null;
            if (!nameVal || !contentVal) continue;

            await client.query(
                `INSERT INTO preset_items (
                    bundle_id, name, content, category, sub_category, shortcut,
                    is_active, strategy_tag, requires_rag, sort_order, metadata
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
                [
                    bundleId,
                    nameVal,
                    contentVal,
                    categoryVal,
                    subCategoryVal,
                    item.shortcut ? String(item.shortcut).trim() : null,
                    item.is_active !== false,
                    item.strategy_tag ? String(item.strategy_tag).trim() : null,
                    item.requires_rag === true,
                    idx + 1,
                    JSON.stringify({ source: 'local-json-file' }),
                ]
            );
            itemsInserted += 1;
        }

        return {
            created,
            bundle: bundleRow,
            categories_count: DEFAULT_TEMPLATE_CATEGORIES.length,
            subcategories_count: DEFAULT_TEMPLATE_SUBCATEGORIES.length,
            items_count: itemsInserted,
        };
    });
};

module.exports = {
    bootstrapBundleFromDefaults,
    getOrCreateBundleRow,
};
