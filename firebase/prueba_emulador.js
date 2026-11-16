// Prueba del módulo de cuentas contra los emuladores de Firebase (Auth 9099, Firestore 8080) con las reglas reales.
// Uso: desde firebase/, con Java: npx firebase-tools emulators:start --only auth,firestore --project demo-apps-docentes-sva
// y en otra terminal: node prueba_emulador.js
const Cuenta = require(process.argv[2] || require('path').join(__dirname, '..', 'src', 'cuenta.js'));
const EMU = { auth: 'http://127.0.0.1:9099', fs: 'http://127.0.0.1:8080' }, PID = 'demo-apps-docentes-sva';
let n = 0, fails = 0;
const ok = (name, cond, extra) => { n++; if (!cond) fails++; console.log((cond ? 'ok   ' : 'FALLA ') + name + (extra ? ' · ' + extra : '')); };
const mem = () => { const m = {}; return { get: k => (k in m ? JSON.parse(m[k]) : null), set: (k, v) => { m[k] = JSON.stringify(v); }, del: k => { delete m[k]; } }; };
const core = () => Cuenta.createCore({ storage: mem(), emu: EMU });
async function verify(email) {
  const j = await (await fetch(`${EMU.auth}/emulator/v1/projects/${PID}/oobCodes`)).json();
  const c = j.oobCodes.filter(x => x.email === email && x.requestType === 'VERIFY_EMAIL').pop();
  if (!c) throw new Error('sin código para ' + email);
  await fetch(`${EMU.auth}/identitytoolkit.googleapis.com/v1/accounts:update?key=x`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oobCode: c.oobCode }) });
}
const tryErr = async f => { try { await f(); return null; } catch (e) { return e; } };
// adaptador de prueba: un conjunto de marcas que se une entre dispositivos
const adapter = local => ({ app: 'sva', collect: () => ({ items: local.items.slice() }), merge: (r, l) => ({ items: [...new Set([...(r ? r.items : []), ...l.items])].sort() }), apply: (m) => { local.items = m.items.slice(); }, summary: m => ({ n: m.items.length }) });

(async () => {
  await fetch(`${EMU.auth}/emulator/v1/projects/${PID}/accounts`, { method: 'DELETE' });
  await fetch(`${EMU.fs}/emulator/v1/projects/${PID}/databases/(default)/documents`, { method: 'DELETE' });

  // 1. registro sin invitación: se rechaza y la cuenta se borra
  const x = core(); let e = await tryErr(() => x.signUp('Intruso', 'intruso@ejemplo.com', 'contraseña1'));
  ok('Registro sin invitación: rechazado', e && e.code === 'NOT_INVITED', e && e.message);
  e = await tryErr(() => x.signIn('intruso@ejemplo.com', 'contraseña1'));
  ok('… y la cuenta creada se borra (no puede entrar)', e && /incorrectos|no existe/.test(e.message), e && e.code);
  e = await tryErr(() => x.signUp('Corta', 'corta@ejemplo.com', '1234567'));
  ok('Contraseña de menos de 8 caracteres: rechazada', e && e.code === 'WEAK_PASSWORD');

  // 2. el administrador (por configuración) se registra, verifica y es administrador
  const A = core(); let st = await A.signUp('David', 'DavidRope93@gmail.com', 'admin-1234');
  ok('Administrador: tras registrarse queda pendiente de verificar', st === 'unverified', st);
  e = await tryErr(() => A.admin.invite('tester@ejemplo.com', 'Ana', 'tester'));
  ok('… sin verificar no puede invitar (reglas)', e && e.status === 403);
  await verify('davidrope93@gmail.com'); st = await A.recheck();
  ok('… verificado: miembro y administrador', st === 'member' && A.isAdmin(), st);
  await A.admin.invite('Tester@Ejemplo.com', 'Ana Pérez', 'tester');
  const inv = await A.admin.invites();
  ok('Invitación guardada en minúsculas con nombre y rol', inv.length === 1 && inv[0].id === 'tester@ejemplo.com' && inv[0].fields.role === 'tester' && inv[0].fields.name === 'Ana Pérez');

  // 3. la invitada se registra; sin verificar no puede guardar
  const T1 = core(); st = await T1.signUp('Ana Pérez', 'tester@ejemplo.com', 'tester-1234');
  ok('Invitada: registrada y pendiente de verificar', st === 'unverified', st);
  e = await tryErr(() => T1.putDoc('users/' + T1.session.uid + '/apps/sva', { data: '{}', updated: 'x', v: 1 }));
  ok('… sin verificar, las reglas no la dejan escribir', e && e.status === 403);
  await verify('tester@ejemplo.com'); st = await T1.recheck();
  ok('… verificada: miembro, no administradora', st === 'member' && !T1.isAdmin());

  // 4. sincronización entre dos dispositivos
  const d1 = { items: ['a', 'b'] }, d2 = { items: ['c'] };
  await T1.sync(adapter(d1));
  const T2 = core(); await T2.signIn('tester@ejemplo.com', 'tester-1234'); await T2.sync(adapter(d2));
  await T1.sync(adapter(d1));
  ok('Dos dispositivos: los dos acaban con la unión', JSON.stringify(d1.items) === '["a","b","c"]' && JSON.stringify(d2.items) === '["a","b","c"]', d1.items + ' / ' + d2.items);
  const r = await T1.sync(adapter(d1)); ok('Sin cambios no vuelve a escribir', r.changed === false);
  // escrituras a la vez: la condición de versión evita perder datos
  d1.items.push('x1'); d2.items.push('x2'); await Promise.all([T1.sync(adapter(d1)), T2.sync(adapter(d2))]); await T1.sync(adapter(d1)); await T2.sync(adapter(d2));
  ok('Escrituras simultáneas: no se pierde nada', d1.items.includes('x1') && d1.items.includes('x2') && d2.items.includes('x1') && d2.items.includes('x2'), d1.items.join(','));

  // 5. lo que no puede hacer una beta tester
  e = await tryErr(() => T1.admin.users()); ok('Beta tester: no puede listar usuarios', e && e.status === 403);
  e = await tryErr(() => T1.admin.invites()); ok('… ni invitaciones', e && e.status === 403);
  e = await tryErr(() => T1.admin.invite('otro@ejemplo.com', 'Otro', 'admin')); ok('… ni invitar', e && e.status === 403);
  e = await tryErr(() => T1.getDoc('users/' + A.session.uid)); ok('… ni leer el perfil de otro', e && e.status === 403);
  e = await tryErr(() => T1.putDoc('users/' + T1.session.uid + '/apps/otra', { data: '{}', updated: 'x', v: 1 })); ok('… ni escribir en una app que no existe', e && e.status === 403);
  e = await tryErr(() => T1.putDoc('users/' + T1.session.uid, { email: 'falso@ejemplo.com', name: 'x', updated: 'x' })); ok('… ni poner otro correo en su perfil', e && e.status === 403);

  // 6. el administrador ve usuarios, resúmenes y el progreso completo
  const us = await A.admin.users(), ana = us.find(u => u.fields.email === 'tester@ejemplo.com');
  ok('Administrador: ve a la invitada con su nombre y resumen', ana && ana.fields.name === 'Ana Pérez' && ana.fields.sva && ana.fields.sva.n === 5, ana && JSON.stringify(ana.fields));
  const data = await A.admin.appData(ana.id, 'sva'); ok('… y su progreso completo', data && data.items.length === 5);

  // 7. retirar la invitación corta el acceso
  await A.admin.uninvite('tester@ejemplo.com'); st = await T1.recheck();
  ok('Invitación retirada: deja de ser miembro', st === 'notInvited', st);
  e = await tryErr(() => T1.putDoc('users/' + T1.session.uid + '/apps/sva', { data: '{}', updated: 'x', v: 1 })); ok('… y las reglas no la dejan escribir', e && e.status === 403);
  await A.admin.invite('tester@ejemplo.com', 'Ana Pérez', 'tester'); st = await T1.recheck(); ok('Invitada otra vez: vuelve a ser miembro', st === 'member');

  // 8. otro administrador por invitación
  await A.admin.invite('coadmin@ejemplo.com', 'Coadmin', 'admin'); const C = core(); await C.signUp('Coadmin', 'coadmin@ejemplo.com', 'coadmin-123'); await verify('coadmin@ejemplo.com'); await C.recheck();
  const cu = await tryErr(() => C.admin.users()); ok('Invitación con rol administrador: puede listar usuarios', C.isAdmin() && !cu, C.state() + ' ' + JSON.stringify(C.session.role) + ' ' + (cu && cu.message));

  // 9. borrar la cuenta borra sus datos
  await T1.signIn('tester@ejemplo.com', 'tester-1234'); const uid = T1.session.uid; await T1.deleteAccount();
  const gone = await A.getDoc('users/' + uid), gone2 = await A.getDoc('users/' + uid + '/apps/sva');
  ok('Borrar la cuenta: perfil y progreso eliminados y sesión cerrada', !gone && !gone2 && T1.state() === 'out');
  e = await tryErr(() => T1.signIn('tester@ejemplo.com', 'tester-1234')); ok('… y la cuenta ya no existe', !!e);
  // sesión caducada: el token se renueva solo
  A.session.exp = 0; const u2 = await A.admin.users(); ok('Token caducado: se renueva solo', Array.isArray(u2));

  console.log(`\n${n - fails} de ${n} pruebas correctas`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
