/* Pruebas del motor: fisiología de referencia, independencia de la velocidad, parada y casos.
   Uso: node tests/run.js   (sale con código 1 si alguna falla) */
const { VMI, CASES, load, run, drug } = require('./harness');
let fails = 0, n = 0;
const f = (x, d = 1) => x == null || !isFinite(x) ? '–' : (+x).toFixed(d);
function check(name, val, lo, hi, unit = '') {
  n++; const ok = val != null && isFinite(val) && val >= lo && val <= hi;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${name}: ${f(val)}${unit} (rango ${lo}–${hi})`);
}
function adv(sim, min, cb) { const S = sim.S, end = S.clin + min; let nx = S.clin; while (S.clin < end) { for (let i = 0; i < 25; i++) sim.step(.004); if (cb && S.clin >= nx) { nx += .02; cb(S); } } }
const keepRel = S => { S.drug.rel.cp = 20; S.drug.rel.ce = 20; };

console.log('— Mecánica (regresión A–E, VCV)');
for (const [lab, ph, cfg, ppk, pplat, peepi] of [['A sano', 'sano', { mode: 'VCV', vt: 450, fr: 14, ti: .675, tplat: 0, peep: 5, fio2: 40 }, 21.9, 14.0, 0], ['B SDRA', 'sdra', { mode: 'VCV', vt: 420, fr: 22, ti: .504, tplat: 0, peep: 10, fio2: 60 }, 36.7, 26.8, 0], ['C asma FR20', 'asma', { mode: 'VCV', vt: 500, fr: 20, ti: 1, tplat: 0, peep: 0, fio2: 50, pmax: 60 }, 36.3, 23.8, 13.8]]) {
  const sim = VMI.create({ pheno: ph, seed: 7, scale: 60, cfg, relCe: 20, pco2: 40 }); sim.warm(10); const S = sim.S;
  for (let i = 0; i < 120 / .004; i++) { sim.step(.004); if (i % 2500 === 0) keepRel(S); }
  sim.expHold(); for (let i = 0; i < 15 / .004; i++) sim.step(.004); sim.inspHold(); for (let i = 0; i < 15 / .004; i++) sim.step(.004);
  const M = sim.monitor();
  check(`${lab} Ppico`, M.ppk, ppk - .5, ppk + .5); check(`${lab} Pplat`, M.pplat, pplat - .5, pplat + .5); check(`${lab} PEEPi`, M.peepi, peepi - .5, peepi + .5);
}

console.log('— Desaturación en apnea (sano, 5 min con FiO2 1,0 o aire) y velocidad');
const apnea = (scale, fio2, ph = 'sano', ex = {}) => { const sim = VMI.create(Object.assign({ pheno: ph, seed: 7, scale, cfg: { mode: 'VCV', vt: 480, fr: 14, ti: 1, peep: ph === 'obeso' ? 10 : 5, fio2, pmax: 40 }, relCe: 20 }, ex)); sim.warm(12); const S = sim.S; adv(sim, 5, keepRel); sim.setStandby(true); const t0 = S.clin; let t = null; adv(sim, 14, S => { keepRel(S); if (t == null && S.spo2 < .9) t = S.clin - t0; }); return t; };
const p1 = apnea(1, 100), p20 = apnea(20, 100);
check('Preoxigenado ×1, min hasta SpO2 < 90 %', p1, 7, 9.5); check('Preoxigenado ×20', p20, 7, 9.5); check('Diferencia ×20 − ×1', Math.abs(p20 - p1), 0, 1.2, ' min');
check('Aire ×10, min hasta SpO2 < 90 %', apnea(10, 21), .6, 2); check('Obeso preoxigenado ×10', apnea(10, 100, 'obeso', { talla: 172, sex: 'h' }), 2.3, 3.6);

console.log('— Control ventilatorio en respiración espontánea');
const pco2At = (k, m, scale = 10) => { const L = load(k, { scale }); run(L, m); return L.S.pco2; };
check('TSV inestable, PaCO2 a 10 min', pco2At('tsvInestable', 10), 34, 45); check('TEP, PaCO2 a 10 min', pco2At('tepPulso', 10), 28, 40);
check('Opiáceos, PaCO2 a 10 min (impulso deprimido)', pco2At('opiaceos', 10), 55, 95); check('EPOC con reservorio, PaCO2 a 20 min (sube)', pco2At('epocO2', 20), 70, 100);

console.log('— EPOC: SpO2 según FiO2 en VMNI');
for (const [fio2, lo, hi] of [[21, 85, 90], [28, 90, 95]]) { const L = load('epocIni', { scale: 10 }); L.sim.setCfg(Object.assign({}, L.S.cfg, { ps: 12, peep: 7, trigE: 45, timax: 1, rise: .15, fio2 })); run(L, 12); check(`FiO2 ${fio2} %`, L.S.spo2 * 100, lo, hi, ' %'); }

console.log('— RCP: EtCO2 con compresiones manuales');
{ const sim = VMI.create({ pheno: 'sano', seed: 5, scale: 10, arrest: 'vf', comp: 'manual', cfg: { mode: 'CPV', pinsp: 15, fr: 10, ti: 1, peep: 0, fio2: 100, pmax: 60 } }); sim.warm(5); const S = sim.S;
  adv(sim, 4, S => { if (S.cpr.relevo > 2) S.cpr.relevo = 0; }); const e4 = sim.monitor().et; adv(sim, 16, S => { if (S.cpr.relevo > 2) S.cpr.relevo = 0; }); const e20 = sim.monitor().et;
  check('EtCO2 a 4 min', e4, 10, 22, ' mmHg'); check('EtCO2 a 20 min', e20, 6, 20, ' mmHg'); check('EtCO2 baja con el tiempo (4 → 20 min)', e4 - e20, 0, 10, ' mmHg'); }

console.log('— Intubación: el relajante necesita tiempo');
{ const sim = VMI.create({ pheno: 'sano', seed: 3, scale: 10, iface: 'o2', relCe: 0, sedE: 0, sedStopped: true, cfg: { o2dev: 'reserv' } }); sim.warm(5); sim.drug('ket', 112); sim.drug('rel', 18); adv(sim, 10 / 60);
  n++; const r1 = sim.intubate(); if (r1.ok) fails++; console.log(`${r1.ok ? 'FALLA' : 'ok  '} a los 10 s no deja intubar`); adv(sim, 50 / 60); n++; const r2 = sim.intubate(); if (!r2.ok) fails++; console.log(`${r2.ok ? 'ok  ' : 'FALLA'} a los 60 s deja intubar`); }

console.log('— Parada: tasa de RCE en 20 min (30 simulaciones por escenario)');
function arrest(k, seed, good) {
  const L = load(k, { scale: 10, seed }); const { sim, S } = L; let shocks = 0, lastAdr = -9, nextCheck = 2, first = false;
  if (good && k === 'asistolia') sim.action('bag'); if (good && k === 'pcrTep') { drug(L, 'tnk'); sim.compress('mech'); } if (good && k === 'fvRefractaria') sim.compress('mech');
  while (S.clin < 20) {
    for (let i = 0; i < 25; i++) sim.step(.004); if (S.cpr.comp === 'manual' && S.cpr.relevo > 2) sim.relevo(); if (!S.arrest) return true;
    const sh = S.rhythm === 'vf' || S.rhythm === 'tvsp';
    if (!first && sh && S.clin > .3) { first = true; sim.shock(150, false); shocks++; }
    if (good && k === 'aespPtx' && S.clin > .5 && S.ptxActive) { sim.action('decomp'); sim.action('fluid'); }
    if (good && !sh && S.clin - lastAdr > 4) { drug(L, 'adr1'); lastAdr = S.clin; }
    if (S.clin >= nextCheck) { nextCheck += 2; const r = sim.check(); if (!S.arrest) return true;
      if (r.rhythm === 'vf' || r.rhythm === 'tvsp') { sim.shock(shocks >= 2 ? 200 : 150, false); shocks++; if (good && shocks >= 3 && S.clin - lastAdr > 4) { drug(L, 'adr1'); lastAdr = S.clin; } if (good && shocks === 3) { drug(L, 'amio300'); if (k === 'fvRefractaria') sim.setPads(true); } if (good && shocks === 5) drug(L, 'amio150'); } }
  }
  return false;
};
const rate = (k, good) => { let r = 0; for (let s = 1; s <= 30; s++) if (arrest(k, s, good)) r++; return r / 30 * 100; };
check('FV presenciada, manejo correcto', rate('pcrFv', true), 65, 100, ' %');
const fr1 = rate('fvRefractaria', true), fr0 = rate('fvRefractaria', false);
check('FV refractaria, manejo correcto', fr1, 30, 70, ' %'); check('FV refractaria, solo descargas', fr0, 10, 50, ' %');
check('AESP por neumotórax sin descomprimir', rate('aespPtx', false), 0, 20, ' %'); check('AESP por neumotórax descomprimido', rate('aespPtx', true), 70, 100, ' %');
check('Asistolia hipóxica sin ventilar', rate('asistolia', false), 0, 10, ' %'); check('PCR por TEP sin fibrinólisis', rate('pcrTep', false), 0, 20, ' %');

console.log('— SIMV, RCP 30:2, vía aérea difícil, drenaje y arritmias (v0.6)');
{ const sim = VMI.create({ pheno: 'sano', seed: 4, scale: 10, relCe: 0, sedE: .5, cfg: { mode: 'SIMV', simvMand: 'VCV', vt: 480, fr: 10, ti: 1, ps: 8, peep: 5, fio2: 40, trigI: 2, trigE: 25, rise: .15, pmax: 40 } }); sim.warm(10);
  adv(sim, 3); const B = sim.S.breaths.filter(b => b.tb > sim.S.t - 30 && b.cycle);
  check('SIMV con respiración espontánea: mandatorias en 30 s (FR 10)', B.filter(b => b.kind === 'mand').length, 4, 6); check('SIMV: espontáneas con PS entre las mandatorias', B.filter(b => b.kind === 'spont').length, 1, 30); }
{ const sim = VMI.create({ pheno: 'sano', seed: 4, scale: 10, relCe: 20, cfg: { mode: 'SIMV', simvMand: 'VCV', vt: 480, fr: 10, ti: 1, ps: 8, peep: 5, fio2: 40, trigI: 2, trigE: 25, pmax: 40 } }); sim.warm(10);
  adv(sim, 3, keepRel); check('SIMV paralizado: FR', sim.monitor().fr, 9, 11.5); }
{ const sim = VMI.create({ pheno: 'sano', seed: 5, scale: 10, arrest: 'asys', comp: 'manual', iface: 'o2', cfg: { o2dev: 'reserv' } }); sim.warm(3); sim.setRatio(30); sim.action('bag');
  adv(sim, 6, S => { if (S.cpr.relevo > 2) S.cpr.relevo = 0; }); const c = sim.S.cpr; check('Fracción de compresión con 30:2', c.cprTime / (c.cprTime + c.noFlow) * 100, 75, 85, ' %'); }
const cico = bmv => { const L = load('viaDificil', { scale: 10, seed: 7 }); if (bmv != null) L.S.bmv = bmv; run(L, 8, [[.5, L => L.sim.action('bag')], [1, L => { drug(L, 'ket'); drug(L, 'roc'); }]]); return L.S.spo2 * 100; };
check('No oxigenable: solo ambú tras relajar, SpO2 a 8 min', cico(), 0, 60, ' %'); check('Misma vía con bolsa eficaz, SpO2 a 8 min', cico(1), 88, 100, ' %');
const sgaSeal = (k, n = 20) => { let ok = 0; for (let s = 1; s <= n; s++) { const L = load(k, { scale: 10, seed: s }); run(L, 2, [[.2, L => { drug(L, 'ket'); drug(L, 'roc'); }], [1.3, L => L.sim.action('sga')]]); if (L.S.iface === 'tube' && L.S.air.sga) ok++; } return ok / n * 100; };
check('Supraglótico que sella en vía difícil con sangre', sgaSeal('viaDificil'), 0, 50, ' %'); check('Supraglótico que sella en ISR habitual', sgaSeal('isrSeptico'), 80, 100, ' %');
{ const L = load('ptxAltitud', { scale: 10 }); run(L, 20, [[.5, L => L.sim.action('drain')]]); check('Neumotórax drenado antes de despegar: SpO2 a 20 min', L.S.spo2 * 100, 92, 100, ' %'); check('Neumotórax drenado: no vuelve a tensarse', L.S.ptxActive ? 1 : 0, 0, 0); }
{ let k = 0; for (let s = 1; s <= 30; s++) { const L = load('tvPulso', { scale: 10, seed: s }); if (run(L, 20).arrestAt != null) k++; } check('TV con pulso sin tratar: parada en 20 min', k / 30 * 100, 15, 60, ' %'); }
{ let k = 0; for (let s = 1; s <= 20; s++) { const L = load('tvPulso', { scale: 10, seed: s }); run(L, .5); L.sim.pace(true, 200, 100, 'overdrive'); run(L, 1); L.sim.pace(false, 200, 100, 'overdrive'); run(L, 1.3); if (!L.S.arr.type && !L.S.arrest) k++; } check('Sobreestimulación (overdrive) en TV: reversión', k / 20 * 100, 35, 85, ' %'); }

console.log('— Todos los casos, 20 min sin tratar: sin valores imposibles');
let bad = 0; for (const k of Object.keys(CASES)) { if (k === 'libre') continue; const L = load(k, { scale: 10 }); const R = run(L, CASES[k].duration || 20); if (R.nan.length || R.weird.some(w => !/pH (6\.|7\.0)/.test(w))) { bad++; console.log('   ', k, R.nan.slice(0, 2), R.weird.slice(0, 2)); } }
check('Casos con NaN o valores fuera de rango fisiológico', bad, 0, 0);

console.log(`\n${n - fails} de ${n} pruebas correctas`);
process.exit(fails ? 1 : 0);
