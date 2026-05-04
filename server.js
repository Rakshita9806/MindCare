console.log("🚀 Starting MindCare...");
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
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
  cookie: { secure: false }
}));

// Auth middlewares
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

////////////////////////////////////////////////////
// AUTH ROUTES
////////////////////////////////////////////////////

app.post('/api/signup', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const userRole = role === 'counselor' ? 'counselor' : 'student';

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(`
      INSERT INTO Users (name, email, password, role)
      VALUES (?, ?, ?, ?)
    `).run(name, email, hashedPassword, userRole);

    req.session.userId = result.lastInsertRowid;
    req.session.role = userRole;
    req.session.name = name;

    res.json({
      message: 'Signup successful',
      user: { id: result.lastInsertRowid, name, role: userRole }
    });

  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

////////////////////////////////////////////////////

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const user = db.prepare(`
      SELECT * FROM Users WHERE email = ?
    `).get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.name = user.name;

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        quiz_completed: user.quiz_completed
      }
    });

  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

////////////////////////////////////////////////////

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

////////////////////////////////////////////////////

app.get('/api/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, name, role, quiz_completed
      FROM Users WHERE id = ?
    `).get(req.session.userId);

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching user' });
  }
});

////////////////////////////////////////////////////
// QUIZ ROUTES
////////////////////////////////////////////////////

app.post('/api/submit-quiz', requireAuth, (req, res) => {
  const { mcq_score, text_response } = req.body;

  if (mcq_score === undefined || text_response === undefined) {
    return res.status(400).json({ error: 'Missing quiz fields' });
  }

  try {
    const { risk_level, sentiment_score } =
      analyzeRisk(Number(mcq_score), text_response);

    db.prepare(`
      INSERT INTO QuizResults
      (user_id, mcq_score, text_response, sentiment_score, risk_level)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.session.userId,
      mcq_score,
      text_response,
      sentiment_score,
      risk_level
    );

    db.prepare(`
      UPDATE Users SET quiz_completed = 1 WHERE id = ?
    `).run(req.session.userId);

    res.json({
      message: 'Quiz submitted successfully',
      risk_level,
      sentiment_score
    });

  } catch (err) {
    res.status(500).json({ error: 'Error saving quiz results' });
  }
});

////////////////////////////////////////////////////
// COUNSELOR DASHBOARD
////////////////////////////////////////////////////

app.get('/api/counselor-data', requireCounselor, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT u.name, q.risk_level
      FROM Users u
      JOIN QuizResults q ON u.id = q.user_id
      WHERE q.id = (
        SELECT MAX(id) FROM QuizResults WHERE user_id = u.id
      )
      AND q.risk_level IN ('Moderate Risk', 'High Risk')
    `).all();

    res.json({ students: rows });

  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

////////////////////////////////////////////////////
// START SERVER
////////////////////////////////////////////////////

app.listen(PORT, () => {
  console.log(`MindCare server running on port ${PORT}`);
});