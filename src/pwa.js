/* Instalable y sin conexión (v1.3; v1.30: convive con hostings que ya tienen service worker). Solo va en la versión publicada, no en el artefacto de claude.ai:
   registra el service worker, ofrece «Instalar app» y avisa cuando hay una versión nueva. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const btn = document.getElementById('installBtn');
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let box = null, boxT = 0;
  function note(msg, action) { // aviso con un botón opcional, por encima de todo
    if (!box) { box = document.createElement('div'); box.className = 'toast pwanote'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    box.innerHTML = ''; const s = document.createElement('span'); s.textContent = msg; box.appendChild(s);
    if (action) { const b = document.createElement('button'); b.className = 'btn sm primary'; b.textContent = action[0]; b.addEventListener('click', () => { box.hidden = true; action[1](); }); box.appendChild(b); }
    const x = document.createElement('button'); x.className = 'btn sm'; x.textContent = 'Cerrar'; x.addEventListener('click', () => { box.hidden = true; }); box.appendChild(x);
    box.hidden = false; clearTimeout(boxT); if (!action) boxT = setTimeout(() => { box.hidden = true; }, 9000);
  }
  /* v1.30: hostings que ponen su propio service worker en la raíz (AI Studio, Cloud Run) o vista previa en un iframe:
     no se registra el nuestro. Si se registrara, los dos se pisarían en cada carga y el aviso «Actualizar» saldría en bucle.
     Ahí la app se puede instalar igual (manifiesto e iconos), pero solo funciona sin conexión desde GitHub Pages. */
  const own = u => { try { return /\/sw\.js$/.test(new URL(u).pathname); } catch (e) { return false; } };
  const hosted = window.top !== window || /(^|\.)(ai\.studio|run\.app|usercontent\.goog)$/.test(location.hostname);
  const clearOwnCaches = () => { if (window.caches) caches.keys().then(ks => ks.filter(k => k.startsWith('simsva-')).forEach(k => caches.delete(k))).catch(() => {}); };
  /* la primera vez el service worker toma el control sin recargar (solo avisa); después, recarga solo si se pulsó «Actualizar» */
  let hadController = !!navigator.serviceWorker.controller && own(navigator.serviceWorker.controller.scriptURL), updating = false, reloading = false;
  async function start() {
    if (hosted) return clearOwnCaches();
    const prev = await navigator.serviceWorker.getRegistration().catch(() => null);
    if (prev && [prev.active, prev.waiting, prev.installing].some(w => w && !own(w.scriptURL))) return clearOwnCaches(); // la raíz ya tiene otro dueño
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const c = navigator.serviceWorker.controller; if (!c || !own(c.scriptURL)) return;
      if (!hadController) { hadController = true; note('Listo: el simulador ya funciona sin conexión' + (standalone() ? '.' : '. Puedes instalarlo como app.')); return; }
      if (updating && !reloading) { reloading = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js').then(reg => {
      const ask = w => { if (own(w.scriptURL)) note('Hay una versión nueva del simulador.', ['Actualizar', () => { updating = true; w.postMessage('skipWaiting'); }]); };
      if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
      const seen = new WeakSet();
      const watch = w => {
        if (!w || seen.has(w)) return; seen.add(w);
        w.addEventListener('statechange', () => {
          if (w.state !== 'installed') return;
          if (navigator.serviceWorker.controller) ask(w);
        });
      };
      watch(reg.installing); reg.addEventListener('updatefound', () => watch(reg.installing));
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
  }
  window.addEventListener('load', () => { start(); });
  /* instalar: Chrome y Edge (Android, ordenador) avisan con beforeinstallprompt; en el iPhone se hace desde Safari */
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; if (btn && !standalone()) btn.hidden = false; });
  if (btn && ios && !standalone()) btn.hidden = false;
  if (btn) btn.addEventListener('click', async () => {
    if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch (e) { /* cancelado */ } deferred = null; btn.hidden = true; }
    else if (ios) note('En el iPhone o el iPad: abre esta página en Safari, pulsa Compartir y «Añadir a pantalla de inicio».');
    else note('Usa el menú del navegador: «Instalar app» o «Añadir a pantalla de inicio».');
  });
  window.addEventListener('appinstalled', () => { if (btn) btn.hidden = true; deferred = null; note('Instalado: ábrelo desde su icono, también sin conexión.'); });
  window.addEventListener('offline', () => note('Sin conexión: el simulador sigue funcionando. Solo el enlace con el instructor en otro dispositivo necesita red.'));
})();
