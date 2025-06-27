const cron = require('node-cron');
const axios = require('axios');
const { pool } = require('../connection'); 

async function rescheduleCronJobs() {
  try {
    const result = await pool.query('SELECT * FROM cron_jobs');
    const jobs = result.rows;

    jobs.forEach(job => {
      if (!cron.validate(job.cron_expression)) {
        console.warn(`Skipping invalid cron expression: ${job.cron_expression}`);
        return;
      }

      cron.schedule(job.cron_expression, async () => {
        console.log(`Running reloaded job: ${job.name}`);

        try {
          const response = await axios.post(job.target_url);
          console.log(`Job ${job.name} executed. Response: ${response.status}`);

          await pool.query(
            'UPDATE cron_jobs SET last_run = NOW() WHERE id = $1',
            [job.id]
          );
        } catch (err) {
          console.error(`Error executing job ${job.name}:`, err.message);
        }
      });

      console.log(`Rescheduled job '${job.name}' with cron: ${job.cron_expression}`);
    });
  } catch (err) {
    console.error('Error rescheduling cron jobs:', err.message);
  }
}

module.exports = { rescheduleCronJobs };
