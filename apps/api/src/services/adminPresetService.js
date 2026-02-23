const { transaction } = require('../utils/db');
const {
    DEFAULT_TEMPLATE_CATEGORIES,
    DEFAULT_TEMPLATE_SUBCATEGORIES,
} = require('./templateTaxonomyDefaults');
const { loadTemplatePreset } = require('./templateDefaults');

const DEFAULT_TAXONOMY_PRESET_KEY = 'default-v1';
const DEFAULT_TEMPLATE_PRESET_KEY = 'default-v1';
const DEFAULT_PRESET_VERSION = 1;

const normalizeScopeWorkspaceId = (value) => (value ? value : null);

const getOrCreatePresetRow = async (client, tableName, payload) => {
    const existing = await client.query(
        `
        SELECT id
        FROM ${tableName}
        WHERE workspace_id IS NOT DISTINCT FROM $1
          AND key = $2
          AND version = $3
        LIMIT 1
        `,
        [payload.workspace_id, payload.key, payload.version]
    );

    if (existing.rows.length > 0) {
        const updated = await client.query(
            `
            UPDATE ${tableName}
            SET name = $1,
                status = $2,
                description = $3,
                metadata = $4::jsonb,
                updated_by = $5,
                updated_at = NOW()
            WHERE id = $6
            RETURNING *
            `,
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
        `
        INSERT INTO ${tableName} (
            workspace_id, key, name, version, status, description, metadata, created_by, updated_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
        RETURNING *
        `,
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

const upsertTaxonomyPresetFromDefaults = async ({
    workspaceId = null,
    actorUserId = null,
    key = DEFAULT_TAXONOMY_PRESET_KEY,
    version = DEFAULT_PRESET_VERSION,
    status = 'published',
    name = 'Default Taxonomy Preset',
    description = 'Default taxonomy preset seeded from runtime defaults',
} = {}) => {
    const scopeWorkspaceId = normalizeScopeWorkspaceId(workspaceId);

    return transaction(async (client) => {
        const { row: presetRow, created } = await getOrCreatePresetRow(client, 'taxonomy_presets', {
            workspace_id: scopeWorkspaceId,
            key,
            version,
            status,
            name,
            description,
            metadata: {
                source: 'runtime-defaults',
                categories_total: DEFAULT_TEMPLATE_CATEGORIES.length,
                subcategories_total: DEFAULT_TEMPLATE_SUBCATEGORIES.length,
            },
            actor_user_id: actorUserId,
        });

        await client.query('DELETE FROM taxonomy_preset_subcategories WHERE preset_id = $1', [presetRow.id]);
        await client.query('DELETE FROM taxonomy_preset_categories WHERE preset_id = $1', [presetRow.id]);

        for (const category of DEFAULT_TEMPLATE_CATEGORIES) {
            await client.query(
                `
                INSERT INTO taxonomy_preset_categories (
                    preset_id, key, label, description, sort_order, is_active, metadata
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
                `,
                [
                    presetRow.id,
                    category.key,
                    category.label,
                    category.description || null,
                    category.sort_order || 0,
                    category.is_active !== false,
                    JSON.stringify({ source: 'runtime-defaults' }),
                ]
            );
        }

        for (const sub of DEFAULT_TEMPLATE_SUBCATEGORIES) {
            await client.query(
                `
                INSERT INTO taxonomy_preset_subcategories (
                    preset_id, category_key, key, label, description,
                    reply_mode, greeting_policy, default_template_count,
                    strategy_pool, sort_order, is_active, metadata
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb)
                `,
                [
                    presetRow.id,
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

        return {
            created,
            preset: presetRow,
            categories_count: DEFAULT_TEMPLATE_CATEGORIES.length,
            subcategories_count: DEFAULT_TEMPLATE_SUBCATEGORIES.length,
        };
    });
};

const upsertTemplatePresetFromLocalFile = async ({
    workspaceId = null,
    actorUserId = null,
    presetKey = DEFAULT_TEMPLATE_PRESET_KEY,
    version,
    status = 'published',
    name = 'Default Template Preset',
    description = 'Default template preset imported from generator output JSON',
    taxonomyPresetId = null,
} = {}) => {
    const loaded = loadTemplatePreset(presetKey);
    const templates = Array.isArray(loaded.templates) ? loaded.templates : [];
    if (templates.length === 0) {
        const err = new Error(`Template preset ${presetKey} is empty`);
        err.code = 'PRESET_EMPTY';
        throw err;
    }

    const presetVersion = Number.isInteger(version) && version > 0
        ? version
        : (Number.isInteger(loaded.preset_version) ? loaded.preset_version : DEFAULT_PRESET_VERSION);

    const scopeWorkspaceId = normalizeScopeWorkspaceId(workspaceId);

    return transaction(async (client) => {
        const { row: presetRow, created } = await getOrCreatePresetRow(client, 'template_presets', {
            workspace_id: scopeWorkspaceId,
            key: loaded.preset_key || presetKey,
            version: presetVersion,
            status,
            name,
            description,
            metadata: {
                source: 'local-json-file',
                source_preset_key: presetKey,
                meta: loaded.meta || {},
                quality_report: Array.isArray(loaded.quality_report) ? loaded.quality_report : [],
            },
            actor_user_id: actorUserId,
        });

        const finalTaxonomyPresetId = taxonomyPresetId || presetRow.taxonomy_preset_id || null;
        if (finalTaxonomyPresetId !== presetRow.taxonomy_preset_id) {
            await client.query(
                `
                UPDATE template_presets
                SET taxonomy_preset_id = $1,
                    updated_by = $2,
                    updated_at = NOW()
                WHERE id = $3
                `,
                [finalTaxonomyPresetId, actorUserId || null, presetRow.id]
            );
            presetRow.taxonomy_preset_id = finalTaxonomyPresetId;
        }

        await client.query('DELETE FROM template_preset_items WHERE template_preset_id = $1', [presetRow.id]);

        let insertedCount = 0;
        for (let idx = 0; idx < templates.length; idx += 1) {
            const item = templates[idx] || {};
            const nameValue = String(item.name || '').trim();
            const contentValue = String(item.content || '').trim();
            const categoryValue = String(item.category || 'general').trim() || 'general';
            const subCategoryValue = item.sub_category == null ? null : String(item.sub_category).trim() || null;
            if (!nameValue || !contentValue) continue;

            await client.query(
                `
                INSERT INTO template_preset_items (
                    template_preset_id, name, content, category, sub_category, shortcut,
                    is_active, strategy_tag, requires_rag, sort_order, metadata
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
                `,
                [
                    presetRow.id,
                    nameValue,
                    contentValue,
                    categoryValue,
                    subCategoryValue,
                    item.shortcut ? String(item.shortcut).trim() : null,
                    item.is_active !== false,
                    item.strategy_tag ? String(item.strategy_tag).trim() : null,
                    item.requires_rag === true,
                    idx + 1,
                    JSON.stringify({ source: 'local-json-file' }),
                ]
            );
            insertedCount += 1;
        }

        return {
            created,
            preset: presetRow,
            items_count: insertedCount,
            total_templates_in_file: templates.length,
        };
    });
};

const bootstrapDefaultPresetsFromLocalSources = async ({
    workspaceId = null,
    actorUserId = null,
    scope = 'both',
} = {}) => {
    if (!['taxonomy', 'templates', 'both'].includes(scope)) {
        const err = new Error('scope must be taxonomy, templates, or both');
        err.status = 400;
        throw err;
    }

    if (scope === 'templates' || scope === 'both') {
        const preflight = loadTemplatePreset(DEFAULT_TEMPLATE_PRESET_KEY);
        const preflightTemplates = Array.isArray(preflight.templates) ? preflight.templates : [];
        if (preflightTemplates.length === 0) {
            const err = new Error(`Template preset ${DEFAULT_TEMPLATE_PRESET_KEY} is empty`);
            err.code = 'PRESET_EMPTY';
            throw err;
        }
    }

    const summary = {
        scope,
        workspace_id: normalizeScopeWorkspaceId(workspaceId),
        taxonomy: null,
        templates: null,
    };

    if (scope === 'taxonomy' || scope === 'both') {
        summary.taxonomy = await upsertTaxonomyPresetFromDefaults({
            workspaceId: summary.workspace_id,
            actorUserId,
            status: 'published',
        });
    }

    if (scope === 'templates' || scope === 'both') {
        summary.templates = await upsertTemplatePresetFromLocalFile({
            workspaceId: summary.workspace_id,
            actorUserId,
            presetKey: DEFAULT_TEMPLATE_PRESET_KEY,
            status: 'published',
            taxonomyPresetId: summary.taxonomy?.preset?.id || null,
        });
    }

    return summary;
};

module.exports = {
    bootstrapDefaultPresetsFromLocalSources,
    upsertTaxonomyPresetFromDefaults,
    upsertTemplatePresetFromLocalFile,
};
