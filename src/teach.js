/* ===== Docencia (v0.7): modo examen con nota, vista del instructor (otra ventana u otro dispositivo), debrief con línea de tiempo,
   PDF, historial por alumno, editor de casos y vista móvil. Se inserta dentro de la interfaz: comparte su estado. ===== */
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* almacenamiento no disponible */ } } };
const INSTR = /^#instructor/.test(location.hash);
const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
let exam = false, student = LS.get('simvmi.name', ''), lastReads = [], instrSeen = 0, stateAt = 0, lastSer = -1, toastT = 0;
const CHECK_LAB = {};

/* ---------- registro de la serie y de lo que hace el alumno ---------- */
function teachOnLoad() { track.series = []; track.actsLog = []; track.used = new Set(); track.usedAt = {}; track.shockT = []; lastSer = -1; if (tut.on) tutStop(); lastAct = performance.now(); sendState(true); }
function teachOnSlow() {
  if (S.clin - lastSer >= .1) { lastSer = S.clin; track.series.push([+S.clin.toFixed(2), Math.round(S.spo2 * 1000) / 10, S.arrest ? null : Math.round(S.tas), M.et != null ? Math.round(M.et) : null, S.arrest ? null : Math.round(S.fc)]); if (track.series.length > 3000) track.series.shift(); }
}
const markUse = tok => { if (track && track.used) { track.used.add(tok); (track.usedAt = track.usedAt || {})[tok] = S.clin; } };

/* ---------- nota ---------- */
function checksOf(c) { return (c.checks || []).map(x => Array.isArray(x) ? x : [x, x]); }
function checkDone(tok) { return tok.split('|').some(t => track.used.has(t) || (t === 'rosc' && track.roscAt != null) || (t === 'intub' && track.intubAt != null) || (t === 'noarrest' && !S.arrest && (track.arrestAt == null || track.roscAt != null))); }
function examScore() {
  const c = CASES[caseKey], parts = [];
  const tg = Object.values(track.t).filter(v => v.tot > 0);
  if (tg.length) parts.push({ lab: 'Tiempo en objetivo', v: tg.reduce((a, v) => a + v.inT / v.tot, 0) / tg.length, w: 4, det: `${tg.length} objetivo${tg.length > 1 ? 's' : ''}` });
  const ch = checksOf(c);
  if (ch.length) { const done = ch.filter(([t]) => checkDone(t)); parts.push({ lab: 'Acciones clave', v: done.length / ch.length, w: 3, det: ch.map(([t, l]) => (checkDone(t) ? '✓ ' : '✗ ') + l).join(' · ') }); }
  if (track.arrestAt != null) {
    const cp = S.cpr, ccf = cp.cprTime + cp.noFlow > 0 ? cp.cprTime / (cp.cprTime + cp.noFlow) : 0;
    let v = clamp(ccf / .8, 0, 1) * .5 + (track.roscAt != null ? .35 : 0);
    const shockable = c.arrest === 'vf' || track.shocks > 0;
    if (shockable) v += track.firstShock != null && track.firstShock <= 2 ? .15 : 0; else v += .15 * (track.adr.length ? 1 : 0);
    parts.push({ lab: 'Parada', v: clamp(v, 0, 1), w: 3, det: `fracción de compresión ${fmt(ccf * 100)} %${track.roscAt != null ? ' · RCE' : ' · sin RCE'}` });
  }
  let sec = 1; const W = track.worst, why = [];
  if (!c.arrest && track.arrestAt != null) { sec -= .5; why.push('parada durante el caso'); }
  if (W.n && W.spo2 < 85) { sec -= W.spo2 < 75 ? .4 : .25; why.push(`SpO₂ mínima ${fmt(W.spo2)} %`); }
  if (track.standbyApnea > .5) { sec -= .2; why.push('intubado sin ventilar'); }
  const unres = track.events.filter(e => e.fixed == null && e.k !== 'cough' && e.k !== 'move' && e.k !== 'aspir').length;
  if (unres) { sec -= .15 * unres; why.push(`${unres} evento${unres > 1 ? 's' : ''} sin resolver`); }
  parts.push({ lab: 'Seguridad', v: clamp(sec, 0, 1), w: 3, det: why.length ? why.join(' · ') : 'sin incidencias' });
  const sw = parts.reduce((a, p) => a + p.w, 0), total = parts.reduce((a, p) => a + p.v * p.w, 0) / sw * 10;
  return { total: Math.round(total * 10) / 10, parts };
}

/* ---------- línea de tiempo (SVG; la usan el debrief y el instructor) ---------- */
function timelineSVG(series, marks, lines, opt) {
  opt = opt || {};
  const Wd = 640, H = opt.compact ? 176 : 246, L = 44, R = 44, T = 8, t0 = 0, t1 = Math.max(1, series.length ? series[series.length - 1][0] : 1, ...marks.map(m => m[0]));
  const X = t => L + (t - t0) / (t1 - t0) * (Wd - L - R);
  const p1 = [T, opt.compact ? 72 : 100], p2 = [p1[1] + 22, opt.compact ? 146 : 186];
  const Y = (v, lo, hi, p) => p[1] - (clamp(v, lo, hi) - lo) / (hi - lo) * (p[1] - p[0]);
  const path = (i, lo, hi, p) => { let d = '', pen = false; for (const s of series) { const v = s[i]; if (v == null) { pen = false; continue; } d += (pen ? 'L' : 'M') + X(s[0]).toFixed(1) + ' ' + Y(v, lo, hi, p).toFixed(1); pen = true; } return d; };
  const step = t1 > 40 ? 10 : t1 > 12 ? 5 : t1 > 4 ? 2 : 1;
  let g = '';
  for (let t = 0; t <= t1 + 1e-6; t += step) g += `<line x1="${X(t)}" x2="${X(t)}" y1="${p1[0]}" y2="${p2[1]}" class="tl-grid"/><text x="${X(t)}" y="${p2[1] + 12}" text-anchor="middle" class="tl-ax">${t}</text>`;
  const ax = (p, lo, hi, side, lab, unit) => [lo, (lo + hi) / 2, hi].map(v => `<text x="${side === 'l' ? L - 4 : Wd - R + 4}" y="${Y(v, lo, hi, p) + 3}" text-anchor="${side === 'l' ? 'end' : 'start'}" class="tl-ax">${v}</text>`).join('') + `<text x="${side === 'l' ? L + 5 : Wd - R - 5}" y="${p[0] + 12}" text-anchor="${side === 'l' ? 'start' : 'end'}" class="tl-lab ${lab}">${unit}</text>`;
  g += `<rect x="${L}" y="${p1[0]}" width="${Wd - L - R}" height="${p1[1] - p1[0]}" class="tl-box"/><rect x="${L}" y="${p2[0]}" width="${Wd - L - R}" height="${p2[1] - p2[0]}" class="tl-box"/>`;
  g += `<line x1="${L}" x2="${Wd - R}" y1="${Y(90, 50, 100, p1)}" y2="${Y(90, 50, 100, p1)}" class="tl-ref"/><line x1="${L}" x2="${Wd - R}" y1="${Y(90, 40, 200, p2)}" y2="${Y(90, 40, 200, p2)}" class="tl-ref"/>`;
  g += ax(p1, 50, 100, 'l', 'tl-sp', 'SpO₂ %') + ax(p1, 0, 60, 'r', 'tl-et', 'EtCO₂') + ax(p2, 40, 200, 'l', 'tl-ta', 'TAS') + `<text x="${Wd - R - 5}" y="${p2[0] + 12}" text-anchor="end" class="tl-lab tl-fc">FC (misma escala)</text>`;
  for (const [t, cls, lab] of lines) g += `<line x1="${X(t)}" x2="${X(t)}" y1="${p1[0]}" y2="${p2[1]}" class="tl-v ${cls}"><title>${esc(lab)} · min ${fmt(t, 1)}</title></line>`;
  g += `<path d="${path(4, 40, 200, p2)}" class="tl-l tl-fc"/><path d="${path(2, 40, 200, p2)}" class="tl-l tl-ta"/><path d="${path(3, 0, 60, p1)}" class="tl-l tl-et"/><path d="${path(1, 50, 100, p1)}" class="tl-l tl-sp"/>`;
  if (!opt.compact) {
    const ym = p2[1] + 30, sym = { drug: (x, y) => `<path d="M${x} ${y - 5}L${x + 5} ${y + 4}L${x - 5} ${y + 4}Z"`, act: (x, y) => `<circle cx="${x}" cy="${y}" r="3.6"`, event: (x, y) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8"`, shock: (x, y) => `<path d="M${x} ${y - 6}L${x + 5} ${y}L${x} ${y + 6}L${x - 5} ${y}Z"` };
    marks.forEach(([t, kind, txt]) => { g += `${sym[kind](X(t).toFixed(1), ym)} class="tl-m tl-${kind}"><title>min ${fmt(t, 1)} · ${esc(txt)}</title>${kind === 'act' ? '</circle>' : kind === 'event' ? '</rect>' : '</path>'}`; });
  }
  return `<svg viewBox="0 0 ${Wd} ${H}" class="tline" role="img" aria-label="Evolución de SpO₂, EtCO₂, TAS y FC con las acciones marcadas"><g>${g}</g></svg>` +
    (opt.compact ? '' : `<p class="tl-leg"><span class="k tl-sp">SpO₂</span><span class="k tl-et">EtCO₂</span><span class="k tl-ta">TAS</span><span class="k tl-fc">FC</span><span>▲ fármaco</span><span>● acción</span><span>■ evento</span><span>◆ descarga</span><span class="k tl-arr">parada</span><span class="k tl-rce">RCE</span><span class="k tl-iot">vía aérea</span> · minutos de tiempo clínico</p>`);
}
function debriefMarks() {
  const m = [];
  track.drugs.forEach(([t, x]) => m.push([t, 'drug', x]));
  (track.actsLog || []).forEach(([t, x]) => m.push([t, 'act', x]));
  track.events.forEach(e => m.push([e.at, 'event', EVLAB[e.k] || e.k]));
  (track.shockT || []).forEach(t => m.push([t, 'shock', 'Descarga']));
  const lines = [];
  if (track.arrestAt != null) lines.push([track.arrestAt, 'tl-arr', 'Parada']);
  if (track.roscAt != null) lines.push([track.roscAt, 'tl-rce', 'RCE']);
  if (track.intubAt != null) lines.push([track.intubAt, 'tl-iot', track.sga ? 'Supraglótico' : track.cric ? 'Cricotiroidotomía' : 'Intubación']);
  return { m, lines };
}

/* ---------- debrief: nota, línea de tiempo, alumno, PDF e historial ---------- */
function teachDebrief(reason) {
  const c = CASES[caseKey], sc = examScore(), dm = debriefMarks();
  const col = v => v >= .8 ? 'var(--ok)' : v >= .5 ? 'var(--warn)' : 'var(--bad)';
  const head = `<div class="dbhead"><div class="score" style="--sc:${col(sc.total / 10)}"><b>${fmt(sc.total, 1)}</b><span>sobre 10</span></div>
    <div class="dbmeta"><label class="small" for="dbName">Alumno</label><input id="dbName" value="${esc(student)}" placeholder="Nombre" autocomplete="off">
    <p class="small">${exam ? 'Modo examen' : 'Modo práctica'}${track.tutorial ? ' · con tutorial' : ''} · ${new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</p></div></div>
    <table class="dtable">${sc.parts.map(p => `<tr><td>${p.lab}<br><span class="small">${esc(p.det)}</span></td><td style="width:34%"><div class="bar"><span style="width:${p.v * 100}%;background:${col(p.v)}"></span></div></td><td class="n">${fmt(p.v * 100)} %</td></tr>`).join('')}</table>`;
  const tl = track.series.length > 2 ? `<h2 style="margin-top:6px">Línea de tiempo</h2>${timelineSVG(track.series, dm.m, dm.lines)}` : '';
  $('#dbBody').insertAdjacentHTML('afterbegin', head + tl);
  if (exam && c.hint) { const hs = [...$('#dbBody').querySelectorAll('h2')].find(h => h.textContent === 'Solución posible'); if (hs) { const p = hs.nextElementSibling; const d = document.createElement('details'); d.innerHTML = '<summary>Ver la solución posible</summary>'; d.appendChild(p.cloneNode(true)); hs.replaceWith(d); p.remove(); } }
  const att = { d: new Date().toISOString(), name: student || '', key: caseKey, base: c.vbase || null, title: c.title, exam, tut: !!track.tutorial, score: sc.total, parts: sc.parts.map(p => [p.lab, Math.round(p.v * 100)]), min: Math.round(S.clin * 10) / 10, reason: reason || '' };
  const hist = LS.get('simvmi.hist', []); hist.push(att); while (hist.length > 500) hist.shift(); LS.set('simvmi.hist', hist);
  const idx = hist.length - 1;
  $('#dbName').addEventListener('change', e => { student = e.target.value.trim().slice(0, 60); LS.set('simvmi.name', student); $('#stuName').value = student; const h = LS.get('simvmi.hist', []); if (h[idx] && h[idx].d === att.d) { h[idx].name = student; LS.set('simvmi.hist', h); } });
  linkSend({ t: 'debrief', title: c.title, reason: reason || '', score: sc.total, parts: sc.parts.map(p => [p.lab, Math.round(p.v * 100), p.det]), name: student });
}

/* ---------- modo examen ---------- */
function setExam(on, silent) {
  exam = !!on; document.body.classList.toggle('exam', exam); if (exam && tut.on) tutStop('Tutorial cerrado: modo examen');
  $$('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', (+b.dataset.x === 1) === exam ? 'true' : 'false'));
  if (!silent) { loadCase(caseKey); logIt(exam ? 'Modo examen: sin Lectura ni solución; nota al terminar' : 'Modo práctica'); }
  sendState(true);
}

/* ---------- enlace con el instructor: otra ventana (BroadcastChannel) u otro dispositivo (WebRTC con PeerJS) ---------- */
const LINK = { bc: null, peer: null, conns: [], code: null };
function linkSend(m) { try { if (LINK.bc) LINK.bc.postMessage(m); } catch (e) { /* canal cerrado */ } LINK.conns.forEach(c => { try { if (c.open) c.send(m); } catch (e) { /* conexión caída */ } }); }
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  const srcs = ['https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
  return srcs.reduce((pr, src) => pr.catch(() => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = () => window.Peer ? ok(window.Peer) : ko(); s.onerror = ko; document.head.appendChild(s); })), Promise.reject()).catch(() => { throw new Error('No se pudo cargar la librería de conexión (¿sin internet?)'); });
}
function hostMsg(m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hello' || m.t === 'ping') { const was = performance.now() - instrSeen < 8000; instrSeen = performance.now(); if (!was) logIt('Instructor conectado'); if (m.t === 'hello') sendState(true); $('#instrDot').hidden = false; return; }
  if (m.t !== 'cmd') return;
  switch (m.c) {
    case 'event': if (EVLAB[m.k]) fireEvent(m.k, null, false); break;
    case 'load': if (CASES[m.k]) { $('#caseSel').value = m.k; loadCase(m.k); } break;
    case 'pause': paused = !!m.v; setPauseBtn(); break;
    case 'speed': if ([1, 5, 10, 20].includes(+m.v)) setSpeed(+m.v); break;
    case 'exam': setExam(!!m.v); break;
    case 'end': if (!ended) { ended = true; showDebrief('Terminado por el instructor'); } break;
    case 'msg': { const t = String(m.txt || '').slice(0, 300); if (t) { toast('Instructor: ' + t); logIt('Instructor: ' + t); } break; }
    case 'alt': setAltUI(clamp(+m.v || 0, 0, 3000)); logIt('Altitud de cabina ' + (+m.v).toLocaleString('es-ES') + ' m'); break;
  }
  sendState(true);
}
function sendState(force) {
  if (INSTR || !S || !track) return;
  const now = performance.now();
  if (now - instrSeen > 8000 && !LINK.conns.some(c => c.open)) return;
  if (!force && now - stateAt < 1000) return;
  stateAt = now;
  const c = CASES[caseKey];
  linkSend({ t: 'state', key: caseKey, title: c.title, lvl: c.lvl, clin: S.clin, scale, paused, exam, name: student,
    dev: DEVS[S.dev.vent].short, mon: MONS[$('#monSel').value].short, iface: IFSHORT[S.iface], mode: S.iface === 'o2' ? O2LAB[S.cfg.o2dev] : modeLabel(uMode(S.cfg)) + (S.standby ? ' (en espera)' : ''),
    v: { spo2: S.spo2 * 100, tas: S.arrest ? null : S.tas, pni: pni && pni.sys ? pni.sys : null, fc: S.arrest ? null : S.fc, et: M.et, rr: M.effN >= 2 ? M.effRR : 0, rhy: rhyLab(S.rhythm) + (S.arrest ? ' · sin pulso' : ''), arrest: S.arrest, gcs: S.relTot > .6 ? null : S.gcs, comp: S.cpr.comp },
    truth: truthRows(), reads: lastReads, log: [...document.querySelectorAll('#log span')].slice(0, 40).map(x => x.textContent),
    series: track.series.slice(-400), tg: Object.entries(track.t).map(([k, v]) => [TGT[k].lab, v.tot ? Math.round(v.inT / v.tot * 100) : null]) });
}
function hostLinkInit() {
  try { LINK.bc = new BroadcastChannel('simvmi'); LINK.bc.onmessage = e => hostMsg(e.data); } catch (e) { LINK.bc = null; }
}
function hostRemote() {
  const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
  $('#linkCode').textContent = '·····'; $('#linkSt').textContent = 'Cargando la conexión…'; $('#linkModal').hidden = false;
  loadPeer().then(Peer => {
    if (LINK.peer) { try { LINK.peer.destroy(); } catch (e) { /* ya cerrado */ } }
    const peer = new Peer('simvmi-' + code); LINK.peer = peer; LINK.code = code;
    peer.on('open', () => { $('#linkCode').textContent = code; $('#linkSt').textContent = 'Esperando al instructor: que abra «Vista del instructor», pulse «Conectar a otro dispositivo» y escriba este código.'; });
    peer.on('connection', conn => { LINK.conns.push(conn); conn.on('data', hostMsg); conn.on('open', () => { $('#linkSt').textContent = 'Instructor conectado.'; instrSeen = performance.now(); sendState(true); }); conn.on('close', () => { LINK.conns = LINK.conns.filter(x => x !== conn); logIt('Instructor desconectado'); }); });
    peer.on('error', e => { $('#linkSt').textContent = 'Error de conexión: ' + (e && e.type ? e.type : 'desconocido') + '. Prueba en la misma red o usa dos ventanas del mismo equipo.'; });
  }).catch(e => { $('#linkSt').textContent = e.message; });
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 12000); }

/* ---------- vista del instructor ---------- */
function startInstructor() {
  document.body.classList.add('instr-mode');
  const box = $('#instr'); box.hidden = false;
  box.innerHTML = `<header class="ihead"><div><span class="eyebrow">Simulador docente · vista del instructor</span><h1>Instructor</h1></div>
      <div class="inrow"><span class="chip" id="iConn">sin conexión</span><label class="small" for="iCode">Otro dispositivo</label><input id="iCode" maxlength="5" placeholder="código" autocomplete="off" style="width:7ch;text-transform:uppercase"><button class="btn" id="iJoin">Conectar a otro dispositivo</button></div></header>
    <p class="small">Abre el simulador en la pantalla del alumno. En el mismo equipo (otra ventana o pestaña) se conecta solo; en otro dispositivo, el alumno pulsa «Enlazar instructor» y te da un código.</p>
    <div class="ibar card"><div class="field"><label for="iCase">Caso</label><select id="iCase">${GROUPS.map(g => `<optgroup label="${esc(g)}">` + Object.entries(CASES).filter(([, c]) => c.lvl === g).map(([k, c]) => `<option value="${k}">${esc(c.title)}</option>`).join('') + '</optgroup>').join('')}</select></div>
      <button class="btn primary" data-i="load">Cargar en el alumno</button><button class="btn" data-i="pause" id="iPause">Pausa</button>
      <div class="seg" id="iSpeed">${[1, 5, 10, 20].map(v => `<button data-s="${v}">×${v}</button>`).join('')}</div>
      <div class="seg" id="iExam"><button data-x="0">Práctica</button><button data-x="1">Examen</button></div><button class="btn" data-i="end">Terminar caso</button></div>
    <div class="igrid">
      <section class="card"><h2 id="iTitle">Sin datos</h2><p class="small" id="iSub">—</p><div class="ivit" id="iVit"></div><div class="targets" id="iTg"></div></section>
      <section class="card"><h2>Provocar</h2><div class="abtns" id="iEv">${Object.entries(EVLAB).map(([k, l]) => `<button class="btn" data-ev="${k}">${l}</button>`).join('')}</div>
        <div class="inrow" style="margin-top:8px"><input id="iMsg" placeholder="Mensaje al alumno (p. ej. «el paciente refiere dolor torácico»)" style="flex:1;min-width:12ch"><button class="btn" id="iSend">Enviar</button></div>
        <div class="range"><label class="small" for="iAlt">Altitud de cabina</label><input type="range" id="iAlt" min="0" max="3000" step="100" value="0"><span class="num small" id="iAltV">0 m</span></div></section>
      <section class="card iwide"><h2>Evolución</h2><div id="iTl"></div></section>
      <section class="card"><h2>Lectura (el alumno no la ve en examen)</h2><div class="read" id="iRead"></div></section>
      <section class="card"><h2>Lo que pasa dentro</h2><dl class="truth" id="iTruth"></dl></section>
      <section class="card"><h2>Registro</h2><div class="log" id="iLog"></div></section>
      <section class="card" id="iDbBox" hidden><h2>Último debrief</h2><div id="iDb"></div></section>
    </div>`;
  let last = null, lastAt = 0;
  const send = m => linkSend(m), cmd = (c, extra) => send(Object.assign({ t: 'cmd', c }, extra || {}));
  const onMsg = m => {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'state') { last = m; lastAt = performance.now(); render(m); }
    if (m.t === 'debrief') { $('#iDbBox').hidden = false; $('#iDb').innerHTML = `<p><b>${esc(m.title)}</b>${m.name ? ' · ' + esc(m.name) : ''}${m.reason ? ' · ' + esc(m.reason) : ''}</p><p class="score-i">${fmt(m.score, 1)} / 10</p><table class="dtable">${m.parts.map(([l, v, d]) => `<tr><td>${esc(l)}<br><span class="small">${esc(d)}</span></td><td class="n">${v} %</td></tr>`).join('')}</table>`; }
  };
  try { LINK.bc = new BroadcastChannel('simvmi'); LINK.bc.onmessage = e => onMsg(e.data); } catch (e) { LINK.bc = null; }
  send({ t: 'hello' }); setInterval(() => { send({ t: 'ping' }); const ok = performance.now() - lastAt < 4000; $('#iConn').textContent = ok ? 'conectado' : 'sin conexión'; $('#iConn').className = 'chip ' + (ok ? 'ok' : 'off'); }, 2000);
  const vit = (l, v, u, d) => `<div class="iv"><span>${l}</span><b>${v == null || !isFinite(v) ? '–' : fmt(v, d || 0)}</b><small>${u}</small></div>`;
  function render(m) {
    $('#iTitle').textContent = m.title; $('#iSub').textContent = `${m.lvl} · ${m.dev} · ${m.mon} · ${m.iface} · ${m.mode} · min ${fmt(m.clin, 1)} · ×${m.scale}${m.paused ? ' · en pausa' : ''}${m.exam ? ' · examen' : ''}${m.name ? ' · ' + m.name : ''}`;
    const v = m.v;
    $('#iVit').innerHTML = vit('SpO₂', v.spo2, '%') + vit('TAS real', v.tas, 'mmHg') + vit('PNI', v.pni, 'mmHg') + vit('FC', v.fc, 'lpm') + vit('EtCO₂', v.et, 'mmHg') + vit('FR', v.rr, 'rpm') + vit('GCS', v.gcs, '') + `<div class="iv wide"><span>Ritmo</span><b class="rt">${esc(v.rhy)}</b><small>${v.arrest ? (v.comp !== 'off' ? 'RCP en curso' : 'sin compresiones') : ''}</small></div>`;
    $('#iTg').innerHTML = m.tg.map(([l, p]) => `<span class="chip ${p == null ? '' : p >= 80 ? 'ok' : p < 50 ? 'off' : ''}">${esc(l)} ${p == null ? '–' : p + ' %'}</span>`).join('');
    $('#iRead').innerHTML = m.reads.map(([l, t, dd, f]) => `<div class="ri ${l}"><b>${esc(t)}</b><p>${esc(dd)}</p><p class="fix">→ ${esc(f)}</p></div>`).join('') || '<p class="small">—</p>';
    $('#iTruth').innerHTML = m.truth.map(([k, x]) => `<dt>${esc(k)}</dt><dd>${esc(x)}</dd>`).join('');
    $('#iLog').innerHTML = m.log.map(x => `<span>${esc(x)}</span>`).join('');
    $('#iTl').innerHTML = m.series.length > 2 ? timelineSVG(m.series.map(s => [s[0] - m.series[0][0], ...s.slice(1)]), [], [], { compact: true }) : '<p class="small">Aún no hay datos.</p>';
    $$('#iSpeed button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.s === m.scale ? 'true' : 'false'));
    $$('#iExam button').forEach(b => b.setAttribute('aria-pressed', (+b.dataset.x === 1) === m.exam ? 'true' : 'false'));
    $('#iPause').textContent = m.paused ? 'Seguir' : 'Pausa';
    if (document.activeElement !== $('#iCase')) $('#iCase').value = m.key;
  }
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ev) cmd('event', { k: b.dataset.ev });
    else if (b.dataset.i === 'load') cmd('load', { k: $('#iCase').value });
    else if (b.dataset.i === 'pause') cmd('pause', { v: !(last && last.paused) });
    else if (b.dataset.i === 'end') cmd('end');
    else if (b.dataset.s) cmd('speed', { v: +b.dataset.s });
    else if (b.dataset.x != null && b.closest('#iExam')) cmd('exam', { v: b.dataset.x === '1' });
    else if (b.id === 'iSend') { const t = $('#iMsg').value.trim(); if (t) { cmd('msg', { txt: t }); $('#iMsg').value = ''; } }
    else if (b.id === 'iJoin') {
      const code = $('#iCode').value.trim().toUpperCase(); if (code.length !== 5) { $('#iConn').textContent = 'código de 5 caracteres'; return; }
      $('#iConn').textContent = 'conectando…';
      loadPeer().then(Peer => { const peer = new Peer(); peer.on('open', () => { const conn = peer.connect('simvmi-' + code, { reliable: true }); LINK.conns.push(conn); conn.on('open', () => { conn.send({ t: 'hello' }); }); conn.on('data', onMsg); conn.on('close', () => { $('#iConn').textContent = 'desconectado'; }); }); peer.on('error', er => { $('#iConn').textContent = 'error: ' + (er && er.type ? er.type : 'conexión'); }); }).catch(er => { $('#iConn').textContent = er.message; });
    }
  });
  $('#iMsg').addEventListener('keydown', e => { if (e.key === 'Enter') $('#iSend').click(); });
  $('#iAlt').addEventListener('input', e => { $('#iAltV').textContent = (+e.target.value).toLocaleString('es-ES') + ' m'; });
  $('#iAlt').addEventListener('change', e => cmd('alt', { v: +e.target.value }));
}

/* ---------- historial ---------- */
function renderHist() {
  const h = LS.get('simvmi.hist', []), names = [...new Set(h.map(a => a.name || 'Sin nombre'))].sort();
  const sel = $('#hiName'), cur = sel.value; sel.innerHTML = '<option value="">Todos los alumnos</option>' + names.map(n => `<option>${esc(n)}</option>`).join(''); sel.value = names.includes(cur) ? cur : '';
  const rows = h.filter(a => !sel.value || (a.name || 'Sin nombre') === sel.value).slice().reverse();
  $('#hiBody').innerHTML = rows.length ? `<table class="dtable"><tr><th>Fecha</th><th>Alumno</th><th>Caso</th><th>Modo</th><th class="n">Nota</th></tr>${rows.map(a => `<tr><td>${new Date(a.d).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${esc(a.name || 'Sin nombre')}</td><td>${esc(a.title)}</td><td>${a.exam ? 'examen' : a.tut ? 'tutorial' : 'práctica'}</td><td class="n">${fmt(a.score, 1)}</td></tr>`).join('')}</table>` : '<p class="small">Todavía no hay intentos guardados en este dispositivo.</p>';
  const ex = rows.filter(a => a.exam); $('#hiSum').textContent = rows.length ? `${rows.length} intento${rows.length > 1 ? 's' : ''} · media ${fmt(rows.reduce((s, a) => s + a.score, 0) / rows.length, 1)}${ex.length ? ' · media en examen ' + fmt(ex.reduce((s, a) => s + a.score, 0) / ex.length, 1) : ''}` : '';
}
// en el visor de claude.ai los archivos se ofrecen con la capacidad «downloads»; en GitHub Pages, con un enlace normal
let dlNs = null;
try { if (window.claude && typeof window.claude.use === 'function') window.claude.use('downloads').then(ns => { dlNs = ns; if (ns) { const b = $('#dbPdf'); if (b) b.textContent = 'Guardar informe'; } }, () => {}); } catch (e) { /* sin visor */ }
function download(name, text, type) {
  if (dlNs) { dlNs.save({ filename: name, data: text }).catch(e => { if (e && e.code !== 'declined') toast('No se pudo guardar el archivo' + (e.code ? ' (' + e.code + ')' : '') + '.'); }); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

/* ---------- editor de casos ---------- */
const PARAMS = { pco2: 'PaCO₂ inicial (mmHg)', deficit: 'Pérdida de volemia (0–0,6)', bs: 'Broncoespasmo (1 = basal)', opioid: 'Opiáceo (26 = grave)', rhythm: 'Arritmia: tsv, fa, flutter, tvp, sbrady', arrPen: 'Caída de TAS por la arritmia', bav: 'BAV completo (1)',
  arrest: 'Parada: vf, aesp, asys', arrestCause: 'Causa: hypox, ptx, hypo, tep, anaf, co, hyperk, tca, hypoT', arrestCause2: 'Segunda causa', comp: 'Compresiones al empezar: manual, mech', shockMul: 'Éxito de la descarga (1 = normal)',
  tep: 'TEP (0–1)', anaf: 'Anafilaxia (0–1)', cohb: 'COHb (fracción)', cn: 'Cianuro (0–1)', icp: 'PIC (mmHg)', icpGrow: 'Subida de la PIC (mmHg/min)', weak: 'Debilidad muscular (0–1)', dav: 'Intubación fallida (probabilidad)', edAir: 'Edema de vía aérea (0–1)', edAirRate: 'Progresión del edema (/min)',
  asp: 'Broncoaspiración (0–1)', ptx: 'Neumotórax (0–1)', ptxTension: 'Neumotórax a tensión (1)', tasAdj: 'Ajuste de TAS (mmHg)', fcAdj: 'Ajuste de FC (lpm)', sevFloor: 'Edema pulmonar mínimo (0–1)', bottleL: 'Botella (L)', bottleBar: 'Botella (bar)', leak10: 'Fuga de mascarilla',
  altitude: 'Altitud de cabina (m)', bmv: 'Eficacia de la bolsa (0–1)', sgaFail: 'Fallo del supraglótico (0–1)', k: 'Potasio (mmol/L)', kRate: 'Subida de potasio (mmol/L/h)', glu: 'Glucemia (mg/dL)', gluT: 'Glucemia a la que tiende', temp: 'Temperatura (°C)', tempRate: 'Cambio de temperatura (°C/h)',
  bleed: 'Sangrado (fracción de volemia/min)', bleedSrc: 'Foco: ext, pelv, uter, int, thor (hemotórax)', htx: 'Hemotórax inicial (L)', flail: 'Volet costal (0–1)', pain: 'Dolor (0–1)', burn: 'Superficie quemada (%)', tca: 'Tricíclicos (0–1)', ecl: 'Eclampsia (1)', croup: 'Crup (0–1)', postRosc: 'Recién recuperado de una parada (1)', tamp: 'Taponamiento (0–1)', tampRate: 'Crecimiento del derrame (/min)', vaso: 'Vasoplejia séptica (0–1)', vasoRate: 'Progresión de la vasoplejia (/min)', neurog: 'Shock neurogénico (0–1)', fluidTol: 'Volumen que tolera el pulmón (mL/kg)', access: 'Vía venosa al empezar (1 sí, 0 no)', hco3Off: 'Cambio de bicarbonato (mmol/L)',
  sedE: 'Sedación de base (0 = despierto)', relCe: 'Relajante de base (0 = no)', sedStopped: 'Bomba de sedación parada (1)' };
const BOOLK = { bav: 1, ptxTension: 1, ecl: 1, postRosc: 1, access: 1, sedStopped: 1, ped: 1 };
const CFGK = ['mode', 'vt', 'fr', 'ti', 'tplat', 'pinsp', 'ps', 'rise', 'peep', 'fio2', 'trigI', 'trigE', 'timax', 'pmax', 'minvol', 'flow', 'o2dev'];
const MODES_ALL = ['VCV', 'PCV', 'APV', 'ASV', 'PSV', 'PST', 'CPAP', 'CPV', 'HFNC', 'SIMV_V', 'SIMV_P', 'SIMV_A', 'CPR_M', 'DEM', 'MAN'];
const ACTS_CHK = { 'act:explore': 'Explorar', 'act:gas': 'Gasometría', 'act:glu': 'Glucemia capilar', 'act:temp': 'Temperatura', 'act:warm': 'Calor activo', 'act:hemo': 'Hemostasia', 'act:iv|act:io': 'Acceso vascular', 'act:io': 'Vía intraósea', 'act:bag': 'Ambú', 'act:sga': 'Supraglótico', 'act:cric': 'Cricotiroidotomía',
  'act:decomp|act:drain': 'Descompresión o drenaje', 'act:drain': 'Drenaje torácico', 'act:vl': 'Videolaringoscopio', 'act:apox': 'Oxigenación apneica', 'act:toMask': 'VMNI', 'act:toNasal': 'Alto flujo', 'act:compMech': 'Compresor mecánico', 'act:ecg12': 'ECG de 12 derivaciones', 'act:eco': 'Ecografía clínica', 'act:pericardio': 'Pericardiocentesis', 'act:icp': 'Activar ICP primaria', 'act:check': 'Análisis de ritmo', 'shock': 'Descarga', 'intub': 'Vía aérea definitiva', 'rosc': 'RCE', 'noarrest': 'Sin parada' };
function checkTokens() { const o = Object.assign({}, ACTS_CHK); Object.values(DRUGITEMS).forEach(it => { if (it.k) o['drug:' + it.k] = it.lab; else if (it.act) o['act:' + it.act] = it.lab; }); PERFS.forEach(p => { o['perf:' + p.id] = 'Perfusión de ' + p.lab.toLowerCase(); }); return o; }
let edRows = null;
function sanitizeCase(c) { const s = x => typeof x === 'string' ? x.replace(/[<>]/g, '').slice(0, 2000) : Array.isArray(x) ? x.map(s) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).filter(([k]) => /^[A-Za-z0-9_]+$/.test(k)).map(([k, v]) => [k, s(v)])) : typeof x === 'number' || typeof x === 'boolean' ? x : null; return s(c); }
function validCase(c) {
  const err = [];
  if (!c || typeof c !== 'object') return ['No es un caso.'];
  if (!c.title) err.push('Falta el título.');
  if (!c.goal) err.push('Falta el planteamiento.');
  if (c.pheno && !VMI.PHENO[c.pheno]) err.push('Paciente desconocido: ' + c.pheno);
  if (c.iface && !['tube', 'mask', 'nasal', 'o2'].includes(c.iface)) err.push('Interfaz desconocida.');
  for (const e of c.events || []) if (!(e.alt != null || EVLAB[e.k])) err.push('Evento desconocido: ' + e.k);
  for (const [k, r] of Object.entries(c.targets || {})) if (!TGT[k] || !Array.isArray(r) || !(r[0] < r[1])) err.push('Objetivo no válido: ' + k);
  return err;
}
function customCases() { return LS.get('simvmi.cases', {}); }
function installCustom() {
  const cc = customCases();
  for (const k of Object.keys(CASES)) if (k.startsWith('u_') && !cc[k] && k !== 'u_link' && k !== 'u_var') delete CASES[k];
  for (const [k, c] of Object.entries(cc)) { const s = sanitizeCase(c); if (!validCase(s).length) CASES[k] = Object.assign(s, { lvl: 'Mis casos' }); }
  if (!GROUPS.includes('Mis casos')) GROUPS.splice(GROUPS.indexOf('Libre'), 0, 'Mis casos');
  const cur = $('#caseSel').value;
  $('#caseSel').innerHTML = GROUPS.map(g => { const list = Object.entries(CASES).filter(([, c]) => c.lvl === g); return list.length ? `<optgroup label="${esc(g)}">` + list.map(([k, c]) => `<option value="${k}">${esc(c.title)}</option>`).join('') + '</optgroup>' : ''; }).join('');
  if (CASES[cur]) $('#caseSel').value = cur;
}
function edOpen(fromKey) {
  const base = JSON.parse(JSON.stringify(CASES[fromKey] || CASES.libre));
  if (!fromKey || fromKey === 'libre') Object.assign(base, { title: 'Caso nuevo', pheno: 'sano', sex: 'h', talla: 175, peso: 75, goal: '', hint: '', targets: {}, cfg: { mode: 'VCV', vt: 480, fr: 14, ti: 1, peep: 5, fio2: 50, pmax: 40 } });
  edFill(base, fromKey && fromKey.startsWith('u_') ? fromKey : null);
  $('#edModal').hidden = false; $('#edTitle').focus();
}
function edFill(c, key) {
  $('#edModal').dataset.key = key || '';
  $('#edFrom').innerHTML = '<option value="">Caso en blanco</option>' + GROUPS.map(g => `<optgroup label="${esc(g)}">` + Object.entries(CASES).filter(([, x]) => x.lvl === g).map(([k, x]) => `<option value="${k}">${esc(x.title)}</option>`).join('') + '</optgroup>').join('');
  $('#edTitle').value = c.title || ''; $('#edPheno').value = c.pheno || 'sano'; $('#edSex').value = c.sex || 'h'; $('#edTalla').value = c.talla || 175; $('#edPeso').value = c.peso || ''; $('#edPed').checked = !!c.ped;
  $('#edIface').value = c.iface || 'tube'; $('#edAwake').checked = c.sedE === 0; $('#edSpeed').value = c.speed || ''; $('#edDur').value = c.duration || ''; $('#edDev').value = c.dev || '';
  $('#edGoal').value = c.goal || ''; $('#edHint').value = c.hint || '';
  const params = Object.entries(c).filter(([k]) => PARAMS[k] && !['sedE', 'relCe', 'sedStopped'].includes(k)).map(([k, v]) => [k, v === true ? 1 : v === false ? 0 : v]);
  if (c.altitude != null) params.push(['altitude', c.altitude]);
  edRows = { par: params, cfg: Object.entries(c.cfg || {}).filter(([k]) => CFGK.includes(k)), ev: (c.events || []).map(e => e.alt != null ? ['alt', e.at, e.alt, e.txt || ''] : [e.k, e.at, '', e.txt || '']), tg: Object.entries(c.targets || {}).map(([k, r]) => [k, r[0], r[1]]), ch: checksOf(c).map(([t]) => t) };
  edRender(); $('#edErr').textContent = ''; $('#edJson').value = '';
}
function edRender() {
  const opt = (o, v) => Object.entries(o).map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const del = (g, i) => `<button class="btn sm" data-del="${g}" data-i="${i}" aria-label="Quitar">✕</button>`;
  const cfgOpt = Object.fromEntries(CFGK.map(k => [k, k === 'mode' ? 'Modo' : k === 'o2dev' ? 'Oxigenoterapia' : (SPEC[k] ? SPEC[k].lab + ' (' + SPEC[k].u + ')' : k)]));
  $('#edPar').innerHTML = edRows.par.map(([k, v], i) => `<div class="edr"><select data-g="par" data-i="${i}" data-f="0">${opt(PARAMS, k)}</select><input data-g="par" data-i="${i}" data-f="1" value="${esc(v)}">${del('par', i)}</div>`).join('');
  $('#edCfg').innerHTML = edRows.cfg.map(([k, v], i) => `<div class="edr"><select data-g="cfg" data-i="${i}" data-f="0">${opt(cfgOpt, k)}</select>${k === 'mode' ? `<select data-g="cfg" data-i="${i}" data-f="1">${opt(Object.fromEntries(MODES_ALL.map(m => [m, m])), v)}</select>` : k === 'o2dev' ? `<select data-g="cfg" data-i="${i}" data-f="1">${opt(O2LAB, v)}</select>` : `<input data-g="cfg" data-i="${i}" data-f="1" value="${esc(v)}" inputmode="decimal">`}${del('cfg', i)}</div>`).join('');
  $('#edEv').innerHTML = edRows.ev.map(([k, at, alt, txt], i) => `<div class="edr"><input data-g="ev" data-i="${i}" data-f="1" value="${esc(at)}" inputmode="decimal" aria-label="Minuto" style="width:7ch"><select data-g="ev" data-i="${i}" data-f="0">${opt(Object.assign({ alt: 'Cambio de altitud (m)' }, EVLAB), k)}</select>${k === 'alt' ? `<input data-g="ev" data-i="${i}" data-f="2" value="${esc(alt)}" inputmode="numeric" aria-label="Metros" style="width:8ch">` : ''}<input data-g="ev" data-i="${i}" data-f="3" value="${esc(txt)}" placeholder="Texto en el registro">${del('ev', i)}</div>`).join('');
  $('#edTg').innerHTML = edRows.tg.map(([k, a, b], i) => `<div class="edr"><select data-g="tg" data-i="${i}" data-f="0">${opt(Object.fromEntries(Object.entries(TGT).map(([x, t]) => [x, t.lab + (t.u ? ' (' + t.u + ')' : '')])), k)}</select><input data-g="tg" data-i="${i}" data-f="1" value="${esc(a)}" inputmode="decimal" aria-label="Mínimo" style="width:8ch"><input data-g="tg" data-i="${i}" data-f="2" value="${esc(b)}" inputmode="decimal" aria-label="Máximo" style="width:8ch">${del('tg', i)}</div>`).join('');
  const toks = checkTokens();
  $('#edCh').innerHTML = edRows.ch.map((t, i) => `<div class="edr"><select data-g="ch" data-i="${i}" data-f="0">${opt(toks, t)}</select>${del('ch', i)}</div>`).join('');
}
function numOr(v) { const s = String(v).trim().replace(',', '.'); return s !== '' && isFinite(+s) ? +s : String(v).trim(); }
function edCollect() {
  const c = { title: $('#edTitle').value.trim(), lvl: 'Mis casos', pheno: $('#edPheno').value, sex: $('#edSex').value, talla: +$('#edTalla').value || 175, goal: $('#edGoal').value.trim(), hint: $('#edHint').value.trim() || null };
  if ($('#edPeso').value) c.peso = +$('#edPeso').value; if ($('#edPed').checked) c.ped = true;
  const iface = $('#edIface').value; if (iface !== 'tube') c.iface = iface;
  if ($('#edAwake').checked) Object.assign(c, { sedE: 0, sedStopped: true, relCe: 0 });
  if ($('#edSpeed').value) c.speed = +$('#edSpeed').value; if ($('#edDur').value) c.duration = +$('#edDur').value; if ($('#edDev').value) c.dev = $('#edDev').value;
  for (const [k, v] of edRows.par) { if (v === '' || v == null) continue; const x = numOr(v); c[k] = BOOLK[k] ? !!(+x) : x; }
  c.cfg = {}; for (const [k, v] of edRows.cfg) { if (v === '' || v == null) continue; c.cfg[k] = k === 'mode' || k === 'o2dev' ? v : numOr(v); }
  if (UMODES[c.cfg.mode]) c.cfg.umode = c.cfg.mode;
  const ev = edRows.ev.filter(r => r[1] !== '').map(([k, at, alt, txt]) => k === 'alt' ? { at: +numOr(at), alt: +numOr(alt), txt } : Object.assign({ at: +numOr(at), k }, txt ? { txt } : {})); if (ev.length) c.events = ev;
  c.targets = {}; for (const [k, a, b] of edRows.tg) c.targets[k] = [+numOr(a), +numOr(b)];
  if (edRows.ch.length) { const toks = checkTokens(); c.checks = edRows.ch.map(t => [t, toks[t] || t]); }
  return c;
}
function edMsg(t, bad) { $('#edErr').textContent = t; $('#edErr').className = 'small ' + (bad ? 'err' : 'okm'); }
function edSave() {
  const c = sanitizeCase(edCollect()), err = validCase(c); if (err.length) { edMsg(err.join(' '), true); return null; }
  const cc = customCases(); let key = $('#edModal').dataset.key; if (!key || key === 'u_link') key = 'u_' + Date.now().toString(36);
  cc[key] = c; LS.set('simvmi.cases', cc); $('#edModal').dataset.key = key; installCustom(); edMsg('Guardado en «Mis casos» de este dispositivo.'); return key;
}
function b64e(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64d(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
function loadSharedFromHash() {
  const m = location.hash.match(/^#caso=([A-Za-z0-9_-]+)/); if (!m) return null;
  try { const c = sanitizeCase(JSON.parse(b64d(m[1]))), err = validCase(c); if (err.length) throw new Error(err.join(' ')); CASES.u_link = Object.assign(c, { lvl: 'Mis casos' }); installCustom(); setTimeout(() => toast('Caso compartido cargado. Guárdalo desde «Mis casos» si quieres conservarlo.'), 300); return 'u_link'; }
  catch (e) { setTimeout(() => toast('El enlace del caso no es válido.'), 300); return null; }
}

/* ---------- variantes: otro paciente y otra complicación a partir del caso abierto (variants.js) ---------- */
function newVariant() {
  const c = CASES[caseKey]; if (!c || !c.pheno || !window.SIM_VARIANT) return;
  const base = c.vbase && CASES[c.vbase] ? c.vbase : caseKey;
  const v = SIM_VARIANT.make(base, Math.floor(Math.random() * 1679616)); if (!v) { toast('Este caso no admite variantes.'); return; }
  v.speed = v.speed || GROUP_SPEED[v.vlvl] || 10;
  CASES.u_var = v; installCustom(); $('#caseSel').value = 'u_var'; loadCase('u_var');
  logIt(`Variante ${v.vcode} de «${CASES[base].title}»`); toast(`Variante ${v.vcode}: lee el planteamiento, ha cambiado el paciente.`);
}
function saveVariant() {
  const c = CASES[caseKey]; if (!c || !c.vbase) return;
  const cc = customCases(), key = 'u_v' + c.vcode.toLowerCase() + (c.vbase || '').slice(0, 6);
  cc[key] = sanitizeCase(Object.assign({}, c, { lvl: 'Mis casos' })); LS.set('simvmi.cases', cc); installCustom();
  toast(`Guardada en «Mis casos» como «${c.title}».`);
}
function linkVariant() {
  const c = CASES[caseKey]; if (!c || !c.vbase) return;
  const u = location.href.split('#')[0] + '#caso=' + b64e(JSON.stringify(sanitizeCase(c)));
  const show = () => { const x = $('#varUrl'); if (x) { x.value = u; x.hidden = false; x.focus(); x.select(); } toast('Copia el enlace del cuadro: quien lo abra carga esta misma variante.'); };
  (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast('Enlace copiado: quien lo abra carga esta misma variante.'), show);
}

/* ---------- vista móvil por pestañas y vista de proyector ---------- */
function setTab(t) { document.body.dataset.tab = t; $$('#tabbar button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === t ? 'true' : 'false')); LS.set('simvmi.tab', t); }
function tabAlerts() { const tb = $('#tabbar'); if (!tb || getComputedStyle(tb).display === 'none') return; const va = $('#alarm').className.includes('hi'), mo = !!document.querySelector('#zAl .hi, .zal.hi'); tb.querySelector('[data-tab="vent"]').classList.toggle('al', va); tb.querySelector('[data-tab="mon"]').classList.toggle('al', mo || (S && S.arrest)); }

/* ---------- arranque de la docencia ---------- */
function teachInit() {
  hostLinkInit();
  $('#modeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setExam(b.dataset.x === '1'); });
  $('#stuName').value = student;
  $('#stuName').addEventListener('change', e => { student = e.target.value.trim().slice(0, 60); LS.set('simvmi.name', student); sendState(true); });
  $('#instrOpen').addEventListener('click', () => { const u = location.href.split('#')[0] + '#instructor'; const w = window.open(u, 'simvmi-instructor', 'width=1200,height=900'); if (!w) toast('El navegador bloqueó la ventana: abre esta misma dirección terminada en #instructor.'); });
  $('#instrLink').addEventListener('click', hostRemote);
  $('#linkClose').addEventListener('click', () => { $('#linkModal').hidden = true; });
  $('#histBtn').addEventListener('click', () => { renderHist(); $('#histModal').hidden = false; });
  $('#hiName').addEventListener('change', renderHist);
  $('#hiClose').addEventListener('click', () => { $('#histModal').hidden = true; });
  $('#hiCsv').addEventListener('click', () => { const h = LS.get('simvmi.hist', []); const rows = [['fecha', 'alumno', 'caso', 'modo', 'nota', 'minutos', 'partes'].join(';')].concat(h.map(a => [a.d, a.name || '', a.title, a.exam ? 'examen' : 'practica', String(a.score).replace('.', ','), String(a.min).replace('.', ','), (a.parts || []).map(p => p[0] + ' ' + p[1] + '%').join(' | ')].map(x => '"' + String(x).replace(/"/g, '""') + '"').join(';'))); download('historial-simulador.csv', '﻿' + rows.join('\n'), 'text/csv;charset=utf-8'); });
  let clr = 0; $('#hiClear').addEventListener('click', e => { if (Date.now() - clr > 4000) { clr = Date.now(); e.target.textContent = 'Pulsa otra vez para borrar'; setTimeout(() => { e.target.textContent = 'Borrar historial'; }, 4000); return; } LS.set('simvmi.hist', []); e.target.textContent = 'Borrar historial'; renderHist(); });
  $('#dbPdf').addEventListener('click', () => {
    if (dlNs) { // el visor no deja imprimir: se guarda el informe como página para abrir e imprimir a PDF
      const css = [...document.querySelectorAll('style')].map(x => x.textContent).join('\n'), sh = $('#debrief .sheet').cloneNode(true); sh.querySelectorAll('.inrow,button').forEach(x => x.remove());
      const nm = sh.querySelector('#dbName'); if (nm) nm.replaceWith(Object.assign(document.createElement('b'), { textContent: nm.value || 'Sin nombre' }));
      download('debrief-' + caseKey + '-' + new Date().toISOString().slice(0, 10) + '.html', '<!doctype html><html lang="es" data-theme="light"><head><meta charset="utf-8"><title>Debrief · ' + esc(CASES[caseKey].title) + '</title><style>' + css + '</style></head><body><main>' + sh.outerHTML + '</main><script>window.onload=()=>print()<\/script></body></html>', 'text/html');
      return;
    }
    document.body.classList.add('printing'); setTimeout(() => { window.print(); document.body.classList.remove('printing'); }, 50);
  });
  // editor
  $('#edBtn').addEventListener('click', () => edOpen(caseKey));
  $('#edFrom').addEventListener('change', e => edOpen(e.target.value || null));
  $('#edModal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.add) { const g = b.dataset.add; edRows[g].push(g === 'par' ? ['pco2', 40] : g === 'cfg' ? ['fio2', 50] : g === 'ev' ? ['disc', 5, '', ''] : g === 'tg' ? ['spo2', 94, 100] : 'drug:adr'); edRender(); return; }
    if (b.dataset.del) { edRows[b.dataset.del].splice(+b.dataset.i, 1); edRender(); return; }
    switch (b.id) {
      case 'edTry': { const c = sanitizeCase(edCollect()), err = validCase(c); if (err.length) { edMsg(err.join(' '), true); return; } CASES.u_try = Object.assign(c, { lvl: 'Mis casos', title: c.title + ' (prueba)' }); installCustom(); $('#edModal').hidden = true; $('#caseSel').value = 'u_try'; loadCase('u_try'); break; }
      case 'edSave': edSave(); break;
      case 'edSaveLoad': { const k = edSave(); if (k) { $('#edModal').hidden = true; $('#caseSel').value = k; loadCase(k); } break; }
      case 'edDel': { const k = $('#edModal').dataset.key; if (!k || !k.startsWith('u_')) { edMsg('Solo se pueden borrar los casos propios.', true); return; } const cc = customCases(); delete cc[k]; LS.set('simvmi.cases', cc); delete CASES[k]; installCustom(); $('#edModal').dataset.key = ''; edMsg('Caso borrado.'); if (caseKey === k) loadCase('libre'); break; }
      case 'edExport': { const c = sanitizeCase(edCollect()); download((c.title || 'caso').toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, '-').slice(0, 40) + '.json', JSON.stringify(c, null, 2), 'application/json'); break; }
      case 'edLink': { const c = sanitizeCase(edCollect()), err = validCase(c); if (err.length) { edMsg(err.join(' '), true); return; } const u = location.href.split('#')[0] + '#caso=' + b64e(JSON.stringify(c)); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => edMsg('Enlace copiado: quien lo abra carga este caso.'), () => { $('#edJson').value = u; $('#edJsonBox').open = true; edMsg('Copia el enlace del cuadro de abajo.'); }); break; }
      case 'edShowJson': $('#edJson').value = JSON.stringify(sanitizeCase(edCollect()), null, 2); break;
      case 'edApplyJson': { try { const c = sanitizeCase(JSON.parse($('#edJson').value)); const err = validCase(c); if (err.length) throw new Error(err.join(' ')); edFill(c, $('#edModal').dataset.key || null); edMsg('JSON aplicado al formulario.'); } catch (er) { edMsg('JSON no válido: ' + er.message, true); } break; }
      case 'edClose': $('#edModal').hidden = true; break;
    }
  });
  $('#edModal').addEventListener('change', e => { const x = e.target; if (x.dataset.g) { edRows[x.dataset.g][+x.dataset.i] = x.dataset.g === 'ch' ? x.value : Object.assign([], edRows[x.dataset.g][+x.dataset.i], { [+x.dataset.f]: x.value }); if (x.dataset.f === '0' && x.dataset.g !== 'ch') edRender(); } });
  $('#edImport').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { const c = sanitizeCase(JSON.parse(t)), err = validCase(c); if (err.length) throw new Error(err.join(' ')); edFill(c, null); edMsg('Caso importado: revisa y guarda.'); }).catch(er => edMsg('No se pudo importar: ' + er.message, true)); e.target.value = ''; });
  $('#edPheno').innerHTML = Object.entries(VMI.PHENO).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
  // móvil y proyector
  $('#tabbar').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) { setTab(b.dataset.tab); window.scrollTo(0, 0); } });
  setTab(LS.get('simvmi.tab', 'vent'));
  $('#projBtn').addEventListener('click', () => { const on = !document.body.classList.contains('proj'); document.body.classList.toggle('proj', on); $('#projBtn').setAttribute('aria-pressed', on ? 'true' : 'false'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ['#edModal', '#histModal', '#linkModal'].forEach(id => { $(id).hidden = true; }); });
  installCustom();
}
