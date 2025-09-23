// routes/candidates.js – API to manage candidates and BMI records
// ---------------------------------------------------------------------------
const express = require('express');
const { pool } = require('../connection');
const { app } = require('firebase-admin');
const router = express.Router();
const QRCode = require('qrcode');


//get worker by id
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


//get bmi of particular candidate
router.get('/bmi/:candidate_id', async (req, res) => {
  try {
    const candidateId = req.params.candidate_id;

    if (!candidateId) {
      return res.status(400).json({ error: 'Candidate ID is required' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM candidate_bmi WHERE candidate_id = $1 ORDER BY created_at DESC',
      [candidateId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error fetching candidate BMI:', err);
    res.status(500).json({ error: 'Server error' });
  }
});





// add bmi of candidate
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



// get all candidates based on filter
router.get("/filter", async (req, res) => {
  const query = req.query;
  console.log("Received filter parameters:", query);

  const conditions = [];
  const values = [];
  let index = 1;

  const allowedColumns = ['age', 'height', 'weight', 'district', 'state', 'category', 'gender', 'worker_id'];

  // Extract page for pagination
  const page = parseInt(query.page) || 1;
  const limit = 100;
  const offset = (page - 1) * limit;

  // Remove 'page' from query so it doesn't interfere with filters
  delete query.page;

  for (let key in query) {
    let matched = key.match(/^(\w+)([><=]{1,2})(\d+)$/); // handles keys like age>500

    if (matched) {
      const [, column, operator, number] = matched;

      if (!allowedColumns.includes(column)) continue;

      conditions.push(`${column} ${operator} $${index++}`);
      values.push(Number(number));
    } else {
      const column = key;
      const value = query[key];

      if (!allowedColumns.includes(column)) continue;

      conditions.push(`${column} = $${index++}`);
      values.push(value);
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  console.log("Generated SQL:", whereClause);
  console.log("Values for SQL:", values);

  try {
    const sql = `
      SELECT * FROM candidates
      ${whereClause}
      ORDER BY id
      LIMIT $${index++} OFFSET $${index++};
    `;

    values.push(limit, offset);

    const { rows } = await pool.query(sql, values);
    res.json({
      page,
      limit,
      data: rows,
    });
  } catch (err) {
    console.error("❌ Error fetching candidates:", err);
    res.status(500).json({ error: "Server error" });
  }
});




// Get all candidates with pagination upto 100 records per page
router.get("/all", async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default page = 1
  const limit = 100;
  const offset = (page - 1) * limit;

  try {
    const sql = `
      SELECT * FROM candidates
      ORDER BY id
      LIMIT $1 OFFSET $2;
    `;
    const { rows } = await pool.query(sql, [limit, offset]);

    res.json({
      page,
      limit,
      data: rows,
    });
  } catch (err) {
    console.error("❌ Error fetching paginated candidates:", err);
    res.status(500).json({ error: "Server error" });
  }
});



// Generate QR code for a candidate
router.get('/generateQR', async (req, res) => {
  try {
    const { workerId, candidateId } = req.query;
    
    if (!workerId || !candidateId) {
      return res.status(400).send('Missing workerId or candidateId');
    }

    const url = `https://anganwadibackend.onrender.com/view-student/${workerId}/${candidateId}`;
    const qrCodeImage = await QRCode.toDataURL(url);

    res.set('Content-Type', 'image/png');
    res.send(Buffer.from(qrCodeImage.split(',')[1], 'base64'));
  } catch (err) {
    console.error('Error generating QR code:', err);
    res.status(500).send('Internal Server Error');
  }
});


//get single candidate by id
router.get('/:id', async (req, res) => {
  const candidateId = req.params.id;
  try {
    const { rows } = await pool.query('SELECT * FROM candidates WHERE id = $1', [candidateId]);
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error fetching candidate:', err);
    res.status(500).json({ error: 'Server error' });
  }
});





module.exports = router;
