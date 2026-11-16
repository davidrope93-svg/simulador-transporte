/* Cuentas (v1, 16/11/2026): común a SVA Trainer y ECG en Ruta. Es el mismo archivo en los dos repositorios (src/cuenta.js):
   si cambias uno, copia el otro. Firebase (proyecto «apps-docentes-sva») por su API REST, sin librerías:
   Authentication con correo y contraseña, y Firestore para el progreso.
   Solo entran los correos invitados por el administrador y con el correo verificado: lo imponen las reglas de Firestore
   (firebase/firestore.rules); aquí solo se refleja en la interfaz.
   Datos: invites/{correo} (nombre, rol), users/{uid} (nombre, correo y un resumen por app para el panel del administrador)
   y users/{uid}/apps/{app} (el progreso completo de cada app, en JSON). Cada app aporta su «adaptador»: qué guarda, cómo
   fusiona lo de este dispositivo con lo de la nube, cómo lo aplica y el resumen. Sin cuenta, las apps funcionan igual que antes. */
(function (root) {
'use strict';
const CFG = { apiKey: 'AIzaSyAMskjVwnXmal6RdXSMhaZgiNr8eWLO7a4', projectId: 'apps-docentes-sva', admins: ['davidrope93@gmail.com'],
  apps: { sva: { name: 'SVA Trainer', url: 'https://davidrope93-svg.github.io/simulador-transporte/' }, ecg: { name: 'ECG en Ruta', url: 'https://davidrope93-svg.github.io/ecg-desnudo/' } } };
const SKEY = 'apps-sva.cuenta'; // la sesión: en GitHub Pages las dos apps comparten origen, así que una sesión sirve para las dos
const VERSION = 1;

/* ---------- utilidades ---------- */
const nowIso = () => new Date().toISOString();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lower = s => String(s || '').trim().toLowerCase();
// cuerpo de un token de Firebase (JWT) en UTF-8: con atob a secas, «Pérez» llegaría como «PÃ©rez»
const jwt = t => { try { const b = atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')); return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0)))); } catch (e) { return {}; } };
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
const ERR = {
  EMAIL_EXISTS: 'Ya hay una cuenta con ese correo: entra con tu contraseña o recupérala.',
  INVALID_LOGIN_CREDENTIALS: 'Correo o contraseña incorrectos.', INVALID_PASSWORD: 'Correo o contraseña incorrectos.', EMAIL_NOT_FOUND: 'Correo o contraseña incorrectos.',
  INVALID_EMAIL: 'El correo no es válido.', MISSING_EMAIL: 'Escribe tu correo.', MISSING_PASSWORD: 'Escribe la contraseña.',
  WEAK_PASSWORD: 'La contraseña tiene que tener al menos 8 caracteres.', TOO_MANY_ATTEMPTS_TRY_LATER: 'Demasiados intentos seguidos: espera unos minutos.',
  USER_DISABLED: 'Esta cuenta está desactivada.', TOKEN_EXPIRED: 'Tu sesión ha caducado: vuelve a entrar.', INVALID_REFRESH_TOKEN: 'Tu sesión ha caducado: vuelve a entrar.',
  USER_NOT_FOUND: 'Esta cuenta ya no existe.', CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Por seguridad, cierra sesión y vuelve a entrar antes de borrar la cuenta.',
  INVALID_ID_TOKEN: 'Tu sesión ha caducado: vuelve a entrar.', EXPIRED_OOB_CODE: 'El enlace ha caducado: pide otro.', INVALID_OOB_CODE: 'El enlace no es válido: pide otro.',
  PERMISSION_DENIED: 'No tienes permiso: tu correo no está invitado o aún no está verificado.', NET: 'Sin conexión: se guardará al volver la cobertura.'
};
class CError extends Error { constructor(code, msg, status) { super(msg || ERR[code] || code); this.code = code; this.status = status; } }

/* valores de Firestore ⇄ JS */
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return !isFinite(v) ? { nullValue: null } : Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(enc) } : {} };
  if (typeof v === 'object') return { mapValue: { fields: encFields(v) } };
  return { nullValue: null };
}
const encFields = o => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined).map(([k, x]) => [k, enc(x)]));
function dec(v) {
  if (!v || 'nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  if ('mapValue' in v) return decFields(v.mapValue.fields || {});
  return null;
}
const decFields = f => Object.fromEntries(Object.entries(f || {}).map(([k, x]) => [k, dec(x)]));

/* ---------- núcleo: sesión, Auth y Firestore por REST (sin DOM: lo usan también las pruebas en Node) ---------- */
function createCore(o) {
  o = o || {};
  const store = o.storage || { get: k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }, del: k => { try { localStorage.removeItem(k); } catch (e) { /* nada */ } } };
  const F = o.fetch || ((...a) => fetch(...a));
  const emu = o.emu !== undefined ? o.emu : store.get('apps-sva.emu'); // solo para las pruebas con los emuladores de Firebase
  const key = o.apiKey || CFG.apiKey, pid = o.projectId || (emu ? 'demo-apps-docentes-sva' : CFG.projectId);
  const AUTH = emu ? emu.auth + '/identitytoolkit.googleapis.com/v1' : 'https://identitytoolkit.googleapis.com/v1';
  const TOKEN = emu ? emu.auth + '/securetoken.googleapis.com/v1' : 'https://securetoken.googleapis.com/v1';
  const FS = (emu ? emu.fs : 'https://firestore.googleapis.com') + '/v1/projects/' + pid + '/databases/(default)/documents/';
  let S = store.get(SKEY); // { uid, email, name, idToken, exp, refresh, verified, role }
  const listeners = new Set(), emit = () => listeners.forEach(f => { try { f(S); } catch (e) { /* nada */ } });
  const saveS = () => { if (S) store.set(SKEY, S); else store.del(SKEY); emit(); };

  async function call(url, opt) {
    let r; try { r = await F(url, opt); } catch (e) { throw new CError('NET'); }
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
    if (!r.ok) { const er = (j && j.error) || {}, m = String(er.message || er.status || r.status), code = m.split(/[ :]/)[0]; throw new CError(r.status === 403 ? 'PERMISSION_DENIED' : code, ERR[code] || (r.status === 403 ? ERR.PERMISSION_DENIED : 'Error del servidor (' + m + ').'), r.status); }
    return j;
  }
  const authCall = (ep, body) => call(AUTH + '/' + ep + '?key=' + key, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Firebase-Locale': 'es' }, body: JSON.stringify(body) });
  function setTokens(j, extra) {
    S = Object.assign({}, S || {}, { uid: j.localId || j.user_id || (S && S.uid), idToken: j.idToken || j.id_token, refresh: j.refreshToken || j.refresh_token, exp: Date.now() + 1000 * (+(j.expiresIn || j.expires_in) || 3600) - 60000 }, extra || {});
    // el token dice si el correo está verificado
    const p = jwt(S.idToken); if (p.email) { S.verified = !!p.email_verified; S.email = lower(p.email); } if (p.name && !S.name) S.name = p.name;
    saveS();
  }
  async function refresh() {
    if (!S || !S.refresh) throw new CError('TOKEN_EXPIRED');
    try {
      const j = await call(TOKEN + '/token?key=' + key, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(S.refresh) });
      setTokens(j);
    } catch (e) { if (e.code !== 'NET') { S = null; saveS(); } throw e; }
  }
  async function token(force) { if (!S) throw new CError('TOKEN_EXPIRED'); if (force || !S.idToken || Date.now() > S.exp) await refresh(); return S.idToken; }

  /* Firestore: ruta relativa a documents/ (users/abc/apps/sva) */
  async function fs(method, path, body, q) {
    const t = await token(), url = FS + path.split('/').map(encodeURIComponent).join('/') + (q ? '?' + q : '');
    return call(url, { method, headers: Object.assign({ Authorization: 'Bearer ' + t }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  }
  async function getDoc(path) { try { const d = await fs('GET', path); return { fields: decFields(d.fields), updateTime: d.updateTime, name: d.name }; } catch (e) { if (e.status === 404) return null; throw e; } }
  async function listDocs(coll) { const out = []; let page = ''; do { const j = await fs('GET', coll, null, 'pageSize=300' + (page ? '&pageToken=' + encodeURIComponent(page) : '')); for (const d of (j && j.documents) || []) out.push({ id: decodeURIComponent(d.name.split('/').pop()), fields: decFields(d.fields), updateTime: d.updateTime }); page = j && j.nextPageToken; } while (page); return out; }
  const putDoc = (path, obj, q) => fs('PATCH', path, { fields: encFields(obj) }, q);
  // escritura con condición de versión (en el cuerpo de :commit; la de la URL no la respeta el emulador)
  async function commitDoc(path, obj, pre) {
    const t = await token();
    return call(FS.slice(0, -1) + ':commit', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: [{ update: { name: 'projects/' + pid + '/databases/(default)/documents/' + path, fields: encFields(obj) }, currentDocument: pre }] }) });
  }
  const delDoc = path => fs('DELETE', path).catch(e => { if (e.status !== 404) throw e; });

  /* rol: invitación propia (o administrador por configuración) */
  async function checkRole() {
    if (!S) return null;
    const inv = await getDoc('invites/' + S.email);
    const role = inv ? (inv.fields.role === 'admin' ? 'admin' : 'tester') : CFG.admins.includes(S.email) ? 'admin' : null;
    S.role = role; if (inv && inv.fields.name && !S.name) S.name = inv.fields.name; saveS(); return role;
  }
  const state = () => !S ? 'out' : !S.role ? 'notInvited' : !S.verified ? 'unverified' : 'member';
  // correo de verificación o de contraseña nueva; con «continuar» a la app si su dominio está autorizado en Firebase (si no, sin él)
  async function oob(body) {
    const cu = continueUrl();
    if (cu) try { return await authCall('accounts:sendOobCode', Object.assign({ continueUrl: cu }, body)); } catch (e) { if (!/UNAUTHORIZED|CONTINUE_URI|DOMAIN/.test(e.code)) throw e; }
    return authCall('accounts:sendOobCode', body);
  }
  const continueUrl = () => { try { return /^https?:/.test(location.href) ? location.href.split('#')[0] : undefined; } catch (e) { return undefined; } };

  const core = {
    CFG, VERSION, enc, dec, encFields, decFields, CError,
    get session() { return S; }, state, isAdmin: () => !!(S && S.verified && S.role === 'admin'),
    on(f) { listeners.add(f); return () => listeners.delete(f); },
    async signUp(name, email, pass) {
      email = lower(email); name = String(name || '').trim().slice(0, 60);
      if (!name) throw new CError('NAME', 'Escribe tu nombre: es el que verá el administrador y el que sale en tus informes.');
      if (String(pass || '').length < 8) throw new CError('WEAK_PASSWORD');
      const j = await authCall('accounts:signUp', { email, password: pass, returnSecureToken: true });
      S = { email, name }; setTokens(j);
      const role = await checkRole().catch(() => null);
      if (!role) { await authCall('accounts:delete', { idToken: S.idToken }).catch(() => null); S = null; saveS(); throw new CError('NOT_INVITED', 'Ese correo no está invitado. Pide al administrador que te invite con este mismo correo.'); }
      await authCall('accounts:update', { idToken: S.idToken, displayName: name, returnSecureToken: true }).then(r => r && r.idToken && setTokens(r)).catch(() => null);
      await core.sendVerify().catch(() => null);
      return state();
    },
    async signIn(email, pass) {
      email = lower(email);
      const j = await authCall('accounts:signInWithPassword', { email, password: pass, returnSecureToken: true });
      S = { email, name: j.displayName || '' }; setTokens(j);
      await checkRole(); return state();
    },
    signOut() { S = null; saveS(); },
    sendVerify: async () => { await token(); return oob({ requestType: 'VERIFY_EMAIL', idToken: S.idToken }); },
    sendReset: email => oob({ requestType: 'PASSWORD_RESET', email: lower(email) }),
    async recheck() { await token(true); await checkRole(); return state(); },
    async rename(name) {
      name = String(name || '').trim().slice(0, 60); if (!name) throw new CError('NAME', 'Escribe un nombre.');
      const r = await authCall('accounts:update', { idToken: await token(), displayName: name, returnSecureToken: true }); if (r && r.idToken) setTokens(r);
      S.name = name; saveS(); await putDoc('users/' + S.uid, { email: S.email, name, updated: nowIso() }, 'updateMask.fieldPaths=email&updateMask.fieldPaths=name&updateMask.fieldPaths=updated').catch(() => null);
    },
    async deleteAccount() {
      // Firebase exige haber entrado hace poco para borrar la cuenta: se comprueba antes de borrar nada
      await token(); const at = jwt(S.idToken).auth_time || 0;
      if (Date.now() / 1000 - at > 240) throw new CError('CREDENTIAL_TOO_OLD_LOGIN_AGAIN');
      const uid = S.uid;
      for (const a of Object.keys(CFG.apps)) await delDoc('users/' + uid + '/apps/' + a);
      await delDoc('users/' + uid);
      await authCall('accounts:delete', { idToken: await token() });
      S = null; saveS();
    },
    token, getDoc, listDocs, putDoc, delDoc, checkRole,

    /* sincronización de una app: lee la nube, fusiona con este dispositivo, escribe con condición (si otro dispositivo
       escribió entretanto, repite) y aplica el resultado aquí. Devuelve { changed } */
    async sync(ad) {
      if (state() !== 'member') throw new CError('PERMISSION_DENIED');
      const path = 'users/' + S.uid + '/apps/' + ad.app, ctx = { uid: S.uid, email: S.email, name: S.name };
      for (let i = 0; i < 4; i++) {
        const doc = await getDoc(path);
        let remote = null; if (doc && typeof doc.fields.data === 'string') { try { remote = JSON.parse(doc.fields.data); } catch (e) { remote = null; } }
        const local = ad.collect(ctx), merged = ad.merge(remote, local, ctx), js = JSON.stringify(merged);
        if (js.length > 880000) throw new CError('BIG', 'Tu progreso ocupa demasiado para la nube.');
        const same = doc && doc.fields.data === js;
        if (!same) {
          try { await commitDoc(path, { data: js, updated: nowIso(), v: VERSION }, doc ? { updateTime: doc.updateTime } : { exists: false }); }
          catch (e) { if ([400, 409, 412].includes(e.status) && i < 3) { await sleep(300 + 400 * i); continue; } throw e; }
        }
        ad.apply(merged, local, ctx);
        const sum = Object.assign({ at: nowIso() }, ad.summary(merged, ctx)), sk = 'apps-sva.sum.' + ad.app + '.' + S.uid, prev = store.get(sk);
        const sumCore = JSON.stringify(Object.assign({}, sum, { at: null }));
        if (!same || prev !== sumCore || !S.profiled) {
          await putDoc('users/' + S.uid, { email: S.email, name: S.name || S.email, updated: nowIso(), [ad.app]: sum }, ['email', 'name', 'updated', ad.app].map(f => 'updateMask.fieldPaths=' + f).join('&'));
          store.set(sk, sumCore); S.profiled = true; saveS();
        }
        return { changed: !same };
      }
      throw new CError('BUSY', 'Otro dispositivo está guardando a la vez: se reintentará.');
    },

    /* administración (las reglas solo lo permiten al administrador) */
    admin: {
      invites: () => listDocs('invites'),
      users: () => listDocs('users'),
      appData: async (uid, app) => { const d = await getDoc('users/' + uid + '/apps/' + app); if (!d || typeof d.fields.data !== 'string') return null; try { return JSON.parse(d.fields.data); } catch (e) { return null; } },
      invite: (email, name, role) => { email = lower(email); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Promise.reject(new CError('INVALID_EMAIL')); return putDoc('invites/' + email, { name: String(name || '').trim().slice(0, 60), role: role === 'admin' ? 'admin' : 'tester', at: nowIso(), by: S.email }); },
      uninvite: email => delDoc('invites/' + lower(email))
    }
  };
  return core;
}

/* ---------- interfaz: botón de cuenta, ventana con entrar/crear/verificar/mi cuenta y panel del administrador ---------- */
const CSS = `.cta-back{position:fixed;inset:0;z-index:9000;background:#0008;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:max(16px,env(safe-area-inset-top)) 12px 24px}
.cta-card{color-scheme:inherit;background:var(--cta-bg,Canvas);color:var(--cta-ink,CanvasText);border-radius:14px;max-width:560px;width:100%;padding:18px 18px 16px;box-shadow:0 10px 40px #0006;font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
.cta-card.wide{max-width:980px}
.cta-card h3{margin:0 0 4px;font-size:19px}.cta-card h4{margin:14px 0 6px;font-size:15px}
.cta-card p{margin:6px 0}.cta-sm{font-size:13px;opacity:.78}
.cta-card label{display:block;font-size:13px;margin:10px 0 3px;opacity:.85}
.cta-card input,.cta-card select{width:100%;box-sizing:border-box;font:inherit;padding:9px 10px;border-radius:9px;border:1px solid var(--cta-line,#8886);background:transparent;color:inherit;min-height:42px}
.cta-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}
.cta-btn{font:inherit;cursor:pointer;border-radius:9px;padding:9px 14px;min-height:42px;border:1px solid var(--cta-line,#8886);background:transparent;color:inherit}
.cta-btn.pri{background:var(--cta-acc,#1c6b9e);border-color:var(--cta-acc,#1c6b9e);color:var(--cta-acc-ink,#fff)}
.cta-btn.danger{border-color:var(--cta-bad,#bf3528);color:var(--cta-bad,#bf3528)}
.cta-btn:disabled{opacity:.5;cursor:default}
.cta-link{background:none;border:0;padding:0;color:var(--cta-acc,#1c6b9e);text-decoration:underline;cursor:pointer;font:inherit}
.cta-tabs{display:flex;gap:6px;margin:10px 0 2px}.cta-tabs button{flex:1}.cta-tabs button[aria-pressed=true]{background:var(--cta-acc,#1c6b9e);color:var(--cta-acc-ink,#fff);border-color:var(--cta-acc,#1c6b9e)}
.cta-msg{margin-top:10px;padding:8px 10px;border-radius:9px;font-size:14px}.cta-msg:empty{display:none}
.cta-msg.err{background:color-mix(in srgb,var(--cta-bad,#bf3528) 14%,transparent)}.cta-msg.ok{background:color-mix(in srgb,var(--cta-ok,#21714a) 14%,transparent)}
.cta-x{float:right;font-size:22px;line-height:1;background:none;border:0;color:inherit;cursor:pointer;padding:2px 6px}
.cta-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}.cta-tbl th,.cta-tbl td{text-align:left;padding:6px 6px;border-bottom:1px solid var(--cta-line,#8884);vertical-align:top}
.cta-tbl tr.cta-click{cursor:pointer}.cta-tbl tr.cta-click:hover{background:color-mix(in srgb,var(--cta-acc,#1c6b9e) 8%,transparent)}
.cta-tag{display:inline-block;font-size:12px;padding:1px 7px;border-radius:99px;border:1px solid var(--cta-line,#8886);margin:1px 3px 1px 0}
.cta-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-left:6px;vertical-align:middle;background:#8888}.cta-dot.ok{background:var(--cta-ok,#21714a)}.cta-dot.warn{background:var(--cta-warn,#a96f00)}.cta-dot.err{background:var(--cta-bad,#bf3528)}
.cta-scroll{overflow-x:auto}
.cta-pre{white-space:pre-wrap;font-size:13px;padding:8px 10px;border:1px dashed var(--cta-line,#8886);border-radius:9px;margin-top:8px}`;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fdate = iso => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); };
const ago = iso => { const d = new Date(iso); if (isNaN(d)) return '—'; const m = (Date.now() - d) / 60000; return m < 1 ? 'ahora' : m < 60 ? 'hace ' + Math.round(m) + ' min' : m < 1440 ? 'hace ' + Math.round(m / 60) + ' h' : m < 2880 ? 'ayer' : 'hace ' + Math.round(m / 1440) + ' días'; };

function createUI(core, ad, opts) {
  opts = opts || {};
  const appName = CFG.apps[ad.app].name, other = Object.keys(CFG.apps).find(a => a !== ad.app);
  let back = null, view = 'main', msg = { t: '', k: '' }, sync = { st: 'idle', at: null, err: '' }, timer = null, busy = false, again = false, adminCache = null, btn = null, lastInvite = null;
  if (!document.getElementById('cta-css')) { const st = document.createElement('style'); st.id = 'cta-css'; st.textContent = CSS; document.head.appendChild(st); }
  const $ = s => back && back.querySelector(s);
  const setMsg = (t, k) => { msg = { t, k: k || 'err' }; const m = $('.cta-msg'); if (m) { m.textContent = t; m.className = 'cta-msg ' + msg.k; } };
  const wrap = async (fn, okMsg) => { setMsg(''); const b = back && back.querySelectorAll('button'); b && b.forEach(x => { x.disabled = true; }); try { const r = await fn(); if (okMsg) msg = { t: okMsg, k: 'ok' }; render(); return r; } catch (e) { msg = { t: e.message || String(e), k: 'err' }; render(); return null; } };

  function label() {
    if (!btn) return;
    const s = core.session, st = core.state();
    const first = s && (s.name || s.email || '').split(/[ @]/)[0];
    btn.innerHTML = st === 'out' ? esc(opts.outLabel || 'Entrar') : esc(first || 'Mi cuenta') + `<span class="cta-dot ${st !== 'member' ? 'warn' : sync.st === 'ok' ? 'ok' : sync.st === 'err' ? 'err' : sync.st === 'off' ? 'warn' : ''}" aria-hidden="true"></span>`;
    btn.title = st === 'out' ? 'Entra con tu cuenta para guardar tu progreso en la nube' : st === 'member' ? syncText() : 'Tu cuenta necesita atención';
  }
  function syncText() {
    return sync.st === 'run' ? 'Sincronizando…' : sync.st === 'ok' ? 'Progreso guardado en tu cuenta ' + ago(sync.at) + '.' : sync.st === 'off' ? ERR.NET : sync.st === 'err' ? 'No se pudo sincronizar: ' + sync.err : 'Pendiente de sincronizar.';
  }
  async function doSync() {
    if (core.state() !== 'member') return;
    if (busy) { again = true; return; }
    busy = true; sync.st = 'run'; label(); refreshInfo();
    try { await core.sync(ad); sync = { st: 'ok', at: nowIso(), err: '' }; }
    catch (e) { sync = { st: e.code === 'NET' ? 'off' : 'err', at: sync.at, err: e.message }; if (e.code === 'TOKEN_EXPIRED' || e.code === 'INVALID_REFRESH_TOKEN') { core.signOut(); } }
    busy = false; label(); refreshInfo(); if (opts.onSync) opts.onSync(sync);
    if (again) { again = false; schedule(1500); }
  }
  function schedule(ms) { clearTimeout(timer); if (core.state() === 'member') timer = setTimeout(doSync, ms == null ? 3000 : ms); }
  const refreshInfo = () => { const e = $('#cta-sync'); if (e) e.textContent = syncText(); };

  function open(v) { view = v || 'main'; msg = { t: '', k: '' }; if (!back) { back = document.createElement('div'); back.className = 'cta-back'; back.setAttribute('role', 'dialog'); back.setAttribute('aria-modal', 'true'); back.addEventListener('click', e => { if (e.target === back) close(); }); document.body.appendChild(back); } render(); }
  function close() { if (back) { back.remove(); back = null; } }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && back) close(); });

  function render() {
    if (!back) return;
    const st = core.state(), s = core.session || {};
    const x = '<button class="cta-x" data-a="close" aria-label="Cerrar">×</button>';
    let h = '';
    if (view === 'admin' && core.isAdmin()) return renderAdmin();
    if (st === 'out') {
      const tab = view === 'up' ? 'up' : view === 'reset' ? 'reset' : 'in';
      h = `${x}<h3>Tu cuenta</h3><p class="cta-sm">Con cuenta, tu progreso de ${esc(CFG.apps.sva.name)} y ${esc(CFG.apps.ecg.name)} se guarda en la nube y lo tienes en cualquier dispositivo. Solo para personas invitadas. Sin cuenta, todo funciona igual y se queda en este dispositivo.</p>
        <div class="cta-tabs"><button class="cta-btn" data-a="v-in" aria-pressed="${tab === 'in'}">Entrar</button><button class="cta-btn" data-a="v-up" aria-pressed="${tab === 'up'}">Crear cuenta</button></div>`;
      if (tab === 'in') h += `<form data-f="in"><label for="cta-e">Correo</label><input id="cta-e" type="email" autocomplete="username" required><label for="cta-p">Contraseña</label><input id="cta-p" type="password" autocomplete="current-password" required>
        <div class="cta-row"><button class="cta-btn pri" type="submit">Entrar</button><button class="cta-link" type="button" data-a="v-reset">He olvidado la contraseña</button></div></form>`;
      else if (tab === 'up') h += `<form data-f="up"><label for="cta-n">Nombre y apellido</label><input id="cta-n" autocomplete="name" maxlength="60" required><label for="cta-e">Correo (el mismo con el que te invitaron)</label><input id="cta-e" type="email" autocomplete="username" required><label for="cta-p">Contraseña (mínimo 8 caracteres)</label><input id="cta-p" type="password" autocomplete="new-password" minlength="8" required>
        <div class="cta-row"><button class="cta-btn pri" type="submit">Crear cuenta</button></div><p class="cta-sm">Te llegará un correo para verificar la dirección. Tus datos: nombre, correo y tu progreso en las apps, en servidores de Google en Madrid. Puedes borrarlo todo desde aquí cuando quieras.</p></form>`;
      else h += `<form data-f="reset"><p class="cta-sm">Te enviamos un enlace para poner una contraseña nueva.</p><label for="cta-e">Correo</label><input id="cta-e" type="email" autocomplete="username" required><div class="cta-row"><button class="cta-btn pri" type="submit">Enviar el enlace</button><button class="cta-link" type="button" data-a="v-in">Volver</button></div></form>`;
    } else if (st === 'notInvited') {
      h = `${x}<h3>Correo no invitado</h3><p>La cuenta <b>${esc(s.email)}</b> existe, pero ese correo no está invitado (o se retiró la invitación). Pide al administrador que te invite con este mismo correo y vuelve a entrar.</p><div class="cta-row"><button class="cta-btn" data-a="recheck">Volver a comprobar</button><button class="cta-btn" data-a="out">Cerrar sesión</button></div>`;
    } else if (st === 'unverified') {
      h = `${x}<h3>Verifica tu correo</h3><p>Te hemos enviado un enlace a <b>${esc(s.email)}</b>. Ábrelo (mira también en spam o promociones) y vuelve aquí.</p><div class="cta-row"><button class="cta-btn pri" data-a="recheck">Ya lo he verificado</button><button class="cta-btn" data-a="resend">Reenviar el correo</button><button class="cta-btn" data-a="out">Cerrar sesión</button></div>`;
    } else {
      h = `${x}<h3>${esc(s.name || s.email)}</h3><p class="cta-sm">${esc(s.email)}${core.isAdmin() ? ' · administrador' : ' · beta tester'}</p>
        <p id="cta-sync">${esc(syncText())}</p><p class="cta-sm">${esc(opts.what || 'Se guarda tu progreso de esta app.')} La misma cuenta sirve en ${esc(CFG.apps[other].name)}.</p>
        <div class="cta-row"><button class="cta-btn pri" data-a="sync">Sincronizar ahora</button>${core.isAdmin() ? '<button class="cta-btn" data-a="v-admin">Administración</button>' : ''}<button class="cta-btn" data-a="out">Cerrar sesión</button></div>
        <details style="margin-top:12px"><summary class="cta-sm">Cambiar el nombre o borrar la cuenta</summary>
          <form data-f="rename"><label for="cta-n">Nombre</label><input id="cta-n" value="${esc(s.name || '')}" maxlength="60"><div class="cta-row"><button class="cta-btn" type="submit">Guardar el nombre</button></div></form>
          <div class="cta-row"><button class="cta-btn danger" data-a="del">Borrar mi cuenta y mis datos de la nube</button></div><p class="cta-sm">Lo que hay en este dispositivo no se borra.</p></details>`;
    }
    back.innerHTML = `<div class="cta-card">${h}<div class="cta-msg ${msg.k}">${esc(msg.t)}</div></div>`;
    bind();
    const f = back.querySelector('input'); if (f && !('ontouchstart' in window)) f.focus();
  }
  let delArm = 0, outArm = 0;
  function bind() {
    back.querySelectorAll('form').forEach(f => f.addEventListener('submit', e => {
      e.preventDefault(); const v = id => (back.querySelector(id) || {}).value || '';
      if (f.dataset.f === 'in') wrap(async () => { const st = await core.signIn(v('#cta-e'), v('#cta-p')); afterLogin(st); });
      if (f.dataset.f === 'up') wrap(async () => { await core.signUp(v('#cta-n'), v('#cta-e'), v('#cta-p')); afterLogin(core.state()); });
      if (f.dataset.f === 'reset') wrap(() => core.sendReset(v('#cta-e')), 'Si el correo tiene cuenta, te llegará el enlace en unos minutos (mira también en spam).');
      if (f.dataset.f === 'rename') wrap(async () => { await core.rename(v('#cta-n')); if (ad.onSession) ad.onSession(core.session, 'rename'); label(); schedule(500); }, 'Nombre guardado.');
    }));
    back.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.a;
      if (a === 'close') return close();
      if (a.startsWith('v-')) { view = a.slice(2); msg = { t: '', k: '' }; return render(); }
      if (a === 'out') { if (ad.pending && ad.pending() && Date.now() - outArm > 6000) { outArm = Date.now(); b.textContent = 'Hay progreso sin subir a la nube: pulsa otra vez para salir igualmente'; doSync(); return; } const s = core.session; core.signOut(); if (ad.onSession) ad.onSession(null, 'out', s); sync = { st: 'idle', at: null, err: '' }; label(); view = 'in'; msg = { t: 'Sesión cerrada. Tu progreso sigue guardado en tu cuenta.', k: 'ok' }; return render(); }
      if (a === 'resend') return wrap(() => core.sendVerify(), 'Correo reenviado.');
      if (a === 'recheck') return wrap(async () => { const st = await core.recheck(); if (st === 'unverified') throw new Error('Todavía no consta como verificado. Abre el enlace del correo y vuelve a pulsar.'); afterLogin(st); });
      if (a === 'sync') return doSync();
      if (a === 'del') { if (Date.now() - delArm > 5000) { delArm = Date.now(); b.textContent = 'Pulsa otra vez para borrarlo todo'; return; } return wrap(async () => { const s = core.session; await core.deleteAccount(); if (ad.onSession) ad.onSession(null, 'deleted', s); label(); view = 'in'; }, 'Cuenta y datos de la nube borrados.'); }
    }));
  }
  function afterLogin(st) {
    label();
    if (st === 'member') { if (ad.onSession) ad.onSession(core.session, 'in'); msg = { t: 'Hecho. Sincronizando tu progreso…', k: 'ok' }; view = 'main'; doSync(); }
  }

  /* ----- panel del administrador ----- */
  async function loadAdmin() {
    const [inv, users] = await Promise.all([core.admin.invites(), core.admin.users()]);
    adminCache = { inv, users, at: Date.now() }; return adminCache;
  }
  function renderAdmin(detail) {
    const x = '<button class="cta-x" data-a="close" aria-label="Cerrar">×</button>';
    back.innerHTML = `<div class="cta-card wide">${x}<h3>Administración</h3><p class="cta-sm">Beta testers de ${esc(CFG.apps.sva.name)} y ${esc(CFG.apps.ecg.name)}: invitaciones y progreso. Los datos solo los ves tú.</p>
      <div class="cta-row"><button class="cta-btn" data-b="back">‹ Mi cuenta</button><button class="cta-btn" data-b="reload">Actualizar</button><button class="cta-btn" data-b="json">Descargar todo (JSON)</button>${(opts.adminActions || []).map((a, i) => `<button class="cta-btn" data-x="${i}">${esc(a.label)}</button>`).join('')}</div>
      <div id="cta-adm"><p class="cta-sm">Cargando…</p></div><div class="cta-msg ${msg.k}">${esc(msg.t)}</div></div>`;
    back.querySelector('[data-a=close]').onclick = close;
    back.querySelector('[data-b=back]').onclick = () => { view = 'main'; msg = { t: '', k: '' }; render(); };
    back.querySelector('[data-b=reload]').onclick = () => { adminCache = null; msg = { t: '', k: '' }; renderAdmin(); };
    back.querySelector('[data-b=json]').onclick = () => wrap(async () => { const c = adminCache || await loadAdmin(); const full = []; for (const u of c.users) { const apps = {}; for (const a of Object.keys(CFG.apps)) apps[a] = await core.admin.appData(u.id, a).catch(() => null); full.push({ uid: u.id, perfil: u.fields, apps }); } const blob = new Blob([JSON.stringify({ exportado: nowIso(), invitaciones: c.inv.map(i => Object.assign({ correo: i.id }, i.fields)), usuarios: full }, null, 1)], { type: 'application/json' }); const aEl = document.createElement('a'); aEl.href = URL.createObjectURL(blob); aEl.download = 'beta-testers-' + nowIso().slice(0, 10) + '.json'; document.body.appendChild(aEl); aEl.click(); aEl.remove(); view = 'admin'; }, 'Descargado.');
    back.querySelectorAll('[data-x]').forEach(b => { b.onclick = () => { const a = opts.adminActions[+b.dataset.x]; wrap(async () => { const c = adminCache || await loadAdmin(); const t = await a.run(c, core); view = 'admin'; return t; }).then(t => { if (t) { msg = { t, k: 'ok' }; renderAdmin(); } }); }; });
    (adminCache ? Promise.resolve(adminCache) : loadAdmin()).then(c => fillAdmin(c, detail), e => { const el = back && back.querySelector('#cta-adm'); if (el) el.innerHTML = `<p class="cta-msg err">${esc(e.message)}</p>`; });
  }
  function fillAdmin(c, detail) {
    const el = back && back.querySelector('#cta-adm'); if (!el) return;
    if (detail) return fillDetail(el, c, detail);
    const byEmail = new Map(c.users.map(u => [lower(u.fields.email), u]));
    const users = c.users.slice().sort((a, b) => String(b.fields.updated || '').localeCompare(String(a.fields.updated || '')));
    const pending = c.inv.filter(i => !byEmail.has(i.id));
    const sumCell = (u, a) => { const s = u.fields[a]; return s ? esc(otherSummary(a, s)) : '<span class="cta-sm">—</span>'; };
    el.innerHTML = `<h4>Usuarios (${users.length})</h4><div class="cta-scroll"><table class="cta-tbl"><tr><th>Nombre</th><th>Última actividad</th><th>${esc(CFG.apps[ad.app].name)}</th><th>${esc(CFG.apps[other].name)}</th></tr>
      ${users.map(u => `<tr class="cta-click" data-u="${esc(u.id)}"><td><b>${esc(u.fields.name || '—')}</b><br><span class="cta-sm">${esc(u.fields.email)}</span></td><td>${esc(ago(u.fields.updated))}</td><td>${sumCell(u, ad.app)}</td><td>${sumCell(u, other)}</td></tr>`).join('') || '<tr><td colspan="4" class="cta-sm">Nadie ha creado su cuenta todavía.</td></tr>'}</table></div>
      ${pending.length ? `<p class="cta-sm">Invitados que aún no han creado su cuenta: ${pending.map(i => esc(i.fields.name ? i.fields.name + ' (' + i.id + ')' : i.id)).join(', ')}.</p>` : ''}
      <h4>Invitaciones (${c.inv.length})</h4>
      <form data-f="inv"><div class="cta-row" style="margin-top:0"><input id="cta-ie" type="email" placeholder="correo@ejemplo.com" style="flex:2;min-width:200px" required><input id="cta-in" placeholder="Nombre" style="flex:1;min-width:140px"><select id="cta-ir" style="flex:0 0 130px"><option value="tester">Beta tester</option><option value="admin">Administrador</option></select><button class="cta-btn pri" type="submit">Invitar</button></div></form>
      <div id="cta-invmsg"></div>
      <div class="cta-scroll"><table class="cta-tbl"><tr><th>Correo</th><th>Nombre</th><th>Rol</th><th>Desde</th><th></th></tr>
      ${c.inv.slice().sort((a, b) => String(b.fields.at || '').localeCompare(String(a.fields.at || ''))).map(i => `<tr><td>${esc(i.id)}</td><td>${esc(i.fields.name || '')}</td><td>${i.fields.role === 'admin' ? 'administrador' : 'beta tester'}</td><td>${esc(fdate(i.fields.at))}</td><td>${CFG.admins.includes(i.id) ? '' : `<button class="cta-btn" data-del="${esc(i.id)}">Quitar</button>`}</td></tr>`).join('') || '<tr><td colspan="5" class="cta-sm">Sin invitaciones.</td></tr>'}</table></div>`;
    el.querySelectorAll('[data-u]').forEach(r => { r.onclick = () => renderAdmin(r.dataset.u); });
    if (lastInvite) { invitedBox(el.querySelector('#cta-invmsg'), lastInvite.em, lastInvite.nm); lastInvite = null; }
    el.querySelector('[data-f=inv]').onsubmit = e => { e.preventDefault(); const em = lower(el.querySelector('#cta-ie').value), nm = el.querySelector('#cta-in').value.trim(), rl = el.querySelector('#cta-ir').value;
      wrap(async () => { await core.admin.invite(em, nm, rl); adminCache = null; lastInvite = { em, nm }; view = 'admin'; }); };
    let arm = null; el.querySelectorAll('[data-del]').forEach(b => { b.onclick = () => { if (arm !== b.dataset.del) { arm = b.dataset.del; b.textContent = 'Pulsa otra vez'; return; } wrap(async () => { await core.admin.uninvite(b.dataset.del); adminCache = null; view = 'admin'; }, 'Invitación retirada: ya no podrá sincronizar (sus datos siguen guardados).'); }; });
  }
  function invitedBox(box, em, nm) {
    const t = `Hola${nm ? ' ' + nm.split(' ')[0] : ''}: te he dado acceso a la beta de ${CFG.apps.sva.name} y ${CFG.apps.ecg.name}. Abre la app, pulsa «Entrar» → «Crear cuenta» con este correo (${em}) y verifica el enlace que te llegará.\n${CFG.apps.sva.name}: ${CFG.apps.sva.url}\n${CFG.apps.ecg.name}: ${CFG.apps.ecg.url}`;
    box.innerHTML = `<p class="cta-msg ok">Invitado ${esc(em)}. Mensaje para enviarle:</p><div class="cta-pre">${esc(t)}</div><div class="cta-row"><button class="cta-btn" data-c="copy">Copiar</button>${navigator.share ? '<button class="cta-btn" data-c="share">Compartir…</button>' : ''}<a class="cta-btn" style="text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(t)}">WhatsApp</a></div>`;
    box.querySelector('[data-c=copy]').onclick = e => { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { e.target.textContent = 'Copiado'; }, () => { e.target.textContent = 'Selecciona el texto y cópialo'; }); };
    const sh = box.querySelector('[data-c=share]'); if (sh) sh.onclick = () => navigator.share({ text: t }).catch(() => null);
  }
  async function fillDetail(el, c, uid) {
    const u = c.users.find(x => x.id === uid); if (!u) return;
    el.innerHTML = `<div class="cta-row" style="margin-top:0"><button class="cta-btn" data-b="list">‹ Todos</button></div><h4>${esc(u.fields.name || '—')} · <span class="cta-sm">${esc(u.fields.email)}</span></h4><p class="cta-sm">Última actividad ${esc(fdate(u.fields.updated))}</p><div id="cta-det"><p class="cta-sm">Cargando su progreso…</p></div>`;
    el.querySelector('[data-b=list]').onclick = () => renderAdmin();
    try {
      const mine = await core.admin.appData(uid, ad.app), s2 = u.fields[other];
      const box = el.querySelector('#cta-det'); if (!box) return;
      box.innerHTML = `<h4>${esc(CFG.apps[ad.app].name)}</h4>${mine ? ad.adminDetail(mine, u) : '<p class="cta-sm">Aún no ha usado esta app con su cuenta.</p>'}<h4>${esc(CFG.apps[other].name)}</h4><p>${s2 ? esc(otherSummary(other, s2)) + ' · ' + esc(ago(s2.at)) : '<span class="cta-sm">Aún no la ha usado con su cuenta.</span>'}</p><p class="cta-sm">El detalle de ${esc(CFG.apps[other].name)} está en su propio panel de administración.</p>`;
    } catch (e) { const box = el.querySelector('#cta-det'); if (box) box.innerHTML = `<p class="cta-msg err">${esc(e.message)}</p>`; }
  }
  /* resumen corto de cada app para la tabla (cada app sabe leer el suyo y el de la otra) */
  function otherSummary(a, s) {
    const pp = s.paths ? Object.entries(s.paths).filter(([, p]) => p > 0).map(([k, p]) => (k === 'enfermeria' ? 'enfermería' : k === 'hems' ? 'HEMS' : k) + ' ' + p + ' %') : [];
    if (a === 'sva') return [plural(s.n || 0, 'intento', 'intentos'), s.avg != null ? 'media ' + String(Math.round(s.avg * 10) / 10).replace('.', ',') : '', pp.length ? 'itinerarios: ' + pp.join(', ') : '', s.rv ? plural(s.rv, 'caso valorado', 'casos valorados') : ''].filter(Boolean).join(' · ');
    if (a === 'ecg') return [plural(s.n || 0, 'respuesta', 'respuestas'), s.pct != null ? s.pct + ' % de acierto' : '', s.rep ? plural(s.rep, 'reporte', 'reportes') : ''].filter(Boolean).join(' · ');
    return '';
  }

  /* arranque: si hay sesión, comprueba el rol y sincroniza; al volver la cobertura o al salir de la app, también */
  const api = {
    core, open, close, schedule, syncNow: doSync, get sync() { return sync; },
    mountButton(el) { btn = el; label(); el.addEventListener('click', () => open()); },
    touch() { schedule(); },
    async start() {
      label();
      if (!core.session) return;
      try { await core.recheck(); } catch (e) { if (e.code !== 'NET') { if (ad.onSession) ad.onSession(null, 'expired'); } }
      label(); if (core.state() === 'member') { if (ad.onSession) ad.onSession(core.session, 'start'); doSync(); }
    }
  };
  window.addEventListener('online', () => schedule(500));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && timer) { clearTimeout(timer); timer = null; doSync(); } else if (document.visibilityState === 'visible' && core.state() === 'member' && (!sync.at || Date.now() - new Date(sync.at) > 60000)) schedule(800); });
  core.on(() => label());
  return api;
}

const Cuenta = { CFG, createCore, createUI, enc, dec, esc, fdate, ago };
root.Cuenta = Cuenta;
if (typeof module !== 'undefined' && module.exports) module.exports = Cuenta;
})(typeof window !== 'undefined' ? window : globalThis);
