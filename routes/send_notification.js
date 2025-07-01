const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const {pool} = require('../connection')

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
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
  const { title, description, data } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      success: false,
      error: 'Title and description are required',
    });
  }

  try {
    // Fetch FCM tokens from the database
    const result = await pool.query(
      'SELECT fcm_token FROM anganwadi_workers WHERE fcm_token IS NOT NULL'
    );

    const tokens = result.rows.map((row) => row.fcm_token);

    if (tokens.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No FCM tokens found',
      });
    }

    // Prepare notification payload
    const message = {
      tokens,
      notification: {
        title,
        body: description,
      },
      data: data || {},
    };

    // Send notification
    const response = await admin.messaging().sendEachForMulticast(message);

    // Log failed tokens if any
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push({
            token: tokens[idx],
            error: resp.error?.message,
          });
        }
      });
      console.warn('Some notifications failed:', failedTokens);
    }

    res.json({
      success: true,
      message: 'Notification sent successfully',
      stats: {
        successCount: response.successCount,
        failureCount: response.failureCount,
      },
    });
  } catch (err) {
    console.error('Error sending notification:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to send notification',
      details: err.message,
    });
  }
});


router.post('/send-to-all', async (req, res) => {
  try {
    const notificationsResult = await pool.query(`
      SELECT * FROM notifications 
    `);

    if (!notificationsResult.rows || notificationsResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No notifications found' 
      });
    }

    let totalSent = 0;
    const results = [];

    for (const notification of notificationsResult.rows) {
      // Step 2: Find matching candidates and get UNIQUE worker IDs using Set
      const candidatesResult = await pool.query(`
        SELECT c.worker_id 
        FROM candidates c
        WHERE c.category = $1 
        AND c.health_status = $2
      `, [notification.category, notification.health_status]);

      // Convert to Set to eliminate duplicates
      const workerIdSet = new Set(candidatesResult.rows.map(c => c.worker_id));
      const uniqueWorkerIds = Array.from(workerIdSet);

      if (uniqueWorkerIds.length === 0) {
        results.push({
          notification_id: notification.id,
          title: notification.title,
          message: notification.message,
          matched_candidates: candidatesResult.rows.length,
          unique_workers: 0,
          sent_count: 0,
          status: 'No matching candidates found',
          filter_criteria: {
            category: notification.category,
            health_status: notification.health_status
          }
        });
        continue;
      }

      // Step 3: Get FCM tokens for UNIQUE workers
      const workersResult = await pool.query(`
        SELECT fcm_token FROM anganwadi_workers
        WHERE id = ANY($1) 
        AND fcm_token IS NOT NULL
      `, [uniqueWorkerIds]);

      const tokens = workersResult.rows.map(w => w.fcm_token).filter(Boolean);

      if (tokens.length === 0) {
        results.push({
          notification_id: notification.id,
          title: notification.title,
          message: notification.message,
          matched_candidates: candidatesResult.rows.length,
          unique_workers: uniqueWorkerIds.length,
          sent_count: 0,
          status: 'No workers with FCM tokens found',
          worker_ids: uniqueWorkerIds
        });
        continue;
      }

      // Step 4: Send notifications (only once per worker)
      const payload = {
        notification: {
          title: notification.title,
          body: notification.message,
        },
        data: {
          notification_id: notification.id.toString(),
          type: 'health_alert',
          category: notification.category,
          health_status: notification.health_status
        }
      };

      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          ...payload
        });

        totalSent += response.successCount;
        results.push({
          notification_id: notification.id,
          title: notification.title,
          message: notification.message,
          matched_candidates: candidatesResult.rows.length,
          unique_workers: uniqueWorkerIds.length,
          workers_with_tokens: tokens.length,
          sent_count: response.successCount,
          failed_count: response.failureCount,
          status: 'Success'
        });

        // Log the notification
        await pool.query(`
          INSERT INTO notification_logs 
          (notification_id, sent_count, failed_count, criteria)
          VALUES ($1, $2, $3, $4)
        `, [
          notification.id, 
          response.successCount, 
          response.failureCount,
          JSON.stringify({
            category: notification.category,
            health_status: notification.health_status
          })
        ]);

      } catch (err) {
        console.error(`Error sending notification ${notification.id}:`, err);
        results.push({
          notification_id: notification.id,
          title: notification.title,
          message: notification.message,
          status: 'Failed to send',
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      total_notifications: notificationsResult.rows.length,
      total_sent: totalSent,
      details: results
    });

  } catch (err) {
    console.error('Error in send-to-all:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process notifications',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;