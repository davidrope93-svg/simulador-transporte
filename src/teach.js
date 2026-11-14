/* ===== Docencia (v0.7): modo examen con nota, vista del instructor (otra ventana u otro dispositivo), debrief con línea de tiempo,
   PDF, historial por alumno, editor de casos y vista móvil. Se inserta dentro de la interfaz: comparte su estado. ===== */
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* almacenamiento no disponible */ } } };
const INSTR = /^#instructor/.test(location.hash);
const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
let exam = false, student = LS.get('simvmi.name', ''), lastReads = [], instrSeen = 0, stateAt = 0, lastSer = -1, toastT = 0;
let cmpTok = 0; // v1.27: turno del debrief comparado (se anula al cargar otro caso)
const CHECK_LAB = {};

/* ---------- registro de la serie y de lo que hace el alumno ---------- */
function teachOnLoad() { cmpTok++; track.logT = []; track.series = []; track.actsLog = []; track.used = new Set(); track.usedAt = {}; track.shockT = []; lastSer = -1; if (tut.on) tutStop(); lastAct = performance.now(); sendState(true); }
function teachOnSlow() {
  if (S.clin - lastSer >= .1) { lastSer = S.clin; track.series.push([+S.clin.toFixed(2), Math.round(S.spo2 * 1000) / 10, S.arrest ? null : Math.round(S.tas), M.et != null ? Math.round(M.et) : null, S.arrest ? null : Math.round(S.fc)]); if (track.series.length > 3000) track.series.shift(); }
}
const markUse = tok => { if (track && track.used) { track.used.add(tok); (track.usedAt = track.usedAt || {})[tok] = S.clin; } };

/* ---------- nota ---------- */
function checksOf(c) { return (c.checks || []).map(x => Array.isArray(x) ? x : [x, x]); }
function checkDone(tok) { return tok.split('|').some(t => (t.startsWith('no:') ? !track.used.has(t.slice(3)) : track.used.has(t)) || (t === 'rosc' && track.roscAt != null) || (t === 'stacked' && S.cpr.stacked) || (t === 'intub' && track.intubAt != null) || (t === 'noarrest' && !S.arrest && (track.arrestAt == null || track.roscAt != null))); }
function examScore() {
  const c = CASES[caseKey], parts = [];
  const tg = Object.values(track.t).filter(v => v.tot > 0);
  if (tg.length) parts.push({ lab: 'Tiempo en objetivo', v: tg.reduce((a, v) => a + v.inT / v.tot, 0) / tg.length, w: 4, det: `${tg.length} objetivo${tg.length > 1 ? 's' : ''}` });
  const ch = checksOf(c);
  if (ch.length) { const done = ch.filter(([t]) => checkDone(t)); parts.push({ lab: 'Acciones clave', v: done.length / ch.length, w: 3, det: ch.map(([t, l]) => (checkDone(t) ? '✓ ' : '✗ ') + l).join(' · ') }); }
  if (track.arrestAt != null) {
    const cp = S.cpr, ccf = cp.cprTime + cp.noFlow > 0 ? cp.cprTime / (cp.cprTime + cp.noFlow) : 0;
    let v = clamp(ccf / .8, 0, 1) * .5 + (track.roscAt != null || (c.noRosc && S.cpr.comp !== 'off') ? .35 : 0); // v1.15: en la hipotermia, el objetivo es llegar con RCP de calidad
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
  $('#dbBody').insertAdjacentHTML('afterbegin', head + tl + '<section id="dbCmp" class="cmp"><h2 style="margin-top:6px">Comparado con la referencia</h2><p class="small">Calculando la actuación de referencia…</p></section>');
  if (exam && c.hint) { const hs = [...$('#dbBody').querySelectorAll('h2')].find(h => h.textContent === 'Solución posible'); if (hs) { const p = hs.nextElementSibling; const d = document.createElement('details'); d.innerHTML = '<summary>Ver la solución posible</summary>'; d.appendChild(p.cloneNode(true)); hs.replaceWith(d); p.remove(); } }
  const att = { d: new Date().toISOString(), name: student || '', key: caseKey, base: c.vbase || null, title: c.title, exam, tut: !!track.tutorial, score: sc.total, parts: sc.parts.map(p => [p.lab, Math.round(p.v * 100)]), min: Math.round(S.clin * 10) / 10, reason: reason || '' };
  const hist = LS.get('simvmi.hist', []); hist.push(att); while (hist.length > 500) hist.shift(); LS.set('simvmi.hist', hist);
  const idx = hist.length - 1;
  $('#dbName').addEventListener('change', e => { student = e.target.value.trim().slice(0, 60); LS.set('simvmi.name', student); $('#stuName').value = student; const h = LS.get('simvmi.hist', []); if (h[idx] && h[idx].d === att.d) { h[idx].name = student; LS.set('simvmi.hist', h); } });
  pathDebrief(c); rvDebrief(); cmpStart(reason);
  linkSend({ t: 'debrief', sid: SID, key: caseKey, vcode: c.vcode || null, exam, min: Math.round(S.clin * 10) / 10, title: c.title, reason: reason || '', score: sc.total, parts: sc.parts.map(p => [p.lab, Math.round(p.v * 100), p.det]), name: student });
}

/* ---------- debrief comparado (v1.27): la misma situación jugada por el equipo de referencia (src/bot.js) ---------- */
const CMP_ACT = { explore: 'Exploración', glu: 'Glucemia capilar', temp: 'Temperatura', gas: 'Gasometría', ecg12: 'ECG de 12 derivaciones', eco: 'Ecografía clínica', bag: 'Ambú', intubate: 'Intubación', toMask: 'VMNI', toNasal: 'Alto flujo', compManual: 'Compresiones manuales', compMech: 'Compresor mecánico', check: 'Análisis del ritmo', apox: 'Oxigenación apneica', hemo: 'Hemostasia', warm: 'Calor activo', pads: 'Parches anteroposteriores' };
function cmpText(e) {
  const [, kind, a, b] = e, D = window.SIM_DRUGS || {};
  if (kind === 'drug') { const it = (D.DRUGITEMS || {})[a]; return it ? (it.act === 'fluid' ? (isPed() ? 'Cristaloide 10 mL/kg' : 'Cristaloide 500 mL') : it.act === 'blood' ? 'Concentrado de hematíes' : it.lab) : a; }
  if (kind === 'act') return ACTLAB[a] || CMP_ACT[a] || a;
  if (kind === 'perf') { const p = PERFS.find(x => x.id === a); return p ? `Perfusión de ${p.lab.toLowerCase()} ${b ? fmt(b, p.d) + ' ' + p.u : 'parada'}` : a; }
  if (kind === 'cfg') return a.map(([k, o, n]) => k === 'mode' ? `Modo ${n}` : k === 'o2dev' ? `O₂: ${O2LAB[n] || n}` : SPEC[k] ? `${SPEC[k].lab} ${o == null ? '' : fmt(o, SPEC[k].d) + ' → '}${fmt(n, SPEC[k].d)} ${SPEC[k].u}` : `${k} ${n}`).join(' · ');
  if (kind === 'shock') return `Descarga ${a} J${b ? ' sincronizada' : ''}`;
  if (kind === 'pace') return `Marcapasos ${a} lpm, ${b} mA`;
  if (kind === 'alt') return `Altitud de cabina ${Number(a).toLocaleString('es-ES')} m`;
  if (kind === 'event') return 'Evento: ' + (b || EVLAB[a] || a);
  return String(a);
}
/* nota de la referencia con las mismas partes que la del alumno */
function cmpScore(c, B, run, S2) {
  const parts = [], tg = c.targets || {}, keys = Object.keys(tg), R = run.R;
  const pct = keys.map(k => { const xs = run.SV.map(x => x.v[k]).filter(v => v != null && isFinite(v)).map(v => +(+v).toFixed(SIM_BOT.RND[k] || 0)); return xs.length ? xs.filter(v => v >= tg[k][0] && v <= tg[k][1]).length / xs.length : null; });
  const ok = pct.filter(x => x != null); if (ok.length) parts.push([4, ok.reduce((a, b) => a + b, 0) / ok.length]);
  const done = tok => tok.split('|').some(t => (t.startsWith('no:') ? !B.used.has(t.slice(3)) : B.used.has(t)) || (t === 'rosc' && R.roscAt != null) || (t === 'stacked' && S2.cpr.stacked) || (t === 'intub' && S2._intubAt != null) || (t === 'noarrest' && !S2.arrest && (R.arrestAt == null || R.roscAt != null)));
  const ch = checksOf(c); if (ch.length) parts.push([3, ch.filter(([t]) => done(t)).length / ch.length]);
  if (R.arrestAt != null) { const cp = S2.cpr, ccf = cp.cprTime + cp.noFlow > 0 ? cp.cprTime / (cp.cprTime + cp.noFlow) : 0, f = B.first.shock;
    parts.push([3, clamp(clamp(ccf / .8, 0, 1) * .5 + (R.roscAt != null || (c.noRosc && cp.comp !== 'off') ? .35 : 0) + (c.arrest === 'vf' || f != null ? (f != null && f - R.arrestAt <= 2 ? .15 : 0) : (B.used.has('drug:adr') ? .15 : 0)), 0, 1)]); }
  const minSp = Math.min(100, ...run.series.filter(x => x[2] != null).map(x => x[1])); let sec = 1;
  if (!c.arrest && R.arrestAt != null) sec -= .5; if (minSp < 85) sec -= minSp < 75 ? .4 : .25; parts.push([3, clamp(sec, 0, 1)]);
  return { total: Math.round(parts.reduce((a, p) => a + p[0] * p[1], 0) / parts.reduce((a, p) => a + p[0], 0) * 100) / 10, pct: Object.fromEntries(keys.map((k, i) => [k, pct[i]])), done };
}
function cmpSVG(a, b, T) {
  const Wd = 640, L = 44, Rr = 14, panels = [['SpO₂ %', 1, 50, 100, 'tl-sp'], ['TAS mmHg', 2, 40, 200, 'tl-ta'], ['EtCO₂ mmHg', 3, 0, 60, 'tl-et']].filter(p => a.concat(b).some(x => x[p[1]] != null));
  const ph = 64, gap = 16, H = panels.length * (ph + gap) + 14, X = t => L + clamp(t, 0, T) / T * (Wd - L - Rr);
  const step = T > 40 ? 10 : T > 12 ? 5 : T > 4 ? 2 : 1; let g = '';
  panels.forEach(([lab, i, lo, hi, cls], n) => { const y0 = n * (ph + gap) + 4, Y = v => y0 + ph - (clamp(v, lo, hi) - lo) / (hi - lo) * ph;
    const path = (ser) => { let d = '', pen = false; for (const s of ser) { if (s[0] > T + 1e-6) break; const v = s[i]; if (v == null) { pen = false; continue; } d += (pen ? 'L' : 'M') + X(s[0]).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; } return d; };
    g += `<rect x="${L}" y="${y0}" width="${Wd - L - Rr}" height="${ph}" class="tl-box"/><text x="${L + 4}" y="${y0 + 11}" class="tl-lab ${cls}">${lab}</text>` + [lo, hi].map(v => `<text x="${L - 4}" y="${Y(v) + 3}" text-anchor="end" class="tl-ax">${v}</text>`).join('');
    g += `<path d="${path(b)}" class="tl-l ${cls} cmp-ref"/><path d="${path(a)}" class="tl-l ${cls}"/>`; });
  for (let t = 0; t <= T + 1e-6; t += step) g += `<text x="${X(t)}" y="${H - 2}" text-anchor="middle" class="tl-ax">${t}</text>`;
  return `<svg viewBox="0 0 ${Wd} ${H}" class="tline" role="img" aria-label="Tu evolución frente a la de la referencia"><g>${g}</g></svg><p class="tl-leg"><span>━ tú</span><span>┅ referencia</span><span>minutos del caso</span></p>`;
}
function cmpStart() {
  const box = $('#dbCmp'); if (!box) return;
  const c = CASES[caseKey], base = c.vbase || caseKey, sol = window.SIM_SOL && SIM_SOL[base], msg = t => { box.innerHTML = '<h2 style="margin-top:6px">Comparado con la referencia</h2><p class="small">' + t + '</p>'; };
  if (!sol || !window.SIM_BOT || !refOpts || !c.pheno) { msg('Este caso no tiene actuación de referencia (casos propios y modo libre).'); return; }
  if (S.clin < 1) { msg('Simula al menos un minuto para poder compararte con la referencia.'); return; }
  const T = Math.max(1, Math.min(S.clin, (c.duration || 20) + 5)), tok = ++cmpTok;
  let sim2, S2, B, run;
  try { const o = JSON.parse(JSON.stringify(refOpts)); o.scale = 10; sim2 = VMI.create(o); sim2.warm(12); sim2.setRatio(refRatio); SIM_BOT.prep(sim2); S2 = sim2.S;
    const sched2 = (c.events || []).map(e => Object.assign({ fired: false }, e)), D = window.SIM_DRUGS;
    B = SIM_BOT.make({ sim: sim2, S: S2, sched: sched2, c, key: caseKey, sol, DR: D, peso: c.peso || Math.round(S2.ibw * 1.15), idle: false });
    run = SIM_BOT.runner({ sim: sim2, S: S2, sched: sched2 }, B, c.targets || {}); } catch (e) { msg('No se pudo preparar la referencia: ' + esc(e.message)); return; }
  const slice = () => {
    if (tok !== cmpTok || !$('#dbCmp')) return;
    const t0 = performance.now();
    try { while (S2.clin < T && performance.now() - t0 < 30) run.advance(Math.min(T, S2.clin + .25)); } catch (e) { msg('No se pudo calcular la referencia: ' + esc(e.message)); return; }
    if (S2.clin < T) { const p = box.querySelector('.small'); if (p) p.textContent = `Calculando la actuación de referencia… ${Math.round(S2.clin / T * 100)} %`; setTimeout(slice, 0); }
    else cmpRender(box, c, B, run, S2, T);
  };
  setTimeout(slice, 20);
}
function cmpRender(box, c, B, run, S2, T) {
  const mine = examScore(), ref = cmpScore(c, B, run, S2), R = run.R;
  const when = (tok, who) => { let best = null; for (const t of tok.split('|')) { const v = who === 'ref' ? (t === 'intub' ? S2._intubAt : t === 'rosc' ? R.roscAt : B.first[t]) : (t === 'intub' ? track.intubAt : t === 'rosc' ? track.roscAt : track.usedAt && track.usedAt[t]); if (v != null && (best == null || v < best)) best = v; } return best; };
  const mm = t => t == null ? '—' : 'min ' + fmt(t, 1);
  const ch = checksOf(c).map(([tok, lab]) => { const a = checkDone(tok), b = ref.done(tok), ta = a ? when(tok, 'me') : null, tb = b ? when(tok, 'ref') : null; return { lab, a, b, ta, tb }; });
  const tgs = Object.entries(c.targets || {}).map(([k, r]) => { const v = track.t[k], a = v && v.tot ? v.inT / v.tot * 100 : null, b = ref.pct[k] != null ? ref.pct[k] * 100 : null; return { k, lab: `${TGT[k].lab} ${rangeTxt(r, TGT[k])} ${TGT[k].fmt ? '' : TGT[k].u}`.trim(), a, b }; });
  /* lo que más cambia: acciones que faltan, retrasos y objetivos */
  const tips = [];
  ch.filter(x => !x.a && x.b).slice(0, 2).forEach(x => tips.push(`Te faltó «${esc(x.lab)}»: la referencia lo hizo en el ${mm(x.tb)}.`));
  ch.filter(x => x.a && x.b && x.ta != null && x.tb != null && x.ta - x.tb >= 2).sort((p, q) => (q.ta - q.tb) - (p.ta - p.tb)).slice(0, 2).forEach(x => tips.push(`«${esc(x.lab)}»: tú en el ${mm(x.ta)}, la referencia en el ${mm(x.tb)} (${fmt(x.ta - x.tb, 1)} min antes).`));
  tgs.filter(x => x.a != null && x.b != null && x.b - x.a >= 25).sort((p, q) => (q.b - q.a) - (p.b - p.a)).slice(0, 2).forEach(x => tips.push(`${esc(x.lab)} en objetivo: tú ${fmt(x.a)} %, la referencia ${fmt(x.b)} %.`));
  if (!tips.length) tips.push(mine.total >= ref.total - .5 ? 'Tu actuación está a la altura de la de referencia.' : 'Las diferencias están en los detalles: mira el minuto a minuto.');
  const myLog = (track.logT || []).filter(([, x]) => !/^Caso:|^Instructor conectado|^Llegada al hospital|^Velocidad/.test(x));
  const refLog = B.log.map(e => [e[0], cmpText(e)]);
  const rows = []; for (let m = 0; m <= Math.floor(T); m++) { const a = myLog.filter(([t]) => t >= m && t < m + 1), b = refLog.filter(([t]) => t >= m && t < m + 1); if (a.length || b.length) rows.push([m, a, b]); }
  const cell = xs => xs.length ? xs.map(([t, x]) => `<div><span class="small">${mmss(t)}</span> ${esc(x)}</div>`).join('') : '<span class="small">—</span>';
  box.innerHTML = `<h2 style="margin-top:6px">Comparado con la referencia</h2>
    <p class="small">La misma situación (mismo paciente, mismos eventos programados) jugada por el equipo de referencia durante ${fmt(T, 1)} min. Desde ahí, cada decisión cambia la evolución.</p>
    <div class="cmpsc"><span>Tu nota <b>${fmt(mine.total, 1)}</b></span><span>Referencia <b>${fmt(ref.total, 1)}</b></span></div>
    <ul class="cmptips">${tips.map(t => `<li>${t}</li>`).join('')}</ul>
    ${cmpSVG(track.series, run.series, T)}
    ${ch.length ? `<h3>Acciones clave</h3><table class="dtable"><tr><th>Acción</th><th class="n">Tú</th><th class="n">Referencia</th></tr>${ch.map(x => `<tr><td>${esc(x.lab)}</td><td class="n">${x.a ? '✓ ' + (x.ta != null ? mm(x.ta) : '') : '✗'}</td><td class="n">${x.b ? '✓ ' + (x.tb != null ? mm(x.tb) : '') : '✗'}</td></tr>`).join('')}</table>` : ''}
    ${tgs.length ? `<h3>Tiempo en objetivo</h3><table class="dtable"><tr><th>Objetivo</th><th class="n">Tú</th><th class="n">Referencia</th></tr>${tgs.map(x => `<tr><td>${esc(x.lab)}</td><td class="n">${x.a == null ? '—' : fmt(x.a) + ' %'}</td><td class="n">${x.b == null ? '—' : fmt(x.b) + ' %'}</td></tr>`).join('')}</table>` : ''}
    <details class="cmpmin"${rows.length <= 12 ? ' open' : ''}><summary>Minuto a minuto</summary><table class="dtable cmpt"><tr><th class="n">Min</th><th>Tú</th><th>Referencia</th></tr>${rows.map(([m, a, b]) => `<tr><td class="n">${m}</td><td>${cell(a)}</td><td>${cell(b)}</td></tr>`).join('')}</table></details>`;
}

/* ---------- modo examen ---------- */
function setExam(on, silent) {
  exam = !!on; document.body.classList.toggle('exam', exam); if (exam && tut.on) tutStop('Tutorial cerrado: modo examen');
  $$('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', (+b.dataset.x === 1) === exam ? 'true' : 'false'));
  if (!silent) { loadCase(caseKey); logIt(exam ? 'Modo examen: sin Lectura ni solución; nota al terminar' : 'Modo práctica'); }
  sendState(true);
}

/* ---------- enlace con el instructor: otra ventana (BroadcastChannel) u otro dispositivo (WebRTC con PeerJS) ----------
   v1.25 (Instructor 2.0): cada alumno tiene su identificador (SID) y las órdenes pueden ir a uno o a todos («to»);
   el instructor abre un aula con un código y los alumnos se unen; variantes, eventos programados y resultados de la clase */
const LINK = { bc: null, peer: null, conns: [], code: null };
const CODEABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', rid = n => Array.from({ length: n }, () => CODEABC[Math.floor(Math.random() * CODEABC.length)]).join('');
const SID = (() => { try { let x = sessionStorage.getItem('simvmi.sid'); if (!x) { x = rid(6); sessionStorage.setItem('simvmi.sid', x); } return x; } catch (e) { return rid(6); } })();
const forMe = to => to == null || to === '*' || to === SID || (Array.isArray(to) && to.includes(SID));
function linkSend(m) { try { if (LINK.bc) LINK.bc.postMessage(m); } catch (e) { /* canal cerrado */ } LINK.conns.forEach(c => { try { if (c.open) c.send(m); } catch (e) { /* conexión caída */ } }); }
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  const srcs = ['https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
  return srcs.reduce((pr, src) => pr.catch(() => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = () => window.Peer ? ok(window.Peer) : ko(); s.onerror = ko; document.head.appendChild(s); })), Promise.reject()).catch(() => { throw new Error('No se pudo cargar la librería de conexión (¿sin internet?)'); });
}
function hostMsg(m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hello' || m.t === 'ping') { const was = performance.now() - instrSeen < 8000; instrSeen = performance.now(); if (!was) logIt('Instructor conectado'); if (m.t === 'hello') sendState(true); $('#instrDot').hidden = false; return; }
  if (m.t !== 'cmd' || !forMe(m.to)) return;
  switch (m.c) {
    case 'event': if (EVLAB[m.k]) fireEvent(m.k, null, false); break;
    case 'eventAt': if (EVLAB[m.k] && sched) { const d = clamp(+m.in || 0, 0, 60); if (d > 0) { sched.push({ at: S.clin + d, k: m.k, txt: 'Instructor: ' + EVLAB[m.k], fired: false, instr: true }); } else fireEvent(m.k, null, false); } break;
    case 'schedFire': { const e = sched && sched[+m.i]; if (e && !e.fired) e.at = S.clin; break; }
    case 'schedCancel': { let n = 0; (sched || []).forEach(e => { if (!e.fired) { e.fired = true; e.cancel = true; n++; } }); if (n) logIt(`Instructor: ${n} evento${n > 1 ? 's' : ''} programado${n > 1 ? 's' : ''} cancelado${n > 1 ? 's' : ''}`); break; }
    case 'variant': if (CASES[m.k]) loadVariant(m.k, Number.isFinite(+m.seed) ? +m.seed : Math.floor(Math.random() * 1679616), true); break;
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
  linkSend({ t: 'state', sid: SID, key: caseKey, base: c.vbase || null, vcode: c.vcode || null, ended, title: c.title, lvl: c.lvl, clin: S.clin, scale, paused, exam, name: student,
    path: pathSummary(), sched: (sched || []).map((e, i) => ({ i, at: Math.round(e.at * 10) / 10, txt: e.txt || (e.alt != null ? 'Altitud ' + e.alt + ' m' : EVLAB[e.k] || e.k), fired: !!e.fired, cancel: !!e.cancel, instr: !!e.instr })),
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
  $('#linkCode').textContent = '·····'; $('#linkSt').textContent = 'Cargando la conexión…'; $('#linkModal').hidden = false; $('#linkOwn').open = true;
  loadPeer().then(Peer => {
    if (LINK.peer) { try { LINK.peer.destroy(); } catch (e) { /* ya cerrado */ } }
    const peer = new Peer('simvmi-' + code); LINK.peer = peer; LINK.code = code;
    peer.on('open', () => { $('#linkCode').textContent = code; $('#linkSt').textContent = 'Esperando al instructor: que abra «Vista del instructor», pulse «Conectar a otro dispositivo» y escriba este código.'; });
    peer.on('connection', conn => { LINK.conns.push(conn); conn.on('data', hostMsg); conn.on('open', () => { $('#linkSt').textContent = 'Instructor conectado.'; instrSeen = performance.now(); sendState(true); }); conn.on('close', () => { LINK.conns = LINK.conns.filter(x => x !== conn); logIt('Instructor desconectado'); }); });
    peer.on('error', e => { $('#linkSt').textContent = 'Error de conexión: ' + (e && e.type ? e.type : 'desconocido') + '. Prueba en la misma red o usa dos ventanas del mismo equipo.'; });
  }).catch(e => { $('#linkSt').textContent = e.message; });
}
function joinRoom(code) {
  code = String(code || '').trim().toUpperCase(); const st = t => { $('#linkSt').textContent = t; };
  if (!/^[A-Z0-9]{5}$/.test(code)) { st('El código del aula tiene 5 caracteres.'); return; }
  st('Conectando con el aula ' + code + '…');
  loadPeer().then(Peer => {
    const peer = new Peer(); LINK.room = peer;
    peer.on('open', () => { const conn = peer.connect('simvmi-aula-' + code, { reliable: true });
      conn.on('open', () => { LINK.conns.push(conn); instrSeen = performance.now(); conn.send({ t: 'join', sid: SID, name: student }); sendState(true); st('Conectado al aula ' + code + '. Puedes cerrar este cuadro.'); $('#instrDot').hidden = false; logIt('Unido al aula ' + code); });
      conn.on('data', hostMsg); conn.on('close', () => { LINK.conns = LINK.conns.filter(x => x !== conn); logIt('Desconectado del aula'); }); });
    peer.on('error', e => st('No se pudo entrar en el aula: ' + (e && e.type === 'peer-unavailable' ? 'código no encontrado (¿está abierta?)' : e && e.type ? e.type : 'error de conexión') + '.'));
  }).catch(e => st(e.message));
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 12000); }

/* ---------- vista del instructor (v1.25: varios alumnos, aula con código, variantes y eventos programados) ---------- */
function startInstructor() {
  document.body.classList.add('instr-mode');
  const box = $('#instr'); box.hidden = false;
  const caseOpts = GROUPS.map(g => `<optgroup label="${esc(g)}">` + Object.entries(CASES).filter(([, c]) => c.lvl === g).map(([k, c]) => `<option value="${k}">${esc(c.title)}</option>`).join('') + '</optgroup>').join('');
  box.innerHTML = `<header class="ihead"><div><span class="eyebrow">Simulador docente · vista del instructor</span><h1>Instructor</h1></div>
      <div class="inrow"><span class="chip" id="iConn">sin alumnos</span><button class="btn primary" id="iRoom">Abrir aula</button><span class="aulacode" id="iRoomCode" hidden></span><button class="btn sm" id="iRoomLink" hidden>Copiar enlace del aula</button></div></header>
    <p class="small" id="iHelp">En el mismo equipo (otras ventanas o pestañas del simulador) los alumnos se conectan solos. En otros dispositivos: pulsa «Abrir aula» y que cada alumno pulse «Enlazar instructor» y escriba el código (o abra el enlace del aula).</p>
    <details class="small"><summary>Conectar a un alumno que me da su código</summary><div class="inrow" style="margin-top:6px"><input id="iCode" maxlength="5" placeholder="código" autocomplete="off" style="width:7ch;text-transform:uppercase"><button class="btn" id="iJoin">Conectar</button></div></details>
    <section class="card"><div class="ihead"><h2>Alumnos</h2><div class="seg" id="iTo" role="group" aria-label="Enviar las órdenes a"><button data-to="sel" aria-pressed="true">Al seleccionado</button><button data-to="all" aria-pressed="false">A todos</button></div></div><div class="roster" id="iRoster"><p class="small">Esperando alumnos…</p></div></section>
    <div class="ibar card"><div class="field"><label for="iCase">Caso</label><select id="iCase">${caseOpts}</select></div>
      <button class="btn primary" data-i="load">Cargar caso</button><button class="btn" data-i="var" title="La misma variante (mismo paciente y complicación) para los destinatarios">Variante</button><button class="btn" data-i="varEach" id="iVarEach" title="Una variante distinta para cada alumno" hidden>Variante distinta para cada uno</button>
      <button class="btn" data-i="pause" id="iPause">Pausa</button>
      <div class="seg" id="iSpeed">${[1, 5, 10, 20].map(v => `<button data-s="${v}">×${v}</button>`).join('')}</div>
      <div class="seg" id="iExam"><button data-x="0">Práctica</button><button data-x="1">Examen</button></div><button class="btn" data-i="end">Terminar caso</button></div>
    <div class="igrid">
      <section class="card"><h2 id="iTitle">Sin datos</h2><p class="small" id="iSub">—</p><div class="ivit" id="iVit"></div><div class="targets" id="iTg"></div></section>
      <section class="card"><h2>Provocar</h2>
        <div class="inrow"><label class="small" for="iWhen">Cuándo</label><select id="iWhen"><option value="0">Ahora</option><option value="1">En 1 min</option><option value="2">En 2 min</option><option value="5">En 5 min</option><option value="10">En 10 min</option></select><span class="small">(minutos del caso)</span></div>
        <div class="abtns" id="iEv">${Object.entries(EVLAB).map(([k, l]) => `<button class="btn" data-ev="${k}">${l}</button>`).join('')}</div>
        <div class="inrow" style="margin-top:8px"><input id="iMsg" placeholder="Mensaje al alumno (p. ej. «el paciente refiere dolor torácico»)" style="flex:1;min-width:12ch"><button class="btn" id="iSend">Enviar</button></div>
        <div class="range"><label class="small" for="iAlt">Altitud de cabina</label><input type="range" id="iAlt" min="0" max="3000" step="100" value="0"><span class="num small" id="iAltV">0 m</span></div></section>
      <section class="card"><h2>Eventos programados</h2><div id="iSched"><p class="small">—</p></div><div class="inrow" style="margin-top:6px"><button class="btn sm" data-i="schedCancel">Cancelar los pendientes</button></div></section>
      <section class="card iwide"><h2>Evolución</h2><div id="iTl"></div></section>
      <section class="card"><h2>Lectura (el alumno no la ve en examen)</h2><div class="read" id="iRead"></div></section>
      <section class="card"><h2>Lo que pasa dentro</h2><dl class="truth" id="iTruth"></dl></section>
      <section class="card"><h2>Registro</h2><div class="log" id="iLog"></div></section>
      <section class="card iwide"><div class="ihead"><h2>Resultados de la clase</h2><button class="btn sm" id="iCsv" disabled>Exportar CSV</button></div><div id="iRes"><p class="small">Aún no ha terminado nadie.</p></div></section>
    </div>`;
  const studs = new Map(), results = []; let sel = null, toAll = false, room = null;
  const send = m => linkSend(m), alive = s => performance.now() - s.at < 6000;
  const targets = () => toAll ? [...studs.values()].filter(alive).map(s => s.st.sid) : sel ? [sel] : [];
  const cmd = (c, extra, to) => { const t = to || (toAll ? '*' : sel); if (!t) { $('#iConn').textContent = 'elige un alumno'; return; } send(Object.assign({ t: 'cmd', c, to: t }, extra || {})); };
  const nameOf = st => st.name || 'Alumno ' + st.sid;
  const onMsg = m => {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'state') { const sid = String(m.sid || 'local').slice(0, 12); m.sid = sid; studs.set(sid, { st: m, at: performance.now() }); if (!sel || !studs.has(sel)) sel = sid; renderRoster(); if (sid === sel) render(m); }
    if (m.t === 'debrief') { results.push({ sid: String(m.sid || 'local'), name: String(m.name || ''), title: String(m.title || ''), vcode: m.vcode || '', exam: !!m.exam, score: +m.score, min: +m.min || null, reason: String(m.reason || ''), parts: Array.isArray(m.parts) ? m.parts : [], at: new Date() }); renderRes(); }
  };
  try { LINK.bc = new BroadcastChannel('simvmi'); LINK.bc.onmessage = e => onMsg(e.data); } catch (e) { LINK.bc = null; }
  send({ t: 'hello' });
  setInterval(() => { send({ t: 'ping' }); const n = [...studs.values()].filter(alive).length; $('#iConn').textContent = n ? n + (n > 1 ? ' alumnos conectados' : ' alumno conectado') : 'sin alumnos'; $('#iConn').className = 'chip ' + (n ? 'ok' : 'off'); for (const [k, s] of studs) if (performance.now() - s.at > 120000) studs.delete(k); renderRoster(); }, 2000);
  const vit = (l, v, u, d) => `<div class="iv"><span>${l}</span><b>${v == null || !isFinite(v) ? '–' : fmt(v, d || 0)}</b><small>${u}</small></div>`;
  function renderRoster() {
    const list = [...studs.values()].sort((a, b) => nameOf(a.st).localeCompare(nameOf(b.st), 'es'));
    if (!list.length) { $('#iRoster').innerHTML = '<p class="small">Esperando alumnos…</p>'; return; }
    $('#iRoster').innerHTML = list.map(({ st: m, at }) => { const v = m.v || {}, off = performance.now() - at > 6000, tg = (m.tg || []).filter(x => x[1] != null), avg = tg.length ? Math.round(tg.reduce((a, x) => a + x[1], 0) / tg.length) : null, bad = (m.reads || []).filter(r => r[0] === 'bad').length;
      return `<button class="stu${m.sid === sel ? ' on' : ''}${off ? ' off' : ''}${v.arrest ? ' arr' : ''}" data-sid="${esc(m.sid)}" aria-pressed="${m.sid === sel}"><b>${esc(nameOf(m))}</b><span class="small">${esc(m.title)}${m.vcode && !String(m.title).includes(m.vcode) ? ' · ' + esc(m.vcode) : ''}</span>
        <span class="stv">SpO₂ ${v.spo2 == null ? '–' : fmt(v.spo2)} · TAS ${v.tas == null ? '–' : fmt(v.tas)} · FC ${v.fc == null ? '–' : fmt(v.fc)}</span>
        ${m.path ? `<span class="small">Itinerario ${esc(m.path.t)}: ${m.path.done ? 'superado' : m.path.pct + ' % · etapa ' + m.path.st + '/' + m.path.n}</span>` : ''}<span class="small">${off ? 'desconectado' : `min ${fmt(m.clin, 1)}${m.paused ? ' · pausa' : ''}${m.exam ? ' · examen' : ''}${m.ended ? ' · terminado' : ''}`}${avg != null ? ` · objetivos ${avg} %` : ''}${bad ? ` · ${bad} alerta${bad > 1 ? 's' : ''}` : ''}${v.arrest ? ' · PARADA' : ''}</span></button>`; }).join('');
  }
  function render(m) {
    $('#iTitle').textContent = nameOf(m) + ' · ' + m.title; $('#iSub').textContent = `${m.lvl}${m.vcode && !String(m.title).includes(m.vcode) ? ' · variante ' + m.vcode : ''} · ${m.dev} · ${m.mon} · ${m.iface} · ${m.mode} · min ${fmt(m.clin, 1)} · ×${m.scale}${m.paused ? ' · en pausa' : ''}${m.exam ? ' · examen' : ''}`;
    const v = m.v;
    $('#iVit').innerHTML = vit('SpO₂', v.spo2, '%') + vit('TAS real', v.tas, 'mmHg') + vit('PNI', v.pni, 'mmHg') + vit('FC', v.fc, 'lpm') + vit('EtCO₂', v.et, 'mmHg') + vit('FR', v.rr, 'rpm') + vit('GCS', v.gcs, '') + `<div class="iv wide"><span>Ritmo</span><b class="rt">${esc(v.rhy)}</b><small>${v.arrest ? (v.comp !== 'off' ? 'RCP en curso' : 'sin compresiones') : ''}</small></div>`;
    $('#iTg').innerHTML = m.tg.map(([l, p]) => `<span class="chip ${p == null ? '' : p >= 80 ? 'ok' : p < 50 ? 'off' : ''}">${esc(l)} ${p == null ? '–' : p + ' %'}</span>`).join('');
    $('#iRead').innerHTML = m.reads.map(([l, t, dd, f]) => `<div class="ri ${l}"><b>${esc(t)}</b><p>${esc(dd)}</p><p class="fix">→ ${esc(f)}</p></div>`).join('') || '<p class="small">—</p>';
    $('#iTruth').innerHTML = m.truth.map(([k, x]) => `<dt>${esc(k)}</dt><dd>${esc(x)}</dd>`).join('');
    $('#iLog').innerHTML = m.log.map(x => `<span>${esc(x)}</span>`).join('');
    $('#iSched').innerHTML = (m.sched || []).length ? `<table class="dtable">${m.sched.map(e => `<tr><td class="n">${fmt(e.at, 1)}′</td><td>${esc(e.txt)}</td><td class="n">${e.cancel ? '<span class="small">cancelado</span>' : e.fired ? '<span class="small">hecho</span>' : `<button class="btn sm" data-fire="${e.i}">Ya</button>`}</td></tr>`).join('')}</table>` : '<p class="small">Este caso no tiene eventos programados.</p>';
    $('#iTl').innerHTML = m.series.length > 2 ? timelineSVG(m.series.map(s => [s[0] - m.series[0][0], ...s.slice(1)]), [], [], { compact: true }) : '<p class="small">Aún no hay datos.</p>';
    $$('#iSpeed button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.s === m.scale ? 'true' : 'false'));
    $$('#iExam button').forEach(b => b.setAttribute('aria-pressed', (+b.dataset.x === 1) === m.exam ? 'true' : 'false'));
    $('#iPause').textContent = m.paused ? 'Seguir' : 'Pausa';
    if (document.activeElement !== $('#iCase')) $('#iCase').value = m.base && CASES[m.base] ? m.base : CASES[m.key] ? m.key : $('#iCase').value;
  }
  function renderRes() {
    $('#iCsv').disabled = !results.length;
    if (!results.length) { $('#iRes').innerHTML = '<p class="small">Aún no ha terminado nadie.</p>'; return; }
    $('#iRes').innerHTML = `<table class="dtable"><tr><th>Hora</th><th>Alumno</th><th>Caso</th><th>Modo</th><th class="n">Min</th><th class="n">Nota</th></tr>${results.slice().reverse().map(r => `<tr><td>${r.at.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td><td>${esc(r.name || 'Alumno ' + r.sid)}</td><td>${esc(r.title)}${r.vcode && !r.title.includes(r.vcode) ? ' · ' + esc(r.vcode) : ''}${r.reason ? '<br><span class="small">' + esc(r.reason) + '</span>' : ''}</td><td>${r.exam ? 'examen' : 'práctica'}</td><td class="n">${r.min == null ? '–' : fmt(r.min, 1)}</td><td class="n">${fmt(r.score, 1)}</td></tr>`).join('')}</table>`;
  }
  function openRoom() {
    const code = rid(5); $('#iRoomCode').hidden = false; $('#iRoomCode').textContent = '·····'; $('#iHelp').textContent = 'Abriendo el aula…';
    loadPeer().then(Peer => {
      if (room) { try { room.destroy(); } catch (e) { /* ya cerrada */ } }
      const peer = new Peer('simvmi-aula-' + code); room = peer;
      peer.on('open', () => { $('#iRoomCode').textContent = code; $('#iRoomLink').hidden = false; $('#iHelp').textContent = `Aula abierta: cada alumno pulsa «Enlazar instructor» y escribe ${code} (o abre el enlace del aula).`; });
      peer.on('connection', conn => { LINK.conns.push(conn); conn.on('data', onMsg); conn.on('open', () => conn.send({ t: 'hello' })); conn.on('close', () => { LINK.conns = LINK.conns.filter(x => x !== conn); }); });
      peer.on('error', e => { $('#iHelp').textContent = 'No se pudo abrir el aula: ' + (e && e.type === 'unavailable-id' ? 'código en uso, vuelve a pulsar' : e && e.type ? e.type : 'error de conexión') + '. En el mismo equipo, las ventanas se conectan sin aula.'; });
    }).catch(e => { $('#iHelp').textContent = e.message; });
  }
  box.addEventListener('click', e => {
    const st = e.target.closest('.stu'); if (st) { sel = st.dataset.sid; const s = studs.get(sel); renderRoster(); if (s) render(s.st); return; }
    const b = e.target.closest('button'); if (!b) return;
    const when = +$('#iWhen').value || 0;
    if (b.dataset.ev) cmd(when ? 'eventAt' : 'event', { k: b.dataset.ev, in: when });
    else if (b.dataset.fire != null) cmd('schedFire', { i: +b.dataset.fire }, sel);
    else if (b.dataset.to) { toAll = b.dataset.to === 'all'; $$('#iTo button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); $('#iVarEach').hidden = !toAll; }
    else if (b.dataset.i === 'load') cmd('load', { k: $('#iCase').value });
    else if (b.dataset.i === 'var') cmd('variant', { k: $('#iCase').value, seed: Math.floor(Math.random() * 1679616) });
    else if (b.dataset.i === 'varEach') targets().forEach(sid => cmd('variant', { k: $('#iCase').value, seed: Math.floor(Math.random() * 1679616) }, sid));
    else if (b.dataset.i === 'schedCancel') cmd('schedCancel', {}, sel);
    else if (b.dataset.i === 'pause') { const s = studs.get(sel); cmd('pause', { v: !(s && s.st.paused) }); }
    else if (b.dataset.i === 'end') cmd('end');
    else if (b.dataset.s) cmd('speed', { v: +b.dataset.s });
    else if (b.dataset.x != null && b.closest('#iExam')) cmd('exam', { v: b.dataset.x === '1' });
    else if (b.id === 'iSend') { const t = $('#iMsg').value.trim(); if (t) { cmd('msg', { txt: t }); $('#iMsg').value = ''; } }
    else if (b.id === 'iRoom') openRoom();
    else if (b.id === 'iRoomLink') { const u = location.href.split('#')[0] + '#aula=' + $('#iRoomCode').textContent; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => { $('#iHelp').textContent = 'Enlace copiado: ' + u; }, () => { $('#iHelp').textContent = 'Enlace del aula: ' + u; }); }
    else if (b.id === 'iCsv') { const rows = [['hora', 'alumno', 'caso', 'variante', 'modo', 'minutos', 'nota', 'motivo', 'partes'].join(';')].concat(results.map(r => [r.at.toISOString(), r.name || 'Alumno ' + r.sid, r.title, r.vcode, r.exam ? 'examen' : 'practica', r.min == null ? '' : String(r.min).replace('.', ','), String(Math.round(r.score * 10) / 10).replace('.', ','), r.reason, r.parts.map(p => p[0] + ' ' + p[1] + '%').join(' | ')].map(x => '"' + String(x).replace(/"/g, '""') + '"').join(';'))); download('resultados-clase-' + new Date().toISOString().slice(0, 10) + '.csv', '﻿' + rows.join('\n'), 'text/csv;charset=utf-8'); }
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
  bleed: 'Sangrado (fracción de volemia/min)', bleedSrc: 'Foco: ext, pelv, uter, int, thor (hemotórax), femur, dig (digestiva)', htx: 'Hemotórax inicial (L)', flail: 'Volet costal (0–1)', pain: 'Dolor (0–1)', burn: 'Superficie quemada (%)', na: 'Sodio (mmol/L)', edad: 'Edad en años (pediatría; 0,5 = 6 meses)', op: 'Organofosforado (0–1)', opRate: 'Absorción del organofosforado (/min)', cocaine: 'Cocaína (0–1)', drown: 'Ahogamiento: agua en el alveolo (0–1)', tca: 'Tricíclicos (0–1)', ecl: 'Eclampsia (1)', croup: 'Crup (0–1)', postRosc: 'Recién recuperado de una parada (1)', tamp: 'Taponamiento (0–1)', tampRate: 'Crecimiento del derrame (/min)', vaso: 'Vasoplejia séptica (0–1)', vasoRate: 'Progresión de la vasoplejia (/min)', neurog: 'Shock neurogénico (0–1)', fluidTol: 'Volumen que tolera el pulmón (mL/kg)', access: 'Vía venosa al empezar (1 sí, 0 no)', hco3Off: 'Cambio de bicarbonato (mmol/L)',
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
function loadVariant(key, seed, byInstr) {
  const c = CASES[key]; if (!c || !c.pheno || !window.SIM_VARIANT) return false;
  const base = c.vbase && CASES[c.vbase] ? c.vbase : key;
  const v = SIM_VARIANT.make(base, seed); if (!v) { toast('Este caso no admite variantes.'); return false; }
  v.speed = v.speed || GROUP_SPEED[v.vlvl] || 10;
  CASES.u_var = v; installCustom(); $('#caseSel').value = 'u_var'; loadCase('u_var');
  logIt(`${byInstr ? 'Instructor: v' : 'V'}ariante ${v.vcode} de «${CASES[base].title}»`); toast(`Variante ${v.vcode}: lee el planteamiento, ha cambiado el paciente.`);
  return true;
}
function newVariant() { loadVariant(caseKey, Math.floor(Math.random() * 1679616)); }
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
  $('#instrLink').addEventListener('click', () => { $('#linkModal').hidden = false; $('#linkSt').textContent = LINK.conns.some(c => c.open) ? 'Ya estás conectado con el instructor.' : '—'; setTimeout(() => $('#roomCode').focus(), 50); });
  $('#linkGen').addEventListener('click', hostRemote);
  $('#roomJoin').addEventListener('click', () => joinRoom($('#roomCode').value));
  $('#roomCode').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(e.target.value); });
  { const am = location.hash.match(/^#aula=([A-Za-z0-9]{5})$/); if (am) { $('#roomCode').value = am[1].toUpperCase(); $('#linkModal').hidden = false; setTimeout(() => joinRoom(am[1]), 400); } } // enlace del aula que comparte el instructor
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
