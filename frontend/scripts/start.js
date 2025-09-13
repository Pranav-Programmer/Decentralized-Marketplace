const http = require('http');
const fs = require('fs');
const path = require('path');
const port = 3000;
http.createServer((req, res) => {
  let file = req.url === '/' ? '/index.html' : req.url;
  const ext = path.extname(file);
  const map = {
    '.js': 'application/javascript',
    '.html': 'text/html',
    '.css': 'text/css'
  };
  const p = path.join(__dirname, '..', 'public', file);
  fs.readFile(p, (err, data) => {
    if(err){ res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': map[ext] || 'text/plain'});
    res.end(data);
  });
}).listen(port, ()=> console.log('Frontend dev server running at http://localhost:'+port));
