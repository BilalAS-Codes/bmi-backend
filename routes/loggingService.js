const express = require('express');
const router = express.Router();
const { pool } = require('../connection');

// Helper to validate base64 format
const isBase64 = (str) => {
  return typeof str === 'string' && /^data:image\/(png|jpeg|jpg);base64,/.test(str);
};

router.post('/', async (req, res) => {
  try {
    const { initialImage, processedImage, jsonData, awwId, location } = req.body;

    if (!initialImage || !processedImage || !jsonData || !awwId || !location) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!isBase64(initialImage) || !isBase64(processedImage)) {
      return res.status(400).json({ error: 'Images must be in base64 format with data URI' });
    }

    if (
      typeof location !== 'object' ||
      typeof location.latitude !== 'number' ||
      typeof location.longitude !== 'number'
    ) {
      return res.status(400).json({ error: 'Invalid location format. Expecting { latitude, longitude }' });
    }

    const query = `
      INSERT INTO aiLogs (initialImage, processedImage, jsonData, awwId, location)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const values = [
      initialImage,
      processedImage,
      jsonData,
      awwId,
      JSON.stringify(location), 
    ];

    const result = await pool.query(query, values);
    const logId = result.rows[0].id;

    return res.status(201).json({ message: 'Log created successfully', logId });

  } catch (error) {
    console.error('Error logging:', error);

    if (error.code === '22001') {
      return res.status(413).json({ error: 'Image data too large. Please compress the image.' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
