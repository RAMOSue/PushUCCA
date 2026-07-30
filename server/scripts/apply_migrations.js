const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  try {
    console.log('Running migration:', filePath);
    await pool.query(sql);
    console.log('Migration applied:', filePath);
  } catch (err) {
    // Handle idempotent errors (object already exists) so migrations continue
    const ignorableCodes = ['42710', '42P07']; // trigger exists, duplicate_table
    const msg = err && err.message ? err.message : String(err);
    if (err && (ignorableCodes.includes(err.code) || /already exists/i.test(msg))) {
      console.warn('Migration warning (ignored):', filePath, msg);
      return;
    }

    console.error('Migration failed:', filePath, err.message);
    throw err;
  }
}

async function main() {
  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      const full = path.join(migrationsDir, f);
      await runMigration(full);
    }
    console.log('All migrations completed');
  } catch (err) {
    console.error('Error running migrations:', err);
  } finally {
    // Allow process to exit
    pool.end().then(() => process.exit(0)).catch(() => process.exit(1));
  }
}

main();
