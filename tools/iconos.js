/* Genera los iconos de la app a partir de src/icon.svg: node tools/iconos.js (necesita Playwright). Solo hace falta si cambia el dibujo. */
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..'), svg = fs.readFileSync(path.join(root, 'src/icon.svg'), 'utf8');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const out = [['icon-192.png', 192, 42], ['icon-512.png', 512, 112], ['maskable-512.png', 512, 0], ['apple-touch-icon.png', 180, 0], ['favicon-32.png', 32, 7]];
  for (const [name, size, r] of out) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;border-radius:${r}px;overflow:hidden">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body></html>`);
    await p.screenshot({ path: path.join(root, 'icons', name), omitBackground: true });
  }
  await b.close(); console.log('iconos generados');
})();
