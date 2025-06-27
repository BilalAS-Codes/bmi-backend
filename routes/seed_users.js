const axios = require('axios');
const express = require('express');
const { pool } = require('../connection'); 
const router = express.Router();

// Helper to sanitize column names
function sanitizeKey(key) {
  return key.toLowerCase().replace(/\s+/g, '_');
}

// Determine PostgreSQL data type from value
function getPostgresType(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'INTEGER' : 'REAL';
  }
  if (typeof value === 'boolean') {
    return 'BOOLEAN';
  }
  if (typeof value === 'string') {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    if (isoDateRegex.test(value)) {
      return 'TIMESTAMP';
    }
    return 'TEXT';
  }
  return 'TEXT';
}

// Get existing columns from a table
async function getExistingColumns(tableName) {
  const result = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = $1
  `, [tableName]);
  return result.rows.map(r => r.column_name);
}

// Create or alter table based on record structure
async function ensureTableExistsAndUpdated(tableName, record) {
  const existingColumns = await getExistingColumns(tableName);
  const keys = Object.keys(record).filter(k => sanitizeKey(k) !== 'id');

  if (existingColumns.length === 0) {
    // Create new table with inferred schema
    const columns = keys.map(k => {
      const colName = sanitizeKey(k);
      const pgType = getPostgresType(record[k]);
      return `"${colName}" ${pgType}`;
    }).join(', ');

    await pool.query(`
      CREATE TABLE ${tableName} (
        id SERIAL PRIMARY KEY,
        ${columns}
      )
    `);
    return;
  }

  // Add any new columns to existing table
  for (const key of keys) {
    const col = sanitizeKey(key);
    if (!existingColumns.includes(col)) {
      const pgType = getPostgresType(record[key]);
      await pool.query(`ALTER TABLE ${tableName} ADD COLUMN "${col}" ${pgType}`);
    }
  }
}

// Insert record into table with conflict handling
async function insertRecord(tableName, record) {
  const rawKeys = Object.keys(record).filter(k => sanitizeKey(k) !== 'id');
  const columns = rawKeys.map(k => `"${sanitizeKey(k)}"`).join(', ');
  const values = rawKeys.map(k => record[k]);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

  await pool.query(
    `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})
     ON CONFLICT DO NOTHING`, 
    values
  );
}

// Sync anganwadi workers from external API
router.post('/sync-users', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const usersRes = await axios.get('https://ai-height-estimate.onrender.com/master-users');
    const users = Array.isArray(usersRes.data) ? usersRes.data : [usersRes.data];
    let insertedCount = 0;

    for (const user of users) {
      await ensureTableExistsAndUpdated('anganwadi', user);
      await insertRecord('anganwadi', user);
      insertedCount++;
    }

    await client.query('COMMIT');
    res.status(200).json({ 
      success: true,
      inserted_count: insertedCount,
      message: `Synced ${insertedCount} workers to anganwadi table`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('User sync error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to sync users',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});


// Sync candidates from external API
router.post('/sync-candidates', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const dataRes = await axios.get('https://ai-height-estimate.onrender.com/master-data');
    const data = Array.isArray(dataRes.data) ? dataRes.data : [dataRes.data];
    let insertedCount = 0;

    for (const candidate of data) {
      await ensureTableExistsAndUpdated('candidate', candidate);
      await insertRecord('candidate', candidate);
      insertedCount++;
    }

    await client.query('COMMIT');
    res.status(200).json({ 
      success: true,
      inserted_count: insertedCount,
      message: `Synced ${insertedCount} candidates to candidate table`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Candidate sync error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to sync candidates',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});



module.exports = router;