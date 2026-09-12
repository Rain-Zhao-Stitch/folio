const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'dist');
const port=Number(process.env.FOLIO_PORT)||4173;
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);});
});
server.on('error',error=>{
 if(error.code==='EADDRINUSE'){console.error(`Folio is already running at http://127.0.0.1:${port}`);process.exitCode=1;return;}
 throw error;
});
server.listen(port,'127.0.0.1',()=>console.log(`Folio: http://127.0.0.1:${port}`));
