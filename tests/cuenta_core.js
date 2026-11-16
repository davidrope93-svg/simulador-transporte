// Pruebas del núcleo de cuentas (src/cuenta.js) sin red: un Firestore falso en memoria con condiciones de versión.
// Mismo archivo en SVA Trainer y ECG en Ruta (tests/cuenta_core.js). Lo ejecuta tests/run.js; también vale solo: node tests/cuenta_core.js
const path = require('path');
const Cuenta = require(path.join(__dirname, '..', 'src', 'cuenta.js'));
let n = 0, fails = 0;
const ok = (name, cond, extra) => { n++; if (!cond) fails++; console.log((cond ? 'ok   ' : 'FALLA ') + name + (extra != null && !cond ? ' · ' + extra : '')); };
const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = p => b64u({ alg: 'none' }) + '.' + b64u(p) + '.x';
const mem = init => { const m = {}; for (const [k, v] of Object.entries(init || {})) m[k] = JSON.stringify(v); return { get: k => (k in m ? JSON.parse(m[k]) : null), set: (k, v) => { m[k] = JSON.stringify(v); }, del: k => { delete m[k]; } }; };
/* Firestore falso: GET, PATCH con updateMask y :commit con precondición; «hooks» para simular otro dispositivo o fallos */
function fakeFs() {
  const docs = new Map(); let clock = 1; const log = []; const hooks = { beforeCommit: null, fail: null };
  const ts = () => new Date(Date.UTC(2026, 10, 16, 12, 0, 0) + clock++).toISOString().replace('Z', '123Z');
  const res = (status, body) => ({ ok: status < 300, status, text: async () => body == null ? '' : JSON.stringify(body) });
  const rel = u => decodeURIComponent(u.split('/documents/')[1].split('?')[0]);
  async function fetch(url, opt) {
    opt = opt || {}; log.push([opt.method, url]);
    if (hooks.fail) { const f = hooks.fail; hooks.fail = null; if (f === 'net') throw new TypeError('Failed to fetch'); return res(f, { error: { code: f, message: 'Missing or insufficient permissions.', status: 'PERMISSION_DENIED' } }); }
    if (url.endsWith(':commit')) {
      if (hooks.beforeCommit) { const h = hooks.beforeCommit; hooks.beforeCommit = null; await h(); }
      const w = JSON.parse(opt.body).writes[0], p = w.update.name.split('/documents/')[1], cur = docs.get(p), pre = w.currentDocument || {};
      if ((pre.exists === false && cur) || (pre.updateTime && (!cur || cur.updateTime !== pre.updateTime))) return res(400, { error: { code: 400, message: 'the stored version does not match the required base version', status: 'FAILED_PRECONDITION' } });
      docs.set(p, { fields: w.update.fields, updateTime: ts() }); return res(200, { writeResults: [{}] });
    }
    const p = rel(url);
    if (opt.method === 'GET') { const d = docs.get(p); return d ? res(200, { name: 'x/documents/' + p, fields: d.fields, updateTime: d.updateTime }) : res(404, { error: { code: 404, status: 'NOT_FOUND' } }); }
    if (opt.method === 'PATCH') {
      const q = new URLSearchParams(url.split('?')[1] || ''), mask = q.getAll('updateMask.fieldPaths'), f = JSON.parse(opt.body).fields, cur = docs.get(p);
      const fields = mask.length ? Object.assign({}, cur ? cur.fields : {}, Object.fromEntries(mask.map(k => [k, f[k]]))) : f;
      docs.set(p, { fields, updateTime: ts() }); return res(200, {});
    }
    if (opt.method === 'DELETE') { docs.delete(p); return res(200, {}); }
    return res(400, {});
  }
  return { fetch, docs, log, hooks };
}
const session = over => Object.assign({ uid: 'u1', email: 'ana@ejemplo.com', name: 'Ana', idToken: jwt({ email: 'ana@ejemplo.com', email_verified: true, auth_time: Math.floor(Date.now() / 1000) }), exp: Date.now() + 3.6e6, refresh: 'r', verified: true, role: 'tester' }, over || {});
const adapter = local => ({ app: 'sva', collect: () => ({ items: local.items.slice() }), merge: (r, l) => ({ items: [...new Set([...(r ? r.items : []), ...l.items])].sort() }), apply: m => { local.items = m.items.slice(); }, summary: m => ({ n: m.items.length }) });

(async () => {
  // valores de Firestore
  const o = { a: 1, b: 2.5, c: 'texto «ñ»', d: null, e: [1, 'x', { f: true }], g: { h: [] }, i: false };
  ok('Valores de Firestore: ida y vuelta sin pérdidas', JSON.stringify(Cuenta.dec(Cuenta.enc(o))) === JSON.stringify(o));
  ok('… enteros como integerValue y decimales como doubleValue', Cuenta.enc(3).integerValue === '3' && Cuenta.enc(0.5).doubleValue === 0.5 && Cuenta.enc(NaN).nullValue === null);
  ok('Configuración: proyecto apps-docentes-sva y administrador', Cuenta.CFG.projectId === 'apps-docentes-sva' && Cuenta.CFG.admins.includes('davidrope93@gmail.com') && /^AIza/.test(Cuenta.CFG.apiKey));

  // estados de la sesión
  const st = s => Cuenta.createCore({ storage: mem(s ? { 'apps-sva.cuenta': s } : {}), emu: null, fetch: () => { throw new Error('sin red'); } }).state();
  ok('Estados: sin sesión, sin invitación, sin verificar y miembro', st(null) === 'out' && st(session({ role: null })) === 'notInvited' && st(session({ verified: false })) === 'unverified' && st(session()) === 'member');
  const adm = Cuenta.createCore({ storage: mem({ 'apps-sva.cuenta': session({ role: 'admin' }) }), emu: null, fetch: () => null });
  ok('Administrador solo con el correo verificado', adm.isAdmin() && !Cuenta.createCore({ storage: mem({ 'apps-sva.cuenta': session({ role: 'admin', verified: false }) }), emu: null }).isAdmin());

  // sincronización
  const F = fakeFs(), mk = () => Cuenta.createCore({ storage: mem({ 'apps-sva.cuenta': session() }), emu: null, fetch: F.fetch });
  const A = mk(), d1 = { items: ['a', 'b'] };
  let r = await A.sync(adapter(d1));
  const doc = F.docs.get('users/u1/apps/sva'), prof = F.docs.get('users/u1');
  ok('Primera sincronización: crea el documento con condición «no existe»', r.changed && doc && JSON.parse(doc.fields.data.stringValue).items.length === 2);
  ok('… y el perfil con el resumen de la app (solo sus campos)', prof && prof.fields.sva.mapValue.fields.n.integerValue === '2' && prof.fields.email.stringValue === 'ana@ejemplo.com' && !prof.fields.ecg);
  const commits = () => F.log.filter(x => x[1].endsWith(':commit')).length, c0 = commits();
  r = await A.sync(adapter(d1));
  ok('Sin cambios: no vuelve a escribir', !r.changed && commits() === c0);
  // otro dispositivo escribe entre la lectura y la escritura: se repite y no se pierde nada
  const B = mk(), d2 = { items: ['z'] };
  F.hooks.beforeCommit = async () => { const cur = F.docs.get('users/u1/apps/sva'); F.docs.set('users/u1/apps/sva', { fields: Object.assign({}, cur.fields, { data: { stringValue: JSON.stringify({ items: ['a', 'b', 'otro'] }) } }), updateTime: 'cambiado' }); };
  r = await B.sync(adapter(d2));
  ok('Escritura a la vez desde otro dispositivo: reintenta y une las dos', JSON.stringify(d2.items) === '["a","b","otro","z"]', d2.items);
  await A.sync(adapter(d1)); ok('… y el primero acaba con lo mismo', JSON.stringify(d1.items) === '["a","b","otro","z"]', d1.items);
  // errores
  F.hooks.fail = 'net'; let e = null; try { await A.sync(adapter(d1)); } catch (x) { e = x; }
  ok('Sin conexión: error NET con mensaje en castellano', e && e.code === 'NET' && /Sin conexión/.test(e.message));
  F.hooks.fail = 403; e = null; try { await A.sync(adapter(d1)); } catch (x) { e = x; }
  ok('Reglas que no dejan: PERMISSION_DENIED', e && e.code === 'PERMISSION_DENIED' && e.status === 403);
  e = null; try { await Cuenta.createCore({ storage: mem({ 'apps-sva.cuenta': session({ verified: false }) }), emu: null, fetch: F.fetch }).sync(adapter(d1)); } catch (x) { e = x; }
  ok('Sin verificar no intenta sincronizar', e && e.code === 'PERMISSION_DENIED');
  // borrar la cuenta exige haber entrado hace poco (y no borra nada si no)
  const old = Cuenta.createCore({ storage: mem({ 'apps-sva.cuenta': session({ idToken: jwt({ email: 'ana@ejemplo.com', email_verified: true, auth_time: 1000 }) }) }), emu: null, fetch: F.fetch });
  e = null; try { await old.deleteAccount(); } catch (x) { e = x; }
  ok('Borrar la cuenta con una sesión antigua: pide volver a entrar y no borra nada', e && e.code === 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN' && F.docs.has('users/u1/apps/sva'));
  // el nombre del token llega bien con tildes
  const T = Cuenta.createCore({ storage: mem(), emu: null, fetch: async (u) => ({ ok: true, status: 200, text: async () => JSON.stringify(u.includes('signInWithPassword') ? { localId: 'u9', idToken: jwt({ email: 'pe@x.es', email_verified: true, name: 'José Núñez' }), refreshToken: 'r', expiresIn: '3600' } : { name: 'x/documents/invites/pe@x.es', fields: { role: { stringValue: 'tester' } } }) }) });
  await T.signIn('PE@x.es', 'clave-123');
  ok('Entrar: correo en minúsculas, rol de la invitación y nombre con tildes del token', T.session.email === 'pe@x.es' && T.state() === 'member' && T.session.name === 'José Núñez', JSON.stringify(T.session.name));

  console.log(`\nNúcleo de cuentas: ${n - fails} de ${n} pruebas correctas`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
