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
  $('#ptWho').textContent = (student ? 'Alumno: ' + student : 'Sin nombre: escribe el tuyo en «Alumno» para llevar tu progreso') + (acctLocked() ? ' · guardado en tu cuenta' : ' · guardado en este dispositivo (entra con tu cuenta para tenerlo en la nube)');
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
/* bloque del debrief: cómo va el itinerario activo y el siguiente caso; v1.31: si el intento no cuenta, dice por qué y propone repetirlo */
function pathDebrief(c, att) {
  const pk = LS.get('simvmi.path', null), P = PATHS[pk]; if (!P) return;
  const key = c.vbase || caseKey; if (!P.stages.some(s => s.k.includes(key))) return;
  const pr = pathOf(pk), st = pr.cur != null ? pr.stages[pr.cur] : null;
  const counts = att ? window.SIM_PATHCOUNTS(att) : true, mn = window.SIM_PATHMIN ? SIM_PATHMIN(key) : 0;
  const b = pr.stages.flatMap(s => s.cases).filter(x => x.k === key).map(x => x.best).filter(x => x != null), m = b.length ? Math.max(...b) : null;
  const why = !counts ? `<b>Este intento no cuenta para el itinerario:</b> terminaste en el min ${fmt(S.clin, 1)}. Cuenta a partir del min ${fmt(mn, 1)}${c.arrest && !c.noRosc ? ' o, en la parada, al terminar con RCE y todas las acciones clave indicadas hechas' : ''}.`
    : m != null && m >= P.pass ? 'Este caso ya cuenta como superado.' : `Para que cuente necesitas una nota ≥ ${P.pass}${att ? ` (esta vez, ${fmt(att.score, 1)})` : ''}.`;
  const again = pr.next === key, nextBtn = pr.next ? `<button class="btn primary" id="dbPathNext" data-k="${esc(pr.next)}" data-ex="${pr.nextExam ? 1 : 0}">${again ? 'Repetir' : 'Siguiente del itinerario'}: ${esc(CASES[pr.next].title)}</button>` : '';
  const html = `<div class="ptdb${counts ? '' : ' warn'}"><b>Itinerario ${esc(P.t)}</b> · progreso ${pr.pct} %${st ? ` · etapa ${st.i + 1} de ${pr.stages.length} (${esc(st.t)}): ${st.ok} de ${st.need}` : ' · superado'}<br><span class="small">${why}</span>${pr.next ? `<div class="inrow">${nextBtn}<button class="btn" id="dbPathOpen">Ver el itinerario</button></div>` : ''}</div>`;
  ($('#dbNext') || $('#dbBody')).insertAdjacentHTML('beforeend', html); // v1.33: bajo el resumen, junto a lo que hacer ahora
}
/* v1.31: «Terminar» antes de que el intento cuente para el itinerario activo: devuelve el aviso (null si ya cuenta o no aplica) */
function pathEndWarn() {
  const pk = LS.get('simvmi.path', null), P = PATHS[pk], c = CASES[caseKey]; if (INSTR || ended || !P || !c) return null;
  const key = c.vbase || caseKey; if (!P.stages.some(s => s.k.includes(key))) return null;
  const mn = SIM_PATHMIN(key); if (S.clin >= mn || attemptFull()) return null;
  return `Aún no cuenta para el itinerario: ${c.arrest && !c.noRosc ? `consigue la RCE con las acciones clave indicadas o sigue hasta el min ${fmt(mn, 1)}` : `sigue hasta el min ${fmt(mn, 1)}`} (vas por el ${fmt(S.clin, 1)}).`;
}
function pathSummary() { const pk = LS.get('simvmi.path', null); if (!PATHS[pk]) return null; const pr = pathOf(pk); return { t: PATHS[pk].t, pct: pr.pct, st: pr.cur != null ? pr.cur + 1 : null, n: pr.stages.length, done: pr.finished }; }
function pathReport() {
  const P = PATHS[pathSel], pr = pathOf(pathSel), d = new Date();
  const rows = pr.stages.map(s => `<h2>Etapa ${s.i + 1} · ${esc(s.t)}${s.exam ? ' (examen)' : ''} — ${s.passed ? 'superada' : s.open ? 'en curso' : 'bloqueada'} · ${s.ok}/${s.need}</h2><table class="dtable">${s.cases.map(c => `<tr><td>${esc(CASES[c.k].title)}<br><span class="small">${esc(CASES[c.k].teach || '')}</span></td><td class="n">${c.best == null ? '—' : fmt(c.best, 1)}${c.best != null && c.best >= P.pass ? ' ✓' : ''}</td></tr>`).join('')}</table>`).join('');
  const css = [...document.querySelectorAll('style')].map(x => x.textContent).join('\n');
  download('itinerario-' + pathSel + '-' + (student || 'alumno').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + d.toISOString().slice(0, 10) + '.html',
    `<!doctype html><html lang="es" data-theme="light"><head><meta charset="utf-8"><title>Itinerario ${esc(P.t)} · ${esc(student || 'Alumno')}</title><style>${css}</style></head><body><main><div class="sheet" style="max-width:820px;margin:20px auto"><span class="eyebrow">SVA Trainer · itinerario</span><h1 style="font-size:1.8rem">${esc(P.title)}</h1><p><b>${esc(student || 'Sin nombre')}</b> · ${d.toLocaleDateString('es-ES', { dateStyle: 'long' })}</p><p>Progreso <b>${pr.pct} %</b>${pr.avg != null ? ` · media de los casos <b>${fmt(pr.avg, 1)}</b>` : ''}${pr.examAvg != null ? ` · evaluación final <b>${fmt(pr.examAvg, 1)}</b>` : ''} · ${pr.finished ? '<b>itinerario superado</b>' : 'en curso'}</p><p class="small">${esc(P.who)} Un caso cuenta como superado con nota ≥ ${P.pass}; la evaluación final se hace en modo examen con variantes nuevas.</p>${rows}</div></main><script>window.onload=()=>print()<\/script></body></html>`, 'text/html');
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

/* ===== Revisión externa (v1.28): valoración de casos por compañeros y consolidado para quien coordina la 2.0 ===== */
const LOTS = window.SIM_LOTS || {};
const RV_CRIT = [['fid', 'Fidelidad clínica', 'manejo, dosis y objetivos correctos'], ['fis', 'Realismo fisiológico', 'el paciente responde como esperarías'], ['doc', 'Valor docente', 'enseña lo que tiene que enseñar'], ['dif', 'Dificultad adecuada', 'para el nivel que indica']];
const RV_FLAGS = [['dosis', 'Dosis o fármaco discutible'], ['obj', 'Objetivo o umbral discutible'], ['fisio', 'Respuesta fisiológica poco creíble'], ['texto', 'Texto confuso o errata'], ['sol', 'La solución de referencia no es la que yo haría'], ['tec', 'Fallo técnico']];
const RV_ROLES = ['Médico de SVA', 'Enfermería de SVA', 'Médico HEMS', 'Enfermería HEMS', 'Residente', 'Técnico (TES)', 'Otro'];
let rv = Object.assign({ name: '', role: '', lot: '', items: {}, general: '' }, LS.get('simvmi.review', {}));
const rvSave = () => LS.set('simvmi.review', rv);
const rvKey = () => { const c = CASES[caseKey]; return c && c.vbase ? c.vbase : caseKey; };
const rvMean = it => { const v = RV_CRIT.map(([k]) => it.r && it.r[k]).filter(x => x); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
function rvRender() {
  $('#rvName').value = rv.name; $('#rvRole').value = rv.role; $('#rvLotSel').value = rv.lot; $('#rvGeneral').value = rv.general || '';
  const lot = LOTS[rv.lot], keys = lot ? lot.k : [], done = keys.filter(k => rv.items[k]).length;
  $('#rvLot').innerHTML = (!rv.name || !Object.keys(rv.items).length ? '<p class="rvhint">Escribe tu nombre y tu perfil y pulsa un caso para jugarlo. Al terminar, lo valoras desde el debrief.</p>' : '') + (lot ? `<p class="small">Lote ${rv.lot} · ${esc(lot.t)} · ${done} de ${keys.length} valorados</p><div class="rvchips">${keys.map(k => `<button class="rvc${rv.items[k] ? ' ok' : ''}${k === rvKey() ? ' cur' : ''}" data-k="${esc(k)}">${rv.items[k] ? '✓ ' : ''}${esc(CASES[k].title)}</button>`).join('')}</div>` : '<p class="small">Sin lote: puedes valorar cualquier caso que abras. Si te han asignado un lote, elígelo arriba.</p>');
  const k = rvKey(), c = CASES[k], it = rv.items[k] || { r: {}, f: [], txt: '' };
  if (!c || !c.pheno) { $('#rvForm').innerHTML = '<p class="small">Abre un caso para valorarlo.</p>'; return; }
  $('#rvForm').innerHTML = `<h4>${esc(c.title)}${CASES[caseKey].vcode ? ' <span class="small">(valoras el caso original; estás en la variante ' + esc(CASES[caseKey].vcode) + ')</span>' : ''}</h4>
    ${RV_CRIT.map(([ck, l, d]) => `<div class="rvrow"><span><b>${l}</b><br><span class="small">${d}</span></span><div class="seg" role="radiogroup" aria-label="${l}">${[1, 2, 3, 4, 5].map(n => `<button data-c="${ck}" data-n="${n}" role="radio" aria-checked="${it.r[ck] === n}" aria-pressed="${it.r[ck] === n}">${n}</button>`).join('')}</div></div>`).join('')}
    <div class="rvflags">${RV_FLAGS.map(([fk, l]) => `<label class="small"><input type="checkbox" data-f="${fk}"${it.f.includes(fk) ? ' checked' : ''}> ${l}</label>`).join('')}</div>
    <textarea id="rvTxt" rows="3" placeholder="Qué cambiarías: dosis, umbrales, textos, cómo responde el paciente, lo que echas en falta…">${esc(it.txt || '')}</textarea>
    <div class="inrow"><button class="btn primary" id="rvSaveBtn">Guardar la valoración</button><span class="small" id="rvSaved">${it.ts ? 'Guardada ' + new Date(it.ts).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin guardar'}</span>${lot && keys.some(x => !rv.items[x] && x !== k) ? '<button class="btn" id="rvNext">Siguiente del lote</button>' : ''}</div>`;
}
/* al abrir un caso del lote: la primera vez, la visita guiada (pausa el caso) y después el aviso */
function rvPlay() { const t = () => toast('Juega el caso y, al terminar, valóralo desde el debrief o con «Revisión».');
  if (!LS.get('simvmi.tour', 0) && !INSTR) { tourAfter = t; setTimeout(tourStart, 400); } else t(); }
function rvOpen() { rvRender(); rvCoordRender(); $('#toast').hidden = true; $('#revModal').hidden = false; }
function rvCollect() {
  const k = rvKey(), c = CASES[k]; if (!c || !c.pheno) return null;
  const r = {}; $$('#rvForm [data-c][aria-pressed="true"]').forEach(b => { r[b.dataset.c] = +b.dataset.n; });
  return { k, it: { t: c.title, r, f: $$('#rvForm [data-f]').filter(x => x.checked).map(x => x.dataset.f), txt: $('#rvTxt').value.trim().slice(0, 2000), ts: new Date().toISOString() } };
}
function rvExportObj() { return { app: 'simulador-sva-hems', v: ($('.eyebrow') ? ($('.eyebrow').textContent.match(/v\d+\.\d+/) || [''])[0] : ''), at: new Date().toISOString(), reviewer: { name: rv.name, role: rv.role }, lot: rv.lot, general: rv.general, items: rv.items }; }
function rvSummary() {
  const its = Object.entries(rv.items), FL = Object.fromEntries(RV_FLAGS);
  return `Revisión del simulador SVA/HEMS · ${rv.name || 'sin nombre'}${rv.role ? ' (' + rv.role + ')' : ''}${rv.lot ? ' · lote ' + rv.lot : ''}\n${rv.general ? '\nGeneral: ' + rv.general + '\n' : ''}\n` +
    its.map(([, it]) => `• ${it.t}: ${RV_CRIT.map(([k, l]) => l.split(' ')[0] + ' ' + (it.r[k] || '–')).join(' · ')}${it.f.length ? ' · avisos: ' + it.f.map(f => FL[f]).join(', ') : ''}${it.txt ? '\n  ' + it.txt : ''}`).join('\n');
}
/* coordinador: importa los archivos de los revisores y consolida */
function rvIn() { return LS.get('simvmi.reviewsIn', []); }
function rvCoordRender() {
  const all = rvIn(), FL = Object.fromEntries(RV_FLAGS), agg = {};
  for (const R of all) for (const [k, it] of Object.entries(R.items || {})) { const a = agg[k] || (agg[k] = { t: it.t || (CASES[k] && CASES[k].title) || k, n: 0, s: {}, c: {}, f: {}, txt: [] }); a.n++;
    for (const [ck] of RV_CRIT) if (it.r && it.r[ck]) { a.s[ck] = (a.s[ck] || 0) + it.r[ck]; a.c[ck] = (a.c[ck] || 0) + 1; }
    for (const f of it.f || []) a.f[f] = (a.f[f] || 0) + 1; if (it.txt) a.txt.push([R.reviewer && R.reviewer.name || '¿?', it.txt]); }
  const rows = Object.entries(agg).map(([k, a]) => { const m = RV_CRIT.map(([ck]) => a.c[ck] ? a.s[ck] / a.c[ck] : null), ok = m.filter(x => x != null); return { k, a, m, low: ok.length ? Math.min(...ok) : 9 }; }).sort((x, y) => x.low - y.low);
  $('#rvInSum').textContent = all.length ? `${all.length} revisor${all.length > 1 ? 'es' : ''} (${all.map(R => (R.reviewer && R.reviewer.name) || '¿?').join(', ')}) · ${rows.length} casos valorados · primero los peor valorados` : 'Aún no has importado revisiones.';
  $('#rvInCsv').disabled = !all.length;
  $('#rvInBody').innerHTML = rows.length ? `<table class="dtable"><tr><th>Caso</th><th class="n">n</th>${RV_CRIT.map(([, l]) => `<th class="n">${l.split(' ')[0]}</th>`).join('')}<th>Avisos y comentarios</th></tr>${rows.map(({ a, m }) => `<tr><td>${esc(a.t)}</td><td class="n">${a.n}</td>${m.map(x => `<td class="n${x != null && x < 3 ? ' rvlow' : ''}">${x == null ? '–' : fmt(x, 1)}</td>`).join('')}<td>${Object.entries(a.f).map(([f, n]) => `<span class="lbs low">${esc(FL[f])} ×${n}</span>`).join(' ')}${a.txt.map(([nm, t]) => `<div class="small"><b>${esc(nm)}:</b> ${esc(t)}</div>`).join('')}</td></tr>`).join('')}</table>` : '';
}
function rvInit() {
  $('#revBtn').addEventListener('click', rvOpen);
  $('#rvClose').addEventListener('click', () => { $('#revModal').hidden = true; });
  $('#revModal').addEventListener('click', e => { if (e.target.id === 'revModal') $('#revModal').hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#revModal').hidden) $('#revModal').hidden = true; });
  $('#rvRole').innerHTML = '<option value="">Perfil</option>' + RV_ROLES.map(r => `<option>${r}</option>`).join('');
  $('#rvLotSel').innerHTML = '<option value="">Sin lote: cualquier caso</option>' + Object.entries(LOTS).map(([k, l]) => `<option value="${k}">Lote ${k} · ${esc(l.t)} (${l.k.length})</option>`).join('');
  $('#rvName').addEventListener('change', e => { rv.name = e.target.value.trim().slice(0, 60); rvSave(); if (!student && rv.name) { student = rv.name; LS.set('simvmi.name', student); $('#stuName').value = student; } });
  $('#rvRole').addEventListener('change', e => { rv.role = e.target.value; rvSave(); });
  $('#rvLotSel').addEventListener('change', e => { rv.lot = e.target.value; rvSave(); rvRender(); });
  $('#rvGeneral').addEventListener('change', e => { rv.general = e.target.value.trim().slice(0, 3000); rvSave(); });
  $('#revModal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.c) { $$(`#rvForm [data-c="${b.dataset.c}"]`).forEach(x => { const on = x === b; x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-checked', String(on)); }); return; }
    if (b.dataset.k) { $('#revModal').hidden = true; $('#caseSel').value = b.dataset.k; loadCase(b.dataset.k); rvPlay(); return; }
    if (b.id === 'rvSaveBtn') { const x = rvCollect(); if (!x) return; if (!Object.keys(x.it.r).length && !x.it.txt && !x.it.f.length) { $('#rvSaved').textContent = 'Marca al menos una puntuación o escribe un comentario.'; return; } rv.items[x.k] = x.it; rvSave(); rvRender(); $('#rvSaved').textContent = 'Guardada en este dispositivo. Cuando acabes, descarga tu revisión y envíala.'; return; }
    if (b.id === 'rvNext') { const lot = LOTS[rv.lot], k = lot && lot.k.find(x => !rv.items[x] && x !== rvKey()); if (k) { $('#revModal').hidden = true; $('#caseSel').value = k; loadCase(k); rvPlay(); } return; }
    if (b.id === 'rvExport') { if (!Object.keys(rv.items).length) { $('#rvMsg').textContent = 'Todavía no has valorado ningún caso.'; return; } download(`revision-simulador-${(rv.name || 'revisor').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}${rv.lot ? '-lote-' + rv.lot : ''}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(rvExportObj(), null, 2), 'application/json'); $('#rvMsg').textContent = 'Envía el archivo a quien coordina la revisión (correo o WhatsApp).'; return; }
    if (b.id === 'rvCopy') { const t = rvSummary(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { $('#rvMsg').textContent = 'Resumen copiado: pégalo en un correo o un mensaje.'; }, () => { $('#rvGeneral').value = t; $('#rvMsg').textContent = 'Copia el resumen del cuadro de comentario general.'; }); return; }
    if (b.id === 'rvInCsv') { const FL = Object.fromEntries(RV_FLAGS), rows = [['revisor', 'perfil', 'lote', 'caso', 'clave'].concat(RV_CRIT.map(([, l]) => l), ['avisos', 'comentario']).join(';')];
      for (const R of rvIn()) for (const [k, it] of Object.entries(R.items || {})) rows.push([(R.reviewer || {}).name || '', (R.reviewer || {}).role || '', R.lot || '', it.t || k, k].concat(RV_CRIT.map(([ck]) => (it.r || {})[ck] || ''), [(it.f || []).map(f => FL[f] || f).join(' | '), it.txt || '']).map(x => '"' + String(x).replace(/"/g, '""') + '"').join(';'));
      download('revisiones-consolidadas-' + new Date().toISOString().slice(0, 10) + '.csv', '﻿' + rows.join('\n'), 'text/csv;charset=utf-8'); return; }
    if (b.id === 'rvInClear') { if (b.dataset.armed) { LS.set('simvmi.reviewsIn', []); delete b.dataset.armed; b.textContent = 'Vaciar'; rvCoordRender(); } else { b.dataset.armed = '1'; b.textContent = 'Pulsa otra vez para vaciar'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Vaciar'; }, 4000); } return; }
  });
  $('#rvInFile').addEventListener('change', e => { const fs = [...e.target.files]; Promise.all(fs.map(f => f.text().then(t => JSON.parse(t)).catch(() => null))).then(list => {
    const ok = list.filter(R => R && R.items && typeof R.items === 'object'), cur = rvIn(); for (const R of ok) { const clean = JSON.parse(JSON.stringify(R)); const i = cur.findIndex(x => x.reviewer && clean.reviewer && x.reviewer.name === clean.reviewer.name && x.lot === clean.lot); if (i >= 0) cur[i] = clean; else cur.push(clean); }
    LS.set('simvmi.reviewsIn', cur); $('#rvInSum').textContent = `${ok.length} archivo${ok.length === 1 ? '' : 's'} importado${ok.length === 1 ? '' : 's'}${list.length > ok.length ? ` · ${list.length - ok.length} no válido${list.length - ok.length > 1 ? 's' : ''}` : ''}`; setTimeout(rvCoordRender, 800); }); e.target.value = ''; });
  const m = location.hash.match(/^#revision=([A-Za-z])$/); if (m && LOTS[m[1].toUpperCase()]) { rv.lot = m[1].toUpperCase(); rvSave(); setTimeout(() => { rvOpen(); }, 600); }
}
/* en el debrief del revisor: valorar el caso recién jugado */
function rvDebrief() { if (!rv.lot && !rv.name) return; const k = rvKey(), done = !!rv.items[k];
  const html = `<div class="ptdb"><b>Revisión</b> · ${done ? 'ya has valorado este caso; puedes cambiar la valoración' : 'valora este caso para la versión 2.0'}<div class="inrow"><button class="btn primary" id="dbRv">${done ? 'Ver mi valoración' : 'Valorar este caso'}</button></div></div>`;
  ($('#dbNext') || $('#dbBody')).insertAdjacentHTML('beforeend', html);
  $('#dbRv').addEventListener('click', () => { $('#debrief').hidden = true; paused = false; setPauseBtn(); rvOpen(); }); }
