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
