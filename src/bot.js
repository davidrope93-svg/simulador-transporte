/* Bot de referencia (v1.27): juega un caso con su solución de referencia (src/solutions.js) como un equipo experto.
   Es el mismo código para el validador (tests/validar.js) y para el debrief comparado del navegador, que lo corre en segundo plano
   con el mismo paciente que el alumno para enseñarle «tu actuación frente a la de referencia, minuto a minuto». */
(function (root) {
const r10 = x => Math.round(x / 10) * 10;
const O2LAD = ['gafas', 'venturi28', 'venturi35', 'venturi50', 'reserv'];
const NOR = [0, .05, .1, .15, .2, .3, .5], ADRI = [0, 2, 5, 10, 20];
const RND = { cuff: 0, spo2: 0, et: 0, tas: 0, pam: 0, vtkg: 1, pplat: 0, dp: 0, peepi: 0, pco2: 0, rr: 0, ie: 2, auto: 2, leak: 0, o2: 0, fight: 2, sinus: 0, glu: 0, qrs: 0, fio2: 0, spco: 0, reperf: 0, temp: 1, fluidRate: 0, na: 0, naUp: 1, seizFree: 0, fc: 0, k: 1, alt: 0, gcs: 0, ph: 2 };


/* devoluciones del motor que espera el bot: al intubar, VCV a 7 mL/kg y el equipo en marcha (como el arnés de pruebas) */
function prep(sim) { const S = sim.S;
  S.onIntubated = () => { const cfg = Object.assign({}, S.cfg, { mode: 'VCV', vt: Math.round(7 * S.ibw / 10) * 10, fr: 16, ti: 1, peep: 5, fio2: 100, pmax: 40, trigI: 2 }); sim.setCfg(cfg); sim.setStandby(false); S._intubAt = S.clin; };
  S.onIntubFail = () => { S._fails = (S._fails || 0) + 1; }; }
/* ctx: { sim, S, sched, c (caso), key, sol (solución), DR (fármacos), peso, idle } → { tick(M), finish(SV, R, T), used, first, log, notes } */
function make(ctx) {
  const { sim, S, c, key, DR } = ctx, sol = ctx.sol || { s: [] }, idle = !!ctx.idle, L = { sched: ctx.sched };
  const ped = !!c.ped, peso = ctx.peso, fW = DR.fWOf(peso, ped);
  const used = new Set(), first = {}, log = [], queue = [], notes = [];
  const mark = t => { used.add(t); if (first[t] == null) first[t] = S.clin; };
  const note = (kind, a, b) => log.push([S.clin, kind, a, b]); // registro legible para el debrief comparado
  const at = (t, fn) => queue.push({ t, fn, done: false });
  const cfg = o => { const x = {}; for (const [k, v] of Object.entries(o)) x[k] = typeof v === 'string' && /^ibw\d/.test(v) ? r10(+v.slice(3) * S.ibw) : v; const ch = Object.entries(x).filter(([k, v]) => S.cfg[k] !== v).map(([k, v]) => [k, S.cfg[k], v]); sim.setCfg(Object.assign({}, S.cfg, x)); if (ch.length) note('cfg', ch); };
  const hasAcc = () => !!S.access;
  let accTries = 0;
  function access(then) {
    if (hasAcc()) return true;
    if (!S.accessPend) { const k = S.arrest || ped || accTries >= 2 ? 'io' : 'iv'; accTries++; mark('act:' + k); note('act', k); sim.action(k); }
    if (then) at(S.clin + .5, then); return false;
  }
  function give(id) {
    const it = DR.DRUGITEMS[id]; if (!it) throw new Error(`${key}: fármaco desconocido «${id}»`);
    if (!hasAcc() && !it.noIV && (it.k || it.act === 'fluid' || it.act === 'blood')) { access(() => give(id)); return; }
    if (it.act) { mark('act:' + it.act); note('drug', id); if (it.act === 'fluid') sim.action('fluid', (ped ? 10 * peso : 500) / peso); else if (it.act === 'blood') sim.action('blood', ped ? peso * 10 / 300 : 1); else sim.action(it.act); return; }
    mark('drug:' + it.k); mark('drug:' + it.id); note('drug', id); sim.drug(it.k, DR.amountOf(it, peso, ped));
  }
  const perfNow = {}; if (c.norPre) perfNow.nor = c.norPre;
  function perf(id, r) {
    const p = DR.PERFS.find(x => x.id === id); if (!p) throw new Error(`${key}: perfusión desconocida «${id}»`);
    if (!hasAcc()) { access(() => perf(id, r)); return; }
    p.run(sim, r, fW); perfNow[id] = r; if (r) mark('perf:' + id); note('perf', id, r);
  }
  let intubTries = 0;
  function intubate() { mark('act:intubate'); note('act', 'intubate'); intubTries++; const r = sim.intubate(); if (!r.ok) notes.push('intubar: ' + r.msg); }
  function act(k) {
    if (k === 'fluid' || k === 'blood' || k === 'sedperf') return give(k);
    if (k === 'iv' || k === 'io') { if (!hasAcc() && !S.accessPend) { mark('act:' + k); note('act', k); sim.action(k); accTries++; } return; }
    mark('act:' + k); if (k !== 'intubate') note('act', k); if (k === 'infl') mark('act:bag'); // las insuflaciones dejan la pieza en T ventilando
    if (k === 'explore') sim.explore(); else if (k === 'glu') sim.glucemia(); else if (k === 'temp') sim.temperatura(); else if (k === 'ecg12') sim.ecg12(); else if (k === 'eco') sim.eco();
    else if (k === 'gas') { if (hasAcc()) sim.gas(); else { used.delete('act:gas'); access(() => act('gas')); } }
    else if (k === 'intubate') intubate(); else if (k === 'compMech') sim.compress('mech');
    else sim.action(k);
  }
  const prevIntub = S.onIntubated; S.onIntubated = () => { prevIntub(); if (sol.post) cfg(sol.post); };
  const prevFail = S.onIntubFail; S.onIntubFail = w => { if (prevFail) prevFail(w); if (intubTries < (sol.maxTries || 3)) at(S.clin + .4, () => { if (S.relTot < .9) give('roc'); intubate(); }); };
  const OPS = {
    vt: kg => cfg({ vt: r10(kg * S.ibw) }), cfg, d: (id, when) => { if (!when || S.arr.type === when) give(id); }, a: act, p: perf,
    niv: o => { mark('act:toMask'); note('act', 'toMask'); sim.setIface('mask'); S.mask.leak10 = Math.min(S.mask.leak10, 15); sim.setCfg(Object.assign({}, S.cfg, { mode: 'PSV', ps: 10, peep: 6, rise: .15, trigE: 40, timax: 1.2, trigI: 2, fio2: Math.max(S.cfg.fio2 || 60, 60), pmax: 30, fr: 12 }, o)); sim.setStandby(false); },
    hfnc: (flow, fio2) => { mark('act:toNasal'); note('act', 'toNasal'); sim.setIface('nasal'); cfg({ mode: 'HFNC', flow: flow === 'kg2' ? Math.min(60, Math.round(2 * peso)) : flow, fio2 }); sim.setStandby(false); },
    o2: dev => { mark('o2:' + dev); if (S.iface === 'o2') cfg({ o2dev: dev }); },
    isr: (o = {}) => { if (!hasAcc()) { access(() => OPS.isr(o)); return; } give(o.ind || 'ket'); give('roc'); if (o.vl) act('vl'); if (o.apox) act('apox'); at(S.clin + 1.1, intubate); },
    cv: J => { give('eto'); const go = (n, j) => { mark('shock'); note('shock', j, true); sim.shock(j, true); if (S.arr.type && !S.arrest) { if (n < 3) at(S.clin + .5, () => go(n + 1, Math.min(200, j + 50))); else give('amio300'); } }; at(S.clin + .3, () => go(1, J)); },
    shk: J => { if (S.arrest && (S.rhythm === 'vf' || S.rhythm === 'tvsp')) { mark('shock'); note('shock', J || 200); sim.shock(J || 200, false); } }, // v1.15: descarga puntual (FV monitorizada)
    pace: (rate, mA) => { mark('act:pace'); note('pace', rate, mA); sim.pace(true, rate, mA, 'demand'); },
    mech: () => { mark('act:compMech'); note('act', 'compMech'); sim.compress('mech'); },
    alt: h => { if (h <= 300) mark('alt'); note('alt', h); sim.setAltitude(h); }
  };
  /* variante de parada con otra causa: el tratamiento de esa causa, como haría el equipo al leer la pista */
  const CAUSE_TX = { hyperk: [[.5, 'd', 'ca'], [.8, 'd', 'ins'], [1, 'd', 'bic']], tca: [[.5, 'd', 'bic'], [.8, 'd', 'bic']], ptx: [[.4, 'a', 'decomp'], [.8, 'a', 'drain']],
    tep: [[.4, 'mech'], [.6, 'd', 'tnk']], hypo: [[.5, 'a', 'fluid'], [.7, 'a', 'fluid'], [1, 'a', 'blood'], [1.2, 'a', 'blood']], opi: [[.6, 'd', 'nalox']],
    anaf: [[.5, 'a', 'fluid'], [.7, 'a', 'fluid'], [1, 'a', 'fluid']], tamp: [[.4, 'a', 'pericardio'], [.6, 'a', 'fluid']], hypoT: [[.4, 'a', 'temp'], [.5, 'a', 'warm'], [.6, 'mech']] };
  const steps = c.vcause ? (CAUSE_TX[c.vcause] || []) : sol.s;
  if (!idle) for (const st of steps) { const [t, op, ...args] = st; if (!OPS[op]) throw new Error(`${key}: orden desconocida «${op}»`); at(t, () => OPS[op](...args)); }

  /* el clínico atento */
  const tg = c.targets || {}, chk = (c.checks || []).map(x => Array.isArray(x) ? x[0] : x);
  let tNext = { tit: 1, hold: 1.5, nor: 1, labet: 4, bic: 3, nalox: 2.5, perm: 1 }, als = null, explored = false, lastEv = -9;
  const RESP = {
    obst: () => act('suction'), disc: () => act('reconnect'), sel: () => act('pull'), o2: () => act('bottle'), bronco: () => give('salb'),
    extub: () => { if (S.iface === 'mask') act('mask'); else { if (!S.bag) act('bag'); act('reintub'); at(S.clin + 1.7, () => { if (S.bag) act('bag'); }); } },
    ptx: () => { act('decomp'); at(S.clin + .4, () => act('drain')); }, wake: () => { give('sedperf'); give('sedB'); },
    leak: () => act(S.iface === 'mask' ? 'mask' : 'cuff'), rebleed: () => { act('hemo'); give('blood'); },
    aspir: () => { if (S.iface === 'tube') { act('suction'); cfg({ peep: Math.max(S.cfg.peep || 5, 10) }); } else if (S.iface === 'mask') OPS.isr({ ind: 'ket' }); },
    seiz: () => give(c.ecl ? 'mg4' : 'mid'),
    pumpNor: () => perf('nor', perfNow.nor || .1), paceLoss: () => OPS.pace(S.pace.rate, Math.min(200, S.pace.mA + 40)), drainClamp: () => act('unclamp'), hemat: () => give('blood') // v1.24
  };
  function tick(Lx, M) {
    for (const q of queue) if (!q.done && S.clin >= q.t) { q.done = true; q.fn(); }
    if (idle) return;
    if (!explored && S.clin >= .3) { explored = true; act('explore'); if (chk.some(x => /act:glu/.test(x))) act('glu'); if (chk.some(x => /act:temp/.test(x))) act('temp'); if (chk.some(x => x === 'act:gas')) act('gas'); if (chk.some(x => /act:(iv|io)/.test(x)) && !hasAcc() && !S.arrest) access(); }
    for (const e of L.sched) if (e.fired && !e.resp) { e.resp = true; lastEv = S.clin; if (RESP[e.k]) at(S.clin + .7, RESP[e.k]); }
    if (S.neo && S.bag && S.neo.obs > .35 && S.clin >= (tNext.neo || 0)) { tNext.neo = S.clin + 1; act('neoPos'); act('neoSuct'); act('infl'); } // el tórax no se mueve: corrige la ventilación
    if (S.arrest) { arrestTick(); return; } else als = null;
    if (S.clin >= tNext.hold && (tg.pplat || tg.dp || tg.peepi) && S.iface === 'tube') { tNext.hold += 2; if (tg.peepi) sim.expHold(); if (tg.pplat || tg.dp) at(S.clin + .5, () => sim.inspHold()); }
    if (S.clin >= tNext.tit) {
      tNext.tit += 1;
      const vented = ['tube', 'mask', 'nasal'].includes(S.iface) && !S.standby;
      if (tg.spo2 && !sol.noAuto) { const sp = Math.round(S.spo2 * 100), [lo, hi] = tg.spo2;
        if (vented) { const f = S.cfg.fio2 || 21; if (sp < lo) cfg({ fio2: Math.min(100, f + Math.min(30, 5 * (lo - sp + 1))) }); else if (sp > hi && f > 21) cfg({ fio2: Math.max(21, f - (sp >= 99 ? 20 : sp > hi + 1 ? 10 : 5)) }); }
        else if (S.iface === 'o2') { const i = O2LAD.indexOf(S.cfg.o2dev); if (sp < lo && i < O2LAD.length - 1) OPS.o2(O2LAD[i + 1]); else if (sp > hi && i > 0) OPS.o2(O2LAD[i - 1]); } }
      /* la FR solo se toca con la vía aérea en orden (sin extubación, desconexión ni tapón) y poco a poco: el CO₂ tarda minutos en estabilizarse */
      const airOk = !S.air.extub && !S.air.disc && !S.air.obst && !S.isr && S.clin - lastEv > 3;
      if (tg.et && S.iface === 'tube' && !S.standby && airOk && M.et > 15 && S.clin >= (tNext.et || 0)) { const [lo, hi] = tg.et, mid = (lo + hi) / 2, fr = S.cfg.fr || 14; if (M.et > hi || M.et < lo) { tNext.et = S.clin + 3; const d = Math.max(-4, Math.min(4, Math.round(fr * (M.et - mid) / mid * .7))) || Math.sign(M.et - mid); cfg({ fr: Math.max(8, Math.min(30, fr + d)) }); } }
    }
    if (S.clin >= tNext.nor) { tNext.nor += 1;
      for (const [flag, id, steps, v, up] of [['nor', 'nor', NOR, S.tas, 50], ['adrI', 'adrI', ADRI, S.tas, 50], ['norPam', 'nor', NOR, S.pam, 30]]) if (sol[flag]) { const cur = perfNow[id] || 0, i = steps.indexOf(cur);
        if (v < sol[flag] && i < steps.length - 1) perf(id, steps[i + 1]); else if (v > sol[flag] + up && i > 0) perf(id, steps[i - 1]); } }
    if (sol.labet && S.clin >= tNext.labet) { tNext.labet += 4; if (S.tas > (sol.labet === true ? 160 : sol.labet)) give('labet'); }
    if (sol.bicQrs && S.clin >= tNext.bic) { tNext.bic += 3; if (S.ecg.qrs * 1000 > 120) give('bic'); }
    if (sol.nalox && S.clin >= tNext.nalox) { tNext.nalox += 2.5; if ((M.effN >= 2 ? M.effRR : 0) < 10) give('nalox'); }
    if (sol.atr && S.clin >= (tNext.atr || 0) && S.arr.type === 'sbrady' && S.tas < 90) { tNext.atr = S.clin + 3; give('atr'); }
    if (sol.permissive && S.clin >= tNext.perm) { tNext.perm += 2; if (S.tas < (sol.permissive === true ? 80 : sol.permissive)) give('blood'); }
  }
  function arrestTick() {
    if (!als) { als = { next: S.clin + 2, shocks: 0, adr: -9, amio: 0 };
      if (S.cpr.comp === 'off') { mark('act:compManual'); note('act', 'compManual'); sim.compress('manual'); }
      if (S.iface !== 'tube' && !S.bag) { act('bag'); sim.setRatio(ped ? 15 : 30); }
      access(); if (S.rhythm === 'vf' || S.rhythm === 'tvsp') shock(); }
    if (S.cpr.comp === 'manual' && S.cpr.relevo > 2) sim.relevo();
    const cold = S.temp < 30, sh = S.rhythm === 'vf' || S.rhythm === 'tvsp';
    if (!cold && hasAcc() && S.clin - als.adr >= 4 && (!sh || als.shocks >= 3)) { give('adr1'); als.adr = S.clin; }
    if (S.clin >= als.next) { als.next += 2; mark('act:check'); note('act', 'check'); const r = sim.check(); if (!S.arrest) return; if (r.rhythm === 'vf' || r.rhythm === 'tvsp') shock(); }
  }
  function shock() {
    if (S.temp < 30 && als.shocks >= 3) return;
    mark('shock'); als.shocks++; note('shock', ped ? Math.min(200, Math.round(4 * peso)) : als.shocks > 1 ? 200 : 150); sim.shock(ped ? Math.min(200, Math.round(4 * peso)) : als.shocks > 1 ? 200 : 150, false);
    if (sol.pads && als.shocks === sol.pads) { mark('act:pads'); sim.setPads(true); }
    if (als.shocks === 3 && !als.amio) { give('amio300'); als.amio = 1; } else if (als.shocks === 5 && als.amio === 1) { give('amio150'); als.amio = 2; }
  }


  /* nota como el examen (la misma que usa el validador) */
  function finish(SV, R, T) {
    const from = Math.max(4, T * .4), parts = [];
    const tgt = {}; for (const k of Object.keys(tg)) { const xs = SV.filter(s => s.t >= from && s.v[k] != null && isFinite(s.v[k])).map(s => +(+s.v[k]).toFixed(RND[k] || 0)); if (xs.length) tgt[k] = xs.filter(x => x >= tg[k][0] && x <= tg[k][1]).length / xs.length; }
    const tk = Object.values(tgt);
    if (tk.length) parts.push([4, tk.reduce((a, b) => a + b, 0) / tk.length, 'objetivos']);
    const arrested = c.arrest || R.arrestAt != null;
    const done = tok => tok.split('|').some(t => (t.startsWith('no:') ? !used.has(t.slice(3)) : used.has(t)) || (t === 'rosc' && R.roscAt != null) || (t === 'stacked' && S.cpr.stacked) || (t === 'intub' && S._intubAt != null) || (t === 'noarrest' && !S.arrest && (!arrested || R.roscAt != null)));
    if (chk.length) parts.push([3, chk.filter(done).length / chk.length, 'acciones']);
    if (arrested) parts.push([3, S.arrest ? (c.noRosc && S.cpr.comp !== 'off' ? 1 : 0) : 1, 'parada']); // noRosc: el éxito es trasladar con RCP de calidad
    const score = parts.length ? 10 * parts.reduce((a, p) => a + p[0] * p[1], 0) / parts.reduce((a, p) => a + p[0], 0) : null;
    return { score, parts, tgt, chkFrac: chk.length ? chk.filter(done).length / chk.length : 1, missing: chk.filter(t => !done(t)), notes, rosc: !S.arrest && arrested, nan: R.nan.length + R.weird.filter(w => !/pH (6\.|7\.0)/.test(w)).length };
  }
  return { tick, finish, used, first, log, notes, perfNow };
}
/* avanza el caso como el arnés de pruebas: eventos del guion, pasos del motor y una muestra cada 0,25 min con el bot */
function runner(L, B, targets, onSample) {
  const { sim, S, sched } = L, R = { arrestAt: S.arrest ? 0 : null, roscAt: null, nan: [], weird: [] }, SV = [], series = [], keys = Object.keys(targets || {});
  let nextS = 0, wasArrest = S.arrest;
  const isNum = x => typeof x === 'number' && isFinite(x);
  function advance(tEnd) {
    while (S.clin < tEnd) {
      for (const e of sched) if (!e.fired && S.clin >= e.at) { e.fired = true; if (e.alt != null) sim.setAltitude(e.alt); else sim.event(e.k); if (B) B.log.push([S.clin, e.alt != null ? 'alt' : 'event', e.alt != null ? e.alt : e.k, e.txt || null]); }
      for (let i = 0; i < 25; i++) sim.step(.004);
      if (S.clin >= nextS) {
        nextS += .25; const M = sim.monitor();
        for (const [kk, v] of [['spo2', S.spo2], ['tas', S.tas], ['pco2', S.pco2], ['ph', S.ph], ['pao2', S.pao2], ['Paw', S.Paw]]) if (!isNum(v)) R.nan.push(kk + '@' + S.clin.toFixed(1));
        if (S.arrest && !wasArrest) R.arrestAt = S.clin; if (!S.arrest && wasArrest) R.roscAt = S.clin; wasArrest = S.arrest;
        if (S.spo2 > 1.001 || S.tas > 280 || S.pco2 < 12 || S.ph > 7.75 || S.ph < 6.6) R.weird.push(`${S.clin.toFixed(1)}: spo2 ${(S.spo2 * 100).toFixed(0)} tas ${S.tas.toFixed(0)} pco2 ${S.pco2.toFixed(0)} pH ${S.ph.toFixed(2)}`);
        if (B) B.tick(L, M);
        const v = {}; for (const k of keys) v[k] = val(k, S, M); SV.push({ t: S.clin, v });
        series.push([+S.clin.toFixed(2), Math.round(S.spo2 * 1000) / 10, S.arrest ? null : Math.round(S.tas), M.et != null ? Math.round(M.et) : null, S.arrest ? null : Math.round(S.fc)]);
        if (onSample) onSample(M);
      }
    }
  }
  return { advance, R, SV, series };
}
function val(k, S, M) {
  switch (k) {
    case 'spo2': return S.spo2 * 100; case 'et': return M.et; case 'tas': return S.arrest ? null : S.tas; case 'pam': return S.arrest ? null : S.pam; case 'vtkg': return M.vtkg;
    case 'pplat': return M.pplat; case 'dp': return M.dp; case 'peepi': return M.peepi; case 'pco2': return S.pco2;
    case 'rr': return S.arrest ? null : (M.effN >= 2 ? M.effRR : 0); case 'ie': return M.effN >= 4 ? M.ies / M.effN : null;
    case 'auto': return M.nB >= 4 ? M.auto / M.nB : null; case 'leak': return M.leak; case 'o2': return S.o2.supply ? 1 : 0;
    case 'fight': return S.fight || 0; case 'sinus': return S.arr.type || S.arrest ? 0 : 1; case 'glu': return S.glu; case 'spco': return S.cohb * 100; case 'cuff': return S.cuffP; case 'temp': return S.temp; case 'fluidRate': return S.fluidRate || 0; case 'na': return S.na; case 'fc': return S.arrest ? null : S.fc; case 'gcs': return S.arrest ? null : S.gcs; case 'alt': return S.altitude; case 'k': return S.k; case 'naUp': return S.na - S.na0; case 'seizFree': return S.arrest ? null : (S.clin >= S.seizUntil ? 1 : 0); case 'reperf': { const m = S.stemi; return m && (m.pci <= 120 || m.nste || m.noTnk || m.failed ? m.icp != null : m.tnkAt != null) ? 1 : 0; }
    case 'ph': return S.ph; case 'qrs': return S.arrest ? null : S.ecg.qrs * 1000; case 'fio2': return (S.iface === 'tube' || S.iface === 'mask') && !S.standby ? S.cfg.fio2 : null;
  }
  return null;
}
root.SIM_BOT = { make, runner, prep, val, RND };
})(typeof window !== 'undefined' ? window : globalThis);
