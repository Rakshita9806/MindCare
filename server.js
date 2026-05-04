const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('./db');
const { analyzeRisk } = require('./sentiment');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
  secret: 'mindcare_secret_key_123',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set secure: true if using HTTPS
}));

// Require auth middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

const requireCounselor = (req, res, next) => {
  if (req.session && req.session.userId && req.session.role === 'counselor') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
};

// --- AUTHENTICATION ROUTES ---

app.post('/api/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const userRole = role === 'counselor' ? 'counselor' : 'student';

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    db.run('INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)', 
      [name, email, hashedPassword, userRole], 
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        
        req.session.userId = this.lastID;
        req.session.role = userRole;
        req.session.name = name;
        
        res.json({ message: 'Signup successful', user: { id: this.lastID, name, role: userRole } });
      });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  db.get('SELECT * FROM Users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (match) {
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.name = user.name;
      
      res.json({ message: 'Login successful', user: { id: user.id, name: user.name, role: user.role, quiz_completed: user.quiz_completed } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

app.get('/api/me', requireAuth, (req, res) => {
  db.get('SELECT id, name, role, quiz_completed FROM Users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err || !user) return res.status(500).json({ error: 'Error fetching user' });
    res.json({ user });
  });
});

// --- QUIZ & DASHBOARD ROUTES ---

app.post('/api/submit-quiz', requireAuth, (req, res) => {
  const { mcq_score, text_response } = req.body;
  
  if (mcq_score === undefined || text_response === undefined) {
    return res.status(400).json({ error: 'Missing quiz fields' });
  }

  // Calculate risk level and sentiment score
  const { risk_level, sentiment_score } = analyzeRisk(Number(mcq_score), text_response);

  // Store in database
  db.serialize(() => {
    db.run(
      'INSERT INTO QuizResults (user_id, mcq_score, text_response, sentiment_score, risk_level) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, mcq_score, text_response, sentiment_score, risk_level],
      function(err) {
        if (err) return res.status(500).json({ error: 'Error saving quiz results' });
        
        // Update user profile to mark quiz as completed
        db.run('UPDATE Users SET quiz_completed = 1 WHERE id = ?', [req.session.userId], (updateErr) => {
          if (updateErr) console.error('Error updating quiz_completed status:', updateErr);
          
          // DO NOT expose full text response in response (Privacy enforcement)
          res.json({ 
            message: 'Quiz submitted successfully',
            risk_level, 
            sentiment_score 
          });
        });
      }
    );
  });
});

app.get('/api/counselor-data', requireCounselor, (req, res) => {
  // Modified counselor view to show ONLY Moderate Risk and High Risk students
  // Fetch ONLY student name and risk level
  const query = `
    SELECT u.name, q.risk_level 
    FROM Users u
    JOIN QuizResults q ON u.id = q.user_id
    WHERE q.id = (
      SELECT MAX(id) FROM QuizResults WHERE user_id = u.id
    )
    AND q.risk_level IN ('Moderate Risk', 'High Risk')
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    // Privacy: No text responses or detailed data shown
    res.json({ students: rows });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`MindCare server running on http://localhost:${PORT}`);
});
