// Run on the same PC as Strata or Ollama with: node local-bridge.mjs
import {createServer} from 'node:http';

const routes = new Map([
  ['/strata/v1/models', ['GET','http://127.0.0.1:47831/v1/models']],
  ['/strata/v1/chat/completions', ['POST','http://127.0.0.1:47831/v1/chat/completions']],
  ['/ollama/api/tags', ['GET','http://127.0.0.1:11434/api/tags']],
  ['/ollama/api/chat', ['POST','http://127.0.0.1:11434/api/chat']]
]);
if (process.argv[2]) {
  const remote = new URL(process.argv[2]);
  if (!['http:','https:'].includes(remote.protocol) || remote.username || remote.password || remote.search || remote.hash) throw Error('Supply the second PC base URL without credentials.');
  const base = remote.href.replace(/\/+$/,'');
  routes.set('/remote/v1/models', ['GET',base+'/models']);
  routes.set('/remote/v1/chat/completions', ['POST',base+'/chat/completions']);
}
const origins = new Set(['https://bindlez.github.io','http://127.0.0.1:8765','http://localhost:8765']);
createServer(async (req,res) => {
  const route = routes.get(req.url);
  if (req.headers.host !== '127.0.0.1:48676' || !origins.has(req.headers.origin) || !route) {
    res.writeHead(403).end(); return;
  }
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Cache-Control','no-store');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {'Access-Control-Allow-Methods':route[0], 'Access-Control-Allow-Headers':'content-type, authorization', 'Access-Control-Allow-Private-Network':'true'}).end(); return;
  }
  if (req.method !== route[0]) { res.writeHead(405).end(); return; }
  if (req.method === 'POST' && req.headers['content-type'] !== 'application/json') { res.writeHead(415).end(); return; }
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 1024) { res.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    const headers = {'Content-Type':'application/json'};
    if (req.headers.authorization && !req.url.startsWith('/ollama/')) headers.Authorization = req.headers.authorization;
    const upstream = await fetch(route[1], {method:route[0], headers, redirect:'error', signal:controller.signal, body:chunks.length ? Buffer.concat(chunks) : undefined});
    res.writeHead(upstream.status, {'Content-Type':'application/json'}).end(await upstream.text());
  } catch { if (!res.destroyed) res.writeHead(502).end('Local model server unavailable'); }
}).listen(48676,'127.0.0.1', () => console.log('Codefield bridge ready. Choose Use local bridge in AI studio.'));
