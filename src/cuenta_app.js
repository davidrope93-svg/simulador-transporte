/* ===== Cuenta (v1.32): el progreso en la nube con la cuenta de beta tester (núcleo común en src/cuenta.js) =====
   Se guardan los intentos (historial e itinerarios), el itinerario elegido, la valoración de revisión, los casos propios y,
   para quien coordina, las revisiones importadas. Con la cuenta iniciada, el alumno es el nombre de la cuenta.
   Fusión entre dispositivos: los intentos se unen (sin repetir; «Borrar historial» deja una marca de borrado); el resto,
   el cambio más reciente, salvo la revisión (se unen las valoraciones por caso) y los casos propios (se unen, con borrados). */
const ACCT_KEYS = ['simvmi.path', 'simvmi.review', 'simvmi.cases', 'simvmi.reviewsIn'];
let acct = null, acctDirty = false; // acctDirty: hay cambios sin subir
const lsRaw = LS.set;
const nowIsoA = () => new Date().toISOString();
/* marca la hora de cada cambio de lo que se sincroniza (con o sin cuenta: así la fusión sabe qué es más nuevo) */
LS.set = (k, v) => {
  if (ACCT_KEYS.includes(k) || k === 'simvmi.hist') {
    const st = LS.get('simvmi.stamps', {}), t = nowIsoA();
    if (k === 'simvmi.hist') { if (Array.isArray(v) && !v.length) st.histClear = t; }
    else st[k] = t;
    if (k === 'simvmi.cases') { const old = LS.get(k, {}), del = st.del || {}; for (const x of Object.keys(old || {})) if (!(v && v[x])) del[x] = t; for (const x of Object.keys(v || {})) delete del[x]; st.del = del; }
    lsRaw(k, v); lsRaw('simvmi.stamps', st);
    if (acct && acctSession()) { acctDirty = true; acct.touch(); }
    return;
  }
  lsRaw(k, v);
};
const acctSession = () => acct && acct.core.state() === 'member' ? acct.core.session : null;
const acctLocked = () => !!acctSession();
const acctName = () => { const s = acctSession(); return s ? (s.name || s.email.split('@')[0]) : ''; };
/* intentos de este dispositivo que son de la cuenta: sin nombre, con el nombre de la cuenta o con el que tenía al enlazarla */
const acctClaim = () => { const a = LS.get('simvmi.acct', null), s = acctSession(); return new Set(['', acctName()].concat(a && s && a.uid === s.uid ? [a.name] : [])); };
const histKey = a => a.d + '|' + a.key;
const SVA_ADAPTER = {
  app: 'sva',
  collect() {
    const cl = acctClaim(), st = LS.get('simvmi.stamps', {});
    return { hist: LS.get('simvmi.hist', []).filter(a => a && cl.has(a.name || '')).map(a => Object.assign({}, a, { name: '' })),
      values: Object.fromEntries(ACCT_KEYS.map(k => [k, LS.get(k, null)])), stamps: Object.fromEntries(ACCT_KEYS.map(k => [k, st[k] || ''])),
      clearedAt: st.histClear || '', del: st.del || {} };
  },
  merge(r, l) { return svaMerge(r, l); },
  apply(m, l) {
    const s = acctSession(); if (!s) return;
    const cl = acctClaim(), nm = acctName(), cur = LS.get('simvmi.hist', []), seen = new Set(m.hist.map(histKey));
    const others = cur.filter(a => !cl.has(a.name || ''));
    const late = cur.filter(a => cl.has(a.name || '') && !seen.has(histKey(a)) && (!m.clearedAt || a.d > m.clearedAt)); // terminados mientras se sincronizaba
    lsRaw('simvmi.hist', others.concat(m.hist, late).map(a => cl.has(a.name || '') ? Object.assign({}, a, { name: nm }) : a).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0).slice(-500));
    const st = LS.get('simvmi.stamps', {});
    for (const k of ACCT_KEYS) { if (m.values[k] != null) lsRaw(k, k === 'simvmi.cases' ? sanitizeCases(m.values[k]) : m.values[k]); st[k] = m.stamps[k] || st[k] || ''; }
    st.histClear = m.clearedAt || ''; st.del = m.del || {}; lsRaw('simvmi.stamps', st);
    lsRaw('simvmi.acct', { uid: s.uid, name: nm });
    /* refrescar lo que está a la vista */
    pathSel = LS.get('simvmi.path', pathSel); if (!PATHS[pathSel]) pathSel = Object.keys(PATHS)[0];
    rv = Object.assign({ name: '', role: '', lot: '', items: {}, general: '' }, LS.get('simvmi.review', {}));
    try { installCustom(); } catch (e) { /* casos propios no válidos: se ignoran */ }
    if (!$('#pathModal').hidden) pathRender(); if (!$('#revModal').hidden) { rvRender(); rvCoordRender(); }
    if (late.length) acct.touch();
  },
  summary(m) {
    const h = m.hist || [], sc = h.slice(-30).map(a => a.score).filter(x => isFinite(x)), r = m.values['simvmi.review'] || {};
    return { n: h.length, avg: sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length * 10) / 10 : null, last: h.length ? h[h.length - 1].d : null,
      paths: Object.fromEntries(Object.keys(PATHS).map(k => [k, pathProg(k, h, '').pct])), rv: Object.keys(r.items || {}).length, lot: r.lot || null };
  },
  pending() { return acctDirty; },
  onSession(s, kind, prev) {
    const box = $('#stuName');
    if (s) {
      const nm = s.name || s.email.split('@')[0], a = LS.get('simvmi.acct', null);
      if (kind === 'rename' && a && a.uid === s.uid && a.name !== nm) { lsRaw('simvmi.hist', LS.get('simvmi.hist', []).map(x => x.name === a.name ? Object.assign({}, x, { name: nm }) : x)); lsRaw('simvmi.acct', { uid: s.uid, name: nm }); }
      if (!a || a.uid !== s.uid) lsRaw('simvmi.acct', { uid: s.uid, name: student || '' }); // al enlazar: también se suman los intentos con el nombre que había escrito
      student = nm; lsRaw('simvmi.name', nm); box.value = nm; box.disabled = true; box.title = 'Con la cuenta iniciada, el alumno es el nombre de tu cuenta';
      if (!rv.name) { rv.name = nm; rvSave(); }
    } else {
      // al cerrar sesión, los intentos de la cuenta se quedan en el dispositivo, pero otra cuenta no los reclamará
      lsRaw('simvmi.acct', null); box.disabled = false; box.title = '';
      if (kind === 'out' || kind === 'deleted') { student = ''; lsRaw('simvmi.name', ''); box.value = ''; }
    }
    if (!$('#pathModal').hidden) pathRender();
  },
  adminDetail(d, u) {
    const E = Cuenta.esc, h = d.hist || [], r = d.values && d.values['simvmi.review'] || {};
    const paths = Object.entries(PATHS).map(([k, P]) => { const pr = pathProg(k, h, ''), st = pr.cur != null ? pr.stages[pr.cur] : null; return `<tr><td>${E(P.t)}</td><td>${pr.pct} %</td><td>${pr.finished ? 'superado' : st ? `etapa ${st.i + 1} de ${pr.stages.length} (${E(st.t)}): ${st.ok} de ${st.need}` : '—'}</td><td>${pr.avg != null ? fmt(pr.avg, 1) : '—'}</td></tr>`; }).join('');
    const rows = h.slice(-40).reverse().map(a => `<tr><td>${E(Cuenta.fdate(a.d))}</td><td>${E(a.title || a.key)}${a.base ? ' <span class="cta-sm">(variante)</span>' : ''}</td><td>${a.exam ? 'examen' : 'práctica'}${a.tut ? ', tutorial' : ''}</td><td>${fmt(a.score, 1)}</td><td>${fmt(a.min, 1)}</td></tr>`).join('');
    const its = Object.values(r.items || {});
    return `<p>${h.length} intentos${h.length ? ' · media ' + fmt(h.reduce((s, a) => s + (a.score || 0), 0) / h.length, 1) : ''}</p>
      <table class="cta-tbl"><tr><th>Itinerario</th><th>Progreso</th><th>Dónde va</th><th>Media</th></tr>${paths}</table>
      <p class="cta-sm" style="margin-top:10px">${its.length ? `Revisión: ${its.length} casos valorados${r.lot ? ' del lote ' + E(r.lot) : ''}${r.role ? ' · ' + E(r.role) : ''}. Tráelas a «Coordinación» con el botón de arriba.` : 'Sin valoraciones de revisión.'}</p>
      ${rows ? `<h4>Últimos intentos</h4><div class="cta-scroll"><table class="cta-tbl"><tr><th>Fecha</th><th>Caso</th><th>Modo</th><th>Nota</th><th>Min</th></tr>${rows}</table></div>` : ''}`;
  }
};
/* fusión (sin DOM ni estado: la prueban las pruebas del motor) */
function svaMerge(r, l) {
  r = r && r.v === 1 ? r : { hist: [], values: {}, stamps: {}, clearedAt: '', del: {} };
  const maxS = (a, b) => (a || '') > (b || '') ? a || '' : b || '';
  const clearedAt = maxS(r.clearedAt, l.clearedAt), m = new Map();
  for (const a of (r.hist || []).concat(l.hist || [])) if (a && a.d && a.key && (!clearedAt || a.d > clearedAt)) m.set(histKey(a), a);
  const hist = [...m.values()].sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0).slice(-500);
  const del = Object.assign({}, r.del || {}); for (const [k, t] of Object.entries(l.del || {})) del[k] = maxS(del[k], t);
  const values = {}, stamps = {}, rv = r.values || {}, rs = r.stamps || {};
  for (const k of ACCT_KEYS) {
    const a = rv[k], b = l.values[k], ta = rs[k] || '', tb = l.stamps[k] || '', newer = tb >= ta ? b : a, older = tb >= ta ? a : b;
    stamps[k] = maxS(ta, tb);
    if (k === 'simvmi.review') { // se unen las valoraciones por caso; el resto, lo más reciente o lo que no esté vacío
      const n = newer || {}, o = older || {}, items = Object.assign({}, o.items || {});
      for (const [c, it] of Object.entries(n.items || {})) if (!items[c] || (it.ts || '') >= (items[c].ts || '')) items[c] = it;
      values[k] = a == null && b == null ? null : { name: n.name || o.name || '', role: n.role || o.role || '', lot: n.lot != null && (n.lot || !o.lot) ? n.lot : o.lot || '', items, general: n.general || o.general || '' };
    } else if (k === 'simvmi.cases') { // se unen; los borrados (con su hora) no vuelven
      const out = Object.assign({}, older || {}, newer || {}); for (const c of Object.keys(out)) if (del[c] && del[c] >= stamps[k]) delete out[c];
      values[k] = a == null && b == null ? null : out;
    } else if (k === 'simvmi.reviewsIn' && (!ta || !tb)) { // sin hora en un lado: se unen por revisor y lote
      const out = (older || []).slice(); for (const R of newer || []) { const i = out.findIndex(x => x.reviewer && R.reviewer && x.reviewer.name === R.reviewer.name && x.lot === R.lot); if (i >= 0) out[i] = R; else out.push(R); }
      values[k] = a == null && b == null ? null : out;
    } else values[k] = newer != null ? newer : older != null ? older : null;
  }
  return { v: 1, hist, values, stamps, clearedAt, del };
}
function sanitizeCases(cc) { const out = {}; for (const [k, c] of Object.entries(cc || {})) if (/^u_[A-Za-z0-9_]+$/.test(k) && c && typeof c === 'object') out[k] = sanitizeCase(c); return out; }
/* coordinación: trae las valoraciones de revisión de todas las cuentas a la tabla consolidada */
async function acctPullReviews(c, core) {
  const cur = rvIn(); let n = 0, who = 0;
  for (const u of c.users) {
    const d = await core.admin.appData(u.id, 'sva').catch(() => null), r = d && d.values && d.values['simvmi.review'];
    if (!r || !r.items || !Object.keys(r.items).length) continue;
    who++; n += Object.keys(r.items).length;
    const R = { app: 'simulador-sva-hems', v: 'cuenta', at: nowIsoA(), reviewer: { name: r.name || u.fields.name || u.fields.email, role: r.role || '' }, lot: r.lot || '', general: r.general || '', items: r.items, uid: u.id };
    const i = cur.findIndex(x => (x.uid && x.uid === u.id) || (x.reviewer && x.reviewer.name === R.reviewer.name && x.lot === R.lot)); if (i >= 0) cur[i] = R; else cur.push(R);
  }
  LS.set('simvmi.reviewsIn', cur); rvCoordRender();
  return who ? `${n} valoraciones de ${who} beta tester${who > 1 ? 's' : ''} traídas a «Coordinación» (en Revisión).` : 'Nadie ha valorado casos todavía.';
}
function acctInit() {
  if (!window.Cuenta || INSTR) return;
  try {
    acct = Cuenta.createUI(Cuenta.createCore(), SVA_ADAPTER, { outLabel: 'Cuenta', what: 'Se guardan tus intentos e itinerarios, tu valoración de revisión y tus casos propios.', onSync: s => { if (s.st === 'ok') acctDirty = false; }, adminActions: [{ label: 'Traer las revisiones a «Coordinación»', run: acctPullReviews }] });
    acct.mountButton($('#acctBtn')); $('#acctBtn').hidden = false;
    acct.start();
  } catch (e) { acct = null; /* sin cuenta: la app sigue igual */ }
}
