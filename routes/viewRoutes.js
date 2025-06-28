const express = require('express');
const router = express.Router(); // CORRECTED: This MUST be express.Router()

const { pool } = require('../connection'); 

/**
 * @route GET /view-student/:workerId/:candidateId
 * @description Renders an HTML page with details for a specific candidate (student),
 * including their latest BMI information.
 * @param {string} workerId - The ID of the Anganwadi worker.
 * @param {string} candidateId - The ID of the candidate (student).
 * @returns {HTML} - Rendered HTML page with student data.
 * @access Public (or adjust if authentication is needed for viewing)
 */

router.get('/view-student/:workerId/:candidateId', async (req, res) => {
  const { workerId, candidateId } = req.params;

  try {
    const query = `
      SELECT
          c.full_name AS name,
          c.father_name AS fathername,
          c.mother_name AS mothername,
          c.age,
          c.gender,
          COALESCE(latest_bmi.height, c.height) AS height,
          COALESCE(latest_bmi.weight, c.weight) AS weight,
          COALESCE(latest_bmi.bmi, 
              CASE WHEN c.height > 0 AND c.weight > 0 
                   THEN ROUND(c.weight / ((c.height/100) * (c.height/100)), 1)
                   ELSE NULL END) AS bmi,
          COALESCE(latest_bmi.health_status, c.health_status) AS health_status,
          COALESCE(latest_bmi.image, c.student_image) AS image_url,
          aw.id AS awd_id,
          aw.full_name AS aw_name,  -- Added worker name
          c.student_id,
          c.address,
          COALESCE(latest_bmi.created_at, c.updated_at) AS updated_at
      FROM
          candidates c
      JOIN
          anganwadi_workers aw ON c.worker_id = aw.id
      LEFT JOIN LATERAL (
          SELECT
              cb.height,
              cb.weight,
              cb.bmi,
              cb.health_status,
              cb.image,
              cb.created_at
          FROM
              candidate_bmi cb
          WHERE
              cb.candidate_id = c.id
          ORDER BY
              cb.created_at DESC
          LIMIT 1
      ) AS latest_bmi ON TRUE
      WHERE
          aw.id = $1
        AND c.id = $2;       
    `;

    const result = await pool.query(query, [workerId, candidateId]);
    console.log('result.rows:', result.rows);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .send('<h1>Student Not Found</h1><p>The requested student could not be found for this worker.</p>');
    }

    // Format the data for the template
    const studentData = {
      ...result.rows[0],
      height_cm: result.rows[0].height,
      weight_kg: result.rows[0].weight
    };

    res.render('bmicard', { student: studentData });
  } catch (error) {
    console.error('Error fetching student details for view:', error);
    res.status(500).send('<h1>Internal Server Error</h1>');
  }
});
module.exports = router;
