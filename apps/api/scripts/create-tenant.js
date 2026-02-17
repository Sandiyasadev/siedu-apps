#!/usr/bin/env node
/**
 * Create Tenant CLI Script
 * 
 * Usage:
 *   node scripts/create-tenant.js --name "Toko ABC" --email "admin@tokoabc.com"
 *   node scripts/create-tenant.js --name "Toko ABC" --email "admin@tokoabc.com" --password "custom123"
 *
 * This script creates:
 *   1. A new Workspace
 *   2. An Admin User for that workspace
 *   3. A default Bot configuration
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { transaction, shutdown } = require('../src/utils/db');

// ============================================
// Parse CLI Arguments
// ============================================
function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {};

    for (let i = 0; i < args.length; i += 2) {
        const key = args[i]?.replace(/^--/, '');
        const value = args[i + 1];
        if (key && value) parsed[key] = value;
    }

    if (!parsed.name || !parsed.email) {
        console.error('\n❌ Error: --name dan --email wajib diisi!\n');
        console.log('Usage:');
        console.log('  node scripts/create-tenant.js --name "Nama Klien" --email "email@klien.com"');
        console.log('  node scripts/create-tenant.js --name "Nama Klien" --email "email@klien.com" --password "custom123"\n');
        process.exit(1);
    }

    return parsed;
}

// ============================================
// Generate Secure Random Password
// ============================================
function generatePassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let password = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        password += chars[bytes[i] % chars.length];
    }
    return password;
}

// ============================================
// Main Script
// ============================================
async function main() {
    const args = parseArgs();
    const tenantName = args.name;
    const email = args.email.toLowerCase();
    const password = args.password || generatePassword();

    console.log('\n🔧 Membuat tenant baru...\n');

    try {
        const result = await transaction(async (client) => {
            // Step 1: Create Workspace
            const slug = tenantName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

            const wsResult = await client.query(
                `INSERT INTO workspaces (name, slug) 
                 VALUES ($1, $2) 
                 RETURNING id, name, slug`,
                [tenantName, slug]
            );
            const workspace = wsResult.rows[0];
            console.log(`✅ Workspace dibuat: ${workspace.name} (${workspace.id})`);

            // Step 2: Create Admin User
            const salt = await bcrypt.genSalt(12);
            const passwordHash = await bcrypt.hash(password, salt);

            const userResult = await client.query(
                `INSERT INTO users (email, password_hash, name, role, workspace_id) 
                 VALUES ($1, $2, $3, 'admin', $4) 
                 RETURNING id, email, name, role`,
                [email, passwordHash, tenantName + ' Admin', workspace.id]
            );
            const user = userResult.rows[0];
            console.log(`✅ Admin user dibuat: ${user.email}`);

            // Step 3: Create Default Bot
            const botResult = await client.query(
                `INSERT INTO bots (workspace_id, name, system_prompt) 
                 VALUES ($1, $2, $3) 
                 RETURNING id, name`,
                [
                    workspace.id,
                    tenantName + ' Bot',
                    `Kamu adalah asisten AI untuk ${tenantName}. Jawab pertanyaan pelanggan dengan ramah dan profesional dalam Bahasa Indonesia.`
                ]
            );
            const bot = botResult.rows[0];
            console.log(`✅ Default bot dibuat: ${bot.name}`);

            return { workspace, user, bot };
        });

        // Output Summary
        console.log('\n' + '='.repeat(50));
        console.log('  🎉 TENANT BERHASIL DIBUAT!');
        console.log('='.repeat(50));
        console.log(`  Workspace : ${result.workspace.name}`);
        console.log(`  Slug      : ${result.workspace.slug}`);
        console.log(`  Email     : ${result.user.email}`);
        console.log(`  Password  : ${password}`);
        console.log(`  Bot       : ${result.bot.name}`);
        console.log('='.repeat(50));
        console.log('  ⚠️  Simpan password ini! Tidak bisa dilihat lagi.');
        console.log('='.repeat(50) + '\n');

    } catch (error) {
        if (error.code === '23505') {
            // Unique constraint violation
            if (error.constraint?.includes('email')) {
                console.error(`\n❌ Error: Email "${email}" sudah terdaftar!\n`);
            } else if (error.constraint?.includes('slug')) {
                console.error(`\n❌ Error: Workspace "${tenantName}" sudah ada!\n`);
            } else {
                console.error(`\n❌ Error: Data duplikat - ${error.detail}\n`);
            }
        } else {
            console.error(`\n❌ Error: ${error.message}\n`);
        }
        process.exit(1);
    } finally {
        await shutdown();
    }
}

main();
