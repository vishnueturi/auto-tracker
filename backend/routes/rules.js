const rulesService = require("../services/rulesService");

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

function getRuleId(pathname) {
  const match = pathname.match(/^\/api\/rules\/(\d+)$/);

  return match ? Number(match[1]) : null;
}

async function handleRulesRoute(req, res, url) {
  try {
    if (url.pathname === "/api/rules" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: rulesService.getRules() });
      return true;
    }

    if (url.pathname === "/api/rules" && req.method === "POST") {
      const payload = await readJson(req);
      const rule = rulesService.addRule(payload);
      sendJson(res, 201, { ok: true, data: rule });
      return true;
    }

    const ruleId = getRuleId(url.pathname);

    if (ruleId && req.method === "PUT") {
      const payload = await readJson(req);
      const rule = rulesService.editRule(ruleId, payload);
      sendJson(res, 200, { ok: true, data: rule });
      return true;
    }

    if (ruleId && req.method === "DELETE") {
      rulesService.removeRule(ruleId);
      sendJson(res, 200, { ok: true });
      return true;
    }

    return false;
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Unexpected rules API error",
      details: error.details || [],
    });
    return true;
  }
}

module.exports = {
  handleRulesRoute,
};
