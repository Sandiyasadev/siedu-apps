#!/usr/bin/env node
/**
 * Reset Password CLI Script
 * 
 * Usage:
 *   node scripts/reset-password.js --email "admin@tokoabc.com" --password "newpassword123"
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, shutdown } = require('../src/utils/db');

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

    if (!parsed.email || !parsed.password) {
        console.error('\n❌ Error: --email dan --password wajib diisi!\n');
        console.log('Usage:');
        console.log('  node scripts/reset-password.js --email "email@klien.com" --password "passwordbaru"\n');
        process.exit(1);
    }

    if (parsed.password.length < 6) {
        console.error('\n❌ Error: Password minimal 6 karakter!\n');
        process.exit(1);
    }

    return parsed;
}

// ============================================
// Main Script
// ============================================
async function main() {
    const args = parseArgs();
    const email = args.email.toLowerCase();
    const newPassword = args.password;

    console.log('\n🔧 Mereset password...\n');

    try {
        // Check if user exists
        const userResult = await query(
            'SELECT id, email, name, workspace_id FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            console.error(`❌ Error: User dengan email "${email}" tidak ditemukan!\n`);
            process.exit(1);
        }

        const user = userResult.rows[0];

        // Hash new password
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        // Update password
        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, user.id]
        );

        console.log('='.repeat(50));
        console.log('  ✅ PASSWORD BERHASIL DIRESET!');
        console.log('='.repeat(50));
        console.log(`  User     : ${user.name}`);
        console.log(`  Email    : ${user.email}`);
        console.log(`  Password : ${newPassword}`);
        console.log('='.repeat(50));
        console.log('  ⚠️  Simpan password ini dan kirim ke klien.');
        console.log('='.repeat(50) + '\n');

    } catch (error) {
        console.error(`\n❌ Error: ${error.message}\n`);
        process.exit(1);
    } finally {
        await shutdown();
    }
}

main();
