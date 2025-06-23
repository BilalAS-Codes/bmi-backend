const express = require('express');
const axios = require('axios');
const router = express.Router();
const { pool } = require('../connection'); // adjust path as needed

// Simple student_id generator: name + awid + timestamp
function generateStudentId(name, awid) {
  const clean = name.toLowerCase().replace(/\s+/g, '_');
  return `${clean}_${awid}_${Date.now()}`;
}

// POST /api/seed-all
// Seeds anganwadi_workers from /master-users, then candidates from /master-data
router.post('/seed-users', async (req, res) => {
  try {
    // 1. Seed workers
    const usersRes = await axios.get('https://ai-height-estimate.onrender.com/master-users');
    const users = usersRes.data;
    for (const { id, name, email, password } of users) {
      await pool.query(
        `INSERT INTO anganwadi_workers (id, full_name, email, password_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
        [id, name, email, password]
      );
    }

    // 2. Seed candidates
    const dataRes = await axios.get('https://ai-height-estimate.onrender.com/master-data');
    const data = dataRes.data;
    let insertedCount = 0;
    for (const item of data) {
      const {
        awid,
        name,
        age,
        father_name,
        mother_name,
        height,
        weight,
        phone_number,
        district,
        state,
        address
      } = item;

      const worker_id = parseInt(awid, 10);
      const student_id = generateStudentId(name, awid);
      const full_name = name;
      const gender = null;
      const student_image = null;

      await pool.query(
        `INSERT INTO candidates (
           worker_id, student_id, full_name, age, gender, father_name, mother_name,
           height, weight, phone_number, district, state, address, student_image
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12, $13, $14
         ) ON CONFLICT (student_id) DO NOTHING`,
        [
          worker_id,
          student_id,
          full_name,
          age || null,
          gender,
          father_name,
          mother_name,
          height,
          weight,
          phone_number,
          district,
          state,
          address,
          student_image,
        ]
      );
      insertedCount++;
    }

    res.status(200).json({ message: `Seeded ${users.length} workers and ${insertedCount} candidates` });
  } catch (error) {
    console.error('Error seeding:', error);
    res.status(500).json({ error: 'Failed to seed data' });
  }
});

module.exports = router;
