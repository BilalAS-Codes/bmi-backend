const express = require('express');
const { pool } = require('../connection');
const { app } = require('firebase-admin');
const jwt = require('jsonwebtoken');
const router = express.Router();
const client = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);



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




//for aganwadi workers
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  console.log('Phone number:', phone);
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    // Check if admin exists
    const adminCheck = await pool.query(
      'SELECT id FROM anganwadi_workers WHERE phone = $1', 
      [phone]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(404).json({ error: 'No Worker registered with this phone number' });
    }

    // Send OTP via Twilio Verify
    const verification = await client.verify.v2.services(
      process.env.TWILIO_VERIFY_SERVICE_SID
    )
    .verifications
    .create({ to: phone, channel: 'sms' });

    res.json({ 
      message: 'OTP sent successfully'
    });

  } catch (err) {
    console.error('Twilio Verify Error:', err);
    
    // Handle specific Twilio errors
    if (err.code === 60200) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    if (err.code === 60203) {
      return res.status(429).json({ error: 'Max verification attempts reached' });
    }
    
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});





// Verify OTP using Twilio Verify
router.post('/verify-otp', async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and verification code are required' });
  }

  try {
    // Verify OTP with Twilio
    const verificationCheck = await client.verify.v2.services(
      process.env.TWILIO_VERIFY_SERVICE_SID
    ).verificationChecks.create({ to: phone, code });

    if (verificationCheck.status !== 'approved') {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    // Fetch anganwadi worker details
    const adminResult = await pool.query(
      `SELECT * FROM anganwadi_workers WHERE phone = $1`,
      [phone]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const { password, ...admin } = adminResult.rows[0]; // Exclude password

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin.id,
        phone: admin.phone,
        email: admin.email
      },
      process.env.JWT_SECRECT, 
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      admin 
    });

  } catch (err) {
    console.error('OTP verification error:', err);

    if (err.code === 60202) {
      return res.status(404).json({ error: 'Verification attempt expired' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});




module.exports = router;