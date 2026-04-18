const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'data', 'merged-sessions.json');

function ensure(){
  const dir = path.dirname(file);
  if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  if(!fs.existsSync(file)) fs.writeFileSync(file,'[]');
}
function all(){ ensure(); return JSON.parse(fs.readFileSync(file,'utf8')); }
function save(rows){ fs.writeFileSync(file, JSON.stringify(rows,null,2)); }
function upsert(entry){
 const rows = all();
 const last = rows[rows.length-1];
 if(last && last.app===entry.app && last.title===entry.title){
   last.end = entry.ts;
   last.durationSec = Math.max(20, last.durationSec + 20);
 } else {
   rows.push({ ...entry, start: entry.ts, end: entry.ts, durationSec: 20 });
 }
 save(rows);
}
module.exports = { all, upsert };
