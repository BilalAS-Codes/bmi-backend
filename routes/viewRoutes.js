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

// viewRoutes.js
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
          latest_bmi.height,
          latest_bmi.weight,
          latest_bmi.bmi,
          latest_bmi.health_status,
          latest_bmi.image AS student_image,
          aw.id AS awd_id,
          c.student_id,
          c.address,
          latest_bmi.created_at AS updated_at
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
        AND c.student_id = $2;        -- <<< filter by your string ID
    `;

    const result = await pool.query(query, [workerId, candidateId]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .send('<h1>Student Not Found</h1><p>The requested student could not be found for this worker.</p>');
    }

    res.render('bmicard', { student: result.rows[0] });
  } catch (error) {
    console.error('Error fetching student details for view:', error);
    res.status(500).send('<h1>Internal Server Error</h1>');
  }
});

module.exports = router;
