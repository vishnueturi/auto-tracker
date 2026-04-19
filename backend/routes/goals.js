const goalsService = require("../services/goalsService");

const MAX_BODY_BYTES = 32 * 1024;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload, null, 2));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        const error = new Error("Request body is too large");
        error.statusCode = 413;
        reject(error);
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        error.statusCode = 400;
        error.details = ["body must be valid JSON"];
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

async function handleGoalsRoute(req, res, url) {
  try {
    if (url.pathname === "/api/goals" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: goalsService.getGoals() });
      return true;
    }

    if (url.pathname === "/api/goals" && req.method === "POST") {
      const payload = await readJson(req);
      const goal = goalsService.upsertGoal(payload);
      sendJson(res, 200, { ok: true, data: goal });
      return true;
    }

    if (url.pathname === "/api/goals/progress" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: goalsService.getProgress() });
      return true;
    }

    return false;
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Unexpected goals API error",
      details: error.details || [],
    });
    return true;
  }
}

module.exports = {
  handleGoalsRoute,
};
