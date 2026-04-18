CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name TEXT NOT NULL,
  window_title TEXT,
  category TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
