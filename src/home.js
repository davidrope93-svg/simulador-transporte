/* ===== Inicio (v1.33): pantalla de entrada en vez de abrir directamente un caso =====
   Arriba, la cuenta: opcional y por invitación, así que saluda y dice dónde se guarda el progreso, pero no cierra el paso a quien no la tiene.
   Lo principal es «seguir»: el caso en curso, el itinerario activo, el último caso o, la primera vez, elegir un itinerario por perfil
   (y al abrir ese primer caso sale la visita de la pantalla). Después, cómo practicar (biblioteca, itinerarios, caso al azar,
   ventilador libre), el modo (práctica o examen), el resumen del progreso y lo demás.
   No sale con los enlaces que ya llevan a algo (#caso=, #revision=, #aula=) ni en la vista del instructor.
   Debajo siempre hay un caso cargado y en pausa, así el resto de la interfaz funciona igual. Cargar cualquier caso cierra el inicio.
   Se inserta dentro de la interfaz, después de cuenta_app.js. ===== */
let homeOn = false, homeCtx = null, homeKeep = false; // homeCtx: el caso que estaba en marcha al abrir el inicio; homeKeep: recargar sin cerrar el inicio
function homeWanted(h) { h = h == null ? location.hash : h; return !INSTR && !/^#(caso|revision|aula|instructor)/i.test(h); }
const HOME_IC = {
  lib: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h4v16H4zM10 4h4v16h-4zM16.3 4.6l3.4.9-3.9 14.9-3.4-.9z"/></svg>',
  paths: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/></svg>',
  rand: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r=".9"/><circle cx="15" cy="9" r=".9"/><circle cx="12" cy="12" r=".9"/><circle cx="9" cy="15" r=".9"/><circle cx="15" cy="15" r=".9"/></svg>',
  free: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 14h4l2-7 3 12 2.5-8 1.5 3h7"/></svg>'
};
const HOME_ECG = '<svg class="hm-ecg" viewBox="0 0 420 70" aria-hidden="true"><path d="M0 46H96l7-5 7 5h22l5 7 9-48 9 56 6-15h36l8-9 12 9H260l7-5 7 5h22l5 7 9-48 9 56 6-15h36l8-9 12 9h29"/></svg>';
function homeInit() {
  if (INSTR) return;
  const hb = $('#homeBtn'); hb.hidden = false; hb.addEventListener('click', () => homeShow(true));
  $('#home').addEventListener('click', homeClick);
  // al cerrar una ventana abierta desde el inicio (biblioteca, itinerarios, historial…) o al cambiar la cuenta, se actualiza
  const mo = new MutationObserver(rs => { if (homeOn && rs.some(r => r.target.hidden || r.target.id === 'installBtn')) homeRender(); });
  $$('.modal').forEach(m => mo.observe(m, { attributes: true, attributeFilter: ['hidden'] }));
  mo.observe($('#installBtn'), { attributes: true, attributeFilter: ['hidden'] });
  if (acct && acct.core) acct.core.on(() => { if (homeOn) homeRender(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && homeOn && homeCtx && !document.querySelector('.modal:not([hidden]), .cta-back')) homeHide(true); });
}
function homeShow(fromCase) {
  if (INSTR || !$('#home')) return;
  if (tourI >= 0) tourEnd();
  if (!homeOn) homeCtx = fromCase && S && !ended && S.clin > .01 ? { key: caseKey, title: CASES[caseKey].title, min: S.clin, paused } : null;
  paused = true; setPauseBtn();
  homeOn = true; document.body.classList.add('home-on'); $('#home').hidden = false;
  homeRender(); $('#home').scrollTop = 0;
  const f = $('#home .hm-hero .btn.primary, #home .hm-path'); if (f && !matchMedia('(pointer: coarse)').matches) f.focus({ preventScroll: true });
  sendState(true);
}
function homeHide(resume) {
  if (!homeOn) return;
  homeOn = false; $('#home').hidden = true; document.body.classList.remove('home-on');
  paused = resume && homeCtx ? homeCtx.paused : false; setPauseBtn(); homeCtx = null;
  window.scrollTo(0, 0);
  // la primera vez, la visita de la pantalla sale al abrir el primer caso (no sobre el inicio)
  if (!LS.get('simvmi.tour', 0)) setTimeout(() => { if (!homeOn && tourI < 0 && $('#debrief').hidden) tourStart(); }, 500);
}
function homeOnLoad() { if (homeOn && !homeKeep) homeHide(false); } // lo llama loadCase: cualquier caso que se cargue (biblioteca, itinerario, instructor…) cierra el inicio
function homeRandom() {
  const st = libStats(), ks = libKeys().filter(k => !k.startsWith('u_')), fresh = ks.filter(k => !st[k]), pool = fresh.length ? fresh : ks;
  const k = pool[Math.floor(Math.random() * pool.length)]; if (!k) return;
  $('#caseSel').value = k; loadCase(k); toast(`Caso al azar: ${CASES[k].title}`);
}
function homeClick(e) {
  const b = e.target.closest('[data-h]'); if (!b) return;
  const k = b.dataset.k;
  switch (b.dataset.h) {
    case 'resume': homeHide(true); break;
    case 'acct': if (acct) acct.open(); break;
    case 'pathNext': { const pk = LS.get('simvmi.path', null); if (!PATHS[pk]) break; pathSel = pk; const pr = pathOf(pk); if (pr.next) pathLaunch(pr.next, pr.nextExam); else pathOpen(); break; }
    case 'pathStart': { if (!PATHS[b.dataset.p]) break; pathSel = b.dataset.p; LS.set('simvmi.path', pathSel); const pr = pathOf(pathSel); if (pr.next) pathLaunch(pr.next, pr.nextExam); else pathOpen(); break; }
    case 'paths': { const pk = LS.get('simvmi.path', null); if (PATHS[pk]) pathSel = pk; pathOpen(); break; }
    case 'lib': libOpen(); break;
    case 'redo': lib = Object.assign(lib, { q: '', g: '', s: '', d: '', p: '', e: 'redo' }); libSave(); libOpen(); break;
    case 'rand': homeRandom(); break;
    case 'free': $('#caseSel').value = 'libre'; loadCase('libre'); break;
    case 'load': if (CASES[k]) { $('#caseSel').value = k; loadCase(k); } break;
    case 'variant': if (CASES[k]) loadVariant(k, Math.floor(Math.random() * 1679616)); break;
    case 'mode': { const on = b.dataset.x === '1'; if (on !== exam) { setExam(on, true); homeCtx = null; homeKeep = true; try { loadCase(caseKey); } finally { homeKeep = false; } } homeRender(); break; } // como en la barra: cambiar de modo reinicia el caso
    case 'editor': edOpen(null); break;
    case 'tour': homeHide(!!homeCtx); tourStart(); break;
    case 'click': { const t = $('#' + b.dataset.id); if (t) t.click(); break; }
  }
}
function homeRender() {
  const box = $('#hmBody'); if (!box) return;
  const hist = LS.get('simvmi.hist', []), st = libStats(), ks = libKeys().filter(x => !x.startsWith('u_'));
  const done = ks.filter(x => st[x]).length, redo = ks.filter(x => st[x] && st[x].best < 6).length, fresh = ks.length - done;
  const sc = hist.slice(-30).map(a => a.score).filter(x => isFinite(x)), avg = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null;
  const pk = LS.get('simvmi.path', null), P = PATHS[pk], ver = (($('.brand .eyebrow') || {}).textContent || '').match(/v\d+(\.\d+)*/);
  const cs = acct && acct.core ? acct.core.state() : null, ses = acctSession(), nm = (ses ? acctName() : student) || '', first = nm.split(/\s+/)[0];
  /* cuenta */
  let acc = '';
  if (cs === 'out') acc = `<button class="hm-acct" data-h="acct" title="Opcional, por invitación: tu progreso en la nube y en todos tus dispositivos"><span class="hm-av" aria-hidden="true">→</span><span><b>Entrar</b><span class="small">Opcional · progreso en la nube</span></span></button>`;
  else if (cs === 'member') { const y = acct.sync || {}, t = y.st === 'run' ? 'Sincronizando…' : y.st === 'off' ? 'Sin conexión: se guarda al volver' : y.st === 'err' ? 'No se pudo sincronizar' : 'Progreso guardado en tu cuenta';
    acc = `<button class="hm-acct on" data-h="acct" title="Tu cuenta"><span class="hm-av" aria-hidden="true">${esc((first || '?').charAt(0).toUpperCase())}</span><span><b>${esc(first || 'Mi cuenta')}</b><span class="small">${t}</span></span><span class="hm-dot ${y.st === 'ok' ? 'ok' : y.st === 'err' ? 'err' : y.st === 'off' ? 'warn' : ''}" aria-hidden="true"></span></button>`; }
  else if (cs) acc = `<button class="hm-acct warn" data-h="acct"><span class="hm-av" aria-hidden="true">!</span><span><b>Mi cuenta</b><span class="small">Necesita atención</span></span></button>`;
  /* lo principal: seguir */
  let hero;
  const last = hist.length ? hist[hist.length - 1] : null, lastK = last && (CASES[last.base] ? last.base : CASES[last.key] && last.key !== 'u_var' && last.key !== 'u_try' ? last.key : null);
  if (homeCtx) {
    hero = `<section class="hm-hero">${HOME_ECG}<span class="eyebrow">Caso en curso · en pausa</span><h2>${esc(homeCtx.title)}</h2><p>Lo dejaste en el ${mmss(homeCtx.min)} de tiempo clínico.</p>
      <div class="inrow"><button class="btn primary" data-h="resume">Volver al caso</button></div><p class="small">Si eliges otro caso, este se descarta.</p></section>`;
  } else if (P) {
    const pr = pathOf(pk), sg = pr.cur != null ? pr.stages[pr.cur] : null, nx = pr.next && CASES[pr.next];
    hero = `<section class="hm-hero">${HOME_ECG}<span class="eyebrow">Tu itinerario · ${esc(P.t)}</span>
      <div class="hm-prog"><span class="ptbar"><span style="width:${pr.pct}%"></span></span><b>${pr.pct} %</b></div>
      <p class="small">${sg ? `Etapa ${sg.i + 1} de ${pr.stages.length} · ${esc(sg.t)} · ${sg.ok} de ${sg.need} superados` : 'Itinerario superado'}${pr.avg != null ? ` · media ${fmt(pr.avg, 1)}` : ''}</p>
      ${nx ? `<h2>${pr.nextExam ? 'Evaluación final: ' : ''}${esc(nx.title)}</h2>${nx.teach ? `<p>${esc(nx.teach)}</p>` : ''}` : '<h2>Itinerario superado</h2><p>Puedes repasar cualquier caso, hacer la evaluación final otra vez o empezar otro itinerario.</p>'}
      <div class="inrow">${nx ? `<button class="btn primary" data-h="pathNext">${pr.nextExam ? 'Empezar la evaluación' : pr.done ? 'Continuar' : 'Empezar'}</button><button class="btn" data-h="paths">Ver el itinerario</button>` : '<button class="btn primary" data-h="paths">Ver el itinerario</button>'}</div></section>`;
  } else if (lastK) {
    const s = st[lastK];
    hero = `<section class="hm-hero">${HOME_ECG}<span class="eyebrow">Tu último caso · ${esc(window.Cuenta ? Cuenta.ago(last.d) : new Date(last.d).toLocaleDateString('es-ES'))}</span><h2>${esc(CASES[lastK].title)}</h2>
      <p>Nota ${fmt(last.score, 1)}${s && s.n > 1 ? ` · tu mejor nota ${fmt(s.best, 1)} en ${s.n} intentos` : ''}.${CASES[lastK].teach ? ' ' + esc(CASES[lastK].teach) : ''}</p>
      <div class="inrow"><button class="btn primary" data-h="load" data-k="${esc(lastK)}">Repetir</button><button class="btn" data-h="variant" data-k="${esc(lastK)}">Con otro paciente</button></div>
      <p class="small">¿Quieres una ruta de casos de menos a más? <button class="lnk" data-h="paths">Elige un itinerario</button>.</p></section>`;
  } else {
    hero = `<section class="hm-hero hm-first">${HOME_ECG}<span class="eyebrow">Para empezar</span><h2>Elige tu itinerario</h2>
      <p>Una ruta de casos de menos a más, por etapas que se van abriendo. Al abrir el primero te enseñamos la pantalla en un minuto.</p>
      <div class="hm-paths">${Object.entries(PATHS).map(([pk2, p]) => { const n = new Set(p.stages.flatMap(x => x.k)).size; return `<button class="hm-path" data-h="pathStart" data-p="${esc(pk2)}"><b>${esc(p.t)}</b><span>${esc(p.who)}</span><span class="small">${n} casos · ${p.stages.length} etapas</span><span class="hm-go">Empezar →</span></button>`; }).join('')}</div>
      <p class="small">¿Prefieres ir a tu aire? <button class="lnk" data-h="lib">Elige un caso de la biblioteca</button>.</p></section>`;
  }
  const tile = (h, t, d) => `<button class="hm-tile" data-h="${h}">${HOME_IC[h]}<b>${t}</b><span>${d}</span></button>`;
  const more = [['tour', 'Visita guiada de la pantalla'], ['editor', 'Mis casos y editor'], ['histBtn', 'Historial'], ['instrOpen', 'Vista del instructor'], ['instrLink', 'Enlazar con el instructor'], ['revBtn', 'Revisión de casos']]
    .concat($('#installBtn').hidden ? [] : [['installBtn', 'Instalar app']])
    .map(([id, t]) => id === 'tour' || id === 'editor' ? `<button class="btn" data-h="${id}">${t}</button>` : `<button class="btn" data-h="click" data-id="${id}">${t}</button>`).join('');
  box.innerHTML = `<header class="hm-top"><div class="hm-brand"><img src="icons/icon-192.png" alt="" width="52" height="52" onerror="this.remove()"><div><span class="eyebrow">Simulador docente · SVA terrestre y HEMS${ver ? ' · ' + ver[0] : ''}</span><h1 id="hmH">SVA Trainer</h1></div></div>${acc}</header>
    <p class="hm-hi">${first ? `Hola, ${esc(first)}. ` : ''}${hist.length ? '¿Qué practicamos hoy?' : 'Ventilación mecánica, monitor-desfibrilador, fármacos y RCP con casos de SVA terrestre y HEMS.'}</p>
    ${hero}
    <section class="hm-sec"><div class="hm-sech"><h2>Elige cómo practicar</h2><div class="seg" role="group" aria-label="Modo"><button data-h="mode" data-x="0" aria-pressed="${!exam}">Práctica</button><button data-h="mode" data-x="1" aria-pressed="${exam}">Examen</button></div></div>
      <p class="small">${exam ? 'Examen: sin la Lectura, el «Siguiente paso», la solución ni el tutorial. Nota al terminar.' : 'Práctica: con la Lectura, el «Siguiente paso» y el tutorial por si te pierdes.'}</p>
      <div class="hm-tiles">${tile('lib', 'Biblioteca', `Los ${ks.length} casos, con buscador y filtros`)}${tile('paths', 'Itinerarios', P ? `Vas por el ${pathOf(pk).pct} % de ${esc(P.t)}` : 'Residente, enfermería y HEMS, por etapas')}${tile('rand', 'Caso al azar', fresh ? `Uno de los ${fresh} que no has hecho` : 'Cualquiera de la biblioteca')}${tile('free', 'Ventilador libre', 'Sin caso: modos, mandos y alarmas')}</div></section>
    ${hist.length ? `<section class="hm-stats" aria-label="Tu progreso"><div><b>${done}</b><span>de ${ks.length} casos hechos</span></div><div><b>${avg != null ? fmt(avg, 1) : '—'}</b><span>nota media${sc.length > 1 ? ` (últimos ${sc.length})` : ''}</span></div>${redo ? `<button data-h="redo"><b>${redo}</b><span>para repetir (nota &lt; 6) ›</span></button>` : '<div><b>0</b><span>para repetir</span></div>'}<div><b class="hm-where">${ses ? 'En tu cuenta' : 'En este dispositivo'}</b><span>${ses ? 'en todos tus dispositivos' : cs === 'out' ? 'entra para tenerlo en la nube' : 'dónde se guarda'}</span></div></section>` : ''}
    <section class="hm-more"><h2>Más</h2><div class="inrow">${more}</div></section>
    <p class="small hm-foot">Herramienta docente: valores y dosis orientativos. No sustituye al manual del equipo, a los protocolos del servicio ni al juicio clínico.</p>`;
}
