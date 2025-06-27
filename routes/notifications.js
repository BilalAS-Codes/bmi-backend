const express = require('express');
const { pool } = require('../connection');
const router = express.Router();


//add a new notification
router.post('/add', async (req, res) => {
  const {title,description,category,healthStatus,bmi,age} = req.body;
  if (!title || !message || !user_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications (title, message, user_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [title, message, user_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('❌ Error inserting notification:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

