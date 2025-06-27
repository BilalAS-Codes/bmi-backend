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

module.exports = router;