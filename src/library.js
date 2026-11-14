/* ===== Biblioteca de casos (v1.1): buscador, filtros, caso aleatorio y marca de hechos con la mejor nota.
   Se inserta dentro de la interfaz, después del tutorial. Los filtros se recuerdan en este dispositivo. ===== */
const SCOPE = { t: 'Terrestre', h: 'HEMS', i: 'Interhospitalario' };
const DIFF = { 1: 'Básico', 2: 'Intermedio', 3: 'Avanzado' };
const PAT = { a: 'Adulto', p: 'Pediátrico', o: 'Obstétrico' };
const libScope = c => c.scope || (c.altitude != null || c.vlvl === 'VMI · HEMS' ? 'h' : 't');
const libPat = c => c.ped || (c.peso && c.peso < 40) ? 'p' : /gestante|parto|posparto|eclampsia/i.test((c.title || '') + ' ' + (c.goal || '')) ? 'o' : 'a';
const libKeys = () => Object.keys(CASES).filter(k => k !== 'libre' && k !== 'u_var' && k !== 'u_try' && CASES[k].pheno);
/* intentos del historial por caso: los de sus variantes cuentan para el caso original */
function libStats() {
  const st = {};
  for (const a of LS.get('simvmi.hist', [])) {
    for (const k of new Set([a.key, a.base].filter(Boolean))) { const s = st[k] || (st[k] = { n: 0, best: null, last: null }); s.n++; if (s.best == null || a.score > s.best) s.best = a.score; if (!s.last || a.d > s.last) s.last = a.d; }
  }
  return st;
}
let lib = Object.assign({ q: '', g: '', s: '', d: '', p: '', e: '' }, LS.get('simvmi.lib', {}), { v: false }); // «como variante» no se recuerda entre sesiones
function libFiltered(stats) {
  const words = norm(lib.q).split(/\s+/).filter(Boolean);
  return libKeys().filter(k => {
    const c = CASES[k], s = stats[k];
    if (lib.g && c.lvl !== lib.g) return false;
    if (lib.s && libScope(c) !== lib.s) return false;
    if (lib.d && String(c.diff || 2) !== lib.d) return false;
    if (lib.p && libPat(c) !== lib.p) return false;
    if (lib.e === 'new' && s) return false;
    if (lib.e === 'done' && !s) return false;
    if (lib.e === 'redo' && !(s && s.best < 6)) return false;
    if (!words.length) return true;
    const hay = norm([c.title, c.goal, c.teach, c.lvl, SCOPE[libScope(c)], PAT[libPat(c)], DIFF[c.diff || 2], libPat(c) === 'p' ? 'niño niña lactante pediatria' : ''].join(' '));
    return words.every(w => hay.includes(w));
  });
}
function libRender() {
  const stats = libStats(), list = libFiltered(stats), all = libKeys();
  const done = all.filter(k => stats[k]).length;
  $('#lbSum').textContent = `${all.length} casos · ${done} ${done === 1 ? 'hecho' : 'hechos'} · ${all.length - done} sin hacer`;
  const act = ['g', 's', 'd', 'p', 'e'].filter(f => lib[f]).length; $('#lbFs').textContent = act ? `Filtros (${act} ${act === 1 ? 'activo' : 'activos'})` : 'Filtros';
  $('#lbN').textContent = list.length === all.length ? 'Mostrando todos' : `${list.length} de ${all.length}`;
  const dots = d => '●'.repeat(d) + '○'.repeat(3 - d);
  $('#lbList').innerHTML = list.length ? list.map(k => {
    const c = CASES[k], s = stats[k], d = c.diff || 2;
    const badge = s ? `<span class="lbs ${s.best >= 8 ? 'ok' : s.best >= 6 ? 'mid' : 'low'}" title="Mejor nota y número de intentos">✓ ${fmt(s.best, 1)} · ${s.n} ${s.n > 1 ? 'intentos' : 'intento'}</span>` : '<span class="lbs new">sin hacer</span>';
    return `<button class="lbi${k === caseKey ? ' cur' : ''}" data-k="${esc(k)}"><span class="lbh"><b>${esc(c.title)}</b>${badge}</span><span class="lbm">${esc(c.lvl)} · ${SCOPE[libScope(c)]} · ${PAT[libPat(c)]} · <span title="${DIFF[d]}">${dots(d)}</span> ${DIFF[d]}</span><span class="lbd">${esc(c.teach || (c.goal || '').slice(0, 120))}</span></button>`;
  }).join('') : '<p class="small">Ningún caso cumple estos filtros. Quita alguno o cambia la búsqueda.</p>';
  $('#lbVar').checked = !!lib.v;
}
function libSave() { const { v, ...keep } = lib; LS.set('simvmi.lib', keep); }
function libOpen() {
  $('#lbG').innerHTML = '<option value="">Todos los grupos</option>' + GROUPS.filter(g => g !== 'Libre' && libKeys().some(k => CASES[k].lvl === g)).map(g => `<option>${esc(g)}</option>`).join('');
  for (const [id, f] of [['#lbQ', 'q'], ['#lbG', 'g'], ['#lbS', 's'], ['#lbD', 'd'], ['#lbP', 'p'], ['#lbE', 'e']]) $(id).value = lib[f] || '';
  if ($('#lbG').value !== (lib.g || '')) { lib.g = ''; $('#lbG').value = ''; }
  $('#lbF').open = !matchMedia('(max-width: 720px)').matches || ['g', 's', 'd', 'p', 'e'].some(f => lib[f]); // en el móvil, plegados salvo que haya alguno puesto
  libRender(); $('#libModal').hidden = false;
  const cur = $('#lbList .lbi.cur'); if (cur) cur.scrollIntoView({ block: 'nearest' });
  if (!matchMedia('(pointer: coarse)').matches) $('#lbQ').focus();
}
function libClose() { $('#libModal').hidden = true; $('#lbQ').blur(); }
function libLoad(k) {
  libClose(); if (!CASES[k]) return;
  $('#caseSel').value = k; loadCase(k);
  if (lib.v) newVariant();
}
function libRandom() {
  const stats = libStats(), list = libFiltered(stats); if (!list.length) { toast('Ningún caso cumple estos filtros.'); return; }
  const fresh = list.filter(k => !stats[k] && k !== caseKey), pool = fresh.length ? fresh : list.filter(k => k !== caseKey).length ? list.filter(k => k !== caseKey) : list;
  const k = pool[Math.floor(Math.random() * pool.length)];
  libLoad(k); toast(`Caso al azar: ${CASES[k].title}${lib.v ? ' (variante nueva)' : ''}`);
}
function libInit() {
  $('#libBtn').addEventListener('click', libOpen);
  $('#lbClose').addEventListener('click', libClose);
  $('#lbRand').addEventListener('click', libRandom);
  $('#lbClear').addEventListener('click', () => { lib = Object.assign(lib, { q: '', g: '', s: '', d: '', p: '', e: '' }); libSave(); libOpen(); });
  $('#lbVar').addEventListener('change', e => { lib.v = e.target.checked; libSave(); });
  for (const [id, f] of [['#lbG', 'g'], ['#lbS', 's'], ['#lbD', 'd'], ['#lbP', 'p'], ['#lbE', 'e']]) $(id).addEventListener('change', e => { lib[f] = e.target.value; libSave(); libRender(); });
  $('#lbQ').addEventListener('input', e => { lib.q = e.target.value; libSave(); libRender(); });
  $('#lbQ').addEventListener('keydown', e => { if (e.key === 'Enter') { const b = $('#lbList .lbi'); if (b) libLoad(b.dataset.k); } });
  $('#lbList').addEventListener('click', e => { const b = e.target.closest('.lbi'); if (b) libLoad(b.dataset.k); });
  $('#libModal').addEventListener('click', e => { if (e.target.id === 'libModal') libClose(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#libModal').hidden) libClose(); });
}

/* ===== Itinerarios (v1.26): rutas para residente, enfermería y HEMS con etapas, progresión y nota ===== */
const PATHS = window.SIM_PATHS || {}, pathProg = window.SIM_PATHPROG;
let pathSel = LS.get('simvmi.path', 'residente'); if (!PATHS[pathSel]) pathSel = Object.keys(PATHS)[0];
const pathOf = pk => pathProg(pk, LS.get('simvmi.hist', []), student);
const scoreBadge = (b, pass) => b == null ? '<span class="lbs new">sin hacer</span>' : `<span class="lbs ${b >= pass ? 'ok' : b >= 5 ? 'mid' : 'low'}">${b >= pass ? '✓ ' : ''}${fmt(b, 1)}</span>`;
function pathRender() {
  const P = PATHS[pathSel], pr = pathOf(pathSel);
  $('#ptWho').textContent = (student ? 'Alumno: ' + student : 'Sin nombre: escribe el tuyo en «Alumno» para llevar tu progreso') + ' · guardado en este dispositivo';
  $('#ptTabs').innerHTML = Object.entries(PATHS).map(([k, p]) => { const g = pathOf(k); return `<button class="ptc${k === pathSel ? ' on' : ''}" data-p="${k}" aria-pressed="${k === pathSel}"><b>${esc(p.t)}</b><span class="ptbar"><span style="width:${g.pct}%"></span></span><span class="small">${g.finished ? 'Superado' : g.pct + ' %'}${g.avg != null ? ' · media ' + fmt(g.avg, 1) : ''}</span></button>`; }).join('');
  const head = `<div class="ptsum"><p>${esc(P.who)}</p><p class="small">Progreso <b>${pr.pct} %</b> (${pr.done} de ${pr.tot} casos necesarios)${pr.avg != null ? ` · media de lo hecho <b>${fmt(pr.avg, 1)}</b>` : ''}${pr.examAvg != null ? ` · evaluación final <b>${fmt(pr.examAvg, 1)}</b>` : ''} · un caso cuenta con nota ≥ ${P.pass} (también sus variantes).</p>${pr.finished ? '<p class="ptok">Itinerario superado. Descarga el informe para tu portafolio.</p>' : ''}</div>`;
  $('#ptBody').innerHTML = head + pr.stages.map(s => {
    const state = s.passed ? '<span class="lbs ok">superada</span>' : s.open ? '<span class="lbs mid">en curso</span>' : '<span class="lbs new">bloqueada</span>';
    return `<section class="ptst${s.open ? '' : ' lock'}"><h4>Etapa ${s.i + 1} · ${esc(s.t)} ${state}</h4><p class="small">${s.ok} de ${s.need} superados${s.exam ? ' · en modo examen y con una variante nueva: el paciente cambia en cada intento' : ''}${s.open ? '' : ' · se abre al superar la etapa anterior'}</p>
      ${s.cases.map(c => { const x = CASES[c.k]; return `<button class="lbi${c.k === pr.next && s.i === pr.cur ? ' cur' : ''}" data-k="${esc(c.k)}" data-ex="${s.exam ? 1 : 0}"${s.open ? '' : ' disabled'}><span class="lbh"><b>${esc(x.title)}</b>${scoreBadge(c.best, P.pass)}</span><span class="lbd">${esc(x.teach || '')}</span></button>`; }).join('')}</section>`;
  }).join('');
  $('#ptNext').disabled = !pr.next; $('#ptNext').textContent = pr.next ? (pr.nextExam ? 'Siguiente examen' : 'Continuar') + ': ' + CASES[pr.next].title : pr.finished ? 'Itinerario superado' : 'Continuar';
}
function pathOpen() { pathRender(); $('#pathModal').hidden = false; const cur = $('#ptBody .lbi.cur'); if (cur) cur.scrollIntoView({ block: 'center' }); }
function pathLaunch(k, ex) {
  $('#pathModal').hidden = true; if (!CASES[k]) return;
  LS.set('simvmi.path', pathSel);
  if (ex) { setExam(true, true); loadVariant(k, Math.floor(Math.random() * 1679616)); } else { $('#caseSel').value = k; loadCase(k); }
  const pr = pathOf(pathSel), st = pr.stages.find(s => s.cases.some(c => c.k === k) && (s.exam === !!ex));
  toast(`Itinerario ${PATHS[pathSel].t}${st ? ' · etapa ' + (st.i + 1) + ': ' + st.t : ''}${ex ? ' · examen' : ''}`);
}
/* bloque del debrief: cómo va el itinerario activo y el siguiente caso */
function pathDebrief(c) {
  const pk = LS.get('simvmi.path', null), P = PATHS[pk]; if (!P) return;
  const key = c.vbase || caseKey; if (!P.stages.some(s => s.k.includes(key))) return;
  const pr = pathOf(pk), st = pr.cur != null ? pr.stages[pr.cur] : null;
  const html = `<div class="ptdb"><b>Itinerario ${esc(P.t)}</b> · progreso ${pr.pct} %${st ? ` · etapa ${st.i + 1} de ${pr.stages.length} (${esc(st.t)}): ${st.ok} de ${st.need}` : ' · superado'}<br><span class="small">${(() => { const b = pr.stages.flatMap(s => s.cases).filter(x => x.k === key).map(x => x.best).filter(x => x != null); const m = b.length ? Math.max(...b) : null; const mn = window.SIM_PATHMIN ? SIM_PATHMIN(key) : 0; if (S.clin < mn) return `Intento demasiado corto para el itinerario: cuenta a partir de ${fmt(mn, 1)} min de caso.`; return m != null && m >= P.pass ? 'Este caso ya cuenta como superado.' : `Para que cuente necesitas una nota ≥ ${P.pass}.`; })()}</span>${pr.next ? `<div class="inrow"><button class="btn primary" id="dbPathNext" data-k="${esc(pr.next)}" data-ex="${pr.nextExam ? 1 : 0}">Siguiente del itinerario: ${esc(CASES[pr.next].title)}</button><button class="btn" id="dbPathOpen">Ver el itinerario</button></div>` : ''}</div>`;
  const t = $('#dbBody .dtable'); if (t) t.insertAdjacentHTML('afterend', html); else $('#dbBody').insertAdjacentHTML('afterbegin', html);
}
function pathSummary() { const pk = LS.get('simvmi.path', null); if (!PATHS[pk]) return null; const pr = pathOf(pk); return { t: PATHS[pk].t, pct: pr.pct, st: pr.cur != null ? pr.cur + 1 : null, n: pr.stages.length, done: pr.finished }; }
function pathReport() {
  const P = PATHS[pathSel], pr = pathOf(pathSel), d = new Date();
  const rows = pr.stages.map(s => `<h2>Etapa ${s.i + 1} · ${esc(s.t)}${s.exam ? ' (examen)' : ''} — ${s.passed ? 'superada' : s.open ? 'en curso' : 'bloqueada'} · ${s.ok}/${s.need}</h2><table class="dtable">${s.cases.map(c => `<tr><td>${esc(CASES[c.k].title)}<br><span class="small">${esc(CASES[c.k].teach || '')}</span></td><td class="n">${c.best == null ? '—' : fmt(c.best, 1)}${c.best != null && c.best >= P.pass ? ' ✓' : ''}</td></tr>`).join('')}</table>`).join('');
  const css = [...document.querySelectorAll('style')].map(x => x.textContent).join('\n');
  download('itinerario-' + pathSel + '-' + (student || 'alumno').toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, '-') + '-' + d.toISOString().slice(0, 10) + '.html',
    `<!doctype html><html lang="es" data-theme="light"><head><meta charset="utf-8"><title>Itinerario ${esc(P.t)} · ${esc(student || 'Alumno')}</title><style>${css}</style></head><body><main><div class="sheet" style="max-width:820px;margin:20px auto"><span class="eyebrow">Simulador docente · itinerario</span><h1 style="font-size:1.8rem">${esc(P.title)}</h1><p><b>${esc(student || 'Sin nombre')}</b> · ${d.toLocaleDateString('es-ES', { dateStyle: 'long' })}</p><p>Progreso <b>${pr.pct} %</b>${pr.avg != null ? ` · media de los casos <b>${fmt(pr.avg, 1)}</b>` : ''}${pr.examAvg != null ? ` · evaluación final <b>${fmt(pr.examAvg, 1)}</b>` : ''} · ${pr.finished ? '<b>itinerario superado</b>' : 'en curso'}</p><p class="small">${esc(P.who)} Un caso cuenta como superado con nota ≥ ${P.pass}; la evaluación final se hace en modo examen con variantes nuevas.</p>${rows}</div></main><script>window.onload=()=>print()<\/script></body></html>`, 'text/html');
}
function pathInit() {
  $('#pathBtn').addEventListener('click', pathOpen);
  $('#ptClose').addEventListener('click', () => { $('#pathModal').hidden = true; });
  $('#ptReport').addEventListener('click', pathReport);
  $('#ptNext').addEventListener('click', () => { const pr = pathOf(pathSel); if (pr.next) pathLaunch(pr.next, pr.nextExam); });
  $('#ptTabs').addEventListener('click', e => { const b = e.target.closest('.ptc'); if (b) { pathSel = b.dataset.p; LS.set('simvmi.path', pathSel); pathRender(); } });
  $('#ptBody').addEventListener('click', e => { const b = e.target.closest('.lbi'); if (b && !b.disabled) pathLaunch(b.dataset.k, b.dataset.ex === '1'); });
  $('#pathModal').addEventListener('click', e => { if (e.target.id === 'pathModal') $('#pathModal').hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#pathModal').hidden) $('#pathModal').hidden = true; });
  $('#dbBody').addEventListener('click', e => {
    const b = e.target.closest('#dbPathNext, #dbPathOpen'); if (!b) return;
    $('#debrief').hidden = true; paused = false; setPauseBtn();
    if (b.id === 'dbPathOpen') { pathSel = LS.get('simvmi.path', pathSel); pathOpen(); } else { pathSel = LS.get('simvmi.path', pathSel); pathLaunch(b.dataset.k, b.dataset.ex === '1'); }
  });
}
