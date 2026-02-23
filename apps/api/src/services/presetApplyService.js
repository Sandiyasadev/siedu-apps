const { query, transaction } = require('../utils/db');
const { delByPattern } = require('../utils/cache');

const VALID_SCOPE = new Set(['taxonomy', 'templates', 'both']);
const VALID_MODE = new Set(['skip_existing', 'reactivate_existing']);

const normalizeMode = (mode) => (VALID_MODE.has(mode) ? mode : 'skip_existing');
const normalizeScope = (scope) => (VALID_SCOPE.has(scope) ? scope : 'both');

const invalidateBotCaches = async (botId) => {
    if (!botId) return;
    await delByPattern(`internal:template-taxonomy:${botId}:*`);
    await delByPattern(`internal:bot-templates:${botId}:*`);
};

const getTaxonomyPresetWithItems = async (client, presetId) => {
    const presetResult = await client.query('SELECT * FROM taxonomy_presets WHERE id = $1', [presetId]);
    if (presetResult.rows.length === 0) {
        const err = new Error('Taxonomy preset not found');
        err.code = 'TAXONOMY_PRESET_NOT_FOUND';
        throw err;
    }
    const categoriesResult = await client.query(
        `
        SELECT *
        FROM taxonomy_preset_categories
        WHERE preset_id = $1
        ORDER BY sort_order ASC, label ASC, key ASC
        `,
        [presetId]
    );
    const subcategoriesResult = await client.query(
        `
        SELECT *
        FROM taxonomy_preset_subcategories
        WHERE preset_id = $1
        ORDER BY category_key ASC, sort_order ASC, label ASC, key ASC
        `,
        [presetId]
    );

    return {
        preset: presetResult.rows[0],
        categories: categoriesResult.rows,
        subcategories: subcategoriesResult.rows,
    };
};

const getTemplatePresetWithItems = async (client, presetId) => {
    const presetResult = await client.query('SELECT * FROM template_presets WHERE id = $1', [presetId]);
    if (presetResult.rows.length === 0) {
        const err = new Error('Template preset not found');
        err.code = 'TEMPLATE_PRESET_NOT_FOUND';
        throw err;
    }
    const itemsResult = await client.query(
        `
        SELECT *
        FROM template_preset_items
        WHERE template_preset_id = $1
        ORDER BY sort_order ASC, category ASC, sub_category ASC NULLS LAST, name ASC
        `,
        [presetId]
    );
    return {
        preset: presetResult.rows[0],
        items: itemsResult.rows,
    };
};

async function applyTaxonomyPresetToBot(botId, taxonomyPresetId, options = {}) {
    if (!botId) throw new Error('botId is required');
    if (!taxonomyPresetId) throw new Error('taxonomyPresetId is required');
    const mode = normalizeMode(options.mode);

    const summary = {
        bot_id: botId,
        taxonomy_preset_id: taxonomyPresetId,
        mode,
        categories_total: 0,
        subcategories_total: 0,
        categories_created: 0,
        categories_skipped: 0,
        categories_reactivated: 0,
        subcategories_created: 0,
        subcategories_skipped: 0,
        subcategories_reactivated: 0,
    };

    await transaction(async (client) => {
        const { categories, subcategories } = await getTaxonomyPresetWithItems(client, taxonomyPresetId);
        summary.categories_total = categories.length;
        summary.subcategories_total = subcategories.length;

        for (const category of categories) {
            const result = await client.query(
                `
                INSERT INTO template_categories (
                    bot_id, key, label, description, sort_order, is_active
                )
                VALUES ($1,$2,$3,$4,$5,$6)
                ON CONFLICT (bot_id, key) DO NOTHING
                `,
                [
                    botId,
                    category.key,
                    category.label,
                    category.description || null,
                    category.sort_order || 0,
                    category.is_active !== false,
                ]
            );
            summary.categories_created += result.rowCount || 0;
        }

        for (const sub of subcategories) {
            const result = await client.query(
                `
                INSERT INTO template_subcategories (
                    bot_id, category_key, key, label, description,
                    reply_mode, greeting_policy, default_template_count,
                    strategy_pool, sort_order, is_active
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
                ON CONFLICT (bot_id, key) DO NOTHING
                `,
                [
                    botId,
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
                ]
            );
            summary.subcategories_created += result.rowCount || 0;
        }

        if (mode === 'reactivate_existing') {
            const activeCategoryKeys = categories.filter((c) => c.is_active !== false).map((c) => c.key);
            const activeSubcategoryKeys = subcategories.filter((s) => s.is_active !== false).map((s) => s.key);

            if (activeCategoryKeys.length > 0) {
                const result = await client.query(
                    `
                    UPDATE template_categories
                    SET is_active = true, updated_at = NOW()
                    WHERE bot_id = $1
                      AND key = ANY($2::text[])
                      AND is_active = false
                    `,
                    [botId, activeCategoryKeys]
                );
                summary.categories_reactivated = result.rowCount || 0;
            }

            if (activeSubcategoryKeys.length > 0) {
                const result = await client.query(
                    `
                    UPDATE template_subcategories
                    SET is_active = true, updated_at = NOW()
                    WHERE bot_id = $1
                      AND key = ANY($2::text[])
                      AND is_active = false
                    `,
                    [botId, activeSubcategoryKeys]
                );
                summary.subcategories_reactivated = result.rowCount || 0;
            }
        }
    });

    summary.categories_skipped = Math.max(0, summary.categories_total - summary.categories_created);
    summary.subcategories_skipped = Math.max(0, summary.subcategories_total - summary.subcategories_created);

    await invalidateBotCaches(botId);
    return summary;
}

async function applyTemplatePresetToBot(botId, templatePresetId, options = {}) {
    if (!botId) throw new Error('botId is required');
    if (!templatePresetId) throw new Error('templatePresetId is required');
    const mode = normalizeMode(options.mode);

    const summary = {
        bot_id: botId,
        template_preset_id: templatePresetId,
        mode,
        total_preset_templates: 0,
        created: 0,
        skipped_existing: 0,
        skipped_invalid: 0,
        skipped_missing_taxonomy: 0,
        reactivated: 0,
        by_intent: {},
    };

    const incIntent = (intent, key) => {
        const safeIntent = intent || '__no_intent__';
        if (!summary.by_intent[safeIntent]) {
            summary.by_intent[safeIntent] = {
                created: 0,
                skipped_existing: 0,
                skipped_invalid: 0,
                skipped_missing_taxonomy: 0,
                reactivated: 0,
            };
        }
        summary.by_intent[safeIntent][key] += 1;
    };

    await transaction(async (client) => {
        const { items } = await getTemplatePresetWithItems(client, templatePresetId);
        summary.total_preset_templates = items.length;

        const taxonomyRows = await client.query(
            `
            SELECT key
            FROM template_subcategories
            WHERE bot_id = $1
            `,
            [botId]
        );
        const taxonomyKeySet = new Set(taxonomyRows.rows.map((r) => r.key));

        for (const item of items) {
            const name = String(item.name || '').trim();
            const content = String(item.content || '').trim();
            const category = String(item.category || 'general').trim() || 'general';
            const subCategory = item.sub_category == null ? null : String(item.sub_category).trim() || null;
            const shortcut = item.shortcut == null ? null : String(item.shortcut).trim() || null;
            const isActive = item.is_active !== false;

            if (!name || !content) {
                summary.skipped_invalid += 1;
                incIntent(subCategory, 'skipped_invalid');
                continue;
            }

            if (subCategory && !taxonomyKeySet.has(subCategory)) {
                summary.skipped_missing_taxonomy += 1;
                incIntent(subCategory, 'skipped_missing_taxonomy');
                continue;
            }

            const existing = await client.query(
                `
                SELECT id, is_active
                FROM templates
                WHERE bot_id = $1
                  AND COALESCE(sub_category, '') = COALESCE($2, '')
                  AND LOWER(name) = LOWER($3)
                ORDER BY created_at ASC
                LIMIT 1
                `,
                [botId, subCategory, name]
            );

            if (existing.rows.length > 0) {
                summary.skipped_existing += 1;
                incIntent(subCategory, 'skipped_existing');
                if (mode === 'reactivate_existing' && existing.rows[0].is_active === false && isActive) {
                    await client.query(
                        'UPDATE templates SET is_active = true, updated_at = NOW() WHERE id = $1',
                        [existing.rows[0].id]
                    );
                    summary.reactivated += 1;
                    incIntent(subCategory, 'reactivated');
                }
                continue;
            }

            await client.query(
                `
                INSERT INTO templates (bot_id, name, content, category, sub_category, shortcut, is_active)
                VALUES ($1,$2,$3,$4,$5,$6,$7)
                `,
                [botId, name, content, category, subCategory, shortcut, isActive]
            );
            summary.created += 1;
            incIntent(subCategory, 'created');
        }
    });

    await invalidateBotCaches(botId);
    return summary;
}

async function previewTaxonomyPresetToBot(botId, taxonomyPresetId, options = {}) {
    if (!botId) throw new Error('botId is required');
    if (!taxonomyPresetId) throw new Error('taxonomyPresetId is required');
    const mode = normalizeMode(options.mode);

    const summary = {
        bot_id: botId,
        taxonomy_preset_id: taxonomyPresetId,
        mode,
        categories_total: 0,
        subcategories_total: 0,
        categories_created: 0,
        categories_skipped: 0,
        categories_reactivated: 0,
        subcategories_created: 0,
        subcategories_skipped: 0,
        subcategories_reactivated: 0,
    };

    await transaction(async (client) => {
        const { categories, subcategories } = await getTaxonomyPresetWithItems(client, taxonomyPresetId);
        summary.categories_total = categories.length;
        summary.subcategories_total = subcategories.length;

        const existingCategories = await client.query(
            'SELECT key, is_active FROM template_categories WHERE bot_id = $1',
            [botId]
        );
        const existingSubcategories = await client.query(
            'SELECT key, is_active FROM template_subcategories WHERE bot_id = $1',
            [botId]
        );

        const catMap = new Map(existingCategories.rows.map((r) => [r.key, r]));
        const subMap = new Map(existingSubcategories.rows.map((r) => [r.key, r]));

        for (const category of categories) {
            const existing = catMap.get(category.key);
            if (!existing) {
                summary.categories_created += 1;
            } else if (mode === 'reactivate_existing' && existing.is_active === false && category.is_active !== false) {
                summary.categories_reactivated += 1;
            }
        }

        for (const sub of subcategories) {
            const existing = subMap.get(sub.key);
            if (!existing) {
                summary.subcategories_created += 1;
            } else if (mode === 'reactivate_existing' && existing.is_active === false && sub.is_active !== false) {
                summary.subcategories_reactivated += 1;
            }
        }
    });

    summary.categories_skipped = Math.max(0, summary.categories_total - summary.categories_created);
    summary.subcategories_skipped = Math.max(0, summary.subcategories_total - summary.subcategories_created);
    return summary;
}

async function previewTemplatePresetToBot(botId, templatePresetId, options = {}) {
    if (!botId) throw new Error('botId is required');
    if (!templatePresetId) throw new Error('templatePresetId is required');
    const mode = normalizeMode(options.mode);

    const summary = {
        bot_id: botId,
        template_preset_id: templatePresetId,
        mode,
        total_preset_templates: 0,
        created: 0,
        skipped_existing: 0,
        skipped_invalid: 0,
        skipped_missing_taxonomy: 0,
        reactivated: 0,
        by_intent: {},
    };

    const incIntent = (intent, key) => {
        const safeIntent = intent || '__no_intent__';
        if (!summary.by_intent[safeIntent]) {
            summary.by_intent[safeIntent] = {
                created: 0,
                skipped_existing: 0,
                skipped_invalid: 0,
                skipped_missing_taxonomy: 0,
                reactivated: 0,
            };
        }
        summary.by_intent[safeIntent][key] += 1;
    };

    await transaction(async (client) => {
        const { items } = await getTemplatePresetWithItems(client, templatePresetId);
        summary.total_preset_templates = items.length;

        const taxonomyRows = await client.query(
            'SELECT key FROM template_subcategories WHERE bot_id = $1',
            [botId]
        );
        const taxonomyKeySet = new Set(taxonomyRows.rows.map((r) => r.key));

        const existingRows = await client.query(
            `
            SELECT id, is_active, sub_category, name
            FROM templates
            WHERE bot_id = $1
            `,
            [botId]
        );
        const existingMap = new Map(
            existingRows.rows.map((r) => [
                `${String(r.sub_category || '').toLowerCase()}::${String(r.name || '').toLowerCase()}`,
                r,
            ])
        );

        for (const item of items) {
            const name = String(item.name || '').trim();
            const content = String(item.content || '').trim();
            const subCategory = item.sub_category == null ? null : String(item.sub_category).trim() || null;
            const isActive = item.is_active !== false;

            if (!name || !content) {
                summary.skipped_invalid += 1;
                incIntent(subCategory, 'skipped_invalid');
                continue;
            }

            if (subCategory && !taxonomyKeySet.has(subCategory)) {
                summary.skipped_missing_taxonomy += 1;
                incIntent(subCategory, 'skipped_missing_taxonomy');
                continue;
            }

            const dedupeKey = `${String(subCategory || '').toLowerCase()}::${name.toLowerCase()}`;
            const existing = existingMap.get(dedupeKey);
            if (existing) {
                summary.skipped_existing += 1;
                incIntent(subCategory, 'skipped_existing');
                if (mode === 'reactivate_existing' && existing.is_active === false && isActive) {
                    summary.reactivated += 1;
                    incIntent(subCategory, 'reactivated');
                }
                continue;
            }

            summary.created += 1;
            incIntent(subCategory, 'created');
        }
    });

    return summary;
}

const buildWorkspacePreviewAggregate = (summary) => {
    const aggregate = {
        taxonomy: {
            categories_created: 0,
            categories_reactivated: 0,
            subcategories_created: 0,
            subcategories_reactivated: 0,
        },
        templates: {
            created: 0,
            reactivated: 0,
            skipped_existing: 0,
            skipped_missing_taxonomy: 0,
            skipped_invalid: 0,
        },
    };

    for (const r of summary.bot_results || []) {
        if (!r.success) continue;
        if (r.taxonomy) {
            aggregate.taxonomy.categories_created += r.taxonomy.categories_created || 0;
            aggregate.taxonomy.categories_reactivated += r.taxonomy.categories_reactivated || 0;
            aggregate.taxonomy.subcategories_created += r.taxonomy.subcategories_created || 0;
            aggregate.taxonomy.subcategories_reactivated += r.taxonomy.subcategories_reactivated || 0;
        }
        if (r.templates) {
            aggregate.templates.created += r.templates.created || 0;
            aggregate.templates.reactivated += r.templates.reactivated || 0;
            aggregate.templates.skipped_existing += r.templates.skipped_existing || 0;
            aggregate.templates.skipped_missing_taxonomy += r.templates.skipped_missing_taxonomy || 0;
            aggregate.templates.skipped_invalid += r.templates.skipped_invalid || 0;
        }
    }
    return aggregate;
};

async function previewPresetsToWorkspace(workspaceId, options = {}) {
    if (!workspaceId) throw new Error('workspaceId is required');

    const scope = normalizeScope(options.scope);
    const mode = normalizeMode(options.mode);
    const taxonomyPresetId = options.taxonomyPresetId || null;
    const templatePresetId = options.templatePresetId || null;

    if ((scope === 'taxonomy' || scope === 'both') && !taxonomyPresetId) {
        const err = new Error('taxonomyPresetId is required for scope taxonomy/both');
        err.status = 400;
        throw err;
    }
    if ((scope === 'templates' || scope === 'both') && !templatePresetId) {
        const err = new Error('templatePresetId is required for scope templates/both');
        err.status = 400;
        throw err;
    }

    const botsResult = await query(
        'SELECT id, name FROM bots WHERE workspace_id = $1 ORDER BY created_at ASC',
        [workspaceId]
    );
    const bots = botsResult.rows;

    const summary = {
        workspace_id: workspaceId,
        scope,
        mode,
        taxonomy_preset_id: taxonomyPresetId,
        template_preset_id: templatePresetId,
        bots_total: bots.length,
        bots_processed: 0,
        bots_failed: 0,
        bot_results: [],
        preview: true,
        aggregate: null,
    };

    for (const bot of bots) {
        const botSummary = { bot_id: bot.id, bot_name: bot.name, success: true, taxonomy: null, templates: null };
        try {
            if (scope === 'taxonomy' || scope === 'both') {
                botSummary.taxonomy = await previewTaxonomyPresetToBot(bot.id, taxonomyPresetId, { mode });
            }
            if (scope === 'templates' || scope === 'both') {
                botSummary.templates = await previewTemplatePresetToBot(bot.id, templatePresetId, { mode });
            }
            summary.bots_processed += 1;
        } catch (error) {
            botSummary.success = false;
            botSummary.error = error.message;
            summary.bots_failed += 1;
        }
        summary.bot_results.push(botSummary);
    }

    summary.aggregate = buildWorkspacePreviewAggregate(summary);
    return summary;
}

async function logPresetApply({
    workspaceId = null,
    botId = null,
    taxonomyPresetId = null,
    templatePresetId = null,
    mode = 'skip_existing',
    actionScope = 'both',
    summary = {},
    createdBy = null,
}) {
    await query(
        `
        INSERT INTO preset_apply_logs (
            workspace_id, bot_id, taxonomy_preset_id, template_preset_id,
            mode, action_scope, summary_json, created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
        `,
        [
            workspaceId,
            botId,
            taxonomyPresetId,
            templatePresetId,
            normalizeMode(mode),
            normalizeScope(actionScope),
            JSON.stringify(summary || {}),
            createdBy,
        ]
    );
}

async function applyPresetsToWorkspace(workspaceId, options = {}) {
    if (!workspaceId) throw new Error('workspaceId is required');

    const scope = normalizeScope(options.scope);
    const mode = normalizeMode(options.mode);
    const taxonomyPresetId = options.taxonomyPresetId || null;
    const templatePresetId = options.templatePresetId || null;

    if ((scope === 'taxonomy' || scope === 'both') && !taxonomyPresetId) {
        const err = new Error('taxonomyPresetId is required for scope taxonomy/both');
        err.status = 400;
        throw err;
    }
    if ((scope === 'templates' || scope === 'both') && !templatePresetId) {
        const err = new Error('templatePresetId is required for scope templates/both');
        err.status = 400;
        throw err;
    }

    const botsResult = await query(
        'SELECT id, name FROM bots WHERE workspace_id = $1 ORDER BY created_at ASC',
        [workspaceId]
    );
    const bots = botsResult.rows;

    const summary = {
        workspace_id: workspaceId,
        scope,
        mode,
        taxonomy_preset_id: taxonomyPresetId,
        template_preset_id: templatePresetId,
        bots_total: bots.length,
        bots_processed: 0,
        bots_failed: 0,
        bot_results: [],
    };

    for (const bot of bots) {
        const botSummary = { bot_id: bot.id, bot_name: bot.name, success: true, taxonomy: null, templates: null };
        try {
            if (scope === 'taxonomy' || scope === 'both') {
                botSummary.taxonomy = await applyTaxonomyPresetToBot(bot.id, taxonomyPresetId, { mode });
            }
            if (scope === 'templates' || scope === 'both') {
                botSummary.templates = await applyTemplatePresetToBot(bot.id, templatePresetId, { mode });
            }
            summary.bots_processed += 1;
        } catch (error) {
            botSummary.success = false;
            botSummary.error = error.message;
            summary.bots_failed += 1;
        }
        summary.bot_results.push(botSummary);
    }

    await logPresetApply({
        workspaceId,
        botId: null,
        taxonomyPresetId,
        templatePresetId,
        mode,
        actionScope: scope,
        summary,
        createdBy: options.createdBy || null,
    });

    return summary;
}

module.exports = {
    applyTaxonomyPresetToBot,
    applyTemplatePresetToBot,
    applyPresetsToWorkspace,
    previewTaxonomyPresetToBot,
    previewTemplatePresetToBot,
    previewPresetsToWorkspace,
    logPresetApply,
};
