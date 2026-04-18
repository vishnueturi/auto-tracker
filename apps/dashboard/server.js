const http = require('http');
const fs = require('fs');
const path = require('path');

const logFile = path.join(process.cwd(), 'data', 'sessions.json');

http.createServer((req,res)=>{
  const rows = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile,'utf8')) : [];
  res.writeHead(200, {'Content-Type':'application/json'});
  res.end(JSON.stringify({ total: rows.length, rows }, null, 2));
}).listen(3000, ()=> console.log('Dashboard on http://localhost:3000'));
