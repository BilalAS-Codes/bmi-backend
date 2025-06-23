// const express = require('express');
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcrypt');
// const { findByUsername, createWorker } = require('../models/worker');

// const router = express.Router();

// // Login route
// router.post('/login', async (req, res) => {
//   const { username, password } = req.body;
//   if (!username || !password) return res.status(400).json({ error: 'missing' });

//   const worker = await findByUsername(username);
//   if (!worker) return res.status(401).json({ error: 'bad creds' });

//   const ok = await bcrypt.compare(password, worker.password_hash);
//   if (!ok) return res.status(401).json({ error: 'bad creds' });

//   const token = jwt.sign({ id: worker.id, username: worker.username }, process.env.JWT_SECRET, { expiresIn: '12h' });
//   res.json({ token, user: { id: worker.id, username: worker.username, full_name: worker.full_name } });
// });

// // 🆕 Register route
// router.post('/register', async (req, res) => {
//   const { username, password, full_name, phone } = req.body;
//   if (!username || !password || !full_name) {
//     return res.status(400).json({ error: 'missing fields' });
//   }

//   // Check duplicate username
//   if (await findByUsername(username)) {
//     return res.status(409).json({ error: 'username exists' });
//   }

//   try {
//     const worker = await createWorker({ username, password, full_name, phone });
//     const token = jwt.sign({ id: worker.id, username: worker.username }, process.env.JWT_SECRET, { expiresIn: '12h' });
//     res.status(201).json({ token, user: worker });
//   } catch (err) {
//     console.error(err);
//     res.sendStatus(500);
//   }
// });

// module.exports = router;





const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { findByEmail, createWorker } = require('../models/worker');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  console.log(req.body)
  if (!email || !password) return res.status(400).json({ error: 'missing' });

  const worker = await findByEmail(email);
  if (!worker) return res.status(401).json({ error: 'bad creds' });

  const ok = await bcrypt.compare(password, worker.password_hash);
  if (!ok) return res.status(401).json({ error: 'bad creds' });

  const token = jwt.sign(
    { id: worker.id, email: worker.email },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({ token, user: { id: worker.id, email: worker.email, full_name: worker.full_name } });
});

router.post('/register', async (req, res) => {
  const { email, password, full_name, phone } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'missing fields' });
  }

  if (await findByEmail(email)) {
    return res.status(409).json({ error: 'email exists' });
  }

  try {
    const worker = await createWorker({ email, password, full_name, phone });
    const token = jwt.sign({ id: worker.id, email: worker.email }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.status(201).json({ token, user: worker });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

module.exports = router;