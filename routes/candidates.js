// const express = require('express');
// const { requireAuth } = require('../middleware/auth');
// const { listByWorker, addCandidate } = require('../models/candidate');

// const router = express.Router();

// router.get('/', requireAuth, async (req, res) => {
//   try {
//     const rows = await listByWorker(req.user.id);
//     res.json(rows);
//   } catch (err) {
//     console.error(err);
//     res.sendStatus(500);
//   }
// });

// router.post('/', requireAuth, async (req, res) => {
//   try {
//     const row = await addCandidate(req.user.id, req.body);
//     res.status(201).json(row);
//   } catch (err) {
//     if (err.code === '23505') return res.status(409).json({ error: 'student_id exists' });
//     console.error(err);
//     res.sendStatus(500);
//   }
// });

// module.exports = router;


// // ---------------------------------------------------------------------------
// // routes/candidates.js – API to manage candidates and BMI records
// // ---------------------------------------------------------------------------
// const express = require('express');
// const { pool } = require('../connection');
// const router = express.Router();

// // GET /candidates/worker/:id - fetch candidates by worker ID
// router.get('/worker/:id', async (req, res) => {
//   const workerId = req.params.id;

//   try {
//     const { rows } = await pool.query(
//       `SELECT * FROM candidates WHERE worker_id = $1 ORDER BY id`,
//       [workerId]
//     );
//     res.json(rows);
//   } catch (err) {
//     console.error('❌ Error fetching candidates:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // GET /candidates/bmi/:candidate_id - fetch BMI records for a candidate
// router.get('/bmi/:candidate_id', async (req, res) => {
//   const candidateId = req.params.candidate_id;

//   try {
//     const { rows } = await pool.query(
//       `SELECT * FROM candidate_bmi WHERE candidate_id = $1 ORDER BY created_at DESC`,
//       [candidateId]
//     );
//     res.json(rows);
//   } catch (err) {
//     console.error('❌ Error fetching candidate BMI:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // POST /candidates/bmi - insert BMI data for a candidate
// router.post('/bmi', async (req, res) => {
//   const { candidate_id, height, weight, bmi, health_status, image } = req.body;

//   if (!candidate_id || !height || !weight || !bmi || !health_status) {
//     return res.status(400).json({ error: 'Missing required fields' });
//   }

//   try {
//     const result = await pool.query(
//       `INSERT INTO candidate_bmi (candidate_id, height, weight, bmi, health_status, image)
//        VALUES ($1, $2, $3, $4, $5, $6)
//        RETURNING *`,
//       [candidate_id, height, weight, bmi, health_status, image || null]
//     );

//     res.status(201).json(result.rows[0]);
//   } catch (err) {
//     console.error('❌ Error inserting BMI record:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// module.exports = router;





// routes/candidates.js – API to manage candidates and BMI records
// ---------------------------------------------------------------------------
const express = require('express');
const axios = require('axios');
const { pool } = require('../connection');
const router = express.Router();

router.get('/worker/:id', async (req, res) => {
  const workerId = req.params.id;
  console.log(workerId)
  try {
    const { rows } = await pool.query('SELECT * FROM candidates WHERE worker_id = $1 ORDER BY id', [workerId]);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching candidates:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/bmi/:candidate_id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM candidate_bmi WHERE candidate_id = $1 ORDER BY created_at DESC', [req.params.candidate_id]);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching candidate BMI:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/bmi', async (req, res) => {
  const { candidate_id, height, weight, bmi, health_status, image } = req.body;
  if (!candidate_id || !height || !weight || !bmi || !health_status) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO candidate_bmi (candidate_id, height, weight, bmi, health_status, image)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [candidate_id, height, weight, bmi, health_status, image || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('❌ Error inserting BMI record:', err);
    res.status(500).json({ error: 'Server error' });
  }
});





router.get('/workers/:workerId/candidates/:candidateId', async (req, res) => {
  const { workerId, candidateId } = req.params;

  try {
    // SQL query to fetch candidate details and their LATEST BMI record.
    // We use a LEFT JOIN LATERAL subquery to efficiently get the single latest BMI entry.
    const query = `
      SELECT
          c.full_name AS name,
          c.father_name AS fathername,
          c.mother_name AS mothername, -- Added mother_name from candidates table
          c.age,
          c.gender,                    -- Added gender from candidates table
          latest_bmi.height,           -- From latest_bmi (candidate_bmi table)
          latest_bmi.weight,           -- From latest_bmi (candidate_bmi table)
          latest_bmi.bmi,              -- From latest_bmi (candidate_bmi table)
          latest_bmi.health_status,    -- From latest_bmi (candidate_bmi table)
          latest_bmi.image AS student_image, -- Added image from candidate_bmi table, aliased as student_image
          aw.id AS awd_id,             -- Renamed to awd_id as per request
          c.student_id,
          c.address
      FROM
          candidates c
      JOIN
          anganwadi_workers aw ON c.worker_id = aw.id
      LEFT JOIN LATERAL (
          SELECT
              cb.height,
              cb.weight,
              cb.bmi,
              cb.health_status,
              cb.image,                  -- Include image from candidate_bmi
              cb.created_at
          FROM
              candidate_bmi cb
          WHERE
              cb.candidate_id = c.id
          ORDER BY
              cb.created_at DESC
          LIMIT 1
      ) AS latest_bmi ON TRUE
      WHERE
          aw.id = $1 AND c.id = $2;
    `;

    const result = await pool.query(query, [workerId, candidateId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found or not associated with this worker.' });
    }

    const studentData = result.rows[0];

    res.status(200).json(studentData);

  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});





// 🔄 Seed candidates from external JSON
// router.get('/seed-from-url', async (_req, res) => {
//   const url = 'https://ai-height-estimate.onrender.com/master-data';
//   try {
//     const { data } = await axios.get(url);
//     const inserted = [];

//     for (const entry of data) {
//       const {
//         name,
//         father_name,
//         mother_name,
//         height,
//         weight,
//         age,
//         adhaar_no,
//         phone_number,
//         address,
//         district,
//         state,
//         awid
//       } = entry;

//       const { rows } = await pool.query(
//         `INSERT INTO candidates (
//           worker_id, student_id, full_name, age, gender, father_name, mother_name,
//           height, weight, phone_number, district, state, address, created_at, updated_at
//         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
//         ON CONFLICT (student_id) DO NOTHING RETURNING *`,
//         [
//           awid,
//           adhaar_no,
//           name,
//           age,
//           'Not Specified',
//           father_name,
//           mother_name,
//           height,
//           weight,
//           phone_number,
//           district,
//           state,
//           address
//         ]
//       );
//       if (rows[0]) inserted.push(rows[0]);
//     }

//     res.status(201).json({ inserted_count: inserted.length });
//   } catch (err) {
//     console.error('❌ Error seeding candidates:', err);
//     res.status(500).json({ error: 'Import failed' });
//   }
// });

module.exports = router;
