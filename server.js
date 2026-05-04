const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { readData, writeData } = require('./db');
const { analyzeRisk } = require('./sentiment');

const app = express();
const PORT = process.env.PORT || 3000;

console.log("🚀 Starting MindCare...");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'mindcare_secret_key',
  resave: false,
  saveUninitialized: false
}));

// AUTH MIDDLEWARE
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireCounselor(req, res, next) {
  if (req.session.role !== 'counselor') return res.status(403).json({ error: 'Forbidden' });
  next();
}

////////////////////////////////////////////////////
// SIGNUP
////////////////////////////////////////////////////
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;

  let data = readData();

  if (data.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    id: Date.now(),
    name,
    email,
    password: hashedPassword,
    role: 'student',
    quiz_completed: 0
  };

  data.users.push(newUser);
  writeData(data);

  req.session.userId = newUser.id;
  req.session.role = newUser.role;

  res.json({ message: 'Signup successful', user: newUser });
});

////////////////////////////////////////////////////
// LOGIN
////////////////////////////////////////////////////
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  let data = readData();

  const user = data.users.find(u => u.email === email);

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);

  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.userId = user.id;
  req.session.role = user.role;

  res.json({ message: 'Login successful', user });
});

////////////////////////////////////////////////////
// QUIZ SUBMISSION
////////////////////////////////////////////////////
app.post('/api/submit-quiz', requireAuth, (req, res) => {
  const { mcq_score, text_response } = req.body;

  let data = readData();

  const { risk_level, sentiment_score } =
    analyzeRisk(Number(mcq_score), text_response);

  const result = {
    id: Date.now(),
    user_id: req.session.userId,
    mcq_score,
    text_response,
    sentiment_score,
    risk_level
  };

  data.results.push(result);

  const user = data.users.find(u => u.id === req.session.userId);
  if (user) user.quiz_completed = 1;

  writeData(data);

  res.json({ risk_level, sentiment_score });
});

////////////////////////////////////////////////////
// COUNSELOR VIEW
////////////////////////////////////////////////////
app.get('/api/counselor-data', requireCounselor, (req, res) => {
  let data = readData();

  const flagged = data.results
    .filter(r => r.risk_level !== 'Low Risk')
    .map(r => {
      const user = data.users.find(u => u.id === r.user_id);
      return {
        name: user ? user.name : 'Unknown',
        risk_level: r.risk_level
      };
    });

  res.json({ students: flagged });
});

////////////////////////////////////////////////////
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});