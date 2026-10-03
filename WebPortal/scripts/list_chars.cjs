
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Look for .env in parent dir (WebPortal root)
dotenv.config({ path: path.join(__dirname, '../.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing in root .env or .env.local');
    process.exit(1);
  }

  console.log('Connecting to:', process.env.DATABASE_URL.split('@')[1] || 'DB');

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await connection.execute('SELECT id, name, class_id FROM characters');
    console.log('--- CHARACTERS IN DB ---');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Query Error:', err.message);
  } finally {
    await connection.end();
  }
}

run();
