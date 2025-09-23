const express = require('express');
const dotenv = require('dotenv');
const { connectDB } = require('./connection');
const authRoutes = require('./routes/auth');
const candidateRoutes = require('./routes/candidates');
const taskRoutes = require('./routes/tasks'); 
const { createTables } = require('./migrate');
const viewRoutes = require('./routes/viewRoutes'); 
const bcrypt = require('bcrypt');
// const seedCandidatesRoute = require('./routes/seedCandidate'); // adjust path
const seedUsers = require('./routes/seed_users')
const cronRouter = require('./routes/cron_jobs')
const { pool } = require('./connection'); 
const jwt = require('jsonwebtoken');
const cors = require('cors');
const {rescheduleCronJobs} = require('./routes/reschedule_crone_jobs');  
const anganwadiRouter = require('./routes/angawadi_workers')
const adminRouter = require('./routes/admins'); 
const notificationRouter = require('./routes/notifications');
const sendNotification = require('./routes/send_notification'); 
const loggingService = require('./routes/loggingService');

dotenv.config();



const app = express();
app.use(express.json({limit: '50mb'}));
app.use(cors())



app.set('view engine', 'ejs');
app.set('views', './views');
const PORT = 5000




app.use('/auth', authRoutes);
app.use('/candidates', candidateRoutes);
app.use('/anganwadi-workers',anganwadiRouter); 
app.use('/seed',seedUsers)
app.use('/notifications',notificationRouter);
app.use('/send-notification', sendNotification); 

app.use('/', viewRoutes);
// app.use('/api', seedCandidatesRoute);

app.use('/task' , taskRoutes);
app.use('/cron', cronRouter);
app.use('/admin', adminRouter);

app.get('/', (_req, res) => res.send('Anganwadi backend is running'));


app.get('/test', (req, res) => {
  res.json({ message: 'Backend is working' });
});






app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const query = 'SELECT * FROM workers WHERE email = $1';
    const { rows } = await pool.query(query, [email]);
    const worker = rows[0];


    if (!worker) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, worker.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: worker.id, email: worker.email },
      process.env.JWT_SECRECT,
      { expiresIn: '12h' }
    );

    // Optional: Omit password before sending user back
    delete worker.password;

    res.status(200).json({ token, user: worker });
  } catch (err) {
    console.error('Error in /api/login:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.use('/log',loggingService);














connectDB().then(() => {
  rescheduleCronJobs(); 
  app.listen(PORT, '0.0.0.0',() => console.log(`🚀 Server running on http://localhost:${PORT}`));
});
