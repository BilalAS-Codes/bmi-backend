const express = require('express');
const router = express.Router();
const {pool} = require('../connection'); 

// converting date to YYYY-MM-DD format for postgres 
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split("-");
  return `${year}-${month}-${day}`;
};

// CREATE a new task
router.post("/add", async (req, res) => {
  const {
    category,
    health_status,
    bmi,
    age,
    title,
    description,
    completion,
    day_from,
    day_to,
  } = req.body;

  
  try {
    await pool.query("BEGIN");

    const formattedDayFrom = day_from ? parseDate(day_from) : null;
    const formattedDayTo = day_to ? parseDate(day_to) : null;

    // 1. Insert into tasks
    const taskResult = await pool.query(
      `INSERT INTO tasks (
         category, health_status, bmi, age, title, description,
         completion, day_from, day_to
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        category,
        health_status,
        bmi,
        age,
        title,
        description,
        completion,
        formattedDayFrom,
        formattedDayTo,
      ]
    );

    const taskId = taskResult.rows[0].id;

    // 2. Fetching candidate IDs and their AWW IDs for given category
    const candidateResult = await pool.query(
      `SELECT id AS candidate_id, worker_id AS aww_id FROM candidates WHERE category = $1`,
      [category]
    );

    if (candidateResult.rows.length === 0) {
      res.send("No candidates found for the given category");
    }
    

    const candidateIds = candidateResult.rows.map((c) => c.candidate_id);
    const awwIds = candidateResult.rows.map((c) => c.aww_id);

    // 3. Inserting into task_mapping
    await pool.query(
      `INSERT INTO task_mapping (task_id, candidates, aww_ids) VALUES ($1, $2, $3)`,
      [taskId, JSON.stringify(candidateIds), JSON.stringify(awwIds)]
    );

    await pool.query("COMMIT");
    res.status(201).json({ message: "Task and mapping added successfully", task_id: taskId });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error adding task with mapping:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    pool.release();
  }
});


//get tasks by aww_id and date
router.get("/get", async (req, res) => {
  const { aww_id, date } = req.query;
  if (!aww_id || !date) {
    return res.status(400).json({ error: "aww_id and date are required" });
  }

  try {
    const formattedDate = parseDate(date);

    const result = await pool.query(
      `
      SELECT t.*
        FROM tasks t
        JOIN task_mapping tm
          ON t.id = tm.task_id
       WHERE tm.aww_ids @> to_jsonb(ARRAY[$1]::int[])
         AND $2::DATE BETWEEN t.day_from AND t.day_to
       ORDER BY t.id DESC
      `,
      [aww_id, formattedDate]
    );

    res.json({ count: result.rows.length, tasks: result.rows });
  } catch (err) {
    console.error("Error fetching tasks by aww_id and date:", err);
    res.status(500).json({ error: "Server error" });
  }
});




// get all tasks
router.get("/get/all", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tasks ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// get a single task by ID
router.get("/get/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Task not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching task:", err);
    res.status(500).json({ error: "Server error" });
  }
});



// UPDATE a task
router.put("/update/:id", async (req, res) => {
  
    console.log(req.body); 
  const {
    category,
    health_status,
    bmi,
    age,
    title,
    description,
    completion,
    day_from,
    day_to
  } = req.body;

  console.log(req.params.id);

  try {
    const formattedDayFrom = day_from ? parseDate(day_from) : null;
    const formattedDayTo   = day_to   ? parseDate(day_to)   : null;

    const result = await pool.query(
      `UPDATE tasks SET
         category     = $1,
         health_status= $2,
         bmi          = $3,
         age          = $4,
         title        = $5,
         description  = $6,
         completion   = $7,
         day_from     = $8,
         day_to       = $9,
         updated_at   = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        category,
        health_status,
        bmi,
        age,
        title,
        description,
        completion || 0,
        formattedDayFrom,
        formattedDayTo,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({ message: "Task updated Succesfully"});
  } catch (err) {
    console.error("Error updating task:", err);
    res.status(500).json({ error: "Server error" });
  }
});




// DELETE a task
router.delete("/delete/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM tasks WHERE id = $1 RETURNING *", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Task not found" });
    res.json({ message: "Task deleted successfully"});
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ error: "Server error" });
  }
});


//get all candidates assigned to a specific AWW ID
router.get("/mapping/aww/:aww_id", async (req, res) => {
  const awwId = parseInt(req.params.aww_id);

  if (isNaN(awwId)) {
    return res.status(400).json({ error: "Invalid AWW ID" });
  }

  try {
    const result = await pool.query(
      `SELECT task_id, candidates, aww_ids
       FROM task_mapping
       WHERE aww_ids @> $1::jsonb`,
      [JSON.stringify([awwId])]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No tasks found for this AWW" });
    }

    const response = [];

    for (const row of result.rows) {
      row.aww_ids.forEach((id, index) => {
        if (id === awwId) {
          response.push({
            task_id: row.task_id,
            candidate_id: row.candidates[index],
          });
        }
      });
    }

    res.json({ aww_id: awwId, assigned_candidates: response });
  } catch (err) {
    console.error("Error fetching mapping:", err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;