// routes/cronJobs.js
const express = require('express');
const router = express.Router();
const {pool} = require('../connection');
const cron = require('node-cron');
const axios = require('axios');

// converting date to YYYY-MM-DD format for postgres 
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split("-");
  return `${year}-${month}-${day}`;
};

// Create a new cron job
router.post('/add', async (req, res) => {
  const { name, date, time, repeat_interval } = req.body;
  const parsedDate = parseDate(date);
  

  try {
    // Extract hour and minute from the time string
    const [hour, minute] = time.split(':');

    let cron_expression;
    // Generate cron based on interval
    switch (repeat_interval) {
      case 'daily':
        cron_expression = `${minute} ${hour} * * *`; // every day at hh:mm
        break;
      case 'weekly':
        const jsDate = new Date(parsedDate); // assuming date is in YYYY-MM-DD
        console.log('Parsed date:', jsDate);
        const dayOfWeek = jsDate.getDay();
        console.log('Day of the week:', dayOfWeek); 
        cron_expression = `${minute} ${hour} * * ${dayOfWeek}`;
        break;
      case 'monthly':
        const dayOfMonth = new Date(parsedDate).getDate(); // 1–31
        cron_expression = `${minute} ${hour} ${dayOfMonth} * *`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid repeat_interval' });
    }

    let target_url ;
    switch (name) {
      case 'sync-users':
        target_url = 'http://13.204.68.9:5000/seed/sync-users';
        break;
      case 'sync-candidates':
        target_url = 'http://13.204.68.9:5000/seed/sync-candidates';
        break;
      case 'send-notification':
        target_url = 'http://13.204.68.9:5000/send-notification/send-to-all';
        break;
      
      default:  
        return res.status(400).json({ error: 'Invalid job name' });
    }
    const result = await pool.query(
      `INSERT INTO cron_jobs 
       (name, date, time, repeat_interval, cron_expression, target_url) 
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, parsedDate, time, repeat_interval, cron_expression, target_url]
    );

// Scheduling the cron job as soon as it's created 
    if (cron.validate(cron_expression)) {
  cron.schedule(cron_expression, async () => {
    console.log(`Running scheduled job: ${name}`);
    try {
      console.log(`Target URL: ${target_url}`);
      const response = await axios.post(target_url);
      console.log(`Success: ${response.status}`);
      await pool.query(
        'UPDATE cron_jobs SET last_run = NOW() WHERE id = $1',
        [result.rows[0].id]
      );
    } catch (err) {
      console.error(`Error running job ${name}:`, err.message);
    }
  });

  console.log(` Scheduled new job: ${name} → ${cron_expression}`);
} else {
  console.warn('Invalid cron expression:', cron_expression);
}


    res.status(201).json({message: 'Cron job created successfully'},result.rows[0]);
  } catch (error) {
    console.error('Error creating cron job:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.delete('/delete/:id', async(req , res)=>{
  const jobId = req.params.id;
  try {
    const result = await pool.query('DELETE FROM cron_jobs WHERE id = $1 RETURNING *', [jobId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Cancel the cron job if it exists

    console.log()
    const job = cron.getTasks().find(task => task.name === result.rows[0].name);
    if (job) {
      job.stop();
      console.log(`Stopped cron job: ${result.rows[0].name}`);
    }

    res.json({ message: 'Job deleted successfully', job: result.rows[0] });
  } catch (error) {
    console.error('Error deleting job:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
})


// Get all cron jobs
router.get('/getall', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cron_jobs ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

//  Get job by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cron_jobs WHERE id = $1', [req.params.id]);
    res.json(result.rows[0] || {});
  } catch (error) {
    res.status(500).json({ error: 'Job not found' });
  }
});

module.exports = router;
