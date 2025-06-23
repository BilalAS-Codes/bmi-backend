// const { pool } = require('../connection');
// const bcrypt = require('bcrypt');

// const findByUsername = async username => {
//   const { rows } = await pool.query(
//     'SELECT * FROM anganwadi_workers WHERE username = $1',
//     [username]
//   );
//   return rows[0];
// };

// const createWorker = async ({ username, password, full_name, phone }) => {
//   const password_hash = await bcrypt.hash(password, 10);
//   const { rows } = await pool.query(
//     `INSERT INTO anganwadi_workers (username, password_hash, full_name, phone)
//      VALUES ($1,$2,$3,$4)
//      RETURNING id, username, full_name, phone`,
//     [username, password_hash, full_name, phone]
//   );
//   return rows[0];
// };

// module.exports = { findByUsername, createWorker };


const { pool } = require('../connection');
const bcrypt = require('bcrypt');

const findByEmail = async (email) => {
  const { rows } = await pool.query('SELECT * FROM anganwadi_workers WHERE email = $1', [email]);
  return rows[0];
};

const createWorker = async ({ email, password, full_name, phone }) => {
  const password_hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO anganwadi_workers (email, password_hash, full_name, phone)
     VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, phone`,
    [email, password_hash, full_name, phone]
  );
  return rows[0];
};

module.exports = { findByEmail, createWorker };