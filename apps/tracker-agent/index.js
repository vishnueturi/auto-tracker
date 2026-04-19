let activeWin; try{activeWin=require('active-win')}catch(e){}
const {POLL_INTERVAL_SEC,dbFile,upsert}=require('../../packages/db/sessionStore');
function categorize(app,title=''){const t=(app+' '+title).toLowerCase(); if(t.includes('leetcode')) return 'DSA'; if(t.includes('code')||t.includes('visual studio')) return 'Coding'; if(t.includes('react')) return 'Learning'; if(t.includes('youtube')) return 'Entertainment'; return 'General';}
async function getWindow(){if(activeWin){const w=await activeWin(); if(w) return {app:w.owner?.name||'Unknown',title:w.title||''};} return {app:'Unknown',title:''};}
let lastSig=''; let idleCount=0;
async function tick(){const w=await getWindow(); const sig=w.app+'|'+w.title; if(sig===lastSig) idleCount++; else idleCount=0; lastSig=sig; const isIdle=idleCount>=15; const s=upsert({app:w.app,title:w.title,category:categorize(w.app,w.title),ts:new Date().toISOString(),isIdle}); console.log('tracked',s.app_name||w.app,isIdle?'(idle)':'');}
console.log(`Auto Tracker Agent started (SQLite: ${dbFile})`); setInterval(()=>tick().catch(console.error),POLL_INTERVAL_SEC*1000); tick();