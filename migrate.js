// // migrate.js
// const { pool } = require('./connection'); // uses the pool from connection.js/db.js


// const createTables = async () => {
//   try {
//     console.log('🗑️  Dropping existing tables (if any)...');

//     // Drop in dependency order (children first)
//     await pool.query('DROP TABLE IF EXISTS candidates');
//     await pool.query('DROP TABLE IF EXISTS anganwadi_workers');

//     console.log('📦 Creating fresh tables...');

//     await pool.query(`
//       CREATE TABLE anganwadi_workers (
//         id SERIAL PRIMARY KEY,
//         email TEXT UNIQUE NOT NULL,
//         password_hash TEXT NOT NULL,
//         full_name TEXT NOT NULL,
//         phone TEXT,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       );
//     `);

//     await pool.query(`
//       CREATE TABLE candidates (
//         id SERIAL PRIMARY KEY,
//         worker_id INTEGER REFERENCES anganwadi_workers(id) ON DELETE CASCADE,
//         student_id TEXT UNIQUE NOT NULL,
//         full_name TEXT NOT NULL,
//         age INTEGER,
//         gender TEXT,
//         father_name TEXT,
//         address TEXT,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       );
//     `);

//     console.log('✅ Tables dropped & recreated successfully');
//   } catch (err) {
//     console.error('❌ Error creating tables:', err);
//   } finally {
//     if (require.main === module) {
//       await pool.end();
//     }
//   }
// };


// module.exports = {
  
//   createTables,
// };



const { pool } = require('./connection');


const createTables = async () => {
  try {
    console.log('🗑️  Dropping existing tables (if any)...');

    await pool.query('DROP TABLE IF EXISTS candidate_bmi CASCADE');
    await pool.query('DROP TABLE IF EXISTS candidates CASCADE');
    await pool.query('DROP TABLE IF EXISTS anganwadi_workers CASCADE');

    console.log('📦 Creating fresh tables...');

    // 1️⃣ Workers
    await pool.query(`
      CREATE TABLE anganwadi_workers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2️⃣ Candidates (expanded columns)
    await pool.query(`
      CREATE TABLE candidates (
        id SERIAL PRIMARY KEY,
        worker_id INTEGER REFERENCES anganwadi_workers(id) ON DELETE CASCADE,
        student_id VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        age INTEGER,
        gender VARCHAR(15),
        father_name VARCHAR(100),
        mother_name VARCHAR(100),
        height NUMERIC(6,2),
        weight NUMERIC(6,2),
        phone_number VARCHAR(20),
        district VARCHAR(100),
        state VARCHAR(100),
        address TEXT,
        student_image TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3️⃣ Candidate BMI
    await pool.query(`
      CREATE TABLE candidate_bmi (
        id SERIAL PRIMARY KEY,
        candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        height NUMERIC(6, 2),
        weight NUMERIC(6, 2),
        bmi NUMERIC(5, 2),
        health_status VARCHAR(50),
        image TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Tables dropped & recreated successfully');
  } catch (err) {
    console.error('❌ Error creating tables:', err);
  } finally {
    if (require.main === module) await pool.end();
  }
};

// If you want to run this file directly to create tables:
// node your_file_name.js
if (require.main === module) {
  createTables();
}

// If this is imported by another file, createTables will be available.
module.exports = {
  createTables
};