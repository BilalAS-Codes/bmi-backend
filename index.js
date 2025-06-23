// // index.js
// const express = require('express');
// require('dotenv').config();

// const { pool, connectDB } = require('./connection');

// const app  = express();
// const PORT = Number(process.env.APP_PORT) || 5000;

// app.use(express.json());

// // Basic health-check endpoint
// app.get('/', async (_req, res) => {
//   try {
//     const { rows } = await pool.query('SELECT NOW() AS now');
//     res.json({ api: 'ok', db: rows[0].now });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'DB not reachable' });
//   }
// });

// connectDB()              // verify DB before we start listening
//   .then(() => {
//     app.listen(PORT, () =>
//       console.log(`🚀 Server running at http://localhost:${PORT}`),
//     );
//   });


const express = require('express');
const dotenv = require('dotenv');
const { connectDB } = require('./connection');
const authRoutes = require('./routes/auth');
const candidateRoutes = require('./routes/candidates');
const { createTables } = require('./migrate');
const viewRoutes = require('./routes/viewRoutes'); 
// const seedCandidatesRoute = require('./routes/seedCandidate'); // adjust path
const seedUsers = require('./routes/seed_users')

dotenv.config();


const app = express();
app.set('view engine', 'ejs');
// Specify the directory where your EJS template files are located
app.set('views', './views');
const PORT = Number(process.env.APP_PORT) || 5000;

app.use(express.json());

// createTables()
app.use('/auth', authRoutes);
app.use('/candidates', candidateRoutes);

app.use('/seed',seedUsers)


app.use('/', viewRoutes);
// app.use('/api', seedCandidatesRoute);

app.get('/', (_req, res) => res.send('Anganwadi backend is running'));

connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
});