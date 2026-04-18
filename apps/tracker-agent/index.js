let activeWin;
try {
  activeWin = require('active-win');
} catch (error) {
  // Sample comment: allow the agent to continue with fallback window data when active-win is unavailable.
}

const {
  POLL_INTERVAL_SEC,
  dbFile,
  upsert,
} = require('../../packages/db/sessionStore');

function categorize(app, title = '') {
  const text = `${app} ${title}`.toLowerCase();
  if (text.includes('leetcode')) return 'DSA';
  if (text.includes('visual studio') || text.includes('code.exe') || text.includes('vscode')) return 'Coding';
  if (text.includes('react')) return 'Learning';
  if (text.includes('youtube')) return 'Entertainment';
  return 'General';
}

async function getWindow() {
  if (activeWin) {
    const windowInfo = await activeWin();
    if (windowInfo) {
      return {
        app: windowInfo.owner && windowInfo.owner.name ? windowInfo.owner.name : 'Unknown',
        title: windowInfo.title || '',
      };
    }
  }

  return { app: 'Google Chrome', title: 'Fallback Mock Window' };
}

async function tick() {
  const windowInfo = await getWindow();
  const session = upsert({
    app: windowInfo.app,
    title: windowInfo.title,
    category: categorize(windowInfo.app, windowInfo.title),
    ts: new Date().toISOString(),
  });

  console.log(
    'tracked:',
    session.app,
    '-',
    session.title,
    `(${session.category}, ${session.durationSec}s)`
  );
}

console.log(`Auto Tracker Agent started (SQLite: ${dbFile})`);
setInterval(() => tick().catch(console.error), POLL_INTERVAL_SEC * 1000);
tick().catch(console.error);
