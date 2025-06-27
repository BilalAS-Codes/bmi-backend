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

dotenv.config();



const app = express();
app.use(express.json());
app.use(cors())

// const admin = require('firebase-admin');
// admin.initializeApp({
//   credential: admin.credential.cert(require('./firebase-adminsdk.json')),
// });

// const sendPushNotification = async (tokens, title, message) => {
//   const payload = {
//     notification: {
//       title,
//       body: message,
//     },
//   };

//   await admin.messaging().sendEachForMulticast({
//     tokens,
//     ...payload
//   });
// };


app.set('view engine', 'ejs');
// Specify the directory where your EJS template files are located
app.set('views', './views');
const PORT = 5000



// createTables()
app.use('/auth', authRoutes);
app.use('/candidates', candidateRoutes);

app.use('/seed',seedUsers)


app.use('/', viewRoutes);
// app.use('/api', seedCandidatesRoute);

app.use('/task' , taskRoutes);
app.use('/cron', cronRouter);

app.get('/', (_req, res) => res.send('Anganwadi backend is running'));


app.get('/test', (req, res) => {
  res.json({ message: 'Backend is working' });
});



// app.post('/test-register', async(req,res)=>{
// try {
//   const {email , password , full_name , phone } = req.body;
//   if (!email || !password || !full_name || !phone) {
//     return res.status(400).json({ error: 'All fields are required' });
//   }
//   const hashedPassword = await bcrypt.hash(password, 10);
//   const query = 'INSERT INTO workers (email, password, full_name, phone) VALUES ($1, $2, $3, $4) RETURNING *';
//   const values = [email, hashedPassword, full_name, phone];
//   const { rows } = await pool.query(query, values);
//   const newWorker = rows[0];
//   res.status(201).json({ worker: newWorker });
// } catch (error) {
//   console.error('Error in /test-register:', error);
//   res.status(500).json({ error: 'Internal Server Error' });
// }
// }
// );



// app.post('/api/notifications', async (req, res) => {
//   const { title, message, workerIds } = req.body;
//   const client = await pool.connect();

//   try {
//     await client.query('BEGIN');

//     const notificationRes = await client.query(
//       `INSERT INTO notifications (title, message, created_by)
//        VALUES ($1, $2, $3) RETURNING id`,
//       [title, message, req.user.id] // assuming JWT middleware sets req.user
//     );

//     const notificationId = notificationRes.rows[0].id;

//     for (const workerId of workerIds) {
//       await client.query(
//         `INSERT INTO notification_recipients (notification_id, worker_id)
//          VALUES ($1, $2)`,
//         [notificationId, workerId]
//       );
//     }

//     // Get FCM tokens
//     const tokenRes = await client.query(
//       `SELECT fcm_token FROM workers WHERE id = ANY($1::int[])`,
//       [workerIds]
//     );

//     const tokens = tokenRes.rows.map(row => row.fcm_token).filter(Boolean);

//     await sendPushNotification(tokens, title, message);

//     await client.query('COMMIT');
//     res.status(200).json({ success: true });
//   } catch (err) {
//     await client.query('ROLLBACK');
//     console.error(err);
//     res.status(500).json({ error: 'Internal server error' });
//   } finally {
//     client.release();
//   }
// });





// Initialize Firebase Admin if not already done
// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(require('./firebase-adminsdk.json')),
//   });
// }

// /**
//  * @api {post} /api/test-notification Send test notification to single device
//  * @apiName SendTestNotification
//  * @apiGroup Notification
//  * 
//  * @apiBody {String} token The device FCM token
//  * @apiBody {String} title Notification title
//  * @apiBody {String} message Notification message
//  * 
//  * @apiSuccess {Boolean} success True if notification was sent successfully
//  * @apiError (500) {String} error Error message
//  */
// app.post('/api/test-notification', async (req, res) => {
//   try {
//     const { token, title, message } = req.body;
//     console.log('Received test notification request:', { token, title, message });

//     if (!token || !title || !message) {
//       return res.status(400).json({ error: 'Token, title and message are required' });
//     }

//     const payload = {
//       notification: {
//         title,
//         body: message,
//       },
//       token: token 
//     };

//     // Send the notification
//     const response = await admin.messaging().send(payload);
    
//     console.log('Successfully sent test notification:', response);
//     res.status(200).json({ success: true, messageId: response });
//   } catch (err) {
//     console.error('Error sending test notification:', err);
//     res.status(500).json({ error: err.message || 'Failed to send notification' });
//   }
// });




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







connectDB().then(() => {
  rescheduleCronJobs(); 
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
});