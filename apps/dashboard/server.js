const http = require('http');
const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'data', 'merged-sessions.json');

function rows(){ return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : []; }
function summarize(list){
 const byCategory = {};
 list.forEach(r => byCategory[r.category] = (byCategory[r.category]||0)+r.durationSec);
 return byCategory;
}
http.createServer((req,res)=>{
 const list = rows();
 res.writeHead(200, {'Content-Type':'application/json'});
 res.end(JSON.stringify({ totalSessions:list.length, summary:summarize(list), rows:list }, null, 2));
}).listen(3000, ()=> console.log('Dashboard on http://localhost:3000'));
