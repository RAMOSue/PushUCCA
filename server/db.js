const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pooling configuration
  max: process.env.NODE_ENV === "production" ? 30 : 15, // Increased from default 10
  min: process.env.NODE_ENV === "production" ? 5 : 2,   // Keep warm connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout new connections after 5s
  allowExitOnIdle: true,       // Allow pool to exit when idle
  ssl: 
    process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Log pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;


/* user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'ucca',
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,*/