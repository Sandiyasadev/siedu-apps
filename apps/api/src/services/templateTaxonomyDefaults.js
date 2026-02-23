const { transaction } = require('../utils/db');
const { delByPattern } = require('../utils/cache');

const DEFAULT_TEMPLATE_CATEGORIES = [
    { key: 'engagement', label: 'Engagement', description: 'Fase pembuka, sapaan, dan interaksi awal pelanggan', sort_order: 10 },
    { key: 'discovery', label: 'Discovery', description: 'Fase eksplorasi layanan, kebutuhan, dan informasi awal', sort_order: 20 },
    { key: 'evaluation', label: 'Evaluation', description: 'Fase pertimbangan harga, value, resiko, dan kredibilitas', sort_order: 30 },
    { key: 'conversion', label: 'Conversion', description: 'Fase CTA, booking, pembayaran, dan konfirmasi transaksi', sort_order: 40 },
    { key: 'retention', label: 'Retention', description: 'Fase after-sales, komplain, progres, reschedule, dan kendala teknis', sort_order: 50 },
    { key: 'fallback', label: 'Fallback', description: 'Intent fallback untuk spam, out-of-scope, dan handoff', sort_order: 60 },
];

const DEFAULT_TEMPLATE_SUBCATEGORIES = [
    {
        category_key: 'engagement',
        key: 'engagement.greeting_new',
        label: 'Greeting New',
        description: 'Warm welcome for first-time users. Establish a positive first impression and ask how to help.',
        reply_mode: 'opening',
        greeting_policy: 'required',
        default_template_count: 3,
        sort_order: 10,
    },
    {
        category_key: 'engagement',
        key: 'engagement.greeting_return',
        label: 'Greeting Return',
        description: 'Welcome back returning users. Acknowledge their return warmly without hard-selling.',
        reply_mode: 'opening',
        greeting_policy: 'required',
        default_template_count: 3,
        sort_order: 20,
    },
    {
        category_key: 'engagement',
        key: 'engagement.time_inquiry',
        label: 'Time Inquiry',
        description: 'Answer inquiries about operational hours, holidays, and schedule availability.',
        reply_mode: 'mixed',
        greeting_policy: 'optional_short',
        default_template_count: 3,
        sort_order: 30,
    },
    {
        category_key: 'engagement',
        key: 'engagement.thank_you_closing',
        label: 'Thank You Closing',
        description: "Politely respond to 'thank you'. Close the conversation gracefully and offer future assistance.",
        reply_mode: 'continuation',
        greeting_policy: 'optional_short',
        default_template_count: 3,
        sort_order: 40,
    },
    {
        category_key: 'discovery',
        key: 'discovery.service_catalog',
        label: 'Service Catalog',
        description: 'Provide a clear, scannable list or catalog of all available services, menus, or pricelists.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 10,
    },
    {
        category_key: 'discovery',
        key: 'discovery.service_detail',
        label: 'Service Detail',
        description: 'Explain specific procedures, tools, or inclusions of a single requested service.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 4,
        sort_order: 20,
    },
    {
        category_key: 'discovery',
        key: 'discovery.service_requirement',
        label: 'Service Requirement',
        description: 'Explain prerequisites or preparations needed before a service (e.g., fasting, clean hair).',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 30,
    },
    {
        category_key: 'discovery',
        key: 'discovery.custom_request',
        label: 'Custom Request',
        description: 'Handle custom service requests. Politely accept or decline while offering best alternatives.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 40,
    },
    {
        category_key: 'discovery',
        key: 'discovery.staff_profile',
        label: 'Staff Profile',
        description: 'Build credibility by explaining staff or expert qualifications, experience, and certifications.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 50,
    },
    {
        category_key: 'discovery',
        key: 'discovery.promo_inquiry',
        label: 'Promo Inquiry',
        description: 'Answer questions about active promos or discounts. State T&C clearly, or decline politely if none exist.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 4,
        sort_order: 60,
    },
    {
        category_key: 'discovery',
        key: 'discovery.facilities_parking',
        label: 'Facilities Parking',
        description: 'Provide details on physical location, parking availability, waiting rooms, and directions.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 70,
    },
    {
        category_key: 'evaluation',
        key: 'evaluation.pricing_inquiry',
        label: 'Pricing Inquiry',
        description: 'Provide specific price information directly without assuming the customer is objecting to the price.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 4,
        sort_order: 10,
    },
    {
        category_key: 'evaluation',
        key: 'evaluation.objection_price',
        label: 'Objection Price',
        description: "Handle 'too expensive' complaints. Shift the focus from price to value, quality, and benefits.",
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 4,
        sort_order: 20,
    },
    {
        category_key: 'evaluation',
        key: 'evaluation.objection_compare',
        label: 'Objection Compare',
        description: 'Handle comparisons with competitors. Highlight unique differentiators without badmouthing others.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 30,
    },
    {
        category_key: 'evaluation',
        key: 'evaluation.objection_risk',
        label: 'Objection Risk',
        description: 'Handle customer fears of bad results. Offer guarantees, risk reversals, or safety protocols.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 4,
        sort_order: 40,
    },
    {
        category_key: 'evaluation',
        key: 'evaluation.objection_authority',
        label: 'Objection Authority',
        description: 'Handle doubts about business credibility. Provide social proof, testimonials, or legalities.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 50,
    },
    {
        category_key: 'evaluation',
        key: 'evaluation.objection_urgency',
        label: 'Objection Urgency',
        description: 'Respond to users delaying their decision. Provide breathing room while creating gentle urgency.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 60,
    },
    {
        category_key: 'conversion',
        key: 'conversion.soft',
        label: 'Soft CTA',
        description: 'Provide a gentle Call-to-Action (CTA) for interested but hesitant users.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 10,
    },
    {
        category_key: 'conversion',
        key: 'conversion.book_appointment',
        label: 'Book Appointment',
        description: 'Guide users to book or reserve step-by-step. Ask for necessary details one at a time.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 4,
        sort_order: 20,
    },
    {
        category_key: 'conversion',
        key: 'conversion.payment_instruction',
        label: 'Payment Instruction',
        description: 'Provide clear payment methods and instruct the user to send transfer proof.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 30,
    },
    {
        category_key: 'conversion',
        key: 'conversion.confirm',
        label: 'Confirm',
        description: 'Confirm received payment or booking and clearly explain the next steps.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 40,
    },
    {
        category_key: 'conversion',
        key: 'conversion.follow_up_ghosting',
        label: 'Follow Up Ghosting',
        description: 'Proactive follow-up for users who ghosted/read without replying. Use empathy and avoid being spammy.',
        reply_mode: 'opening',
        greeting_policy: 'optional_short',
        default_template_count: 4,
        sort_order: 50,
        is_active: false,
    },
    {
        category_key: 'retention',
        key: 'retention.complaint_handling',
        label: 'Complaint Handling',
        description: 'Handle service complaints or refund requests with high empathy. Validate feelings and offer concrete solutions.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 4,
        sort_order: 10,
    },
    {
        category_key: 'retention',
        key: 'retention.progress_inquiry',
        label: 'Progress Inquiry',
        description: 'Update users on their ongoing service status and provide estimated completion times.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 20,
    },
    {
        category_key: 'retention',
        key: 'retention.reschedule',
        label: 'Reschedule',
        description: 'Assist users wanting to reschedule or cancel bookings. Explain terms and conditions politely.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 30,
    },
    {
        category_key: 'retention',
        key: 'retention.technical_issue',
        label: 'Technical Issue',
        description: 'Handle technical errors (broken links, QRIS failed). Apologize and provide manual alternatives.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 40,
    },
    {
        category_key: 'fallback',
        key: 'fallback.spam_random',
        label: 'Spam Random',
        description: "Handle spam, typos, or random chats (e.g., 'P', 'wkwk'). Stay professional and redirect to services.",
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 4,
        sort_order: 10,
    },
    {
        category_key: 'fallback',
        key: 'fallback.human_handoff',
        label: 'Human Handoff',
        description: 'Handle explicit requests for human agents. Inform wait times and simulate transferring the chat.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 20,
        is_active: false,
    },
    {
        category_key: 'fallback',
        key: 'fallback.out_of_scope',
        label: 'Out Of Scope',
        description: 'Politely decline out-of-bounds questions and redirect to main services.',
        reply_mode: 'continuation',
        greeting_policy: 'forbidden',
        default_template_count: 3,
        sort_order: 30,
    },
];

async function invalidateTaxonomyCaches(botId) {
    await delByPattern(`internal:template-taxonomy:${botId}:*`);
    await delByPattern(`internal:bot-templates:${botId}:*`);
}

async function seedDefaultTemplateTaxonomyForBot(botId, options = {}) {
    const mode = options.mode === 'reactivate_existing' ? 'reactivate_existing' : 'skip_existing';
    if (!botId) throw new Error('botId is required');

    const summary = {
        bot_id: botId,
        mode,
        categories_total_default: DEFAULT_TEMPLATE_CATEGORIES.length,
        subcategories_total_default: DEFAULT_TEMPLATE_SUBCATEGORIES.length,
        categories_created: 0,
        subcategories_created: 0,
        categories_reactivated: 0,
        subcategories_reactivated: 0,
    };

    await transaction(async (client) => {
        for (const category of DEFAULT_TEMPLATE_CATEGORIES) {
            const insertResult = await client.query(
                `
                INSERT INTO template_categories (bot_id, key, label, description, sort_order, is_active)
                VALUES ($1, $2, $3, $4, $5, $6)
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
            summary.categories_created += insertResult.rowCount || 0;
        }

        for (const sub of DEFAULT_TEMPLATE_SUBCATEGORIES) {
            const insertResult = await client.query(
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
                    sub.reply_mode,
                    sub.greeting_policy,
                    sub.default_template_count || 3,
                    JSON.stringify(sub.strategy_pool || []),
                    sub.sort_order || 0,
                    sub.is_active !== false,
                ]
            );
            summary.subcategories_created += insertResult.rowCount || 0;
        }

        if (mode === 'reactivate_existing') {
            const categoryKeys = DEFAULT_TEMPLATE_CATEGORIES
                .filter((c) => c.is_active !== false)
                .map((c) => c.key);
            const subcategoryKeys = DEFAULT_TEMPLATE_SUBCATEGORIES
                .filter((s) => s.is_active !== false)
                .map((s) => s.key);

            if (categoryKeys.length > 0) {
                const reactivateCategories = await client.query(
                    `
                    UPDATE template_categories
                    SET is_active = true, updated_at = NOW()
                    WHERE bot_id = $1
                      AND key = ANY($2::text[])
                      AND is_active = false
                    `,
                    [botId, categoryKeys]
                );
                summary.categories_reactivated = reactivateCategories.rowCount || 0;
            }

            if (subcategoryKeys.length > 0) {
                const reactivateSubcategories = await client.query(
                    `
                    UPDATE template_subcategories
                    SET is_active = true, updated_at = NOW()
                    WHERE bot_id = $1
                      AND key = ANY($2::text[])
                      AND is_active = false
                    `,
                    [botId, subcategoryKeys]
                );
                summary.subcategories_reactivated = reactivateSubcategories.rowCount || 0;
            }
        }
    });

    summary.categories_skipped = summary.categories_total_default - summary.categories_created;
    summary.subcategories_skipped = summary.subcategories_total_default - summary.subcategories_created;

    await invalidateTaxonomyCaches(botId);
    return summary;
}

module.exports = {
    DEFAULT_TEMPLATE_CATEGORIES,
    DEFAULT_TEMPLATE_SUBCATEGORIES,
    seedDefaultTemplateTaxonomyForBot,
};
