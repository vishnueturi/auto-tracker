const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const POLL_INTERVAL_SEC = 20;
const rootDir = process.cwd();
const dataDir = path.join(rootDir, 'data');
const dbFile = path.join(dataDir, 'tracker.sqlite');
const schemaFile = path.join(rootDir, 'packages', 'db', 'schema.sql');
const legacyMergedFile = path.join(dataDir, 'merged-sessions.json');
const legacyRawFile = path.join(dataDir, 'sessions.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.exec(fs.readFileSync(schemaFile, 'utf8'));

const insertSession = db.prepare(`
  INSERT INTO sessions (
    app_name,
    window_title,
    category,
    start_time,
    end_time,
    duration_sec
  ) VALUES (?, ?, ?, ?, ?, ?)
`);

const updateSession = db.prepare(`
  UPDATE sessions
  SET end_time = ?, duration_sec = ?
  WHERE id = ?
`);

const selectLastSession = db.prepare(`
  SELECT id, app_name, window_title, category, start_time, end_time, duration_sec
  FROM sessions
  ORDER BY end_time DESC, id DESC
  LIMIT 1
`);

const selectSessionsForDate = db.prepare(`
  SELECT
    id,
    app_name AS app,
    window_title AS title,
    category,
    start_time AS start,
    end_time AS end,
    duration_sec AS durationSec,
    created_at AS createdAt
  FROM sessions
  WHERE date(start_time, 'localtime') = ?
  ORDER BY start_time DESC, id DESC
`);

const selectCategorySummaryForDate = db.prepare(`
  SELECT category, SUM(duration_sec) AS durationSec
  FROM sessions
  WHERE date(start_time, 'localtime') = ?
  GROUP BY category
  ORDER BY durationSec DESC, category ASC
`);

const selectTopAppsForDate = db.prepare(`
  SELECT app_name AS app, SUM(duration_sec) AS durationSec
  FROM sessions
  WHERE date(start_time, 'localtime') = ?
  GROUP BY app_name
  ORDER BY durationSec DESC, app ASC
  LIMIT ?
`);

function init() {
  migrateLegacyData();
}

function rowCount() {
  return db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count;
}

function migrateLegacyData() {
  if (rowCount() > 0) {
    return;
  }

  if (fs.existsSync(legacyMergedFile)) {
    importMergedSessions(JSON.parse(fs.readFileSync(legacyMergedFile, 'utf8')));
    return;
  }

  if (fs.existsSync(legacyRawFile)) {
    importRawEvents(JSON.parse(fs.readFileSync(legacyRawFile, 'utf8')));
  }
}

function normalizeTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function secondsBetween(start, end) {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(POLL_INTERVAL_SEC, Math.round(diffMs / 1000));
}

function upsert(entry) {
  const ts = normalizeTimestamp(entry.ts || new Date());
  const last = selectLastSession.get();

  if (
    last &&
    last.app_name === entry.app &&
    last.window_title === entry.title &&
    last.category === entry.category
  ) {
    const durationSec = secondsBetween(last.start_time, ts);
    updateSession.run(ts, durationSec, last.id);
    return getById(last.id);
  }

  const result = insertSession.run(
    entry.app,
    entry.title,
    entry.category,
    ts,
    ts,
    POLL_INTERVAL_SEC
  );

  return getById(result.lastInsertRowid);
}

function getById(id) {
  return db.prepare(`
    SELECT
      id,
      app_name AS app,
      window_title AS title,
      category,
      start_time AS start,
      end_time AS end,
      duration_sec AS durationSec,
      created_at AS createdAt
    FROM sessions
    WHERE id = ?
  `).get(id);
}

function listSessions(date = todayKey()) {
  return selectSessionsForDate.all(date);
}

function getSummary(date = todayKey()) {
  const rows = listSessions(date);
  const byCategory = Object.fromEntries(
    selectCategorySummaryForDate.all(date).map((row) => [row.category, row.durationSec])
  );
  const topApps = selectTopAppsForDate.all(date, 5);
  const totalDurationSec = rows.reduce((sum, row) => sum + row.durationSec, 0);

  return {
    date,
    totalSessions: rows.length,
    totalDurationSec,
    summary: byCategory,
    topApps,
    rows,
  };
}

function todayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function importMergedSessions(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const transaction = db.transaction((items) => {
    for (const row of items) {
      insertSession.run(
        row.app || 'Unknown',
        row.title || '',
        row.category || 'General',
        normalizeTimestamp(row.start || row.ts),
        normalizeTimestamp(row.end || row.ts),
        Math.max(POLL_INTERVAL_SEC, Number(row.durationSec) || POLL_INTERVAL_SEC)
      );
    }
  });

  transaction(rows);
}

function importRawEvents(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const sorted = rows
    .filter((row) => row && row.ts)
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  for (const row of sorted) {
    upsert({
      app: row.app || 'Unknown',
      title: row.title || '',
      category: row.category || 'General',
      ts: row.ts,
    });
  }
}

init();

module.exports = {
  POLL_INTERVAL_SEC,
  dbFile,
  getSummary,
  listSessions,
  todayKey,
  upsert,
};
