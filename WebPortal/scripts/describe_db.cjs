
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
}

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('Tables:', JSON.stringify(tables, null, 2));
    
    for (const t of tables) {
      const tableName = Object.values(t)[0];
      const [cols] = await connection.execute(`DESCRIBE ${tableName}`);
      console.log(`Table: ${tableName}`, JSON.stringify(cols, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

run();
