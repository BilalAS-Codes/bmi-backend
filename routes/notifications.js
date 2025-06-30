const express = require('express');
const router = express.Router();
const {pool} = require('../connection');

//get current timestamp
const getCurrentTimestamp = () => new Date().toISOString();

// Create Notification
router.post('/add', async (req, res) => {
  const { title, message, user_id, category, healthStatus, bmi, age } = req.body;
  const createdAt = getCurrentTimestamp();
  
  if (!title || !message || !user_id) {
    return res.status(400).json({ error: 'Title, message, and user_id are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications 
       (title, message, worker_id, category, health_status, bmi, age, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [title, message, user_id, category, healthStatus, bmi, age, createdAt, createdAt]
    );
    res.status(201).json("Notification created successfully: " + rows[0].title + " and with description: " + rows[0].message);
  } catch (err) {
    console.error('❌ Error inserting notification:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Get All Notifications
router.get('/get', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching notifications:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Get Notification by ID
router.get('/get/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { rows } = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error fetching notification:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Get Notifications by User ID
router.get('/user/:user_id', async (req, res) => {
  const { user_id } = req.params;
  
  try {
    const { rows } = await pool.query(
      'SELECT * FROM notifications WHERE worker_id = $1 ORDER BY created_at DESC', 
      [user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching user notifications:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Update Notification
router.put('/update/:id', async (req, res) => {
  const { id } = req.params;
  console.log("Updating notification with ID:", id);
  const { title, message, category, healthStatus, bmi, age } = req.body;
  const updatedAt = getCurrentTimestamp();
  
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE notifications 
       SET title = $1, message = $2, category = $3, 
           health_status = $4, bmi = $5, age = $6,
           updated_at = $7
       WHERE id = $8
       RETURNING *`,
      [title, message, category, healthStatus, bmi, age, updatedAt, id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.send('Notification Updated Successfully');
  } catch (err) {
    console.error('❌ Error updating notification:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Delete Notification
router.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { rowCount } = await pool.query('DELETE FROM notifications WHERE id = $1', [id]);
    
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting notification:', err);
    res.status(500).json({ error: 'Server error' });
  }
});





module.exports = router;