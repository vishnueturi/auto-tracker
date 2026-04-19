const fs = require("fs");
const http = require("http");
const path = require("path");
const { handleGoalsRoute } = require("../../backend/routes/goals");
const { handleRulesRoute } = require("../../backend/routes/rules");
const { getSummary, getWeekSummary } = require("../../packages/db/sessionStore");

const PORT = Number(process.env.PORT || 3000);
const rootDir = process.cwd();
const goalsCardPath = path.join(
  rootDir,
  "apps",
  "dashboard",
  "components",
  "GoalsCard.jsx",
);

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload, null, 2));
}

function html(res, body) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function minutes(seconds) {
  return Math.round(Number(seconds || 0) / 60);
}

function renderDashboard() {
  const today = getSummary();
  const week = getWeekSummary();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Auto Tracker Dashboard</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f8fa;
        --panel: #ffffff;
        --border: #d9dee7;
        --text: #242424;
        --muted: #616161;
        --green: #15803d;
        --yellow: #b7791f;
        --red: #b91c1c;
        --track: #e5e7eb;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: Arial, Helvetica, sans-serif;
      }
      main {
        width: min(1080px, calc(100% - 32px));
        margin: 0 auto;
        padding: 28px 0 40px;
      }
      header {
        margin-bottom: 24px;
      }
      h1,
      h2,
      h3,
      p {
        margin-top: 0;
      }
      .muted {
        color: var(--muted);
      }
      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 18px;
      }
      .metric {
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      ul {
        padding-left: 20px;
        margin-bottom: 0;
      }
      li {
        margin: 8px 0;
      }
      label {
        display: block;
        color: var(--muted);
        font-size: 13px;
        margin-bottom: 6px;
      }
      input,
      button {
        border-radius: 6px;
        font: inherit;
      }
      input {
        width: 100%;
        border: 1px solid var(--border);
        padding: 10px;
      }
      button {
        border: 0;
        background: #242424;
        color: #ffffff;
        cursor: pointer;
        padding: 10px 14px;
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.65;
      }
      .goal-form {
        display: grid;
        gap: 12px;
        grid-template-columns: minmax(160px, 1fr) minmax(120px, 160px) auto;
        align-items: end;
        margin-bottom: 16px;
      }
      .goal-list {
        display: grid;
        gap: 12px;
      }
      .goal-row {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
      }
      .goal-heading {
        align-items: baseline;
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .progress-track {
        background: var(--track);
        border-radius: 6px;
        height: 10px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        transition: width 160ms ease;
      }
      .progress-fill.complete {
        background: var(--green);
      }
      .progress-fill.on_track {
        background: var(--yellow);
      }
      .progress-fill.behind {
        background: var(--red);
      }
      .state {
        border-radius: 6px;
        margin: 10px 0;
        padding: 10px;
      }
      .state.error {
        background: #fee2e2;
        color: #7f1d1d;
      }
      .state.empty {
        background: #edf7ed;
        color: #1b5e20;
      }
      @media (max-width: 680px) {
        main {
          width: min(100% - 20px, 1080px);
          padding-top: 18px;
        }
        .goal-form {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Auto Tracker Dashboard</h1>
        <p class="muted">Today and weekly execution progress from local tracking data.</p>
      </header>

      <section class="grid" aria-label="Today summary">
        <article class="panel">
          <h2>Today</h2>
          <div class="metric">${minutes(today.productiveDurationSec)} mins</div>
          <p class="muted">Productive time</p>
        </article>
        <article class="panel">
          <h2>Idle</h2>
          <div class="metric">${minutes(today.idleDurationSec)} mins</div>
          <p class="muted">${today.totalSessions} tracked sessions</p>
        </article>
      </section>

      <section class="grid" style="margin-top: 16px">
        <article class="panel">
          <h2>Top Apps</h2>
          ${
            today.topApps.length
              ? `<ul>${today.topApps
                  .map(
                    (app) =>
                      `<li>${escapeHtml(app.app)}: ${minutes(app.durationSec)} mins</li>`,
                  )
                  .join("")}</ul>`
              : '<p class="muted">No sessions tracked today.</p>'
          }
        </article>
        <article class="panel">
          <h2>Categories</h2>
          ${
            today.categoryTotals.length
              ? `<ul>${today.categoryTotals
                  .map(
                    (row) =>
                      `<li>${escapeHtml(row.category)}: ${minutes(row.durationSec)} mins</li>`,
                  )
                  .join("")}</ul>`
              : '<p class="muted">No category totals yet.</p>'
          }
        </article>
        <article class="panel">
          <h2>Week</h2>
          ${
            week.length
              ? `<ul>${week
                  .map(
                    (row) =>
                      `<li>${escapeHtml(row.category)}: ${Number(row.minutes || 0)} mins</li>`,
                  )
                  .join("")}</ul>`
              : '<p class="muted">No weekly sessions yet.</p>'
          }
        </article>
      </section>

      <section id="goals-card" class="panel" style="margin-top: 16px">
        <h2>Goals</h2>
        <p class="muted">Loading goals...</p>
      </section>
    </main>
    <script src="/assets/GoalsCard.jsx"></script>
  </body>
</html>`;
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/health") {
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/today") {
    json(res, 200, getSummary());
    return;
  }

  if (url.pathname === "/api/categories") {
    json(res, 200, { ok: true, data: getSummary().categoryTotals });
    return;
  }

  if (url.pathname === "/api/week") {
    json(res, 200, getWeekSummary());
    return;
  }

  if (await handleGoalsRoute(req, res, url)) {
    return;
  }

  if (await handleRulesRoute(req, res, url)) {
    return;
  }

  if (url.pathname === "/assets/GoalsCard.jsx") {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(goalsCardPath).pipe(res);
    return;
  }

  if (url.pathname === "/") {
    html(res, renderDashboard());
    return;
  }

  json(res, 404, { ok: false, error: "Not found" });
}

http.createServer((req, res) => {
  requestHandler(req, res).catch((error) => {
    json(res, 500, { ok: false, error: error.message || "Unexpected server error" });
  });
}).listen(PORT, () => {
  console.log(`Dashboard on http://localhost:${PORT}`);
});
