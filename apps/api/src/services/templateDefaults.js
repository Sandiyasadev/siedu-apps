const fs = require('fs');
const path = require('path');
const { transaction } = require('../utils/db');
const { delByPattern } = require('../utils/cache');

const PRESET_REGISTRY = {
    'default-v1': path.join(__dirname, '..', 'data', 'template-presets', 'default-v1.json'),
};

const normalizeText = (value) => String(value ?? '').trim();

const loadTemplatePreset = (presetKey = 'default-v1') => {
    const filePath = PRESET_REGISTRY[presetKey];
    if (!filePath) {
        const err = new Error(`Unknown template preset: ${presetKey}`);
        err.code = 'PRESET_NOT_FOUND';
        throw err;
    }

    let raw;
    try {
        raw = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        const err = new Error(`Failed to read preset file for ${presetKey}: ${error.message}`);
        err.code = 'PRESET_READ_FAILED';
        throw err;
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        const err = new Error(`Invalid preset JSON for ${presetKey}: ${error.message}`);
        err.code = 'PRESET_INVALID_JSON';
        throw err;
    }

    const templates = Array.isArray(parsed.templates) ? parsed.templates : [];
    return {
        preset_key: parsed.preset_key || presetKey,
        preset_version: parsed.preset_version || 1,
        meta: parsed.meta || {},
        templates,
    };
};

const invalidateTemplateCaches = async (botId) => {
    await delByPattern(`internal:bot-templates:${botId}:*`);
    await delByPattern(`internal:template-taxonomy:${botId}:*`);
};

async function seedDefaultTemplatesForBot(botId, options = {}) {
    if (!botId) throw new Error('botId is required');
    const mode = options.mode === 'reactivate_existing' ? 'reactivate_existing' : 'skip_existing';
    const presetKey = options.presetKey || 'default-v1';
    const preset = loadTemplatePreset(presetKey);

    const templates = Array.isArray(preset.templates) ? preset.templates : [];
    if (templates.length === 0) {
        const err = new Error(`Preset ${presetKey} has no templates`);
        err.code = 'PRESET_EMPTY';
        throw err;
    }

    const summary = {
        bot_id: botId,
        mode,
        preset_key: preset.preset_key,
        preset_version: preset.preset_version,
        total_preset_templates: templates.length,
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
        const taxonomyRows = await client.query(
            `
            SELECT s.key
            FROM template_subcategories s
            LEFT JOIN template_categories c
              ON c.bot_id = s.bot_id AND c.key = s.category_key
            WHERE s.bot_id = $1
              AND s.is_active = true
              AND COALESCE(c.is_active, true) = true
            `,
            [botId]
        );
        const activeIntentKeys = new Set(taxonomyRows.rows.map((r) => r.key));

        for (const tpl of templates) {
            const name = normalizeText(tpl.name);
            const content = normalizeText(tpl.content);
            const category = normalizeText(tpl.category) || 'general';
            const subCategoryRaw = tpl.sub_category === undefined ? null : tpl.sub_category;
            const subCategory = subCategoryRaw == null ? null : normalizeText(subCategoryRaw);
            const shortcut = normalizeText(tpl.shortcut) || null;
            const isActive = tpl.is_active !== false;

            if (!name || !content) {
                summary.skipped_invalid += 1;
                incIntent(subCategory, 'skipped_invalid');
                continue;
            }

            if (subCategory && !activeIntentKeys.has(subCategory)) {
                // Allow seeding to inactive/default-disabled intents if taxonomy row exists (active check above blocks it).
                // Check existence only as fallback to avoid losing templates for intentionally disabled intents.
                const taxonomyExists = await client.query(
                    'SELECT id FROM template_subcategories WHERE bot_id = $1 AND key = $2',
                    [botId, subCategory]
                );
                if (taxonomyExists.rows.length === 0) {
                    summary.skipped_missing_taxonomy += 1;
                    incIntent(subCategory, 'skipped_missing_taxonomy');
                    continue;
                }
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
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                `,
                [botId, name, content, category, subCategory, shortcut, isActive]
            );

            summary.created += 1;
            incIntent(subCategory, 'created');
        }
    });

    await invalidateTemplateCaches(botId);
    return summary;
}

module.exports = {
    loadTemplatePreset,
    seedDefaultTemplatesForBot,
    PRESET_REGISTRY,
};
