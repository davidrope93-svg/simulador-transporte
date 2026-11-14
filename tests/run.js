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

console.log('— Medio interno, tóxicos, hemorragia, obstetricia, pediatría y post-RCE (v0.7)');
const at = (k, min, acts, o) => { const L = load(k, Object.assign({ scale: 10, seed: 3 }, o || {})); const R = run(L, min, acts || []); return { S: L.S, R }; };
{ const u = at('hiperK', 10).S, t = at('hiperK', 10, [[.5, L => L.sim.drug('ca', 1)]]).S;
  check('Hiperpotasemia sin tratar: QRS a 10 min', u.ecg.qrs * 1000, 140, 220, ' ms'); check('Hiperpotasemia con calcio: QRS a 10 min', t.ecg.qrs * 1000, 80, 115, ' ms');
  const i = at('hiperK', 30, [[.5, L => L.sim.drug('ca', 1)], [1, L => L.sim.drug('ins', 1)], [1.5, L => L.sim.drug('salb', 1)]]).S; check('Insulina con glucosa y salbutamol: bajada de K⁺ en 30 min', 8 - i.k, .7, 2.5, ' mmol/L'); }
{ const u = at('hipoglucemia', 10).S, t = at('hipoglucemia', 10, [[.5, L => L.sim.drug('gluc', 25)]]).S;
  check('Hipoglucemia sin tratar: GCS a 10 min', u.gcs, 3, 8); check('Glucosa 25 g IV: glucemia a 10 min', t.glu, 90, 180, ' mg/dL'); check('Glucosa 25 g IV: GCS a 10 min', t.gcs, 14, 15);
  const r = at('hipoglucemia', 40, [[.5, L => L.sim.drug('gluc', 25)]]).S; check('Sulfonilurea: la hipoglucemia recurre a los 40 min sin perfusión', r.glu, 20, 69, ' mg/dL'); }
{ const u = at('triciclicos', 10).S, t = at('triciclicos', 10, [[.5, L => L.sim.drug('bic', 1.5 * 75)], [3, L => L.sim.drug('bic', 75)]]).S;
  check('Tricíclicos sin tratar: QRS', u.ecg.qrs * 1000, 150, 200, ' ms'); check('Tricíclicos con bicarbonato 2,5 mEq/kg: QRS', t.ecg.qrs * 1000, 90, 119, ' ms'); }
{ const h = at('hipotermia', 2).S; check('Hipotermia a 28,5 °C: FC', h.fc, 30, 55, ' lpm');
  let r = 0; for (let s = 1; s <= 20; s++) { const L = load('hipotermia', { scale: 10, seed: s }); run(L, .5); L.sim.event('vf'); for (let i = 0; i < 3; i++) { run(L, 1 + i); L.sim.shock(200, false); } if (!L.S.arrest) r++; } check('FV a < 30 °C: RCE con 3 descargas', r / 20 * 100, 0, 20, ' %'); }
{ const u = at('pelvis', 30).S, t = at('pelvis', 30, [[.5, L => L.sim.action('hemo')], [1, L => L.sim.drug('txa', 1)], [2, L => L.sim.action('warm')]]).S;
  check('Fractura de pelvis sin hemostasia: TAS a 30 min', u.tas, 40, 75, ' mmHg'); check('Cinturón pélvico y tranexámico: TAS a 30 min', t.tas, 78, 100, ' mmHg');
  const f = at('pelvis', 30, [[.5, L => L.sim.action('hemo')], [1, L => L.sim.drug('txa', 1)], ...[3, 6, 9, 12, 15, 18].map(m => [m, L => L.sim.action('fluid')])]).S; check('Volumen liberal: más sangre perdida que con hipotensión permisiva', (f.lost - t.lost) * 100, 2, 30, ' % de la volemia'); }
{ const u = at('eclampsia', 20).S, t = at('eclampsia', 20, [[1.5, L => L.sim.drug('mg', 4)], [2, L => L.sim.perf('mg', 1 / 60)]]).S;
  check('Eclampsia sin magnesio: convulsiones en 20 min', u.seizures, 2, 12); check('Con magnesio: convulsiones en 20 min (contando la inicial)', t.seizures, 1, 1); }
{ const u = at('crup', 30).S, t = at('crup', 30, [[.5, L => L.sim.drug('adrN', 37.5)], [1, L => L.sim.drug('dexa', 45)]]).S;
  check('Crup sin tratar: PaCO₂ a 30 min (agotamiento)', u.pco2, 50, 80); check('Crup con adrenalina nebulizada y dexametasona: PaCO₂', t.pco2, 28, 46); }
{ const u = at('bronquiolitis', 15).S, t = at('bronquiolitis', 15, [[.5, L => { L.sim.setIface('nasal'); L.sim.setCfg(Object.assign({}, L.S.cfg, { mode: 'HFNC', flow: 12, fio2: 50 })); }]]).S;
  check('Lactante de 6 kg con bronquiolitis: FR', u.pat.rr, 55, 80, ' rpm'); check('Alto flujo 2 L/kg/min: baja la FR', u.pat.rr - t.pat.rr, 5, 25, ' rpm'); check('Alto flujo: sube la SpO₂', (t.spo2 - u.spo2) * 100, 3, 12, ' puntos'); }
{ const sim = VMI.create({ pheno: 'sano', seed: 2, scale: 10, peso: 6, sex: 'h', talla: 62, iface: 'o2', cfg: { o2dev: 'gafas' }, relCe: 0, sedE: 0, sedStopped: true }); sim.warm(10); adv(sim, 8);
  check('Lactante sano de 6 kg: FR', sim.S.pat.rr, 25, 50, ' rpm'); check('Lactante sano: PaCO₂', sim.S.pco2, 34, 45); check('Lactante sano: FC', sim.S.fc, 120, 165, ' lpm'); check('Lactante sano: TAS', sim.S.tas, 75, 100, ' mmHg'); }
{ let u = 0, t = 0; for (let s = 1; s <= 20; s++) { if (at('rceInestable', 30, [], { seed: s }).R.arrestAt != null) u++; if (at('rceInestable', 30, [[.5, L => L.sim.setNor(.15)], [1, L => L.sim.action('fluid')]], { seed: s }).R.arrestAt != null) t++; }
  check('RCE inestable sin soporte: nueva parada en 30 min', u / 20 * 100, 40, 100, ' %'); check('Con noradrenalina y volumen: nueva parada', t / 20 * 100, 0, 15, ' %'); }
{ let u = 0, t = 0; for (let s = 1; s <= 20; s++) { const ck = [2, 4, 6, 8, 10, 12, 14].map(m => [m, L => L.sim.check()]);
    if (!at('pcrTrauma', 15, ck, { seed: s }).S.arrest) u++;
    if (!at('pcrTrauma', 15, [[.3, L => L.sim.action('hemo')], [.5, L => L.sim.action('drain')], [2, L => L.sim.action('blood', 2)], [2.2, L => L.sim.action('fluid')], [3, L => L.sim.action('blood', 2)], ...ck], { seed: s }).S.arrest) t++; }
  check('Parada traumática sin tratar las causas: RCE', u / 20 * 100, 0, 5, ' %'); check('Tratando neumotórax e hipovolemia: RCE', t / 20 * 100, 30, 90, ' %'); }
{ const sim = VMI.create({ pheno: 'sano', seed: 2, scale: 10, iface: 'o2', cfg: { o2dev: 'gafas' }, relCe: 0, sedE: 0, sedStopped: true, hco3Off: -8 }); sim.warm(10); adv(sim, 15);
  check('Acidosis metabólica: PaCO₂ frente a Winter (1,5 × HCO₃ + 8)', sim.S.pco2 - (1.5 * sim.S.hco3m + 8), -6, 6); }

console.log('— Todos los casos, 20 min sin tratar: sin valores imposibles');
let bad = 0; for (const k of Object.keys(CASES)) { if (k === 'libre') continue; const L = load(k, { scale: 10 }); const R = run(L, CASES[k].duration || 20); if (R.nan.length || R.weird.some(w => !/pH (6\.|7\.0)/.test(w))) { bad++; console.log('   ', k, R.nan.slice(0, 2), R.weird.slice(0, 2)); } }
check('Casos con NaN o valores fuera de rango fisiológico', bad, 0, 0);

console.log('— Biblioteca (v1.1): cada caso con ámbito, dificultad y qué enseña');
{ const miss = Object.entries(CASES).filter(([k, c]) => k !== 'libre' && !(['t', 'h', 'i'].includes(c.scope) && [1, 2, 3].includes(c.diff) && c.teach && c.teach.length > 15)).map(([k]) => k);
  if (miss.length) console.log('   sin ficha:', miss.join(', ')); check('Casos sin ficha de biblioteca', miss.length, 0, 0); }

console.log('— Variantes (v1.0): reproducibles, sin valores imposibles y cada causa de parada pide su tratamiento');
{ const V = global.SIM_VARIANT, keys = Object.keys(CASES).filter(k => k !== 'libre' && CASES[k].pheno);
  check('Misma semilla, misma variante', keys.filter(k => JSON.stringify(V.make(k, 4242)) !== JSON.stringify(V.make(k, 4242))).length, 0, 0);
  let same = 0, badV = 0; for (const k of keys) for (let s = 1; s <= 6; s++) { const v = V.make(k, s * 104729 + 17); if (v.goal === CASES[k].goal && !v.vev && !v.vcause && v.access === CASES[k].access && v.altitude === CASES[k].altitude && !/Es (más grave|algo más leve)/.test(v.hint || '')) same++;
    CASES.v_t = v; const R = run(load('v_t', { scale: 10 }), Math.min(v.duration || 20, 20)); if (R.nan.length || R.weird.some(w => !/pH (6\.|7\.0)/.test(w))) { badV++; console.log('  ', k, s, v.vcause || '', v.vev || '', R.nan.concat(R.weird).slice(0, 2).join('; ')); } }
  delete CASES.v_t; check(`Variantes iguales al original (de ${keys.length * 6})`, same, 0, 0); check(`Variantes con NaN o fuera de rango (de ${keys.length * 6})`, badV, 0, 0);
  const byCause = {}; for (let s = 1; s < 3000 && Object.keys(byCause).length < 10; s++) { const v = V.make('pcrFv', s); if (!byCause[v.vcause]) byCause[v.vcause] = v; }
  const fix = { hyperk: (L, w) => { L.sim.drug('ca', 1); L.sim.drug('ins', 1); L.sim.drug('bic', w); }, tca: (L, w) => { L.sim.drug('bic', w); L.sim.drug('bic', w); }, ptx: L => L.sim.action('decomp'), tep: L => { drug(L, 'tnk'); L.sim.compress('mech'); },
    hypo: L => { for (let i = 0; i < 4; i++) L.sim.action('fluid'); L.sim.action('blood', 1); L.sim.action('blood', 1); }, opi: L => drug(L, 'nalox') };
  const rce = (v, seed, good) => { CASES.v_t = v; const L = load('v_t', { scale: 10, seed }), { sim, S } = L; let lastAdr = -9, next = 2, shocks = 0; if (good) fix[v.vcause](L, L.peso * L.fW);
    while (S.clin < 20) { for (let i = 0; i < 25; i++) sim.step(.004); if (S.cpr.comp === 'manual' && S.cpr.relevo > 2) sim.relevo(); if (!S.arrest) return true;
      if (S.clin - lastAdr > 4) { drug(L, 'adr1'); lastAdr = S.clin; } if (S.clin >= next) { next += 2; const r = sim.check(); if (!S.arrest) return true; if (r.rhythm === 'vf' || r.rhythm === 'tvsp') { sim.shock(200, false); shocks++; } } } return false; };
  for (const ck of Object.keys(fix)) { const v = byCause[ck]; if (!v) { check('Variante de parada por ' + ck + ' encontrada', 0, 1, 1); continue; } let g = 0, b = 0; for (let s = 1; s <= 10; s++) { if (rce(v, s, true)) g++; if (rce(v, s, false)) b++; }
    check(`Parada por ${ck} (variante): RCE tratando la causa`, g * 10, 50, 100, ' %'); check(`Parada por ${ck} (variante): RCE sin tratarla`, b * 10, 0, 25, ' %'); }
  delete CASES.v_t; }

console.log('— Validador (v1.2): cada caso se resuelve con su solución de referencia y no se aprueba sin hacer nada');
{ const { validate, play } = require('./validar'); const keys = Object.keys(CASES).filter(k => k !== 'libre' && CASES[k].pheno);
  const noSol = keys.filter(k => !global.SIM_SOL[k]); if (noSol.length) console.log('   sin solución:', noSol.join(', ')); check('Casos sin solución de referencia', noSol.length, 0, 0);
  const res = validate(keys), bad = res.filter(r => !r.ok);
  for (const r of bad) console.log(`   ${r.k}: solución ${r.sol.toFixed(1)}, sin hacer nada ${r.idle.toFixed(1)}${r.missing.length ? ', falta ' + r.missing.join(' ') : ''}`);
  check('Casos que no se resuelven con su solución', res.filter(r => !(r.sol >= 7 || (CASES[r.k].arrest && r.rosc >= .4))).length, 0, 0);
  check('Casos que se aprueban sin hacer nada (nota > 5)', res.filter(r => r.idle > 5).length, 0, 0);
  require('../src/variants.js'); let ok = 0, tot = 0;
  for (const k of keys) for (let s = 1; s <= 3; s++) { CASES.v_val = global.SIM_VARIANT.make(k, s * 9973 + 5); tot++; if (play('v_val', { seed: s }).score >= 7) ok++; }
  delete CASES.v_val; check(`Variantes resueltas con la solución del original (de ${tot})`, ok / tot * 100, 85, 100, ' %'); }

console.log(`\n${n - fails} de ${n} pruebas correctas`);
process.exit(fails ? 1 : 0);
