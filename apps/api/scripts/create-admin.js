#!/usr/bin/env node
/**
 * Create Admin User Script
 * Usage: node scripts/create-admin.js <email> <password> [name]
 * 
 * Run from inside the API container:
 *   docker-compose exec api node scripts/create-admin.js admin@example.com mypassword "Admin Name"
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

async function createAdmin() {
    const [, , email, password, name] = process.argv;

    if (!email || !password) {
        console.error('Usage: node scripts/create-admin.js <email> <password> [name]');
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        // Ensure default workspace exists
        await pool.query(
            `INSERT INTO workspaces (id, name, slug) 
             VALUES ($1, 'Default Workspace', 'default') 
             ON CONFLICT (id) DO NOTHING`,
            [WORKSPACE_ID]
        );

        // Check if user already exists
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            console.error(`Error: User with email "${email}" already exists.`);
            process.exit(1);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, name, role, workspace_id) 
             VALUES ($1, $2, $3, 'admin', $4) 
             RETURNING id, email, name, role`,
            [email.toLowerCase(), passwordHash, name || email.split('@')[0], WORKSPACE_ID]
        );

        const user = result.rows[0];
        console.log('✅ Admin user created successfully:');
        console.log(`   ID:    ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Name:  ${user.name}`);
        console.log(`   Role:  ${user.role}`);
    } catch (error) {
        console.error('Failed to create admin:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

createAdmin();
