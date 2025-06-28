const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../connection');
const router = express.Router();
const bcrypt = require('bcrypt');
const client = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

require('dotenv').config();

//login-with-email
router.post('/login-with-email', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Fetch admin by email
    const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
    const admin = result.rows[0];

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    
    const passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    
    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      process.env.JWT_SECRECT, 
      { expiresIn: '12h' }
    );

    res.json({
      message: 'Login successful',
      token,
      userDetails: {
        id: admin.id,
        email: admin.email,
        phone: admin.phone
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//register new admin
router.post('/register', async (req, res) => {
  const { email, password, full_name, phone } = req.body;

  
  if (!email || !password || !full_name || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
  
    const existingResult = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
    if (existingResult.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new admin
    const insertQuery = `
      INSERT INTO admins (email, password, full_name, phone)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `;
    const insertResult = await pool.query(insertQuery, [email, hashedPassword, full_name, phone]);

    // Respond with success
    res.status(201).json({
      message: 'Admin registered successfully',
      user: {
        id: insertResult.rows[0].id,
        email,
        full_name,
        phone
      }
    });
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});





const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
console.log('twillo' , process.env.TWILIO_PHONE_NUMBER)

console.log('Twilio service SID:',process.env.TWILIO_VERIFY_SERVICE_SID);


// Send OTP using Twilio Verify
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    // Check if admin exists
    const adminCheck = await pool.query(
      'SELECT id FROM admins WHERE phone = $1', 
      [phone]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(404).json({ error: 'No admin registered with this phone number' });
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
  const { phone, code } = req.body; // Changed 'otp' to 'code' for Twilio consistency

  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and verification code are required' });
  }

  try {
    //  Verify OTP with Twilio
    const verificationCheck = await client.verify.v2.services(
      process.env.TWILIO_VERIFY_SERVICE_SID
    )
    .verificationChecks
    .create({ to: phone, code: code });

    //  If OTP is invalid/expired
    if (verificationCheck.status !== 'approved') {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    //  Get admin details (only if OTP is valid)
    const adminResult = await pool.query(
      `SELECT id, phone, email FROM admins WHERE phone = $1`,
      [phone]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const admin = adminResult.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin.id,
        phone: admin.phone,
        email: admin.email,
        role: 'admin' // Optional: Add role for authorization
      },
      process.env.JWT_SECRECT, // Fixed typo: JWT_SECRECT → JWT_SECRET
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        phone: admin.phone,
        email: admin.email
      }
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