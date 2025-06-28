const express = require('express');
const { pool } = require('../connection');
const { app } = require('firebase-admin');
const router = express.Router();



router.get("/anganwadi_workers/filter", async (req, res) => {
  const query = req.query;
  const conditions = [];
  const values = [];
  let idx = 1;

  // Only allow these three columns
  const allowed = ["state", "district", "project"];

  for (const key in query) {
    if (!allowed.includes(key)) continue;

    // simple equality filter
    conditions.push(`${key} = $${idx}`);
    values.push(query[key]);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT *
      FROM anganwadi_workers
    ${where}
    ORDER BY id;
  `;

  try {
    const { rows } = await pool.query(sql, values);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching workers:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.get('/get/all', async (req, res) => {
  const sql = `
    SELECT *
      FROM anganwadi_workers
    ORDER BY id;
  `;

  try {
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error(" Error fetching workers:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.post('/register', async (req, res) => {
  const { email , password , full_name , phone} = req.body;
  const id = 11 

  if (!email || !password || !full_name || !phone ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const query = `
    INSERT INTO anganwadi_workers (id, email , password_hash, full_name , phone)
    VALUES ($1, $2, $3, $4 , $5)
    RETURNING id;
  `;

  try {
    const { rows } = await pool.query(query, [id,email , password , full_name , phone]);
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    console.error("❌ Error registering worker:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;