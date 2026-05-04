const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'mindcare.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create Users table with quiz_completed column as requested
    db.run(`
      CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        quiz_completed INTEGER DEFAULT 0
      )
    `);

    // Create QuizResults table
    db.run(`
      CREATE TABLE IF NOT EXISTS QuizResults (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        mcq_score INTEGER,
        text_response TEXT,
        sentiment_score REAL,
        risk_level TEXT,
        FOREIGN KEY (user_id) REFERENCES Users (id)
      )
    `);
  }
});

module.exports = db;
