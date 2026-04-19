CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name TEXT NOT NULL,
  window_title TEXT,
  category TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  is_idle INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL COLLATE NOCASE UNIQUE,
  target_minutes INTEGER NOT NULL CHECK (target_minutes > 0),
  period TEXT NOT NULL DEFAULT 'daily',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classification_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,
  source TEXT NOT NULL,
  match_type TEXT NOT NULL,
  category TEXT NOT NULL,
  priority INTEGER DEFAULT 100,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rules_active_priority
  ON classification_rules(is_active, priority);
