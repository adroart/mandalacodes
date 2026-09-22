import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
// Local-only acceptance server. Never forwards requests to a provider.
const root = process.cwd() + '/dist';
const port = Number(process.env.AUDIT_PORT || 2425);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
http.createServer((req,res)=>{
 const u = new URL(req.url,'http://localhost');
 if(u.pathname.startsWith('/media/')) {res.writeHead(200,{'Content-Type':'image/png'});return res.end(png);}
 if(u.pathname.startsWith('/api/oracle/reflections/')) {
   const admin = req.headers['x-audit-admin'] === 'synthetic';
   const now = new Date().toISOString();
   let body = {ok:true,admin};
   if(u.pathname.includes('/sessions')) body = req.method === 'POST' ? {id:'audit-session',hexagramNumber:22,createdAt:now,updatedAt:now,finishedAt:null} : {current:null,history:[]};
   if(u.pathname.includes('/segments')) body = {segments:[]};
   res.writeHead(admin ? 200 : 403,{'Content-Type':'application/json'});return res.end(JSON.stringify(body));
 }
 if(u.pathname.startsWith('/api/')) {res.writeHead(200,{'Content-Type':'application/json'});return res.end(u.pathname.includes('capability') ? '{"ok":true,"admin":false}' : u.pathname==='/api/atlas' ? '{"ok":true,"state":{"schemaVersion":2,"pieces":[],"cities":[]}}' : 'null');}
 let file=path.join(root,decodeURIComponent(u.pathname));
 if(!file.startsWith(root+'/') && file!==root){res.writeHead(403);return res.end();}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
 if(!fs.existsSync(file))file=root+'/index.html';
 const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml'}[path.extname(file)] || 'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`audit server ${port}: local static files, synthetic API, stub media`));
