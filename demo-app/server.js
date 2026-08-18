const http = require('http');
const os = require('os');

const name = process.env.APP_NAME || 'demo';
const version = process.env.APP_VERSION || 'v1';

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    `<h1>${name} ${version}</h1>` +
    `<p>Pod IP: ${os.hostname()}</p>` +
    `<p>Request: ${req.url}</p>`
  );
}).listen(8080, () => console.log(`[${name} ${version}] listening on 8080`));
