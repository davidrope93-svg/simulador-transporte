// Arnés de auditoría: reproduce loadCase de la interfaz sobre el motor, sin navegador
const path = '../src/';
global.window = global;
const VMI = require(path + 'model.js'); global.VMI = VMI;
require(path + 'devices.js'); require(path + 'cases.js'); require(path + 'variants.js');
const CASES = global.SIM_CASES;
const MODEL_KEYS = ['pco2','deficit','bs','opioid','rhythm','arrPen','tep','anaf','cohb','cn','icp','icpGrow','weak','dav','edAir','edAirRate','asp','arrest','arrestCause','comp','bav','tasAdj','fcAdj','sevFloor','bottleL','bottleBar','leak10','relCe','sedE','sedStopped','sev','ptx','ptxTension','shockMul','bmv','sgaFail','peso','k','kRate','glu','gluT','temp','tempRate','bleed','bleedSrc','tca','ecl','croup','postRosc','access','arrestCause2','hco3Off','stemi','tamp','tampRate','vaso','vasoRate','neurog','fluidTol','htx','flail','pain','burn','se','stroke','na','cv','op','opRate','cocaine','dka','neo','dci','heat','drown','edad','tire','pneu','cedema','tbi','witnessed','preg','tdp','retainer','hape','anxRate','anxBase','irritant','ptxRate','drive0'];
function load(k, o = {}) {
  const c = CASES[k], pk = c.pheno || 'sano', iface = c.iface || (c.pheno ? 'tube' : 'tube');
  const opts = { pheno: pk, seed: o.seed != null ? o.seed : 12345, scale: o.scale || 20, cfg: Object.assign({}, c.cfg), vent: c.dev || o.dev || 'monnal', sex: c.sex, talla: c.talla, altitude: c.altitude || 0, iface };
  for (const key of MODEL_KEYS) if (c[key] != null) opts[key] = c[key];
  if (opts.pco2 == null) opts.pco2 = pk === 'epoc' ? 64 : 40;
  if (opts.bs == null && pk === 'epoc') opts.bs = 1.3;
  const awake = c.pheno ? c.sedE === 0 : iface !== 'tube';
  if (awake) { opts.relCe = 0; opts.sedE = 0; opts.sedStopped = true; }
  if (iface === 'o2' && !opts.cfg.o2dev) opts.cfg.o2dev = 'reserv';
  const sim = VMI.create(opts); sim.warm(12);
  const S = sim.S; const peso = c.peso || Math.round(S.ibw * 1.15); const fW = Math.min(1.4, Math.max(.7, 75 / peso));
  const sched = (c.events || []).map(e => Object.assign({ fired: false }, e));
  S.onIntubated = () => { const cfg = Object.assign({}, S.cfg, { mode: 'VCV', vt: Math.round(7 * S.ibw / 10) * 10, fr: 16, ti: 1, peep: 5, fio2: 100, pmax: 40, trigI: 2 }); sim.setCfg(cfg); sim.setStandby(false); S._intubAt = S.clin; };
  S.onIntubFail = () => { S._fails = (S._fails || 0) + 1; };
  return { sim, S, c, peso, fW, sched };
}
// dosis como la interfaz: mg/kg * peso * fW, o importe fijo del motor
const D = { ket: ['ket', 1.5, 'kg'], eto: ['eto', .3, 'kg'], prop: ['prop', 1.5, 'kg'], fentI: ['fent', 1.5, 'kg'], roc: ['rel', 18, 'amt'], sux: ['sux', 15, 'amt'],
  mid: ['mid', 2, 'fix'], fentS: ['fent', 1, 'kg'], morf: ['morf', 3, 'fix'], nalox: ['nalox', .4, 'fix'], sed: ['sed', 2, 'amt'], adr1: ['adr', 100, 'amt'], adrP: ['adr', 4, 'amt'],
  amio300: ['amio', 300, 'fix'], amio150: ['amio', 150, 'fix'], tnk: ['tnk', 1, 'amt'], aden6: ['aden', 6, 'amt'], aden12: ['aden', 12, 'amt'], aden18: ['aden', 18, 'amt'],
  atr: ['atr', .5, 'fix'], salb: ['salb', 1, 'amt'], mg: ['mg', 2, 'fix'], cort: ['cort', 1, 'kg'], adrIM: ['adrIM', .5, 'amt'], dexclor: ['dexclor', 5, 'fix'],
  ntgsl: ['ntg', 250, 'amt'], ntgiv: ['ntg', 900, 'amt'], furo: ['furo', 40, 'fix'], shs: ['shs', 1, 'amt'], manit: ['manit', 1, 'amt'], hidroxo: ['hidroxo', 5, 'fix'] };
function drug(L, id) { const [k, v, t] = D[id]; const amt = t === 'amt' ? v : t === 'kg' ? v * L.peso * L.fW : v * L.fW; L.sim.drug(k, amt); }
const isNum = x => typeof x === 'number' && isFinite(x);
// avanza hasta el minuto clínico tEnd ejecutando acciones programadas [[min, fn]] y registrando
function run(L, tEnd, script = [], onSample) {
  const { sim, S } = L; const acts = script.map(a => ({ at: a[0], fn: a[1], done: false }));
  const R = { minSp: 100, minTas: 400, maxTas: 0, minPh: 9, maxPco2: 0, minPco2: 999, arrestAt: S.arrest ? 0 : null, roscAt: null, nan: [], samples: [], weird: [] };
  let nextS = 0, wasArrest = S.arrest;
  while (S.clin < tEnd) {
    for (const e of L.sched) if (!e.fired && S.clin >= e.at) { e.fired = true; if (e.alt != null) sim.setAltitude(e.alt); else sim.event(e.k); }
    for (const a of acts) if (!a.done && S.clin >= a.at) { a.done = true; a.fn(L); }
    for (let i = 0; i < 25; i++) sim.step(.004);
    if (S.clin >= nextS) {
      nextS += .25; const M = sim.monitor();
      for (const [kk, v] of [['spo2', S.spo2], ['tas', S.tas], ['pco2', S.pco2], ['ph', S.ph], ['pao2', S.pao2], ['Paw', S.Paw]]) if (!isNum(v)) R.nan.push(kk + '@' + S.clin.toFixed(1));
      if (!S.arrest) { R.minSp = Math.min(R.minSp, S.spo2 * 100); R.minTas = Math.min(R.minTas, S.tas); R.maxTas = Math.max(R.maxTas, S.tas); }
      R.minPh = Math.min(R.minPh, S.ph); R.maxPco2 = Math.max(R.maxPco2, S.pco2); R.minPco2 = Math.min(R.minPco2, S.pco2);
      if (S.arrest && !wasArrest) R.arrestAt = S.clin; if (!S.arrest && wasArrest) R.roscAt = S.clin; wasArrest = S.arrest;
      if (S.spo2 > 1.001 || S.tas > 280 || S.pco2 < 12 || S.ph > 7.75 || S.ph < 6.6) R.weird.push(`${S.clin.toFixed(1)}: spo2 ${(S.spo2*100).toFixed(0)} tas ${S.tas.toFixed(0)} pco2 ${S.pco2.toFixed(0)} pH ${S.ph.toFixed(2)}`);
      if (onSample) onSample(L, M);
      R.samples.push({ t: +S.clin.toFixed(2), sp: S.spo2 * 100, tas: S.tas, et: M.et, pco2: S.pco2, ph: S.ph, rr: M.effN >= 2 ? M.effRR : 0, arrest: S.arrest, rhy: S.rhythm, vtkg: M.vtkg, M });
    }
  }
  R.final = { sp: S.spo2 * 100, tas: S.tas, pco2: S.pco2, ph: S.ph, rhy: S.rhythm, arrest: S.arrest, iface: S.iface };
  return R;
}
// tiempo en objetivo como el debrief, sobre las muestras
const TG = {
  spo2: s => s.sp, et: s => s.et, tas: s => s.arrest ? null : s.tas, vtkg: s => s.vtkg, pco2: s => s.pco2, rr: s => s.arrest ? null : s.rr,
  pplat: s => { const b = [...s.M ? [] : []]; return null; }, dp: () => null, peepi: () => null, ie: s => s.M.effN >= 4 ? s.M.ies / s.M.effN : null,
  auto: s => s.M.nB >= 4 ? s.M.auto / s.M.nB : null, leak: s => s.M.leak, o2: () => null, fight: () => null, sinus: s => (s.rhy === 'sinus' || s.rhy === 'tsinus') && !s.arrest ? 1 : 0
};
function score(c, R, from = 0) {
  const out = {};
  for (const [k, r] of Object.entries(c.targets || {})) { let n = 0, ok = 0; for (const s of R.samples) { if (s.t < from) continue; const v = TG[k] ? TG[k](s) : null; if (v == null || !isNum(v)) continue; n++; if (v >= r[0] && v <= r[1]) ok++; } out[k] = n ? Math.round(ok / n * 100) : '–'; }
  return out;
}
module.exports = { VMI, CASES, load, run, drug, score };
