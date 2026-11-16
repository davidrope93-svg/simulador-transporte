'use strict';
// Servidor estático mínimo y sin dependencias para Google AI Studio
// (vista previa y publicación en Cloud Run). La app sigue siendo estática:
// index.html y sw.js los genera build.py a partir de src/; aquí no se tocan.
//
//   node server.js           sirve la raíz del proyecto (vista previa, puerto 3000)
//   node server.js --build   copia a dist/ solo lo que la app necesita
//   node server.js dist      sirve dist/ (producción; usa $PORT si existe)
const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
// Lo mismo que precachea sw.js para funcionar sin cobertura.
const PUBLIC = ['index.html', 'sw.js', 'manifest.webmanifest', 'icons'];

function build() {
  const out = path.join(ROOT, 'dist');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const f of PUBLIC) fs.cpSync(path.join(ROOT, f), path.join(out, f), { recursive: true });
  console.log('dist/ listo: ' + PUBLIC.join(', '));
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};
const COMPRIMIBLE = new Set(['.html', '.js', '.json', '.webmanifest', '.css', '.svg', '.txt']);
const gzCache = new Map();

function send(req, res, file, st) {
  const ext = path.extname(file).toLowerCase();
  // no-cache = revalidar siempre: las versiones las controla sw.js con su huella.
  const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' };
  if (COMPRIMIBLE.has(ext)) {
    headers.Vary = 'Accept-Encoding';
    if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      const key = file + ':' + st.mtimeMs;
      let gz = gzCache.get(key);
      if (!gz) {
        gz = zlib.gzipSync(fs.readFileSync(file), { level: 9 });
        gzCache.set(key, gz);
      }
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': gz.length });
      return res.end(req.method === 'HEAD' ? undefined : gz);
    }
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

function fail(res, code) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(String(code));
}

function serve(base, port) {
  http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return fail(res, 405);
    }
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch (e) { return fail(res, 400); }
    // Nada de archivos ocultos (.github, .gitignore…) ni salir de la carpeta.
    if (rel.split('/').some((s) => s.startsWith('.'))) return fail(res, 404);
    const file = path.join(base, rel);
    if (file !== base && !file.startsWith(base + path.sep)) return fail(res, 403);
    fs.stat(file, (err, st) => {
      if (!err && st.isFile()) return send(req, res, file, st);
      // Carpetas y rutas sin extensión: es una app de una sola página.
      if (!path.extname(rel)) {
        const index = path.join(base, 'index.html');
        return fs.stat(index, (e2, st2) => (e2 ? fail(res, 404) : send(req, res, index, st2)));
      }
      fail(res, 404);
    });
  }).listen(port, '0.0.0.0', () => {
    console.log('SVA Trainer en http://localhost:' + port + ' (sirviendo ' + (path.relative(ROOT, base) || '.') + ')');
  });
}

if (process.argv.includes('--build')) {
  build();
} else {
  const dir = process.argv.slice(2).find((a) => !a.startsWith('-'));
  serve(path.resolve(ROOT, dir || '.'), Number(process.env.PORT) || 3000);
}
