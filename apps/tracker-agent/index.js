const fs = require('fs');
const path = require('path');
let activeWin;
try { activeWin = require('active-win'); } catch (e) {}

const dataDir = path.join(process.cwd(), 'data');
const logFile = path.join(dataDir, 'sessions.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, '[]');

function categorize(app, title='') {
  const text = `${app} ${title}`.toLowerCase();
  if (text.includes('leetcode')) return 'DSA';
  if (text.includes('visual studio') || text.includes('code.exe') || text.includes('vscode')) return 'Coding';
  if (text.includes('react')) return 'Learning';
  if (text.includes('youtube')) return 'Entertainment';
  return 'General';
}

async function getWindow() {
  if (activeWin) {
    const w = await activeWin();
    if (w) {
      return {
        app: w.owner && w.owner.name ? w.owner.name : 'Unknown',
        title: w.title || '',
      };
    }
  }
  return { app: 'Google Chrome', title: 'Fallback Mock Window' };
}

async function tick() {
  const rows = JSON.parse(fs.readFileSync(logFile, 'utf8'));
  const w = await getWindow();
  rows.push({
    app: w.app,
    title: w.title,
    category: categorize(w.app, w.title),
    ts: new Date().toISOString()
  });
  fs.writeFileSync(logFile, JSON.stringify(rows, null, 2));
  console.log('tracked:', w.app, '-', w.title);
}

console.log('Auto Tracker Agent started');
setInterval(() => tick().catch(console.error), 20000);
tick();