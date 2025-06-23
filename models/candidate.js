const { pool } = require('../connection');

const listByWorker = async workerId => {
  const { rows } = await pool.query(
    `SELECT student_id, full_name, age, gender, father_name, address
       FROM candidates WHERE worker_id = $1 ORDER BY full_name`,
    [workerId]
  );
  return rows;
};

const addCandidate = async (workerId, data) => {
  const { student_id, full_name, age, gender, father_name, address } = data;
  const { rows } = await pool.query(
    `INSERT INTO candidates
     (worker_id, student_id, full_name, age, gender, father_name, address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [workerId, student_id, full_name, age, gender, father_name, address]
  );
  return rows[0];
};

module.exports = { listByWorker, addCandidate };