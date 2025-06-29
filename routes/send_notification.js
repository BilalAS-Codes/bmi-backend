const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require('../firebase-adminsdk.json')),
});

/**
 * @route POST /send-notification
 * @description Send push notification to devices
 * @body {string[]} tokens - Array of device tokens
 * @body {string} title - Notification title
 * @body {string} message - Notification body
 * @body {object} [data] - Additional data payload (optional)
 * @returns {object} Success/error message
 */
router.post('/', async (req, res) => {
  const { tokens, title, message, data } = req.body;

  // Validate required fields
  if (!tokens || !Array.isArray(tokens)) {
    return res.status(400).json({ 
      success: false,
      error: 'Device tokens array is required' 
    });
  }

  if (!title || !message) {
    return res.status(400).json({ 
      success: false,
      error: 'Title and message are required' 
    });
  }

  try {
    // Prepare notification payload
    const payload = {
      notification: {
        title,
        body: message,
      },
      data: data || {} // Include additional data if provided
    };

    // Send to multiple devices
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      ...payload
    });

    // Handle partial failures
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push({
            token: tokens[idx],
            error: resp.error
          });
        }
      });

      console.error('Failed to send to some tokens:', failedTokens);
    }

    res.json({
      success: true,
      message: `Notification sent successfully`,
      stats: {
        successCount: response.successCount,
        failureCount: response.failureCount
      }
    });

  } catch (err) {
    console.error('Error sending notification:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send notification',
      details: err.message 
    });
  }
});

module.exports = router;