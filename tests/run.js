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

console.log('— Cardiología (v1.4): SCACEST, infarto de VD y taponamiento');
{ const mk = o => { const s = VMI.create(Object.assign({ pheno: 'sano', seed: 3, scale: 10, iface: 'o2', relCe: 0, sedE: 0, sedStopped: true, cfg: { mode: 'VCV', vt: 450, fr: 14, peep: 5, fio2: 50, o2dev: 'reserv' } }, o)); s.warm(12); return s; };
  let s = mk({ stemi: { loc: 'inf', onset: 90 } }); adv(s, 1); check('SCACEST inferior: ST en II', s.S.ecg.st, 2.5, 3.5, ' mm');
  s = mk({ stemi: { loc: 'ant', onset: 90 } }); adv(s, 1); check('SCACEST anterior: descenso especular en II', s.S.ecg.st, -1.5, -.5, ' mm');
  let r = 0, r0 = 0; for (let k = 1; k <= 30; k++) { const a = mk({ seed: k, stemi: { loc: 'inf', onset: 90 } }); adv(a, .5); a.drug('tnk', 1); adv(a, 45); if (a.S.stemi.reperf) r++; const b = mk({ seed: k, stemi: { loc: 'inf', onset: 90 } }); adv(b, 45.5); if (b.S.stemi.reperf) r0++; }
  check('Tenecteplasa a los 90 min de evolución: reperfusión en 45 min', r / 30 * 100, 55, 90, ' %'); check('Sin fibrinólisis: reperfusión', r0 / 30 * 100, 0, 0, ' %');
  const ntgDrop = rv => { const a = mk({ seed: 5, stemi: { loc: 'inf', rv, onset: 90 } }); adv(a, 1); const t0 = a.S.tas; a.drug('ntg', 900); adv(a, 4); return t0 - a.S.tas; };
  const dRv = ntgDrop(true), dNo = ntgDrop(false); check('Nitroglicerina con infarto de VD: caída de la TAS', dRv, 35, 80, ' mmHg'); check('Sin afectación del VD: caída menor', dRv - dNo, 15, 60, ' mmHg');
  s = mk({ tamp: .62, tampRate: .012 }); check('Taponamiento: TAS al empezar', s.S.tas, 75, 92, ' mmHg'); adv(s, 10); check('Taponamiento sin tratar: TAS a 10 min', s.S.arrest ? 0 : s.S.tas, 0, 80, ' mmHg');
  let arr = 0; for (let k = 1; k <= 20; k++) { const a = mk({ seed: k, tamp: .62, tampRate: .012 }); adv(a, 25); if (a.S.arrest) arr++; } check('Taponamiento sin tratar: AESP en 25 min', arr / 20 * 100, 50, 100, ' %');
  s = mk({ tamp: .62, tampRate: .012 }); adv(s, .5); s.action('fluid', 7); adv(s, .3); s.action('pericardio'); adv(s, 8); check('Volumen y pericardiocentesis: TAS a 9 min', s.S.tas, 105, 150, ' mmHg');
  const peepDrop = () => { const a = mk({ seed: 4, tamp: .62, iface: 'tube', relCe: 9, sedE: 3, sedStopped: false, cfg: { mode: 'VCV', vt: 400, fr: 14, peep: 5, fio2: 50 } }); adv(a, 2); const t5 = a.S.tas; a.setCfg(Object.assign({}, a.S.cfg, { peep: 12 })); adv(a, 2); return t5 - a.S.tas; };
  check('Taponamiento: subir la PEEP de 5 a 12 baja la TAS', peepDrop(), 10, 60, ' mmHg');
  s = mk({ tamp: .62 }); check('Ecografía clínica: ve el taponamiento', /taponamiento/.test(s.eco()) ? 1 : 0, 1, 1); s = mk({ stemi: { loc: 'inf', rv: true } }); check('ECG de 12 derivaciones: SCACEST inferior con VD', /inferior/.test(s.ecg12()) && /V4R, elevaci/.test(s.ecg12()) ? 1 : 0, 1, 1); }

console.log('— Shock distributivo (v1.5): sepsis, sobrecarga de volumen y neurogénico');
{ const mk = o => { const s = VMI.create(Object.assign({ pheno: 'sano', seed: 3, scale: 10, iface: 'o2', relCe: 0, sedE: 0, sedStopped: true, peso: 62, cfg: { mode: 'VCV', vt: 450, fr: 14, peep: 5, fio2: 50, o2dev: 'gafas' } }, o)); s.warm(12); return s; };
  const sep = () => mk({ vaso: .45, vasoRate: .006, deficit: .4 });
  let s = sep(); adv(s, 1); check('Shock séptico: PAM al empezar', s.S.pam, 50, 64, ' mmHg'); check('Presión de pulso ancha (vasoplejia)', s.S.tas - s.S.tad, 33, 60, ' mmHg'); check('Taquicardia', s.S.fc, 105, 140, ' lpm');
  adv(s, 20); check('Sin tratar: PAM a los 21 min', s.S.pam, 30, 55, ' mmHg'); check('Sin tratar: lactato sube', s.S.lact, 4.5, 9, ' mmol/L');
  s = sep(); adv(s, 1); const p0 = s.S.pam; for (let i = 0; i < 3; i++) { s.action('fluid', 500 / 62); adv(s, 4); } const p15 = s.S.pam; s.action('fluid', 500 / 62); adv(s, 4);
  check('1,5 L de cristaloide: sube la PAM', p15 - p0, 7, 20, ' mmHg'); check('El cuarto bolo ya casi no la sube', s.S.pam - p15, -5, 3, ' mmHg');
  s.setNor(.1); adv(s, 4); check('Con noradrenalina 0,1: PAM ≥ 65', s.S.pam, 65, 95, ' mmHg');
  const over = tol => { const a = mk({ vaso: .35, deficit: .15, fluidTol: tol, peso: 76, cfg: { mode: 'VCV', vt: 450, fr: 14, peep: 5, fio2: 50, o2dev: 'venturi35' } }); adv(a, 1); const s0 = a.S.spo2; for (let i = 0; i < 4; i++) { a.action('fluid', 500 / 76); adv(a, 2); } adv(a, 4); return (s0 - a.S.spo2) * 100; };
  check('Cardiópata (tolera 10 mL/kg): 2 L bajan la SpO₂', over(10), 3, 15, ' puntos'); check('Sin cardiopatía: casi no la bajan', over(35), -1, 1.5, ' puntos');
  const atb = (on) => { const a = sep(); adv(a, .5); if (on) a.drug('atb', 2); adv(a, 40); return a.S.vaso; }; check('Antibiótico precoz: la vasoplejia deja de progresar', atb(false) - atb(true), .08, .3);
  s = mk({ neurog: .8, peso: 78 }); adv(s, 1); check('Shock neurogénico: FC sin taquicardia', s.S.fc, 38, 58, ' lpm'); check('Shock neurogénico: PAM', s.S.pam, 50, 70, ' mmHg');
  s.drug('atr', .5); adv(s, 3); check('Atropina: sube la FC', s.S.fc, 55, 80, ' lpm'); s.setNor(.2); adv(s, 4); check('Noradrenalina 0,2: PAM ≥ 80', s.S.pam, 78, 100, ' mmHg'); }

console.log('— Trauma torácico y quemado (v1.6): hemotórax, volet, analgesia y fluidos del gran quemado');
{ const avg = (sim, min, f) => { let a = 0, n = 0; adv(sim, min, S => { a += f(S); n++; }); return a / n; };
  let L = load('hemotorax', { seed: 4, scale: 10 }), s = L.sim; adv(s, .5);
  check('Hemotórax: SpO₂ con reservorio al empezar', s.S.spo2 * 100, 84, 91, ' %'); check('Hemotórax: TAS al empezar', s.S.tas, 75, 95, ' mmHg');
  const ex0 = s.explore().join(' '), sp0 = s.S.spo2; check('Exploración: matidez y murmullo abolido', /matidez/.test(ex0) ? 1 : 0, 1, 1); check('Ecografía: hemotórax', /hemotórax/.test(s.eco()) ? 1 : 0, 1, 1);
  s.action('drain'); adv(s, 3); check('Drenaje: sale el hemotórax', s.S.htxFirst, 1200, 1700, ' mL'); check('Drenaje: sube la SpO₂', (s.S.spo2 - sp0) * 100, 4, 12, ' puntos');
  check('Tras el drenaje, el registro lo anota', s.S.log.some(x => /Drenaje torácico: salen/.test(x[1])) ? 1 : 0, 1, 1); check('Sigue drenando (criterio de toracotomía)', s.S.bleedNow * 240000, 300, 1100, ' mL/h');
  const exD = s.explore().join(' '); check('La exploración muestra el débito del drenaje', /mL\/h/.test(exD) && !/matidez/.test(exD) ? 1 : 0, 1, 1);
  const vol = txa => { const a = load('hemotorax', { seed: 4, scale: 10 }).sim; adv(a, .5); a.action('drain'); if (txa) a.drug('txa', 1); adv(a, 15); return a.S.bleedNow * 240000; }; check('El tranexámico reduce el débito', vol(false) - vol(true), 60, 400, ' mL/h');
  L = load('volet', { seed: 4, scale: 10 }); s = L.sim; adv(s, 1); const rr0 = s.S.pat.rr, pe0 = s.S.painEff;
  check('Volet: taquipnea con dolor', rr0, 28, 45, ' rpm'); check('Volet: exploración con respiración paradójica', /paradójica/.test(s.explore().join(' ')) ? 1 : 0, 1, 1);
  s.drug('ket', .3 * 75); adv(s, 2); check('Ketamina 0,3 mg/kg: alivia el dolor', pe0 - s.S.painEff, .35, .85); check('Ketamina analgésica: casi no seda', s.S.sedTot, 0, .1); check('Analgesia: baja la FR', rr0 - s.S.pat.rr, 2, 20, ' rpm');
  const spA = avg(s, 2, S => S.spo2 * 100); s.setIface('mask'); s.S.mask.leak10 = 15; s.setCfg(Object.assign({}, s.S.cfg, { mode: 'PSV', ps: 6, peep: 8, rise: .15, trigE: 40, timax: 1.2, trigI: 2, fio2: 60, pmax: 30, fr: 12 })); s.setStandby(false);
  adv(s, 2); check('VMNI con PEEP 8: recluta la contusión (SpO₂)', avg(s, 3, S => S.spo2 * 100) - spA, 3, 12, ' puntos');
  const ind = load('volet', { seed: 4, scale: 10 }).sim; adv(ind, .5); ind.drug('ket', 1.5 * 75); adv(ind, 1.5); check('Ketamina de inducción: sí seda', ind.S.sedTot, .45, 1);
  L = load('granQuemado', { seed: 4, scale: 10 }); s = L.sim; adv(s, .5); check('Quemado: exploración con la superficie quemada', /36 % de superficie/.test(s.explore().join(' ')) ? 1 : 0, 1, 1);
  s.drug('fent', 75 * L.fW); adv(s, 4); check('Fentanilo 1 mcg/kg con dolor: casi no deprime la respiración', s.S.opiR, 0, .15); check('Fentanilo: alivia el dolor', s.S.painEff, 0, .5);
  const burn = (rate, warm) => { const a = load('granQuemado', { seed: 4, scale: 10 }).sim; adv(a, .5); const d0 = a.S.deficit; if (rate) a.setFluidRate(rate); if (warm) a.action('warm'); adv(a, 30); return { dd: a.S.deficit - d0, t: a.S.temp, fk: a.S.fluidKg }; };
  const b0 = burn(0, false), b1 = burn(500, true);
  check('Sin fluidos: la fuga capilar sube el déficit en 30 min', b0.dd, .05, .14); check('500 mL/h: déficit estable', b1.dd, -.03, .03); check('500 mL/h durante 30 min', b1.fk * 80, 220, 280, ' mL');
  check('Sin aislar: hipotermia a los 30 min', b0.t, 33.5, 35.2, ' °C'); check('Con manta y calor: temperatura mantenida', b1.t, 35.8, 37, ' °C');
  const V = global.SIM_VARIANT; let rb = 0, px = 0; for (let k = 1; k <= 12; k++) { if (V.make('hemotorax', k * 7919).vev === 'rebleed') rb++; if (V.make('volet', k * 7919).vev === 'ptx') px++; }
  check('Variantes del hemotórax: sin «resangrado» (no hay hemostasia posible)', rb, 0, 0); check('Variantes del volet: neumotórax a tensión añadido', px, 4, 12); }

console.log('— Neurología (v1.7): estatus epiléptico, ictus e hiponatremia');
{ const mk = o => { const s = VMI.create(Object.assign({ pheno: 'sano', seed: 3, scale: 10, iface: 'o2', relCe: 0, sedE: 0, sedStopped: true, peso: 78, sex: 'h', talla: 175, cfg: { mode: 'VCV', vt: 500, fr: 14, peep: 5, fio2: 50, o2dev: 'reserv' } }, o)); s.warm(12); return s; };
  const seiz = s => s.S.clin < s.S.seizUntil;
  let s = mk({ se: { r: .97, since: 12 } }); adv(s, 1); const t0 = s.S.temp; check('Estatus: SpO₂ con reservorio', s.S.spo2 * 100, 84, 94, ' %'); adv(s, 20);
  check('Estatus sin tratar: sigue convulsionando a los 21 min', seiz(s) ? 1 : 0, 1, 1); check('La crisis mantenida calienta', s.S.temp - t0, .4, 1, ' °C'); check('Lactato alto', s.S.lact, 4, 9, ' mmol/L');
  const stop = (r, since, n = 20) => { let k = 0; for (let i = 1; i <= n; i++) { const a = mk({ seed: i, se: { r, since } }); adv(a, .5); a.drug('mid', 10 * 75 / 78); adv(a, 5); if (!seiz(a)) k++; } return k / n * 100; };
  const early = stop(0, 5), late = stop(0, 45); check('Midazolam 10 mg en un estatus de 5 min: cede', early, 75, 100, ' %'); check('El mismo a los 45 min: cede menos', early - late, 15, 80, ' puntos');
  let ref = 0; for (let i = 1; i <= 20; i++) { const a = mk({ seed: i, se: { r: .99, since: 12 } }); adv(a, .5); a.drug('mid', 10 * 75 / 78); a.drug('lev', 4327); adv(a, 10); if (seiz(a)) ref++; } check('Refractario: midazolam y levetiracetam no bastan', ref / 20 * 100, 75, 100, ' %');
  s = mk({ se: { r: .97, since: 12 } }); adv(s, .5); s.drug('rel', 18); adv(s, 3); check('Con el relajante solo, la crisis sigue (sin movimientos)', s.S.se.on ? 1 : 0, 1, 1); s.drug('prop', 115); s.perf('prop', 200 / 60 * 75 / 78); adv(s, 5); check('Propofol en perfusión: crisis controlada', seiz(s) ? 0 : 1, 1, 1); adv(s, 15); check('Con la perfusión mantenida no vuelve', seiz(s) ? 0 : 1, 1, 1);
  let L = load('ictusIsq', { seed: 4, scale: 10 }); s = L.sim; adv(s, .5); check('Ictus: exploración con RACE 7', /RACE 7/.test(s.explore().join(' ')) ? 1 : 0, 1, 1); check('Ictus: TAS de partida', s.S.tas, 200, 220, ' mmHg');
  const ta0 = s.S.tas; s.drug('labet', 20); adv(s, 8); check('Labetalol 20 mg: baja la TAS', ta0 - s.S.tas, 10, 30, ' mmHg'); s.action('ictus'); check('Código ictus en el registro', s.S.log.some(x => /Código ictus activado/.test(x[1])) ? 1 : 0, 1, 1);
  s = load('ictusIsq', { seed: 4, scale: 10 }).sim; adv(s, .5); s.drug('labet', 100); s.drug('urap', 100); adv(s, 25); check('Hipotensión relativa: la penumbra empeora (RACE)', s.race() - 7, 1, 3);
  const hem = n => { const a = load('hemCerebral', { seed: 4, scale: 10 }).sim; adv(a, .5); if (n) { a.drug('labet', 40); a.drug('urap', 50); } adv(a, 30); return a.S; };
  const h0 = hem(false), h1 = hem(true); check('Hemorragia sin bajar la TA: crece el hematoma en 30 min', h0.stroke.vol - 30, 7, 16, ' mL'); check('… y cae la GCS', h0.gcs, 3, 11); check('Con TAS ≤ 150: casi no crece', h1.stroke.vol - 30, 0, 6, ' mL');
  L = load('hiponatremia', { seed: 1, scale: 10 }); s = L.sim; adv(s, .2); s.S.access = 'iv'; check('Hiponatremia: la gasometría da el sodio', s.gas().na, 115, 117, ' mmol/L'); check('Con Na 116, confusa (sin convulsionar)', seiz(s) ? 0 : s.S.gcs, 8, 12);
  const na0 = s.S.na; s.drug('ssh3', 100); adv(s, 10); check('Salino hipertónico 3 % 100 mL: sube el Na', s.S.na - na0, 1.1, 1.7, ' mmol/L');
  const n1 = s.S.na; s.drug('shs', 1); adv(s, 10); check('Salino 7,5 % 250 mL: sube más', s.S.na - n1, 5, 9, ' mmol/L');
  s = mk({ na: 140, peso: 70 }); adv(s, .5); s.action('fluid', 2000 / 70); adv(s, 10); check('2 L de cristaloide con Na normal: el sodio no cambia', Math.abs(s.S.na - 140), 0, .3, ' mmol/L');
  let sz = 0; for (let i = 1; i <= 10; i++) { const a = mk({ seed: i, na: 116, sex: 'm', peso: 58, talla: 165 }); adv(a, 25); if (a.S.seizures > 0) sz++; } check('Na 116 sin tratar: convulsiona en 25 min', sz / 10 * 100, 50, 100, ' %');
  sz = 0; for (let i = 1; i <= 10; i++) { const a = mk({ seed: i, na: 126, sex: 'm', peso: 58, talla: 165 }); adv(a, 25); if (a.S.seizures > 0) sz++; } check('Na 126: no convulsiona', sz, 0, 0); }

console.log('— Tóxicos y cetoacidosis (v1.8): calcioantagonistas, betabloqueantes, organofosforados, cocaína y cetoacidosis intubada');
{ const adv2 = (L, m) => adv(L.sim, m);
  let L = load('verapamilo', { seed: 4, scale: 10 }); adv2(L, .5); check('Verapamilo: FC', L.S.fc, 32, 46, ' lpm'); check('Verapamilo: TAS', L.S.tas, 55, 75, ' mmHg');
  const v0 = L.S.tas; L.sim.drug('atr', 1); adv2(L, 5); check('Atropina: casi no sube la TAS', L.S.tas - v0, -3, 8, ' mmHg');
  L = load('verapamilo', { seed: 4, scale: 10 }); adv2(L, .5); L.sim.drug('ca', 1); adv2(L, 3); const vc = L.S.tas; check('Calcio: sube algo la TAS', vc - v0, 5, 25, ' mmHg');
  L.sim.drug('insHD', 75); L.sim.perf('insHD', 1 / 60); adv2(L, 3); const v3 = L.S.tas; adv2(L, 22); check('Insulina a dosis altas: efecto tardío pero grande', L.S.tas - v3, 15, 50, ' mmHg'); check('… y baja la glucemia', L.S.glu, 150, 270, ' mg/dL'); check('… y el potasio', L.S.k, 3, 4.2, ' mmol/L');
  const bb = glu => { const a = load('betabloq', { seed: 4, scale: 10 }); adv2(a, .5); const t0 = a.S.tas; if (glu) a.sim.drug('glucg', 5 * 75 / 82); else a.sim.drug('ca', 1); adv2(a, 8); return a.S.tas - t0; };
  check('Betabloqueante: el glucagón rinde más que el calcio', bb(true) - bb(false), 10, 40, ' mmHg');
  L = load('organofosf', { seed: 4, scale: 10 }); adv2(L, .5); check('Organofosforado: bradicardia', L.S.fc, 38, 55, ' lpm'); check('Broncorrea: SpO₂ con reservorio', L.S.spo2 * 100, 84, 92, ' %');
  check('Exploración: secreciones y miosis', /puntiformes/.test(L.sim.explore().join(' ')) ? 1 : 0, 1, 1);
  const op0 = L.S.op; adv2(L, 15); check('Sin descontaminar, sigue absorbiéndose', L.S.op - op0, .08, .2);
  L = load('organofosf', { seed: 4, scale: 10 }); adv2(L, .5); L.sim.action('decont'); [2, 4, 8].forEach(d => L.sim.drug('atr', d)); adv2(L, 3); check('14 mg de atropina: aún no atropinizado', L.S.opM, .2, .5); L.sim.drug('atr', 16); adv2(L, 3);
  check('30 mg: atropinizado (FC > 80)', L.S.fc, 80, 130, ' lpm'); check('… y el tórax seco (SpO₂)', L.S.spo2 * 100, 94, 100, ' %');
  L = load('organofosf', { seed: 4, scale: 10 }); adv2(L, .5); L.sim.drug('sux', 15); adv2(L, 10); check('Succinilcolina con organofosforado: sigue relajado a los 10 min', L.S.relTot, .6, 1);
  L = load('cocaina', { seed: 4, scale: 10 }); adv2(L, .5); check('Cocaína: FC', L.S.fc, 140, 180, ' lpm'); check('Cocaína: TAS', L.S.tas, 180, 230, ' mmHg');
  const c0 = L.S.temp; adv2(L, 10); check('Sin tratar, la temperatura sigue subiendo', L.S.temp - c0, .5, 1.2, ' °C');
  L = load('cocaina', { seed: 4, scale: 10 }); adv2(L, .5); L.sim.drug('mid', 10 * 75 / 80); L.sim.action('cool'); adv2(L, 10); check('Midazolam: baja la FC', L.S.fc, 85, 125, ' lpm'); check('Enfriamiento: −1 °C en 10 min', c0 - L.S.temp, .8, 1.8, ' °C');
  check('QRS algo ancho con cocaína', L.S.ecg.qrs * 1000, 115, 135, ' ms');
  const dka = fr => { const a = load('cadIntubada', { seed: 4, scale: 10 }); adv2(a, .3); a.sim.setCfg(Object.assign({}, a.S.cfg, { fr, vt: 440, ti: .8 })); adv2(a, 15); return a.S; };
  const d14 = dka(14), d28 = dka(28); check('Cetoacidosis intubada con FR 14: pH', d14.ph, 6.7, 6.95); check('Con FR 28: pH (mantiene su compensación)', d28.ph, 7.05, 7.2); check('Con FR 28: pCO₂', d28.pco2, 18, 26, ' mmHg');
  check('Con FR 14: hipotensión por la acidemia', d14.tas, 50, 92, ' mmHg');
  L = load('cadIntubada', { seed: 4, scale: 10 }); adv2(L, .3); L.sim.setCfg(Object.assign({}, L.S.cfg, { fr: 28, vt: 440, ti: .8 })); const g0 = L.S.glu, k0 = L.S.k; L.sim.perf('ins', .1 * 75 / 10 / 60); adv2(L, 30);
  check('Insulina 0,1 UI/kg/h: la glucemia baja 50–75 por hora', (g0 - L.S.glu) * 2, 40, 100, ' mg/dL/h'); check('… y baja el potasio', k0 - L.S.k, .3, 1.2, ' mmol/L'); }

console.log('— Reanimación neonatal (v1.9): insuflaciones, ventilación, compresiones 3:1 y adrenalina');
{ const nb = (k, acts, m) => { const L = load(k, { seed: 4, scale: 10 }), s = L.sim, out = {}; adv(s, .05); for (const [t, f] of acts) { if (s.S.clin < t) adv(s, t - s.S.clin); f(s); } adv(s, m - s.S.clin); out.S = s.S; out.sim = s; return out; };
  let r = nb('rnApnea', [], 5); check('Recién nacido apneico sin reanimar: FC a los 5 min', r.S.fc, 20, 50, ' lpm'); check('… y SpO₂', r.S.spo2 * 100, 15, 40, ' %');
  check('Exploración con Apgar', /Apgar ≈ \d/.test(r.sim.explore().join(' ')) ? 1 : 0, 1, 1);
  r = nb('rnApnea', [[.1, s => s.action('warm')], [.2, s => s.action('infl')]], 3); check('Insuflaciones y ventilación: FC > 100 antes de 3 min', r.S.neo.hr100 != null ? r.S.neo.hr100 : 99, 0, 3, ' min');
  adv(r.sim, 2); check('SpO₂ a los 5 min con aire (transición)', r.S.spo2 * 100, 80, 96, ' %'); adv(r.sim, 3); check('Respira solo antes de 8 min', r.S.neo.firstBreath != null ? r.S.neo.firstBreath : 99, 2, 8, ' min');
  const bagOnly = nb('rnApnea', [[.2, s => s.action('bag')]], 3); check('Sin insuflaciones iniciales, la FC tarda más', (bagOnly.S.neo.hr100 != null ? bagOnly.S.neo.hr100 : 9) - r.S.neo.hr100, .4, 9, ' min');
  r = nb('rnRcp', [[.1, s => s.action('warm')], [.2, s => s.action('infl')]], 2); check('Con el tórax sin moverse, la FC no sube', r.S.fc, 20, 55, ' lpm');
  const vent = nb('rnRcp', [[.1, s => s.action('warm')], [.2, s => s.action('infl')], [.6, s => { s.action('neoPos'); s.action('neoSuct'); s.action('infl'); }], [1.4, s => s.setCfg(Object.assign({}, s.S.cfg, { fio2: 100 }))], [1.5, s => s.action('neoComp')]], 15);
  const adr = nb('rnRcp', [[.1, s => s.action('warm')], [.2, s => s.action('infl')], [.6, s => { s.action('neoPos'); s.action('neoSuct'); s.action('infl'); }], [1.4, s => s.setCfg(Object.assign({}, s.S.cfg, { fio2: 100 }))], [1.5, s => s.action('neoComp')], [3.5, s => { s.S.access = 'iv'; s.drug('adr', 150); }]], 15);
  check('Bradicardia extrema: con adrenalina, FC > 60 antes', (vent.S.neo.hr60 || 99) - (adr.S.neo.hr60 || 99), 1, 10, ' min'); check('Con adrenalina, FC > 60 antes de 6 min', adr.S.neo.hr60 || 99, 2, 6, ' min');
  check('FC final con la reanimación completa', adr.S.fc, 120, 175, ' lpm');
  const wet = nb('rnApnea', [], 10), dry = nb('rnApnea', [[.1, s => s.action('warm')]], 10); check('Mojado y sin calor: hipotermia a los 10 min', wet.S.temp, 35, 35.8, ' °C'); check('Secado y abrigado: normotermia', dry.S.temp, 36.5, 37.2, ' °C');
  global.window = global; require('../src/drugs.js'); const DR = global.SIM_DRUGS; check('Adrenalina en el recién nacido de 3,1 kg: 20 mcg/kg', DR.doseOf(DR.DRUGITEMS.adr1, 3.1, true) * 1000, 60, 64, ' mcg'); check('En un niño de 26 kg sigue siendo 10 mcg/kg', DR.doseOf(DR.DRUGITEMS.adr1, 26, true) * 1000, 255, 265, ' mcg'); }

console.log('— Ambiental de Canarias (v1.10): ahogamiento, enfermedad descompresiva y golpe de calor');
{ const dci = (o2, alt, vol) => { const L = load('buceoDci', { seed: 4, scale: 10 }), s = L.sim; if (o2) s.setCfg(Object.assign({}, s.S.cfg, { o2dev: 'reserv' })); if (vol) s.action('fluid', 1000 / 84); adv(s, 2.5); s.setAltitude(alt); adv(s, 30); return s.S.dciE; };
  let L = load('buceoDci', { seed: 4, scale: 10 }); adv(L.sim, .5); check('Descompresiva: exploración con paraparesia', /Paraparesia/.test(L.sim.explore().join(' ')) ? 1 : 0, 1, 1);
  const a = dci(false, 1500, false), b = dci(true, 1500, false), c2 = dci(true, 300, false), d = dci(true, 300, true);
  check('Sin O₂ y a 1.500 m, empeora en 30 min', a - .65 * 760 / VMI.pbarAt(0), .05, .4); check('El O₂ al 100 % reduce la carga de burbujas', a - b, .2, .5); check('Volar a 300 m en vez de 1.500 m', b - c2, .08, .25); check('El volumen ayuda', c2 - d, .05, .2);
  L = load('golpeCalor', { seed: 4, scale: 10 }); adv(L.sim, .5); const t0 = L.S.temp; check('Golpe de calor: GCS', L.S.gcs, 3, 13); adv(L.sim, 15); check('Sin enfriar, sigue subiendo', L.S.temp - t0, .1, .6, ' °C'); check('… y cae la TAS', L.S.tas, 60, 92, ' mmHg');
  L = load('golpeCalor', { seed: 4, scale: 10 }); adv(L.sim, .5); L.sim.action('cool'); adv(L.sim, 10); check('Enfriamiento activo: −1,3 °C en 10 min', t0 - L.S.temp, 1, 1.8, ' °C'); adv(L.sim, 40); check('El enfriamiento no baja de 37 °C', L.S.temp, 37, 37.4, ' °C');
  const dr = niv => { const a = load('ahogVmni', { seed: 4, scale: 10 }), s = a.sim; adv(s, .3); if (niv) { s.setIface('mask'); s.S.mask.leak10 = 15; s.setCfg(Object.assign({}, s.S.cfg, { mode: 'PSV', ps: 6, peep: 10, fio2: 100, trigI: 2, trigE: 40, rise: .15, timax: 1.2, pmax: 30, fr: 12 })); s.setStandby(false); } adv(s, 6); return s.S.spo2 * 100; };
  check('Ahogamiento: VMNI con PEEP 10 frente a reservorio', dr(true) - dr(false), 5, 14, ' puntos de SpO₂'); }

console.log('— Pediatría por edad (v1.11): normalidad, peso estimado, cinta pediátrica y triángulo de evaluación');
{ const n6 = VMI.pedNorms(6), n05 = VMI.pedNorms(.5), n15 = VMI.pedNorms(15);
  check('TAS mínima a los 6 años (70 + 2 × edad)', n6.tasMin, 82, 82, ' mmHg'); check('FC normal del lactante (límite alto)', n05.fc[1], 160, 160, ' lpm'); check('TAS mínima a los 15 años', n15.tasMin, 90, 90, ' mmHg');
  check('Peso estimado a los 6 años (3 × edad + 7)', VMI.pesoPorEdad(6), 25, 25, ' kg'); check('Peso estimado a los 6 meses', VMI.pesoPorEdad(.5), 7, 7, ' kg'); check('Edad estimada con 25 kg', VMI.ageFromWeight(25), 5.8, 6.2, ' años');
  const k = VMI.pedKit(20, 6); check('Tubo con balón a los 6 años (edad/4 + 3,5)', k.tubo, 5, 5); check('Profundidad oral (edad/2 + 12)', k.prof, 15, 15, ' cm'); check('i-gel con 20 kg', +k.igel, 2, 2); check('Desfibrilación 4 J/kg', k.julios, 80, 80, ' J');
  const kn = VMI.pedKit(3.4, 0); check('Recién nacido: tubo 3,5', kn.tubo, 3.5, 3.5); check('Recién nacido: profundidad 6 + kg', kn.prof, 9, 9, ' cm');
  const tepOf = key => { const L = load(key, { seed: 4, scale: 10 }); adv(L.sim, .5); return L.sim.explore().join(' '); };
  check('Triángulo en la bronquiolitis: respiración alterada', /respiración alterada/.test(tepOf('bronquiolitis')) ? 1 : 0, 1, 1); check('Triángulo en la anafilaxia pediátrica: circulación alterada', /circulación alterada/.test(tepOf('anafPed')) ? 1 : 0, 1, 1);
  check('Niño intubado: triángulo no valorable', /no valorable/.test(tepOf('tcePed')) ? 1 : 0, 1, 1); check('Lactante: Glasgow pediátrica', /Glasgow pediátrica/.test(tepOf('bronquiolitis')) ? 1 : 0, 1, 1);
  const L = load('tcePed', { seed: 4, scale: 10 }); check('Edad del caso en el motor', L.S.age, 6, 6, ' años'); }

console.log('— Prematuro y transporte neonatal (v1.12): CPAP con PEEP, bolsa de plástico, incubadora, glucosa y neumotórax');
{ const nb = (k, acts, m) => { const L = load(k, { seed: 4, scale: 10 }), s = L.sim; adv(s, .05); for (const [t, f] of acts) { if (s.S.clin < t) adv(s, t - s.S.clin); f(s); } adv(s, m - s.S.clin); return { S: s.S, sim: s }; };
  const fi = v => s => s.setCfg(Object.assign({}, s.S.cfg, { fio2: v }));
  let r = nb('prematuro', [], 8); check('Prematuro de 27 semanas sin soporte: se agota y entra en apnea antes de 8 min', r.S.neo.apnea ? 1 : 0, 1, 1); check('… con SpO₂ muy baja', r.S.spo2 * 100, 15, 50, ' %');
  check('Exploración: quejido, tiraje y Silverman', /Silverman/.test(nb('prematuro', [], .5).sim.explore().join(' ')) ? 1 : 0, 1, 1);
  const cp = nb('prematuro', [[.5, s => s.action('cpap')], [.6, fi(30)]], 6); check('CPAP 5 y FiO₂ 30 % desde el principio: SpO₂ a los 6 min', cp.S.spo2 * 100, 85, 96, ' %'); check('… pulmón aireado', cp.S.neo.aer, .7, .9); check('… sigue respirando', cp.S.neo.apnea ? 0 : 1, 1, 1);
  const p8 = nb('prematuro', [[.5, s => { s.setNeo({ peep: 8 }); s.action('cpap'); }], [.6, fi(30)]], 6); check('Con PEEP 8 se airea más que con 5', p8.S.neo.aer - cp.S.neo.aer, .05, .4);
  const ff = nb('prematuro', [[.6, fi(30)]], 9); check('Solo oxígeno, sin CPAP: también se agota', ff.S.neo.apnea || ff.S.spo2 < .75 ? 1 : 0, 1, 1);
  const T0 = nb('prematuro', [], 15).S.temp, Tw = nb('prematuro', [[.3, s => s.action('warm')]], 15).S.temp, Tb = nb('prematuro', [[.2, s => s.action('plast')], [.3, s => s.action('warm')]], 15).S.temp;
  check('Prematuro mojado y sin calor: hipotermia a los 15 min', T0, 33, 35, ' °C'); check('Solo calor y gorro, sin bolsa: sigue enfriándose', Tw, 35.5, 36.4, ' °C'); check('Bolsa de plástico y calor: normotermia', Tb, 36.5, 37.5, ' °C');
  const g0 = nb('prematuro', [], 15).S.glu, g1 = nb('prematuro', [[.3, s => { s.S.access = 'iv'; }], [4, s => { s.drug('gluc', .2 * 75); s.setGluPerf(3 * .1 / 60 * 75); }]], 15).S.glu;
  check('Sin aporte, el prematuro se queda hipoglucémico', g0, 20, 40, ' mg/dL'); check('G10 % 2 mL/kg y 3 mL/kg/h: glucemia a los 15 min', g1, 55, 110, ' mg/dL');
  global.window = global; require('../src/drugs.js'); const DR = global.SIM_DRUGS;
  check('Glucosa en el prematuro de 1 kg: 200 mg/kg', DR.doseOf(DR.DRUGITEMS.gluc10, 1, true), .2, .2, ' g'); check('Perfusión de G10 % por peso (3 mL/kg/h ≈ 5 mg/kg/min)', 3 * 100 / 60, 5, 5, ' mg/kg/min'); check('Glucosa 10 % neonatal en las perfusiones', DR.PERFS.some(p => p.id === 'g10kg') ? 1 : 0, 1, 1);
  const tr = (acts, m) => { const L = load('trasladoNeo', { seed: 4, scale: 10 }), s = L.sim; adv(s, .05); for (const [t, f] of acts) { if (s.S.clin < t) adv(s, t - s.S.clin); f(s); } adv(s, m - s.S.clin); return s.S; };
  const cold = tr([], 14), warm = tr([[.3, s => s.action('warm')]], 14); check('Traslado sin encender la incubadora: hipotermia a los 14 min', cold.temp, 35.3, 36.2, ' °C'); check('Incubadora encendida: normotermia', warm.temp, 36.5, 37.5, ' °C');
  const nod = tr([[.3, s => s.action('warm')], [2, s => s.event('ptx')]], 15), dec = tr([[.3, s => s.action('warm')], [2, s => s.event('ptx')], [4, s => s.action('decomp')]], 15);
  check('Neumotórax a tensión en el prematuro sin descomprimir: bradicardia', nod.fc, 20, 100, ' lpm'); check('Con la punción: SpO₂', dec.spo2 * 100, 88, 97, ' %'); check('… y FC', dec.fc, 130, 175, ' lpm');
  check('Respiraciones de 5–8 mL: el prematuro de 1 kg ventila (PaCO₂ con CPAP)', cp.S.pco2, 30, 55, ' mmHg'); }

console.log('— Respiratorio y shock pediátricos (v1.13): asma, neumonía con shock séptico, deshidratación y cetoacidosis');
{ const run = (k, acts, m) => { const L = load(k, { seed: 4, scale: 10 }), s = L.sim; adv(s, .05); for (const [t, f] of acts) { if (s.S.clin < t) adv(s, t - s.S.clin); f(s); } adv(s, m - s.S.clin); return s; };
  global.window = global; require('../src/drugs.js'); const DR = global.SIM_DRUGS, give = id => s => { if (!s.S.access) s.S.access = 'io'; s.drug(DR.DRUGITEMS[id].k, DR.amountOf(DR.DRUGITEMS[id], s.S.peso, true)); };
  const res = s => s.setCfg(Object.assign({}, s.S.cfg, { o2dev: 'reserv' })), bolo = s => s.action('fluid', 10);
  let a = run('asmaPed', [], 18); check('Asma grave sin tratar: se agota y sube la PaCO₂', a.S.arrest || a.S.pco2 > 55 ? 1 : 0, 1, 1); check('… con tórax silente', a.S.arrest || /silente/.test(a.explore().join(' ')) ? 1 : 0, 1, 1);
  a = run('asmaPed', [[.3, res], [.5, give('salb')], [1.5, give('cort')], [5.5, give('salb')], [10.5, give('salb')], [11, give('mgso4')]], 25); check('Asma tratada: PaCO₂ a los 25 min (sin hipercapnia)', a.S.pco2, 22, 45, ' mmHg'); check('… y sin agotamiento', a.S.weak, 0, .15); check('… y SpO₂ con reservorio', a.S.spo2 * 100, 94, 100, ' %');
  check('Sulfato de magnesio en el niño de 24 kg: 50 mg/kg', DR.doseOf(DR.DRUGITEMS.mgso4, 24, true), 1.2, 1.2, ' g'); check('Metilprednisolona en el niño: 2 mg/kg', DR.doseOf(DR.DRUGITEMS.cort, 24, true), 48, 48, ' mg'); check('Salino hipertónico 3 % en el niño de 30 kg: 5 mL/kg', DR.doseOf(DR.DRUGITEMS.ssh3, 30, true), 150, 150, ' mL');
  let n = run('neumoSepsis', [], 3), n2 = run('neumoSepsis', [[.3, res]], 3); check('Neumonía: SpO₂ con gafas', n.S.spo2 * 100, 80, 90, ' %'); check('… responde al O₂ (baja V/Q, no shunt puro)', n2.S.spo2 * 100, 94, 100, ' %');
  const sep = [[.3, res], [.5, s => { s.S.access = 'io'; }], [1.5, bolo], [2, give('ceftri')], [4, bolo], [6.5, bolo], [9, bolo], [11, s => DR.PERFS.find(p => p.id === 'adrIkg').run(s, .1)]];
  n = run('neumoSepsis', [], 20); n2 = run('neumoSepsis', sep, 20); check('Shock séptico pediátrico sin tratar: TAS a los 20 min', n.S.tas, 40, 70, ' mmHg'); check('Bolos de 10 mL/kg, antibiótico y adrenalina: TAS', n2.S.tas, 85, 130, ' mmHg');
  const over = run('neumoSepsis', [[.3, res], [.5, s => { s.S.access = 'io'; }], ...[1, 2, 3, 4, 5, 6, 7].map(t => [t, bolo])], 12); check('Siete bolos: sobrecarga con hígado palpable', /hígado palpable/.test(over.explore().join(' ')) ? 1 : 0, 1, 1); check('… y peor oxigenación que con cuatro', n2.S.spo2 * 100 - over.S.spo2 * 100, 1, 15, ' puntos');
  let d = run('deshidratacion', [], 6), d2 = run('deshidratacion', [[.5, s => { s.S.access = 'io'; }], [1.5, bolo], [4, bolo], [6.5, bolo]], 15); check('Lactante deshidratado: FC sin tratar (el niño compensa con taquicardia)', d.S.fc, 170, 200, ' lpm'); check('Tres bolos de 10 mL/kg: FC a los 15 min', d2.S.fc, 120, 155, ' lpm');
  check('G10 % 2 mL/kg en el lactante hipoglucémico', run('deshidratacion', [[.5, s => { s.S.access = 'io'; }], [1, give('gluc10')]], 3).S.glu, 80, 160, ' mg/dL');
  const good = run('cadPed', [[.8, bolo], [14, give('manit')]], 30), badA = [[.5, s => s.action('fluid', 20)], [3, s => s.action('fluid', 20)], [4, give('bic')], [5, give('ins')]], bad = run('cadPed', badA, 15), late = run('cadPed', badA, 22), none = run('cadPed', [[.8, bolo]], 30);
  check('Cetoacidosis: aparece el edema cerebral', good.S.ced.on ? 1 : 0, 1, 1); check('Manitol: Glasgow a los 30 min', good.S.gcs, 13, 15); check('Sin osmoterapia: Glasgow a los 30 min', none.S.gcs, 7, 12);
  check('40 mL/kg, bicarbonato y bolo de insulina: edema grave (Glasgow)', bad.S.gcs, 3, 7); check('… con Cushing (TAS alta y bradicardia)', bad.S.tas > 120 && bad.S.fc < 85 ? 1 : 0, 1, 1); check('… y si sigue sin tratarse, la herniación deja al niño sin respirar (SpO₂)', late.S.spo2 * 100, 0, 80, ' %');
  check('Adrenalina pediátrica en mcg/kg/min entre las perfusiones', DR.PERFS.some(p => p.id === 'adrIkg' && p.u === 'mcg/kg/min') ? 1 : 0, 1, 1); }

console.log('— Parada y trauma pediátricos (v1.14): ventilaciones de rescate, 15:2, ahogamiento, trauma con TCE');
{ const run = (k, acts, m, seed) => { const L = load(k, { seed: seed || 4, scale: 10 }), s = L.sim; adv(s, .05); for (const [t, f] of acts) { if (s.S.clin < t) adv(s, t - s.S.clin); f(s); } adv(s, m - s.S.clin); return s; };
  global.window = global; require('../src/drugs.js'); const DR = global.SIM_DRUGS, give = id => s => { if (!s.S.access) s.S.access = 'io'; s.drug(DR.DRUGITEMS[id].k, DR.amountOf(DR.DRUGITEMS[id], s.S.peso, true)); };
  const rcp = rescue => { let ok = 0; for (let seed = 1; seed <= 24; seed++) { const L = load('ahogPiscina', { seed, scale: 1 }), s = L.sim; adv(s, .05); if (rescue) s.action('rescue'); else s.action('bag'); adv(s, .5); s.compress('manual'); s.setRatio(15); s.S.access = 'io'; adv(s, 1); s.drug('adr', DR.amountOf(DR.DRUGITEMS.adr1, 14, true)); for (let i = 0; i < 4 && s.S.arrest; i++) { adv(s, 2); s.check(); } if (!s.S.arrest) ok++; } return ok / 24; };
  const withR = rcp(true), sinR = rcp(false); check('Ahogamiento: RCE con ventilaciones de rescate al principio', withR * 100, 45, 100, ' %'); check('… más que sin ellas', (withR - sinR) * 100, 5, 80, ' puntos');
  check('Exploración de la niña ahogada: agua y espuma', /espuma/.test(load('ahogPiscina', { seed: 4, scale: 10 }).sim.explore().join(' ')) ? 1 : 0, 1, 1);
  const none = run('politraumaPed', [], 30), care = run('politraumaPed', [[.3, s => { s.S.access = 'io'; }], [1.2, s => s.action('blood', 20 * 10 / 300)], [1.5, give('txa')], [1.7, s => s.action('warm')], [2, give('ketA')], [5, s => s.action('blood', 20 * 10 / 300)]], 30);
  check('Trauma pediátrico sin tratar: TAS a los 30 min', none.S.tas, 60, 89, ' mmHg'); check('… lesión cerebral secundaria (Glasgow)', none.S.gcs, 6, 10); check('Con sangre 10 mL/kg, tranexámico y calor: TAS', care.S.tas, 95, 125, ' mmHg'); check('… y Glasgow conservado', care.S.gcs, 10, 12); check('… normotermia', care.S.temp, 35.5, 37.5, ' °C');
  check('Ácido tranexámico en el niño de 20 kg: 15 mg/kg', DR.doseOf(DR.DRUGITEMS.txa, 20, true) * (DR.DRUGITEMS.txa.u === 'g' ? 1000 : 1), 300, 300, ' mg'); }

console.log('— Tanda de parada (v1.15): descargas seguidas, gestante, torsade, hipotermia y causas reversibles');
{ global.window = global; require('../src/drugs.js'); const DR = global.SIM_DRUGS;
  const rate = (k, setup, n = 24) => { let ok = 0; for (let seed = 1; seed <= n; seed++) { const L = load(k, { seed, scale: 1 }), s = L.sim; adv(s, .05); setup(s); for (let i = 0; i < 6 && s.S.arrest; i++) { adv(s, 2); if (s.S.rhythm === 'vf' || s.S.rhythm === 'tvsp') s.shock(200, false); else s.check(); } if (!s.S.arrest) ok++; } return ok / n; };
  let L = load('fvMonitorizada', { seed: 3, scale: 1 }), s = L.sim; adv(s, .05); for (let i = 0; i < 3 && s.S.arrest && (s.S.rhythm === 'vf'); i++) s.shock(200, false); check('FV monitorizada: descargas seguidas sin RCP registradas', s.S.cpr.stacked ? 1 : 0, 1, 1);
  const cpr = s => { s.compress('manual'); s.setRatio(30); s.action('bag'); };
  const preg = rate('pcrGestante', s => { cpr(s); s.action('lud'); s.S.access = 'io'; for (let i = 0; i < 4; i++) s.action('fluid'); s.action('blood'); s.drug('adr', 1); }), pregNo = rate('pcrGestante', s => { cpr(s); s.S.access = 'io'; for (let i = 0; i < 4; i++) s.action('fluid'); s.action('blood'); s.drug('adr', 1); });
  check('Gestante: RCE con desplazamiento uterino', preg * 100, 40, 100, ' %'); check('… frente a sin desplazarlo', (preg - pregNo) * 100, 15, 100, ' puntos');
  const tdpMg = (() => { let re = 0; for (let seed = 1; seed <= 16; seed++) { const L = load('pcrTorsades', { seed, scale: 1 }), s = L.sim; adv(s, .05); cpr(s); s.drug('mg', DR.amountOf(DR.DRUGITEMS.mgso4, 60, false)); for (let i = 0; i < 6 && s.S.arrest; i++) { s.shock(200, false); adv(s, 1); } adv(s, 8); if (s.S.arrest) re++; } return re / 16; })();
  const tdpNo = (() => { let re = 0; for (let seed = 1; seed <= 16; seed++) { const L = load('pcrTorsades', { seed, scale: 1 }), s = L.sim; adv(s, .05); cpr(s); for (let i = 0; i < 6 && s.S.arrest; i++) { s.shock(200, false); adv(s, 1); } adv(s, 8); if (s.S.arrest) re++; } return re / 16; })();
  check('Torsade: sin magnesio recurre más que con él', (tdpNo - tdpMg) * 100, 20, 100, ' puntos');
  L = load('pcrHipotermia', { seed: 4, scale: 1 }); s = L.sim; adv(s, .05); cpr(s); for (let i = 0; i < 3; i++) s.shock(200, false); adv(s, 4); check('Hipotermia < 30 °C: las descargas apenas funcionan', s.S.arrest ? 1 : 0, 1, 1);
  const hk = rate('pcrHiperK', s => { cpr(s); s.drug('ca', 1); s.drug('ins', 1); s.drug('bic', 75); }), hkNo = rate('pcrHiperK', s => { cpr(s); s.drug('adr', 1); });
  check('Hiperpotasemia: RCE con calcio, insulina y bicarbonato', hk * 100, 40, 100, ' %'); check('… y casi nada solo con adrenalina', hkNo * 100, 0, 15, ' %');
  check('Opiáceos: exploración en la parada con pupilas puntiformes', /puntiformes/.test(load('pcrOpi', { seed: 4, scale: 10 }).sim.explore().join(' ')) ? 1 : 0, 1, 1); }

console.log('— Tanda de disnea y VMNI (v1.16): retenedor, neumotórax con presión positiva, edema de altura, hiperventilación');
{ const run = (k, acts, m, seed) => { const L = load(k, { seed: seed || 4, scale: 10 }), s = L.sim; adv(s, .05); for (const [t, f] of acts) { if (s.S.clin < t) adv(s, t - s.S.clin); f(s); } adv(s, m - s.S.clin); return s; };
  global.window = global; require('../src/drugs.js'); const DR = global.SIM_DRUGS;
  const niv = o => s => { s.setIface('mask'); s.S.mask.leak10 = 10; s.setCfg(Object.assign({}, s.S.cfg, { mode: 'PSV', ps: 10, peep: 6, rise: .15, trigE: 40, timax: 1.2, trigI: 2, fio2: 40 }, o)); s.setStandby(false); };
  let a = run('sohHipercapnia', [], 20), b = run('sohHipercapnia', [[.3, niv({ mode: 'PCV', pinsp: 14, peep: 9, fr: 18, ti: 1.2, fio2: 30 })]], 20); check('Obesidad-hipoventilación solo con O₂: sigue hipercápnica', a.S.pco2, 63, 140, ' mmHg'); check('VMNI con EPAP alta y FR de respaldo: baja la pCO₂', a.S.pco2 - b.S.pco2, 2, 40, ' mmHg');
  let tens = 0; for (let seed = 1; seed <= 12; seed++) { const s = run('ptxEspontaneo', [[.3, niv({ peep: 6, ps: 8 })]], 15, seed); if (s.S.ptxActive) tens++; } check('Neumotórax sin drenar en VMNI: pasa a tensión', tens / 12 * 100, 60, 100, ' %');
  a = run('ptxEspontaneo', [], 20); b = run('ptxEspontaneo', [[.3, s => s.setCfg(Object.assign({}, s.S.cfg, { o2dev: 'reserv' }))]], 20); check('Neumotórax simple sin O₂ alto: crece', a.S.ptx, .6, .85); check('… con reservorio, no', b.S.ptx, .1, .5);
  a = run('hapeTeide', [], 7); check('Edema de altura en el refugio: SpO₂ con gafas', a.S.spo2 * 100, 60, 86, ' %'); b = run('hapeTeide', [[.3, s => s.setCfg(Object.assign({}, s.S.cfg, { o2dev: 'reserv' }))], [.6, s => s.drug('nifed', DR.amountOf(DR.DRUGITEMS.nifed, 60, false))]], 20); check('Con O₂, nifedipino y descenso: SpO₂', b.S.spo2 * 100, 92, 100, ' %');
  a = run('crisisAnsiedad', [], 10); b = run('crisisAnsiedad', [[.3, s => s.action('calm')]], 15); check('Hiperventilación: pCO₂ baja sin intervenir', a.S.pco2, 15, 30, ' mmHg'); check('Tranquilizar y respiración guiada: pCO₂', b.S.pco2, 32, 48, ' mmHg');
  a = run('eapIntolerante', [], 12); check('EAP con intolerancia: se arranca la mascarilla (fuga)', a.S.mask.leak10, 60, 200, ' L/min');
  a = run('cloroPiscina', [[8, s => s.event('edema')]], 12); check('Cloro: aparece el edema lesional y desatura', a.S.spo2 * 100, 70, 92, ' %'); }

console.log('— Tanda de trauma (v1.17): torniquete, parche valvulado, aplastamiento, tracción, útero y herniación');
{ const run = (k, acts, m, seed) => { const L = load(k, { seed: seed || 4, scale: 10 }), s = L.sim; adv(s, .05); for (const [t, f] of acts) { if (s.S.clin < t) adv(s, t - s.S.clin); f(s); } adv(s, m - s.S.clin); return s; };
  const act = (k, x) => s => s.action(k, x);
  let a = run('amputacion', [], 15), b = run('amputacion', [[.1, act('hemo')], [.3, s => { s.S.access = 'io'; }], [1, act('blood')]], 10); check('Amputación sin torniquete: TAS a los 15 min', a.S.tas, 0, 80, ' mmHg'); check('Torniquete y sangre: TAS', b.S.tas, 80, 120, ' mmHg');
  a = run('heridaSoplante', [], 6); b = run('heridaSoplante', [[.2, act('seal')]], 6); check('Herida soplante sin sellar: SpO₂ con reservorio', a.S.spo2 * 100, 75, 88, ' %'); check('… con parche valvulado sube', b.S.spo2 * 100 - a.S.spo2 * 100, 3, 30, ' puntos');
  const rel = [8, s => s.event('release')]; a = run('aplastamiento', [rel], 12); b = run('aplastamiento', [[.3, act('fluid')], [1, act('fluid')], [2, act('fluid')], [3, act('fluid')], rel], 12); check('Aplastamiento liberado sin volumen previo: potasio', a.S.k, 7.5, 10, ' mEq/L'); check('… con 2 L antes de liberar', b.S.k, 5.5, 7.2, ' mEq/L'); check('… y sin hipotensión de reperfusión (TAS)', b.S.tas, 100, 160, ' mmHg');
  a = run('femurBarranco', [], 3); b = run('femurBarranco', [[.3, act('hemo')]], 3); check('Fémur: la férula de tracción reduce el dolor', a.S.painEff - b.S.painEff, .2, 1); check('… y el sangrado', (a.S.bleedNow || 0) - (b.S.bleedNow || 0) > 0 ? 1 : 0, 1, 1);
  a = run('traumaGestante', [], 3); b = run('traumaGestante', [[.1, act('lud')]], 3); check('Gestante: desplazar el útero sube la TAS', b.S.tas - a.S.tas, 10, 30, ' mmHg');
  a = run('epidural', [], 20); check('Hematoma epidural sin tratar: la herniación deprime la respiración (pCO₂)', a.S.pco2, 50, 150, ' mmHg');
  a = run('tetraplejia', [], 20); check('Lesión C4 sin soporte: hipercapnia por agotamiento a los 20 min', a.S.pco2, 48, 150, ' mmHg'); }

console.log('— Instalable y sin conexión (v1.3): manifiesto, iconos y service worker');
{ const fs = require('fs'), path = require('path'), R = f => path.join(__dirname, '..', f);
  const man = JSON.parse(fs.readFileSync(R('manifest.webmanifest'), 'utf8'));
  const okMan = man.name && man.short_name && man.start_url && man.display === 'standalone' && man.icons.some(i => i.sizes === '192x192') && man.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable');
  check('Manifiesto completo (nombre, inicio, standalone, iconos 192 y 512 maskable)', okMan ? 1 : 0, 1, 1);
  const badIcon = man.icons.filter(i => { const b = fs.readFileSync(R(i.src)); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) !== i.sizes; }).length;
  check('Iconos con el tamaño que declara el manifiesto', badIcon, 0, 0);
  const sw = fs.readFileSync(R('sw.js'), 'utf8'), assets = JSON.parse(sw.match(/const ASSETS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  check('Archivos del service worker que no existen', assets.filter(a => a !== './' && !fs.existsSync(R(a))).length, 0, 0);
  const html = fs.readFileSync(R('index.html'), 'utf8');
  check('La página enlaza el manifiesto y registra el service worker', /rel="manifest"/.test(html) && /serviceWorker\.register\('sw\.js'\)/.test(html) && !/__VERSION__/.test(sw) ? 1 : 0, 1, 1); }

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
