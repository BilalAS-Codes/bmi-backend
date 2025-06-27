const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user : process.env.MASTER_USERNAME ,
  host : process.env.HOST,
  database : process.env.DB_NAME,
  password : process.env.MASTER_PASSWORD,
  port : process.env.PORT,
  ssl: {
    rejectUnauthorized: false,
  },
  
  idleTimeoutMillis: 10000, 
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.stack);
});

const connectDB = async () => {
  try {
    // Test connection
    const client = await pool.connect();
    console.log('Connected to PostgreSQL');
    client.release();
  } catch (err) {
    console.error('Connection failed:', err);
    process.exit(1);
  }
};

module.exports = {
  pool,
  connectDB,
};
