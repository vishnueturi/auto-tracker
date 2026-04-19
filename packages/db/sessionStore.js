const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const POLL_INTERVAL_SEC = 20;
const rootDir = process.cwd();
const dataDir = process.env.AUTO_TRACKER_DATA_DIR
  ? path.resolve(process.env.AUTO_TRACKER_DATA_DIR)
  : path.join(rootDir, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFile = path.join(dataDir, "tracker.sqlite");
const schemaFile = path.join(rootDir, "packages", "db", "schema.sql");
const db = new Database(dbFile);

db.pragma("journal_mode = WAL");
db.exec(fs.readFileSync(schemaFile, "utf8"));

function tableColumns(tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all();
}

function ensureSessionColumns() {
  const columns = tableColumns("sessions");
  if (!columns.some((column) => column.name === "is_idle")) {
    db.exec("ALTER TABLE sessions ADD COLUMN is_idle INTEGER DEFAULT 0");
  }
}

function ensureGoalsSchema() {
  const columns = tableColumns("goals");
  const needsRebuild =
    columns.some((column) => column.name === "week_start") ||
    !columns.some((column) => column.name === "period") ||
    !columns.some((column) => column.name === "updated_at");

  if (!needsRebuild) {
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_category_unique ON goals(category COLLATE NOCASE)",
    );
    return;
  }

  const migrateGoals = db.transaction(() => {
    db.exec("DROP TABLE IF EXISTS goals_migration");
    db.exec(`
      CREATE TABLE IF NOT EXISTS goals_migration (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL COLLATE NOCASE UNIQUE,
        target_minutes INTEGER NOT NULL CHECK (target_minutes > 0),
        period TEXT NOT NULL DEFAULT 'daily',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.prepare(
      `
        INSERT OR REPLACE INTO goals_migration (
          category,
          target_minutes,
          period,
          created_at,
          updated_at
        )
        SELECT
          TRIM(category),
          MAX(CAST(target_minutes AS INTEGER)),
          'daily',
          COALESCE(MIN(created_at), CURRENT_TIMESTAMP),
          CURRENT_TIMESTAMP
        FROM goals
        WHERE category IS NOT NULL
          AND TRIM(category) != ''
          AND CAST(target_minutes AS INTEGER) > 0
        GROUP BY LOWER(TRIM(category))
      `,
    ).run();

    db.exec("DROP TABLE goals");
    db.exec("ALTER TABLE goals_migration RENAME TO goals");
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_category_unique ON goals(category COLLATE NOCASE)",
    );
  });

  migrateGoals();
}

function ensureRulesSchema() {
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_rules_active_priority ON classification_rules(is_active, priority)",
  );
}

function migrate() {
  ensureSessionColumns();
  ensureGoalsSchema();
  ensureRulesSchema();
}

migrate();

const defaultRules = [
  {
    pattern: "leetcode",
    source: "title",
    match_type: "contains",
    category: "Preparation",
    priority: 10,
  },
  {
    pattern: "hackerrank",
    source: "title",
    match_type: "contains",
    category: "Preparation",
    priority: 10,
  },
  {
    pattern: "geeksforgeeks",
    source: "title",
    match_type: "contains",
    category: "Preparation",
    priority: 10,
  },
  {
    pattern: "linkedin jobs",
    source: "title",
    match_type: "contains",
    category: "Job Search",
    priority: 20,
  },
  {
    pattern: "naukri",
    source: "title",
    match_type: "contains",
    category: "Job Search",
    priority: 20,
  },
  {
    pattern: "indeed",
    source: "title",
    match_type: "contains",
    category: "Job Search",
    priority: 20,
  },
  {
    pattern: "wellfound",
    source: "title",
    match_type: "contains",
    category: "Job Search",
    priority: 20,
  },
  {
    pattern: "youtube",
    source: "title",
    match_type: "contains",
    category: "Entertainment",
    priority: 30,
  },
  {
    pattern: "netflix",
    source: "title",
    match_type: "contains",
    category: "Entertainment",
    priority: 30,
  },
  {
    pattern: "prime video",
    source: "title",
    match_type: "contains",
    category: "Entertainment",
    priority: 30,
  },
  {
    pattern: "teams",
    source: "app",
    match_type: "contains",
    category: "Office Work",
    priority: 40,
  },
  {
    pattern: "outlook",
    source: "app",
    match_type: "contains",
    category: "Office Work",
    priority: 40,
  },
  {
    pattern: "slack",
    source: "app",
    match_type: "contains",
    category: "Office Work",
    priority: 40,
  },
  {
    pattern: "visual studio code",
    source: "app",
    match_type: "contains",
    category: "Personal Project",
    priority: 50,
  },
  {
    pattern: "auto-tracker",
    source: "title",
    match_type: "contains",
    category: "Personal Project",
    priority: 50,
  },
];

function seedDefaultRules() {
  const ruleCount = db.prepare("SELECT COUNT(*) count FROM classification_rules").get().count;

  if (ruleCount > 0) {
    return;
  }

  const insertRule = db.prepare(
    `
      INSERT INTO classification_rules (
        pattern,
        source,
        match_type,
        category,
        priority,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, 1)
    `,
  );

  const seedRules = db.transaction(() => {
    for (const rule of defaultRules) {
      insertRule.run(
        rule.pattern,
        rule.source,
        rule.match_type,
        rule.category,
        rule.priority,
      );
    }
  });

  seedRules();
}

seedDefaultRules();

function todayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function upsert(event) {
  const ts = new Date(event.ts || new Date()).toISOString();
  const last = db.prepare("SELECT * FROM sessions ORDER BY id DESC LIMIT 1").get();
  const isIdle = Number(Boolean(event.isIdle));

  if (
    last &&
    last.app_name === event.app &&
    last.window_title === event.title &&
    last.category === event.category &&
    last.is_idle === isIdle
  ) {
    const durationSec = Math.max(
      POLL_INTERVAL_SEC,
      Math.round((new Date(ts) - new Date(last.start_time)) / 1000),
    );

    db.prepare("UPDATE sessions SET end_time = ?, duration_sec = ? WHERE id = ?").run(
      ts,
      durationSec,
      last.id,
    );
  } else {
    db.prepare(
      `
        INSERT INTO sessions (
          app_name,
          window_title,
          category,
          start_time,
          end_time,
          duration_sec,
          is_idle
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      event.app,
      event.title,
      event.category,
      ts,
      ts,
      POLL_INTERVAL_SEC,
      isIdle,
    );
  }

  return db.prepare("SELECT * FROM sessions ORDER BY id DESC LIMIT 1").get();
}

function getSummary(date = todayKey()) {
  const rows = db
    .prepare(
      `
        SELECT *
        FROM sessions
        WHERE date(start_time, 'localtime') = ?
        ORDER BY id DESC
      `,
    )
    .all(date);
  const totalDurationSec = rows.reduce((sum, row) => sum + row.duration_sec, 0);
  const idleDurationSec = rows
    .filter((row) => row.is_idle)
    .reduce((sum, row) => sum + row.duration_sec, 0);
  const summary = {};

  for (const row of rows) {
    summary[row.category] = (summary[row.category] || 0) + row.duration_sec;
  }

  const categoryTotals = Object.entries(summary)
    .map(([category, durationSec]) => ({ category, durationSec }))
    .sort((a, b) => b.durationSec - a.durationSec);

  const topApps = db
    .prepare(
      `
        SELECT app_name app, SUM(duration_sec) durationSec
        FROM sessions
        WHERE date(start_time, 'localtime') = ?
        GROUP BY app_name
        ORDER BY durationSec DESC
        LIMIT 5
      `,
    )
    .all(date);

  return {
    date,
    totalSessions: rows.length,
    totalDurationSec,
    idleDurationSec,
    productiveDurationSec: totalDurationSec - idleDurationSec,
    summary,
    categoryTotals,
    topApps,
    rows,
  };
}

function getWeekSummary() {
  return db
    .prepare(
      `
        SELECT category, ROUND(SUM(duration_sec) / 60) minutes
        FROM sessions
        WHERE date(start_time) >= date('now', '-6 day')
          AND COALESCE(is_idle, 0) = 0
        GROUP BY category
        ORDER BY minutes DESC
      `,
    )
    .all();
}

function listGoals() {
  return db
    .prepare(
      `
        SELECT id, category, target_minutes, period, created_at, updated_at
        FROM goals
        ORDER BY category COLLATE NOCASE ASC
      `,
    )
    .all();
}

function saveGoal(category, targetMinutes, period = "daily") {
  return db
    .prepare(
      `
        INSERT INTO goals (category, target_minutes, period, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(category) DO UPDATE SET
          target_minutes = excluded.target_minutes,
          period = excluded.period,
          updated_at = CURRENT_TIMESTAMP
      `,
    )
    .run(category, targetMinutes, period);
}

function getGoalProgress(date = todayKey()) {
  const goals = listGoals();

  if (goals.length === 0) {
    return [];
  }

  const dailyTotals = db
    .prepare(
      `
        SELECT category, ROUND(SUM(duration_sec) / 60) actual_minutes
        FROM sessions
        WHERE date(start_time, 'localtime') = ?
          AND COALESCE(is_idle, 0) = 0
        GROUP BY category
      `,
    )
    .all(date)
    .reduce((totals, row) => {
      totals[row.category.toLowerCase()] = Number(row.actual_minutes || 0);
      return totals;
    }, {});

  return goals.map((goal) => {
    const actualMinutes = dailyTotals[goal.category.toLowerCase()] || 0;
    const targetMinutes = Number(goal.target_minutes);
    const percent =
      targetMinutes > 0
        ? Math.min(100, Math.round((actualMinutes / targetMinutes) * 100))
        : 0;

    return {
      id: goal.id,
      category: goal.category,
      period: goal.period,
      target_minutes: targetMinutes,
      actual_minutes: actualMinutes,
      remaining_minutes: Math.max(targetMinutes - actualMinutes, 0),
      percent,
      status: percent >= 100 ? "complete" : percent >= 50 ? "on_track" : "behind",
    };
  });
}

function listRules({ activeOnly = false } = {}) {
  const activeClause = activeOnly ? "WHERE is_active = 1" : "";

  return db
    .prepare(
      `
        SELECT
          id,
          pattern,
          source,
          match_type,
          category,
          priority,
          is_active,
          created_at,
          updated_at
        FROM classification_rules
        ${activeClause}
        ORDER BY
          CASE match_type WHEN 'exact' THEN 0 ELSE 1 END,
          priority ASC,
          CASE source WHEN 'domain' THEN 0 WHEN 'title' THEN 1 ELSE 2 END,
          id ASC
      `,
    )
    .all();
}

function getRule(id) {
  return db
    .prepare(
      `
        SELECT
          id,
          pattern,
          source,
          match_type,
          category,
          priority,
          is_active,
          created_at,
          updated_at
        FROM classification_rules
        WHERE id = ?
      `,
    )
    .get(id);
}

function createRule(rule) {
  const result = db
    .prepare(
      `
        INSERT INTO classification_rules (
          pattern,
          source,
          match_type,
          category,
          priority,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
    )
    .run(
      rule.pattern,
      rule.source,
      rule.matchType,
      rule.category,
      rule.priority,
      rule.isActive,
    );

  return getRule(result.lastInsertRowid);
}

function updateRule(id, rule) {
  const result = db
    .prepare(
      `
        UPDATE classification_rules
        SET
          pattern = ?,
          source = ?,
          match_type = ?,
          category = ?,
          priority = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .run(
      rule.pattern,
      rule.source,
      rule.matchType,
      rule.category,
      rule.priority,
      rule.isActive,
      id,
    );

  return result.changes > 0 ? getRule(id) : null;
}

function deleteRule(id) {
  return db.prepare("DELETE FROM classification_rules WHERE id = ?").run(id).changes > 0;
}

module.exports = {
  POLL_INTERVAL_SEC,
  dbFile,
  upsert,
  getSummary,
  getWeekSummary,
  listGoals,
  saveGoal,
  getGoalProgress,
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  todayKey,
};
