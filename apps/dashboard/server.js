const http = require('http');
const { getSummary, todayKey } = require('../../packages/db/sessionStore');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload, null, 2));
}

http.createServer((req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost:3000');

  if (requestUrl.pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (requestUrl.pathname !== '/') {
    return sendJson(res, 404, { error: 'Not found' });
  }

  const date = requestUrl.searchParams.get('date') || todayKey();
  return sendJson(res, 200, getSummary(date));
}).listen(3000, () => console.log('Dashboard on http://localhost:3000'));
