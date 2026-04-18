const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
const logFile = path.join(dataDir, 'sessions.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, '[]');

function mockActiveWindow() {
  return {
    app: 'Google Chrome',
    title: 'LeetCode - Two Sum',
    category: 'DSA',
    ts: new Date().toISOString()
  };
}

function tick() {
  const current = JSON.parse(fs.readFileSync(logFile, 'utf8'));
  current.push(mockActiveWindow());
  fs.writeFileSync(logFile, JSON.stringify(current, null, 2));
  console.log('tracked', new Date().toLocaleTimeString());
}

console.log('Auto Tracker Agent started');
setInterval(tick, 20000);
