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

function migrate() {
  ensureSessionColumns();
  ensureGoalsSchema();
}

migrate();

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

module.exports = {
  POLL_INTERVAL_SEC,
  dbFile,
  upsert,
  getSummary,
  getWeekSummary,
  listGoals,
  saveGoal,
  getGoalProgress,
  todayKey,
};
