const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: 
    process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

module.exports = pool;


/* user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'ucca',
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,*/