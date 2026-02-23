#!/usr/bin/env node
/**
 * Import generator output JSON into default template preset format.
 *
 * Usage:
 *   node scripts/import-template-preset.js <input.json> [output.json]
 *
 * Example:
 *   node scripts/import-template-preset.js \
 *     /path/to/templates_review_ready_taxonomy_2026-02-23.json \
 *     src/data/template-presets/default-v1.json
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_OUTPUT = path.join(__dirname, '..', 'src', 'data', 'template-presets', 'default-v1.json');
const DEFAULT_DISABLED_INTENTS = new Set([
    'conversion.follow_up_ghosting',
    'fallback.human_handoff',
]);

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to read/parse JSON "${filePath}": ${error.message}`);
    }
}

function writeJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeTemplate(template) {
    return {
        name: String(template?.name || '').trim(),
        content: String(template?.content || '').trim(),
        category: String(template?.category || 'general').trim() || 'general',
        sub_category:
            template?.sub_category === null || template?.sub_category === undefined
                ? null
                : String(template.sub_category).trim() || null,
        shortcut:
            template?.shortcut === null || template?.shortcut === undefined
                ? undefined
                : String(template.shortcut).trim() || null,
        is_active:
            template?.is_active === false
                ? false
                : !DEFAULT_DISABLED_INTENTS.has(String(template?.sub_category || '').trim()),
        strategy_tag:
            template?.strategy_tag === undefined ? undefined : String(template.strategy_tag || '').trim(),
        requires_rag: !!template?.requires_rag,
    };
}

function buildPreset(source, options = {}) {
    if (!Array.isArray(source.templates)) {
        throw new Error('Input JSON must contain `templates` array');
    }

    const seen = new Set();
    const templates = [];
    const stats = {
        total_input_templates: source.templates.length,
        imported_templates: 0,
        skipped_invalid: 0,
        skipped_duplicate: 0,
        auto_inactive_marked: 0,
    };

    for (const raw of source.templates) {
        const t = normalizeTemplate(raw);
        if (!t.name || !t.content) {
            stats.skipped_invalid += 1;
            continue;
        }

        const dedupeKey = `${(t.sub_category || '').toLowerCase()}::${t.name.toLowerCase()}`;
        if (seen.has(dedupeKey)) {
            stats.skipped_duplicate += 1;
            continue;
        }
        seen.add(dedupeKey);

        if (DEFAULT_DISABLED_INTENTS.has(String(t.sub_category || '')) && t.is_active === false) {
            stats.auto_inactive_marked += 1;
        }

        // Keep preset payload lean but preserve useful metadata.
        const out = {
            name: t.name,
            content: t.content,
            category: t.category,
            sub_category: t.sub_category,
            is_active: t.is_active,
        };
        if (t.shortcut !== undefined) out.shortcut = t.shortcut;
        if (t.strategy_tag) out.strategy_tag = t.strategy_tag;
        if (t.requires_rag) out.requires_rag = true;

        templates.push(out);
    }

    stats.imported_templates = templates.length;

    const sourceMeta = source.meta && typeof source.meta === 'object' ? { ...source.meta } : {};
    if (sourceMeta.bot_id) {
        sourceMeta.source_bot_id = sourceMeta.bot_id;
        delete sourceMeta.bot_id;
    }

    return {
        preset_key: options.presetKey || 'default-v1',
        preset_version: Number(options.presetVersion || 1),
        meta: {
            name: options.name || 'Default Master Templates V1',
            mode: 'taxonomy-driven',
            source: 'generator-review-json',
            imported_at: new Date().toISOString(),
            source_generator_meta: sourceMeta,
            import_stats: stats,
            note: 'Generated from template-generator JSON. Templates remain editable after apply to each bot.',
        },
        quality_report: Array.isArray(source.quality_report) ? source.quality_report : [],
        templates,
    };
}

function main() {
    const [, , inputArg, outputArg, presetKeyArg, presetVersionArg] = process.argv;

    if (!inputArg || ['-h', '--help'].includes(inputArg)) {
        console.log('Usage: node scripts/import-template-preset.js <input.json> [output.json] [preset_key] [preset_version]');
        console.log('');
        console.log('Imports generator output JSON (with templates[]) into preset format for /v1/templates/apply-default.');
        process.exit(inputArg ? 0 : 1);
    }

    const inputPath = path.resolve(process.cwd(), inputArg);
    const outputPath = path.resolve(process.cwd(), outputArg || DEFAULT_OUTPUT);
    const source = readJson(inputPath);
    const preset = buildPreset(source, {
        presetKey: presetKeyArg || 'default-v1',
        presetVersion: presetVersionArg ? Number(presetVersionArg) : 1,
    });

    writeJson(outputPath, preset);

    const s = preset.meta.import_stats;
    console.log(`✅ Preset written: ${outputPath}`);
    console.log(`   preset_key: ${preset.preset_key}`);
    console.log(`   templates imported: ${s.imported_templates}/${s.total_input_templates}`);
    console.log(`   skipped invalid: ${s.skipped_invalid}`);
    console.log(`   skipped duplicate: ${s.skipped_duplicate}`);
    console.log(`   auto-marked inactive: ${s.auto_inactive_marked}`);
    console.log(`   quality_report entries: ${Array.isArray(preset.quality_report) ? preset.quality_report.length : 0}`);
  }

main();
