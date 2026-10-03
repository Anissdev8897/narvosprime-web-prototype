/**
 * NARVOS PRIME — Create 4 test ADMIN accounts for automated testing agents.
 *
 * Usage:  node scripts/create-test-accounts.cjs
 *
 * Reads DATABASE_URL from ../.env, connects to MySQL, hashes passwords with bcryptjs,
 * upserts 4 test users (ADMIN role), then verifies each one by running bcrypt.compare
 * against the stored hash — the same path that electron/database.ts::verifyUser uses.
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal .env parser — LINE=VAL, ignore comments / blank lines. */
function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    console.error(`❌ .env not found: ${envPath}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

/** Parse a mysql:// URL into mysql2 Pool options. */
function parseDatabaseUrl(url) {
  // mysql://user:pass@host:port/dbname
  const u = new URL(url);
  return {
    host: u.hostname || '127.0.0.1',
    port: parseInt(u.port || '3306', 10),
    user: u.username || 'root',
    password: u.password || '',
    database: u.pathname.replace(/^\//, '') || 'worldnevaros',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('═══ NARVOS PRIME — Test Account Creator ═══\n');

  // 1. Load env
  const envPath = path.resolve(__dirname, '..', '.env');
  loadEnv(envPath);
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in .env');
    process.exit(1);
  }

  // Mask password for logging
  const safeUrl = dbUrl.replace(/:([^@]+)@/, ':****@');
  console.log(`📡 DATABASE_URL = ${safeUrl}`);

  const poolConfig = parseDatabaseUrl(dbUrl);
  console.log(`🔗 Connecting to ${poolConfig.user}@${poolConfig.host}:${poolConfig.port}/${poolConfig.database} ...`);

  let pool;
  try {
    pool = mysql.createPool({ ...poolConfig, connectTimeout: 5000 });
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('✅ MySQL connected.\n');
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  }

  // 2. Define test accounts
  const accounts = [
    { username: 'testagent1', password: 'testpass1', role: 'ADMIN' },
    { username: 'testagent2', password: 'testpass2', role: 'ADMIN' },
    { username: 'testagent3', password: 'testpass3', role: 'ADMIN' },
    { username: 'testagent4', password: 'testpass4', role: 'ADMIN' },
  ];

  // 3. Hash & upsert
  console.log('🔐 Hashing passwords with bcryptjs (salt rounds = 10)...\n');

  const salt = bcrypt.genSaltSync(10);

  for (const acct of accounts) {
    const hash = bcrypt.hashSync(acct.password, salt);
    try {
      await pool.execute(
        `INSERT INTO users (username, password_hash, role, email)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           password_hash = VALUES(password_hash),
           role = VALUES(role),
           email = VALUES(email)`,
        [acct.username, hash, acct.role, `${acct.username}@narvo.stest`]
      );
      console.log(`   ✅ ${acct.username} — created/updated`);
    } catch (err) {
      console.error(`   ❌ ${acct.username} — ${err.message}`);
    }
  }

  console.log('');

  // 4. Verify every account (mirrors verifyUser from electron/database.ts)
  console.log('🔍 Verifying accounts (bcrypt.compare against stored hash)...\n');
  let allGood = true;

  for (const acct of accounts) {
    try {
      const [rows] = await pool.execute(
        'SELECT id, username, password_hash, role FROM users WHERE username = ? LIMIT 1',
        [acct.username]
      );

      if (rows.length === 0) {
        console.log(`   ❌ ${acct.username} — NOT FOUND in database`);
        allGood = false;
        continue;
      }

      const user = rows[0];

      // Guard: must be bcrypt (same as database.ts:verifyUser)
      const isBcrypt =
        user.password_hash.startsWith('$2a$') ||
        user.password_hash.startsWith('$2b$') ||
        user.password_hash.startsWith('$2y$');

      if (!isBcrypt) {
        console.log(`   ❌ ${acct.username} — hash is NOT bcrypt (${user.password_hash.substring(0, 10)}...)`);
        allGood = false;
        continue;
      }

      const match = await bcrypt.compare(acct.password, user.password_hash);

      if (match) {
        console.log(`   ✅ ${acct.username} — LOGIN OK (id=${user.id}, role=${user.role})`);
      } else {
        console.log(`   ❌ ${acct.username} — PASSWORD MISMATCH`);
        allGood = false;
      }
    } catch (err) {
      console.error(`   ❌ ${acct.username} — ERROR: ${err.message}`);
      allGood = false;
    }
  }

  await pool.end();

  console.log('');
  if (allGood) {
    console.log('✅ ALL 4 TEST ACCOUNTS CREATED & VERIFIED SUCCESSFULLY');
    process.exit(0);
  } else {
    console.log('❌ SOME ACCOUNTS FAILED VERIFICATION — check logs above');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
