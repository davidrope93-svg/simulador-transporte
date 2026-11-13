(function () {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const clamp = VMI.clamp;
const fmt = (x, d = 0) => (x == null || !isFinite(x)) ? '–' : x.toFixed(d).replace('.', ',');
const { SPEC, PKEYS, KEYS, DEVS, KEYLAB, MONS } = window.SIM_DEV;
const CASES = window.SIM_CASES, GROUPS = window.SIM_GROUPS;
const N = 750, SR = .02, GAP = 12, ZN = 750, ZSR = .008, ZGAP = 20;
const MODEL_KEYS = ['pco2', 'deficit', 'bs', 'opioid', 'rhythm', 'arrPen', 'tep', 'anaf', 'cohb', 'cn', 'icp', 'icpGrow', 'weak', 'dav', 'edAir', 'edAirRate', 'asp', 'arrest', 'arrestCause', 'comp', 'bav', 'tasAdj', 'fcAdj', 'sevFloor', 'bottleL', 'bottleBar', 'leak10', 'relCe', 'sedE', 'sedStopped', 'sev', 'ptx', 'ptxTension', 'shockMul'];
const O2LAB = { gafas: 'gafas nasales 2 L/min', venturi35: 'Venturi 35 %', venturi50: 'Venturi 50 %', reserv: 'mascarilla con reservorio 15 L/min' };
const IFLAB = { tube: 'tubo endotraqueal', mask: 'mascarilla oronasal', nasal: 'cánula nasal de alto flujo', o2: 'paciente sin conectar' };
const IFSHORT = { tube: 'intubado', mask: 'VMNI', nasal: 'alto flujo', o2: 'oxigenoterapia' };
const RLAB = { sinus: 'sinusal', tsinus: 'taquicardia sinusal', brady: 'bradicardia', sbrady: 'bradicardia sinusal', bav: 'BAV completo', paced: 'ritmo de marcapasos', aesp: 'AESP', vf: 'FV', tvsp: 'TVSP', asys: 'asistolia', tsv: 'TSV', fa: 'FA rápida', flutter: 'flutter auricular', tvp: 'TV con pulso' };
const FALLBACK = { CPV: ['PCV', 'VCV'], ASV: ['APV', 'VCV'], APV: ['VCV'], PST: ['PSV'], CPAP: ['PSV'], VCV: ['APV'], PCV: ['APV'], PSV: ['CPAP'], HFNC: [], DEM: ['CPAP', 'PSV'], MAN: ['VCV', 'APV'] };

/* ---------- fármacos (dosis de referencia para adulto; el efecto se escala al peso del caso) ---------- */
const DRUGSET = [
  { g: 'Inducción y relajante', open: true, items: [
    { id: 'ket', lab: 'Ketamina', k: 'ket', mgkg: 1.5, u: 'mg' }, { id: 'eto', lab: 'Etomidato', k: 'eto', mgkg: .3, u: 'mg' },
    { id: 'propI', lab: 'Propofol', k: 'prop', mgkg: 1.5, u: 'mg' }, { id: 'fentI', lab: 'Fentanilo', k: 'fent', mgkg: 1.5, u: 'mcg' },
    { id: 'roc', lab: 'Rocuronio', k: 'rel', mgkg: 1.2, u: 'mg', amt: 18 }, { id: 'sux', lab: 'Succinilcolina', k: 'sux', mgkg: 1.5, u: 'mg', amt: 15 }] },
  { g: 'Sedoanalgesia y antídoto', items: [
    { id: 'mid', lab: 'Midazolam', k: 'mid', dose: 2, u: 'mg' }, { id: 'propS', lab: 'Propofol', k: 'prop', mgkg: .5, u: 'mg' },
    { id: 'fentS', lab: 'Fentanilo', k: 'fent', mgkg: 1, u: 'mcg' }, { id: 'morf', lab: 'Morfina', k: 'morf', dose: 3, u: 'mg' },
    { id: 'nalox', lab: 'Naloxona', k: 'nalox', dose: .4, u: 'mg' }, { id: 'sedB', lab: 'Bolo de la bomba de sedación', k: 'sed', amt: 2, note: 'midazolam + fentanilo' },
    { id: 'sedperf', lab: 'Reanudar la bomba de sedación', act: 'sedperf' }] },
  { g: 'Hemodinámica y parada', items: [
    { id: 'fluid', lab: 'Cristaloide', act: 'fluid', note: '500 mL' }, { id: 'adr1', lab: 'Adrenalina', k: 'adr', dose: 1, u: 'mg', amt: 100 },
    { id: 'adrP', lab: 'Adrenalina en bolo', k: 'adr', dose: 20, u: 'mcg', amt: 4 }, { id: 'amio300', lab: 'Amiodarona', k: 'amio', dose: 300, u: 'mg' },
    { id: 'amio150', lab: 'Amiodarona', k: 'amio', dose: 150, u: 'mg' }, { id: 'tnk', lab: 'Tenecteplasa', k: 'tnk', amt: 1, tnk: true, u: 'mg' }] },
  { g: 'Arritmias', items: [
    { id: 'aden6', lab: 'Adenosina', k: 'aden', dose: 6, u: 'mg', amt: 6, route: ' IV rápida' }, { id: 'aden12', lab: 'Adenosina', k: 'aden', dose: 12, u: 'mg', amt: 12, route: ' IV rápida' },
    { id: 'aden18', lab: 'Adenosina', k: 'aden', dose: 18, u: 'mg', amt: 18, route: ' IV rápida' }, { id: 'atr', lab: 'Atropina', k: 'atr', dose: .5, u: 'mg' },
    { id: 'vagal', lab: 'Maniobras vagales', act: 'vagal', note: 'Valsalva modificada' }] },
  { g: 'Respiratorio y anafilaxia', items: [
    { id: 'salb', lab: 'Salbutamol + ipratropio', k: 'salb', amt: 1, note: 'nebulizado o en línea', route: '' }, { id: 'mgso4', lab: 'Sulfato de magnesio', k: 'mg', dose: 2, u: 'g' },
    { id: 'cort', lab: 'Metilprednisolona', k: 'cort', mgkg: 1, u: 'mg' }, { id: 'adrIM', lab: 'Adrenalina IM', k: 'adrIM', dose: .5, u: 'mg', amt: .5, route: ' en el muslo' },
    { id: 'dexclor', lab: 'Dexclorfeniramina', k: 'dexclor', dose: 5, u: 'mg' }] },
  { g: 'EAP, HTIC e intoxicaciones', items: [
    { id: 'ntgsl', lab: 'NTG sublingual', k: 'ntg', dose: 400, u: 'mcg', amt: 250, route: '' }, { id: 'ntgiv', lab: 'NTG en bolo', k: 'ntg', dose: 1, u: 'mg', amt: 900 },
    { id: 'furo', lab: 'Furosemida', k: 'furo', dose: 40, u: 'mg' }, { id: 'shs', lab: 'Salino hipertónico 7,5 %', k: 'shs', amt: 1, note: '250 mL' },
    { id: 'manit', lab: 'Manitol 20 %', k: 'manit', amt: 1, note: '0,5 g/kg' }, { id: 'hidroxo', lab: 'Hidroxocobalamina', k: 'hidroxo', dose: 5, u: 'g' }] }
];
const DRUGITEMS = {}; DRUGSET.forEach(g => g.items.forEach(it => { DRUGITEMS[it.id] = it; }));
const PERFS = [
  { id: 'nor', lab: 'Noradrenalina', u: 'mcg/kg/min', d: 2, opts: [0, .05, .1, .15, .2, .3, .5], set: r => sim.setNor(r), extra: r => r ? ` · ${fmt(r * peso)} mcg/min` : '' },
  { id: 'adrI', lab: 'Adrenalina', u: 'mcg/min', d: 0, opts: [0, 2, 5, 10, 20], set: r => sim.perfSteady('adr', r) },
  { id: 'ntg', lab: 'Nitroglicerina', u: 'mcg/min', d: 0, opts: [0, 20, 50, 100, 150, 200], set: r => sim.setNtg(r) },
  { id: 'prop', lab: 'Propofol', u: 'mg/h', d: 0, opts: [0, 50, 100, 150, 200, 300], set: r => sim.perf('prop', r / 60 * fW) },
  { id: 'mid', lab: 'Midazolam', u: 'mg/h', d: 0, opts: [0, 2, 5, 10], set: r => sim.perf('mid', r / 60 * fW) },
  { id: 'fent', lab: 'Fentanilo', u: 'mcg/h', d: 0, opts: [0, 50, 100, 150, 200], set: r => sim.perf('fent', r / 60 * fW) }
];
const roundDose = x => x >= 50 ? Math.round(x / 5) * 5 : x >= 10 ? Math.round(x) : Math.round(x * 10) / 10;
const tnkDose = p => p < 60 ? 30 : p < 70 ? 35 : p < 80 ? 40 : p < 90 ? 45 : 50;
const doseOf = it => it.tnk ? tnkDose(peso) : it.mgkg != null ? roundDose(it.mgkg * peso) : it.dose;

const TGT = {
  spo2: { lab: 'SpO₂', u: '%', get: () => S.spo2 * 100, d: 0 }, et: { lab: 'EtCO₂', u: 'mmHg', get: () => M.et, d: 0 },
  tas: { lab: 'TAS', u: 'mmHg', get: () => S.arrest ? null : S.tas, d: 0 }, vtkg: { lab: 'Vt/kg', u: 'mL/kg', get: () => M.vtkg, d: 1 },
  pplat: { lab: 'Meseta', u: 'cmH₂O', get: () => real().pplat, d: 0 }, dp: { lab: 'Driving', u: 'cmH₂O', get: () => real().dp, d: 0 },
  peepi: { lab: 'Auto-PEEP', u: 'cmH₂O', get: () => real().peepi, d: 0 }, pco2: { lab: 'PaCO₂', u: 'mmHg', get: () => S.pco2, d: 0 },
  rr: { lab: 'FR del paciente', u: 'rpm', get: () => S.arrest ? null : (M.effN >= 2 ? M.effRR : 0), d: 0 },
  ie: { lab: 'Esfuerzos ineficaces', u: '', get: () => M.effN >= 4 ? M.ies / M.effN : null, d: 2, fmt: true },
  auto: { lab: 'Autodisparos', u: '', get: () => M.nB >= 4 ? M.auto / M.nB : null, d: 2, fmt: true },
  leak: { lab: 'Fuga', u: 'L/min', get: () => M.leak, d: 0 }, o2: { lab: 'O₂ disponible', u: '', get: () => S.o2.supply ? 1 : 0, d: 0, fmt: true },
  fight: { lab: 'Sin lucha', u: '', get: () => S.fight || 0, d: 2, fmt: true },
  sinus: { lab: 'Ritmo sinusal', u: '', get: () => S.arr.type || S.arrest ? 0 : 1, d: 0, fmt: true }
};
const EVLAB = { extub: 'Extubación o retirada de mascarilla', disc: 'Desconexión', sel: 'Intubación selectiva', obst: 'Tapón o acodamiento', bronco: 'Broncoespasmo', ptx: 'Neumotórax a tensión', leak: 'Fuga', o2: 'Fallo de O₂', wake: 'Se despierta', anx: 'Ansiedad', cough: 'Tos', vf: 'Fibrilación ventricular', aspir: 'Broncoaspiración', tep: 'TEP', anaf: 'Anafilaxia', tsv: 'TSV', fa: 'FA rápida', tvp: 'TV con pulso' };
const EVFIX = { extub: () => !S.air.extub && !(S.iface === 'mask' && S.mask.leak10 > 100), disc: () => !S.air.disc, sel: () => !S.air.sel, obst: () => !S.air.obst, bronco: () => S.bs < 1.2, ptx: () => !S.ptxActive, leak: () => S.air.leak === 0 && !(S.iface === 'mask' && S.mask.leak10 > 40), o2: () => S.o2.supply, wake: () => (S.fight || 0) < .1, anx: () => S.clin >= S.anxUntil, cough: () => true, vf: () => !S.arrest, aspir: () => false, tep: () => S.tep < .3, anaf: () => S.anaf < .2, tsv: () => !S.arr.type, fa: () => !S.arr.type, tvp: () => !S.arr.type };
const ACTLAB = { reconnect: 'Tubuladura reconectada', reintub: 'Reintubación en curso (1,5 min)', pull: 'Tubo retirado 2 cm', suction: 'Aspirado y revisado el tubo', cuff: 'Balón inflado', opencirc: 'Desconexión 15 s para vaciar', decomp: 'Descompresión con aguja', bottle: 'Botella cambiada', fluid: 'Cristaloide 500 mL', mask: 'Mascarilla recolocada', sedperf: 'Bomba de sedación reanudada', vagal: 'Maniobra de Valsalva modificada', recruit: 'Maniobra de reclutamiento (CPAP 40 cmH₂O 30 s)', clamp: 'Tubo pinzado para desconectar', vl: 'Videolaringoscopio y bougie preparados', cric: 'Cricotiroidotomía quirúrgica (≈ 1,5 min)' };

/* ---------- estado ---------- */
let sim, S, M = {}, pend, caseKey = 'tce', scale = 10, paused = false, track, sched, buf, zb, w = 0, filled = false, zw = 0, zfilled = false, sacc = 0, zacc = 0, uacc = 0, lastFrame = performance.now(), ended = false;
let peso = 75, fW = 1, invCfg = null, prevArrest = false, frameKey = '', pni = null, pniMeas = 0, apvHist = [];
let lim = {}, ventSilUntil = -1, monSilUntil = -1, soundOn = true, actx = null, lastBeepHi = 0, lastBeepMed = 0;
let sbyHint = null, activeK = null, pendAt = 0, locked = false, frozen = 0, view = 'curves', showModes = true, standbyArm = 0, cprPrev = null, devPat = { sex: 'h', talla: 170 };
let defib = { st: 'idle', until: 0 }, aed = { st: 'idle', until: 0 }, syncOn = false, analysis = null, resume = null, zMsg = '', zMsgUntil = 0;
const devOf = () => DEVS[S.dev.vent];
const hashSeed = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const round10 = x => Math.round(x / 10) * 10;
const devIbw = () => VMI.pesoIdeal(devPat.sex, devPat.talla);

function spec(k) {
  const d = devOf(), s = Object.assign({}, SPEC[k], (d.spec || {})[k] || {});
  if (PKEYS[k]) s.u = d.u;
  if (k === 'fio2' && d.spec.fio2 && d.spec.fio2.bin) { s.u = ''; s.show = v => v >= 100 ? '100 %' : 'Air Mix'; }
  return s;
}
const showV = (k, v) => { const s = spec(k); return s.show ? s.show(v) : fmt(v, s.d); };
function labOf(k, mode) {
  const d = devOf();
  if ((mode === 'PSV' || mode === 'CPAP') && (k === 'vt' || k === 'fr')) return (k === 'vt' ? 'Vt' : (d.lab.fr || 'Fr')) + ' apnea';
  if (mode === 'CPAP' && k === 'peep' && S.dev.vent === 'monnal') return 'CPAP';
  return d.lab[k] || SPEC[k].lab;
}
function keysFor(mode) { let k = KEYS[mode] || []; if (devOf().limitsPmax) k = k.filter(x => x !== 'pmax'); return k; }
function modeList(iface) { return devOf().modes[iface || S.iface] || []; }
function modeLabel(m, dev, iface) {
  const d = DEVS[dev || S.dev.vent], i = iface || S.iface;
  const hit = (d.modes[i] || []).find(x => x[0] === m) || Object.values(d.modes).flat().find(x => x[0] === m);
  return hit ? hit[1] : m;
}
const uMode = c => c.umode || c.mode;
/* modos de interfaz que el motor resuelve con otro modo interno */
function toModel(c) {
  const m = uMode(c);
  if (m === 'DEM') return Object.assign(c, { umode: 'DEM', mode: 'CPAP', peep: 0, fio2: 100 });
  if (m === 'MAN') return Object.assign(c, { umode: 'MAN', mode: 'MAN' });
  delete c.umode; return c;
}
function fitMode(cfg, dev, iface) {
  const list = DEVS[dev].modes[iface] || [], c = Object.assign({}, cfg);
  if (DEVS[dev].spec.fio2 && DEVS[dev].spec.fio2.bin) c.fio2 = (c.fio2 || 100) > 80 ? 100 : 60;
  const m = uMode(c);
  if (!list.length || list.find(x => x[0] === m)) return c;
  for (const f of FALLBACK[m] || []) if (list.find(x => x[0] === f)) { if (m === 'CPAP' && f === 'PSV') c.ps = 0; if (m === 'CPV') { c.trigI = ((DEVS[dev].spec.trigI || {}).max) || SPEC.trigI.max; c.fr = Math.min(c.fr || 10, 10); } c.mode = f; delete c.umode; return toModel(c); }
  c.mode = list[0][0]; delete c.umode; return toModel(c);
}
const ventOffNow = () => S.iface === 'o2' || S.standby || (S.dev.pneumatic && !S.o2.supply && (S.iface === 'tube' || S.iface === 'mask'));
function real() {
  const b = [...S.breaths].reverse().find(x => x.cycle && x.palvEnd != null);
  if (!b || S.air.extub || S.air.disc || S.iface === 'o2' || S.iface === 'nasal') return { pplat: null, dp: null, peepi: Math.max(0, (S.peepTotReal || 0) - S.cfg.peep) };
  return { pplat: b.palvEnd, dp: b.palvEnd - b.p0, peepi: Math.max(0, b.p0 - S.cfg.peep) };
}

/* ---------- carga del caso ---------- */
function loadCase(k) {
  caseKey = k; const c = CASES[k];
  const pk = c.pheno || $('#phenoSel').value;
  if (c.dev) $('#ventSel').value = c.dev;
  const dev = $('#ventSel').value;
  let iface = c.iface || (c.pheno ? 'tube' : $('#ifaceSel').value);
  if (iface === 'nasal' && !DEVS[dev].modes.nasal.length) iface = 'o2';
  $('#phenoField').hidden = !!c.pheno; $('#ifaceField').hidden = !!c.pheno;
  const awake = !c.pheno ? iface !== 'tube' : (c.sedE === 0);
  let cfg = Object.assign({}, c.cfg);
  if (cfg.o2dev) $('#o2dev').value = cfg.o2dev; else cfg.o2dev = $('#o2dev').value;
  if (!c.pheno && iface === 'mask') cfg = Object.assign(cfg, { mode: DEVS[dev].niv, ps: 10, peep: 6, trigE: 35, timax: 1.2, trigI: 2, fio2: 40, rise: .15, fr: 12, vt: 450, pmax: 30 });
  if (iface === 'nasal') Object.assign(cfg, { mode: 'HFNC', flow: cfg.flow || 50, fio2: Math.max(cfg.fio2 || 60, 50) });
  const invBase = fitMode(Object.assign({ mode: DEVS[dev].inv, vt: 480, fr: 16, ti: 1, tplat: 0, rise: .15, peep: 5, pmax: 40, trigI: 2, pinsp: 15, fio2: 100 }, (iface === 'o2' || iface === 'tube') ? c.cfg : {}), dev, 'tube');
  cfg = fitMode(cfg, dev, iface === 'o2' ? 'tube' : iface);
  if (c.altitude != null) setAltUI(c.altitude, true);
  const opts = { pheno: pk, seed: hashSeed(k + pk + iface + dev), scale, cfg, vent: dev, sex: c.sex, talla: c.talla, altitude: +$('#alt').value, iface };
  for (const key of MODEL_KEYS) if (c[key] != null) opts[key] = c[key];
  if (opts.pco2 == null) opts.pco2 = pk === 'epoc' ? 64 : 40;
  if (opts.bs == null && pk === 'epoc') opts.bs = 1.3;
  if (awake) { opts.relCe = 0; opts.sedE = 0; opts.sedStopped = true; }
  sim = VMI.create(opts);
  sim.warm(12);
  S = sim.S; pend = Object.assign({}, S.cfg); activeK = null; pendAt = 0;
  invCfg = invBase; if (!c.cfg || !c.cfg.vt) invCfg.vt = round10(7 * S.ibw);
  peso = c.peso || Math.round(S.ibw * 1.15); fW = clamp(75 / peso, .7, 1.4);
  // datos del paciente en el ventilador: si ya estaba conectado, los metió quien lo conectó; si no, los de fábrica (Monnal: mujer de 165 cm)
  devPat = iface !== 'o2' ? { sex: c.sex || S.P.sex, talla: c.talla || S.P.talla } : dev === 'monnal' ? { sex: 'm', talla: 165 } : { sex: 'h', talla: 170 };
  track = { t: {}, worst: { spo2: 100, tas: 300, ppk: 0 }, events: [], acts: 0, drugs: [], intubAt: null, peri: null, induct: null, relax: null, attempts: 0, cric: false,
    arrestAt: S.arrest ? 0 : null, firstShock: null, lastShock: null, shocks: 0, adr: [], amio: 0, roscAt: null, nalox: null, convAt: null, hadArr: false, standbyApnea: 0 };
  for (const key in (c.targets || {})) track.t[key] = { inT: 0, tot: 0 };
  sched = (c.events || []).map(e => Object.assign({ fired: false }, e));
  S.onSlow = onSlow; S.onIntubated = onIntubated; S.onIntubFail = onIntubFail; ended = false; prevArrest = S.arrest;
  buf = { p: new Float32Array(N), f: new Float32Array(N), v: new Float32Array(N), c: new Float32Array(N), m: new Float32Array(N), ev: new Int8Array(N), ie: new Int8Array(N) };
  zb = { e: new Float32Array(ZN), p: new Float32Array(ZN), c: new Float32Array(ZN), mk: new Int8Array(ZN) };
  w = 0; filled = false; zw = 0; zfilled = false; frameKey = '';
  pni = null; pniMeas = 0; defib = { st: 'idle', until: 0 }; aed = { st: 'idle', until: 0 }; syncOn = false; analysis = null; resume = null; apvHist = [];
  ventSilUntil = -1; monSilUntil = -1; locked = false; sbyHint = null; frozen = 0; cprPrev = null; showModes = dev !== 'medumat';
  $('#zPace').checked = false; $('#zPaceMode').value = 'demand'; $('#zMode').value = 'manual';
  $('#findings').hidden = true; $('#log').innerHTML = '';
  setLimits(true);
  renderDrugs(); applyDevUI(); applyMonUI();
  logIt('Caso: ' + c.title + ' · ' + DEVS[dev].short + ' · ' + MONS[$('#monSel').value].short);
  renderCase(); renderVent(); updateUI();
  if (!S.arrest) measurePni(true);
}
function setAltUI(v, silent) { $('#alt').value = v; $('#altV').textContent = (+v).toLocaleString('es-ES') + ' m'; if (sim && !silent) sim.setAltitude(+v); }

function onIntubated() {
  track.intubAt = S.clin;
  // tras intubar, el ventilador queda en espera con ajustes invasivos preparados: revisar y pulsar Iniciar
  const base = fitMode(Object.assign({}, S.cfg, invCfg, { fio2: Math.max(S.cfg.fio2 || 100, 60) }), S.dev.vent, 'tube');
  delete base.umode;
  sim.setCfg(base); sim.setStandby(true);
  pend = Object.assign({}, S.cfg); activeK = null; sbyHint = null; pendAt = 0;
  logIt(`${track.cric ? 'Cánula de cricotiroidotomía comprobada' : 'Tubo comprobado'} con capnografía. Ventilador en espera con ${modeLabel(S.cfg.mode, null, 'tube')} preparado: revisa los ajustes y pulsa «Iniciar ventilación».`);
  renderVent(); renderCase();
}
function onIntubFail(isr) {
  track.attempts++;
  const why = isr.edema > .45 ? 'edema de glotis, no se identifican estructuras' : 'Cormack III–IV, el tubo no pasa';
  showFind([`Intento de intubación fallido (${why}). El paciente sigue sin vía aérea: oxigena antes de reintentar.`]);
  logIt(`Intubación fallida, intento ${track.attempts}: ${why}`);
}

/* ---------- bucle lento ---------- */
function onSlow(dtc) {
  const c = CASES[caseKey];
  for (const e of sched) if (!e.fired && S.clin >= e.at) { e.fired = true; if (e.alt != null) { setAltUI(e.alt); logIt(e.txt || 'Altitud ' + e.alt + ' m'); } else fireEvent(e.k, e.txt, true); }
  const auto = +$('#zAuto').value;
  if (auto && !pniMeas && !S.arrest && (!pni || S.clin - pni.at >= auto)) measurePni(false);
  if (S.arrest && !prevArrest) { track.arrestAt = S.clin; track.roscAt = null; logIt('Parada cardiorrespiratoria'); }
  if (!S.arrest && prevArrest) { track.roscAt = S.clin; logIt('RCE: pulso central palpable'); resume = null; setTimeout(() => measurePni(false), 0); }
  prevArrest = S.arrest;
  if (S.arr.type) track.hadArr = true;
  if (track.hadArr && !S.arr.type && track.convAt == null && !S.arrest) { track.convAt = S.clin; logIt('Ritmo sinusal recuperado'); }
  if (S.pace.on && S.pace.capture && S.pace.mA >= 40 && S.sedTot < .3 && S.opi < .3 && !S.arrest) S.anxUntil = Math.max(S.anxUntil, S.clin + .3);
  if (track.peri && S.clin <= track.peri.end) { track.peri.spo2 = Math.min(track.peri.spo2, S.spo2 * 100); track.peri.tas = Math.min(track.peri.tas, S.tas); }
  if (S.standby && S.iface === 'tube' && !S.bag && S.relTot > .5) track.standbyApnea += dtc;
  if (S.cfg.mode === 'APV' || S.cfg.mode === 'ASV') { if (!apvHist.length || S.clin - apvHist[apvHist.length - 1][0] > .25) apvHist.push([S.clin, S.apv.p]); apvHist = apvHist.filter(x => x[0] > S.clin - 6); } else apvHist = [];
  if (!M || M.fr == null) return;
  for (const key in track.t) {
    const tg = TGT[key], rng = c.targets[key], v = tg.get();
    if (v == null || !isFinite(v)) continue;
    track.t[key].tot += dtc; if (v >= rng[0] && v <= rng[1]) track.t[key].inT += dtc;
  }
  const W = track.worst; if (!S.arrest) { W.n = (W.n || 0) + 1; W.spo2 = Math.min(W.spo2, S.spo2 * 100); W.tas = Math.min(W.tas, S.tas); }
  if (M.ppk != null && (S.iface === 'tube' || S.iface === 'mask') && !S.arrest && !ventOffNow()) W.ppk = Math.max(W.ppk, M.ppk);
  for (const ev of track.events) if (ev.fixed == null && EVFIX[ev.k]()) { ev.fixed = S.clin; logIt(EVLAB[ev.k] + ': resuelto'); }
  if (c.duration && S.clin >= c.duration && !ended) { ended = true; logIt('Llegada al hospital'); showDebrief('Llegada al hospital'); }
}
function fireEvent(k, txt, scheduled) {
  sim.event(k);
  track.events.push({ k, at: S.clin, fixed: null });
  logIt(scheduled ? (txt || EVLAB[k]) : 'Instructor: ' + EVLAB[k]);
}

/* ---------- tarjeta del caso ---------- */
function rangeTxt(r, t) { if (t.fmt) return r[0] === 1 && r[1] === 1 ? '' : r[1] < 1 ? '≤ ' + fmt(r[1] * 100) + ' %' : ''; if (r[1] >= 200) return '≥ ' + fmt(r[0], t.d); if (r[0] <= 0) return '≤ ' + fmt(r[1], t.d); if (r[1] >= 40 && t === TGT.rr) return '≥ ' + fmt(r[0], t.d); return fmt(r[0], t.d) + '–' + fmt(r[1], t.d); }
function renderCase() {
  const c = CASES[caseKey];
  const tg = Object.entries(c.targets || {}).map(([k, r]) => `<span class="chip" id="tg_${k}">${TGT[k].lab} ${rangeTxt(r, TGT[k])}</span>`).join('');
  $('#caseCard').innerHTML = `<div><span class="eyebrow">${c.lvl} · ${VMI.PHENO[S.pk].label} · ${IFSHORT[S.iface]} · ${(c.sex || S.P.sex) === 'm' ? 'mujer' : 'varón'} de ${c.talla || S.P.talla} cm · peso ideal ${fmt(S.ibw)} kg · peso ${fmt(peso)} kg</span><h3>${c.title}</h3><p>${c.goal}</p></div><div class="targets">${tg}</div>` +
    (c.hint ? `<details><summary>Ver una solución posible</summary><p>${c.hint}</p></details>` : '');
}

/* ---------- ventilador: modos, mandos y mando giratorio ---------- */
const PKS = () => ['mode', ...Object.keys(SPEC)];
function isPend(k) { return k === 'mode' ? uMode(pend) !== uMode(S.cfg) : pend[k] !== S.cfg[k]; }
const pendList = () => PKS().filter(isPend);
function sbyIface() {
  if (sbyHint) return sbyHint;
  const m = uMode(pend), has = i => modeList(i).some(x => x[0] === m);
  if (m === 'HFNC') return 'nasal';
  if (m === 'DEM' || m === 'MAN') return 'mask';
  if ((S.iface === 'mask' || S.iface === 'nasal' || S.iface === 'tube') && has(S.iface)) return S.iface;
  if (has('mask') && !has('tube')) return 'mask';
  return 'tube';
}
const cleanCfg = extra => { const c = Object.assign({}, S.cfg); delete c.umode; return toModel(Object.assign(c, extra || {})); };
function pendIface() { return S.iface === 'o2' || S.standby ? sbyIface() : S.iface; }
function renderVent() { renderModes(); renderKnobs(); renderDials(); renderKeys(); renderTilesFrame(); renderLimits(); renderStandby(); }
function renderModes() {
  const i = (S.iface === 'o2' || S.standby) ? sbyIface() : S.iface, list = modeList(i), d = devOf();
  $('#modes').hidden = !showModes && !ventOffNow();
  if (!list.length) { $('#modes').innerHTML = '<span class="ml">Modo</span><span class="minfo">Este equipo no tiene esta función.</span>'; return; }
  const pm = uMode(pend);
  $('#modes').innerHTML = `<span class="ml">${d === DEVS.medumat ? 'Menú · modo' : d === DEVS.t1 ? 'Modes' : 'Modo'}</span>` + list.map(([m, l]) => `<button data-m="${m}" aria-pressed="${pm === m}" class="${pm === m && isPend('mode') ? 'pend' : ''}" ${locked ? 'disabled' : ''}>${l}</button>`).join('');
}
function renderKnobs() {
  const ks = keysFor(uMode(pend) === 'DEM' ? 'DEM' : pend.mode);
  $('#knobs').innerHTML = ks.map(k => { const s = spec(k), lb = labOf(k, pend.mode);
    return `<div class="knob${isPend(k) ? ' pend' : ''}${activeK === k ? ' act' : ''}" id="k_${k}" data-sel="${k}" role="button" tabindex="0" aria-label="${lb}"><span class="kl"><span>${lb}</span><span>${s.u}${s.note ? ' · ' + s.note : ''}</span></span>
      <span class="krow"><button data-k="${k}" data-d="-1" aria-label="Bajar ${lb}" ${locked ? 'disabled' : ''}>−</button><span class="kv" id="kv_${k}">${showV(k, pend[k])}</span><button data-k="${k}" data-d="1" aria-label="Subir ${lb}" ${locked ? 'disabled' : ''}>+</button></span></div>`; }).join('');
  renderConfirm();
}
function renderConfirm() {
  const n = pendList().length, d = devOf();
  $('#confirm').innerHTML = n ? `<span class="msg">${n} ${n === 1 ? 'cambio pendiente' : 'cambios pendientes'} · ${d.knob === 'pt' ? 'toca otra vez el control o pulsa el mando' : d.knob === 'three' ? 'pulsa el mando' : 'pulsa la rueda'} para confirmar</span><button class="go" id="cOk">Confirmar</button><button class="no" id="cNo">Cancelar</button>` : '<span class="small" style="color:var(--scr-mut)">Ajustes aplicados</span>';
}
function stepParam(k, d) {
  if (locked || !k) return;
  const s = spec(k);
  if (s.bin) pend[k] = d > 0 ? s.max : s.min;
  else { const cur = pend[k] != null ? pend[k] : s.min; pend[k] = +clamp(Math.round((cur + s.step * d) / s.step) * s.step, s.min, s.max).toFixed(3); }
  if (!pendAt) pendAt = performance.now();
  const el = $('#kv_' + k); if (el) el.textContent = showV(k, pend[k]);
  const kn = $('#k_' + k); if (kn) kn.classList.toggle('pend', isPend(k));
  renderConfirm(); updateDialLabels();
}
function confirmPend() {
  if (!pendList().length) return;
  const i = pendIface(), ch = pendList().map(k => k === 'mode' ? 'modo ' + modeLabel(uMode(pend), null, i) : `${labOf(k, pend.mode)} ${showV(k, pend[k])}`);
  sim.setCfg(toModel(Object.assign({}, pend))); pend = Object.assign({}, S.cfg); pendAt = 0; track.acts++;
  logIt((ventOffNow() ? 'Preparado en espera: ' : 'Ajustes: ') + ch.join(', '));
  renderModes(); renderKnobs(); renderDials(); renderStandby();
}
function cancelPend(msg) { pend = Object.assign({}, S.cfg); pendAt = 0; sbyHint = null; if (msg) logIt(msg); renderModes(); renderKnobs(); renderDials(); renderStandby(); }
function markActive() { $$('#knobs .knob').forEach(x => x.classList.toggle('act', x.dataset.sel === activeK)); renderDials(); }
$('#knobs').addEventListener('click', e => {
  const b = e.target.closest('button[data-k]');
  if (b) { activeK = b.dataset.k; stepParam(b.dataset.k, +b.dataset.d); markActive(); return; }
  const kn = e.target.closest('.knob'); if (!kn || locked) return;
  const k = kn.dataset.sel;
  if (devOf().knob === 'pt' && activeK === k && isPend(k)) { confirmPend(); activeK = null; markActive(); return; } // T1: tocar de nuevo el control confirma
  activeK = k; markActive();
});
$('#knobs').addEventListener('keydown', e => { const kn = e.target.closest('.knob'); if (!kn) return; const k = kn.dataset.sel;
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); activeK = k; stepParam(k, 1); } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); activeK = k; stepParam(k, -1); } else if (e.key === 'Enter') { e.preventDefault(); confirmPend(); } });
$('#modes').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (!b || locked) return; const m = b.dataset.m; sbyHint = null; pend.mode = m; if (m === 'DEM' || m === 'MAN') pend.umode = m; else delete pend.umode; pend = toModel(pend); if (!pendAt) pendAt = performance.now(); activeK = null; renderModes(); renderKnobs(); renderDials(); renderStandby(); });
$('#confirm').addEventListener('click', e => { if (e.target.id === 'cOk') confirmPend(); if (e.target.id === 'cNo') cancelPend(); });

/* mandos giratorios: uno (rueda o pulsar y girar) o tres (Medumat) */
function dialBindings() {
  const d = devOf(), m = pend.mode, um = uMode(pend);
  if (d.knob !== 'three') return [{ id: 'main', k: activeK, lab: d.knob === 'pt' ? 'Mando de pulsar y girar' : 'Rueda de control' }];
  const left = m === 'PCV' || m === 'CPV' ? 'pinsp' : m === 'PSV' ? 'ps' : (m === 'CPAP' || um === 'DEM') ? 'peep' : 'vt';
  const center = (m === 'CPAP' || m === 'PSV' || um === 'DEM' || m === 'MAN') ? null : 'fr';
  const ks = keysFor(um === 'DEM' ? 'DEM' : m);
  const right = activeK && ks.includes(activeK) && activeK !== left && activeK !== center ? activeK : ks.find(k => k !== left && k !== center) || null;
  return [{ id: 'L', k: left, lab: 'Mando izquierdo' }, { id: 'C', k: center, lab: 'Mando central' }, { id: 'R', k: right, lab: 'Mando derecho' }];
}
function renderDials() {
  const B = dialBindings();
  $('#dials').innerHTML = B.map(b => `<div class="dial" data-dial="${b.id}" data-k="${b.k || ''}">
      <div class="dlab">${b.lab}</div>
      <div class="dring" tabindex="0" role="slider" aria-label="${b.lab}: ${b.k ? labOf(b.k, pend.mode) : 'sin asignar'}"><div class="dmark"></div><button class="dpress" aria-label="Pulsar para confirmar">OK</button></div>
      <div class="dval" id="dv_${b.id}">${b.k ? labOf(b.k, pend.mode) + ' ' + showV(b.k, pend[b.k]) : (devOf().knob === 'three' ? '—' : 'toca un control')}</div>
    </div>`).join('');
  $$('.dial').forEach(setupDial);
}
function updateDialLabels() { dialBindings().forEach(b => { const e = $('#dv_' + b.id); if (e && b.k) e.textContent = labOf(b.k, pend.mode) + ' ' + showV(b.k, pend[b.k]); }); }
function setupDial(el) {
  const ring = el.querySelector('.dring'), mark = el.querySelector('.dmark'), btn = el.querySelector('.dpress');
  let rot = 0, acc = 0, last = null;
  const k = () => el.dataset.k || null;
  const turn = d => { if (!k() || locked) return; if (devOf().knob !== 'three' || el.dataset.dial === 'R') activeK = k(); stepParam(k(), d); rot += d * 18; mark.style.transform = `rotate(${rot}deg)`; };
  const ang = ev => { const r = ring.getBoundingClientRect(); return Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
  ring.addEventListener('pointerdown', ev => { if (ev.target === btn) return; last = ang(ev); acc = 0; ring.setPointerCapture(ev.pointerId); });
  ring.addEventListener('pointermove', ev => { if (last == null) return; const a = ang(ev); let da = a - last; if (da > 180) da -= 360; if (da < -180) da += 360; last = a; acc += da; while (acc >= 18) { acc -= 18; turn(1); } while (acc <= -18) { acc += 18; turn(-1); } });
  ring.addEventListener('pointerup', () => { last = null; });
  ring.addEventListener('pointercancel', () => { last = null; });
  ring.addEventListener('wheel', ev => { ev.preventDefault(); turn(ev.deltaY < 0 ? 1 : -1); }, { passive: false });
  ring.addEventListener('keydown', ev => { if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') { ev.preventDefault(); turn(1); } if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') { ev.preventDefault(); turn(-1); } if (ev.key === 'Enter') { ev.preventDefault(); confirmPend(); } });
  btn.addEventListener('click', () => { if (!locked) confirmPend(); });
}

/* teclas de función de cada equipo */
function renderKeys() {
  const d = devOf(), keys = d.keys.slice();
  if (S.dev.vent === 'monnal' && (S.cfg.mode === 'CPV' || S.cfg.rce)) keys.splice(1, 0, 'rce');
  $('#vkeys').innerHTML = keys.map(k => `<button class="vbtn" data-vk="${k}" id="vk_${k}">${k === 'rce' ? (S.cfg.mode === 'CPV' ? 'RCE' : 'CPV') : KEYLAB[k](d)}</button>`).join('');
  updateKeys();
}
function updateKeys() {
  const d = devOf(), off = ventOffNow(), live = (S.iface === 'tube' || S.iface === 'mask') && !off;
  const set = (k, pressed, dis, txt) => { const b = $('#vk_' + k); if (!b) return; b.setAttribute('aria-pressed', pressed ? 'true' : 'false'); b.disabled = !!dis || (locked && k !== 'lock'); if (txt) b.textContent = txt; };
  const boost = S.clin < S.o2boostUntil;
  set('o2boost', boost, !S.o2.supply || off, boost ? `${KEYLAB.o2boost(d)} · ${fmt((S.o2boostUntil - S.clin) * 60)} s` : KEYLAB.o2boost(d));
  set('inhold', S.req.inhold, !(d.holds[0] && live)); set('exhold', S.req.exhold, !(d.holds[1] && live));
  set('freeze', frozen > 0); set('lock', locked);
  set('silence', S.clin < ventSilUntil, false, S.clin < ventSilUntil ? `Silenciado ${fmt((ventSilUntil - S.clin) * 60)} s` : KEYLAB.silence(d));
  set('standby', off, S.iface === 'o2', standbyArm > performance.now() ? '¿Confirmar espera?' : off ? 'En espera' : KEYLAB.standby(d));
  set('manual', false, !live);
  set('menu', showModes); set('airmix', S.cfg.fio2 < 100, !S.o2.supply); set('o2full', S.cfg.fio2 >= 100); set('cpr', S.cfg.mode === 'CPV');
}
let manualDown = 0;
$('#vkeys').addEventListener('pointerdown', e => { const b = e.target.closest('[data-vk="manual"]'); if (b && !b.disabled) manualDown = performance.now(); });
$('#vkeys').addEventListener('click', e => {
  const b = e.target.closest('[data-vk]'); if (!b || b.disabled) return;
  const k = b.dataset.vk, d = devOf();
  switch (k) {
    case 'o2boost': sim.action('o2boost'); logIt(S.clin < S.o2boostUntil ? `${KEYLAB.o2boost(d)}: O₂ al 100 % durante 2 min` : `${KEYLAB.o2boost(d)} cancelado`); break;
    case 'inhold': sim.inspHold(); logIt('Pausa inspiratoria'); break;
    case 'exhold': sim.expHold(); logIt('Pausa espiratoria'); break;
    case 'freeze': frozen = frozen ? 0 : performance.now() + 30000; break;
    case 'lock': locked = !locked; renderModes(); renderKnobs(); renderStandby(); logIt(locked ? 'Pantalla bloqueada' : 'Pantalla desbloqueada'); break;
    case 'silence': ventSilUntil = S.clin < ventSilUntil ? -1 : S.clin + d.silence; break;
    case 'standby':
      if (ventOffNow()) break;
      if (standbyArm > performance.now()) { sim.setStandby(true); standbyArm = 0; pend = Object.assign({}, S.cfg); logIt('Ventilador en espera: no ventila'); renderVent(); }
      else standbyArm = performance.now() + 3000;
      break;
    case 'manual':
      if (d === DEVS.t1 && performance.now() - manualDown > 700) { sim.inspHold(); logIt('Pausa inspiratoria (tecla mantenida)'); }
      else { sim.action('manual'); logIt('Respiración manual'); }
      break;
    case 'neb': b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); logIt(b.getAttribute('aria-pressed') === 'true' ? 'Nebulizador en línea encendido' : 'Nebulizador apagado'); break;
    case 'menu': showModes = !showModes; renderModes(); break;
    case 'airmix': case 'o2full': { const f = k === 'airmix' ? 60 : 100; sim.setCfg(Object.assign({}, S.cfg, { fio2: f })); pend.fio2 = f; logIt(k === 'airmix' ? 'Air Mix activado' : 'O₂ al 100 %'); renderKnobs(); break; }
    case 'cpr':
      if (S.cfg.mode !== 'CPV') { cprPrev = Object.assign({}, S.cfg); const c = Object.assign({}, S.cfg, { mode: 'CPV', peep: 0, fr: 10, ti: 1, pinsp: S.cfg.pinsp || 15, fio2: 100 }); delete c.umode; sim.setCfg(c); logIt('Modo CPR: ventilación continua a 10/min, PEEP 0'); }
      else { sim.setCfg(cprPrev || Object.assign({}, S.cfg, { mode: 'VCV', peep: 5 })); cprPrev = null; logIt('Sales de CPR'); }
      pend = Object.assign({}, S.cfg); renderVent(); break;
    case 'rce':
      if (S.cfg.mode === 'CPV') { sim.setCfg(Object.assign({}, S.cfg, { mode: 'PCV', fr: 12, trigI: 2, peep: 5, rce: true })); logIt('Fase RCE: ventilación controlada por presión, asistida'); }
      else { sim.setCfg(Object.assign({}, S.cfg, { mode: 'CPV', fr: 10, peep: 0, rce: false })); logIt('Vuelta a compresiones (CPV)'); }
      pend = Object.assign({}, S.cfg); renderVent(); break;
  }
  track.acts++; updateKeys();
});

/* pantalla de espera y puesta en marcha */
function renderStandby() {
  const off = ventOffNow(), d = devOf(), el = $('#ventOff');
  el.hidden = !off;
  if (!off) return;
  if (S.dev.pneumatic && !S.o2.supply && !S.standby && S.iface !== 'o2') { el.innerHTML = `<div class="sby"><b>Sin gas</b><p>El ${d.short} es neumático y se ha parado al quedarse sin O₂. Cambia la botella y ventila con ambú mientras tanto.</p></div>`; return; }
  const need = sbyIface(), conn = S.iface === need;
  el.innerHTML = `<div class="sby">
    <b>En espera</b><span class="sbysub">${d.short} · ${S.iface === 'o2' ? 'paciente sin conectar (' + O2LAB[S.cfg.o2dev] + ')' : 'conectado a ' + IFLAB[S.iface] + ', sin ventilar'}</span>
    <div class="sbyrow"><span class="ml">Paciente</span><button class="sbtn" data-sex="h" aria-pressed="${devPat.sex === 'h'}">Varón</button><button class="sbtn" data-sex="m" aria-pressed="${devPat.sex === 'm'}">Mujer</button>
      <span class="ml">Talla</span><button class="sbtn" data-tal="-5" aria-label="Bajar talla">−</button><span class="num">${devPat.talla} cm</span><button class="sbtn" data-tal="5" aria-label="Subir talla">+</button><span class="num sbyibw">peso ideal ${fmt(devIbw())} kg</span></div>
    <div class="sbyrow">${d.start.map(s => `<button class="sbtn wide" data-start="${s.id}" ${locked ? 'disabled' : ''}>${s.lab}${s.note ? `<small>${s.note}</small>` : ''}</button>`).join('')}</div>
    <p class="sbynote">Preparado: <b>${modeLabel(uMode(pend), null, need)}</b> para ${IFLAB[need]}. Ajusta modo y mandos abajo.${!conn ? ` <span class="warnt">Para iniciar, coloca ${need === 'tube' ? 'el tubo' : need === 'mask' ? 'la mascarilla de VMNI' : 'la cánula de alto flujo'} desde Acciones.</span>` : ''}</p>
    <button class="go" id="sbyGo" ${conn && !locked ? '' : 'disabled'}>Iniciar ventilación</button></div>`;
}
$('#ventOff').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.sex) devPat.sex = b.dataset.sex;
  if (b.dataset.tal) devPat.talla = clamp(devPat.talla + +b.dataset.tal, 50, 250);
  if (b.dataset.start) {
    const st = devOf().start.find(x => x.id === b.dataset.start);
    if (st && st.cfg) { pend = cleanCfg(st.cfg(devIbw())); sbyHint = st.iface || null; if (!pendAt) pendAt = performance.now(); logIt(`${devOf().short}: ${st.lab} con peso ideal ${fmt(devIbw())} kg`); }
    else { pend = Object.assign({}, S.cfg); sbyHint = null; }
    activeK = null; renderModes(); renderKnobs(); renderDials();
  }
  if (b.id === 'sbyGo') {
    if (S.iface !== sbyIface()) return;
    sim.setCfg(toModel(Object.assign({}, pend))); sim.setStandby(false); pend = Object.assign({}, S.cfg); pendAt = 0; sbyHint = null;
    logIt(`Ventilación iniciada: ${modeLabel(uMode(S.cfg), null, S.iface)}`); track.acts++;
    renderVent(); return;
  }
  renderStandby();
});

/* ---------- alarmas del ventilador ---------- */
function setLimits(reset) {
  const c = S.cfg, ibw = S.ibw, vt = c.vt || 7 * ibw, fr = c.fr || 14, hyper = VMI.PHENO[S.pk].hyper;
  if (reset || !lim.vteLow) lim = { pLow: 8, vteLow: Math.round(.6 * Math.min(vt, 8 * ibw)), vteHigh: Math.round(1.6 * Math.max(vt, 7 * ibw)), mvLow: +(Math.max(2, .5 * vt * fr / 1000)).toFixed(1), mvHigh: +(Math.max(12, 2 * vt * fr / 1000)).toFixed(1), fHigh: 35, etLow: 25, etHigh: hyper ? 80 : 55, apnea: 20, leak: 45 };
}
const LIMDEF = [
  ['pHigh', 'Presión alta', 'p', 1, 0], ['pLow', 'Presión baja', 'p', 1, 0], ['vteLow', 'Vte bajo', 'mL', 10, 0], ['vteHigh', 'Vte alto', 'mL', 10, 0],
  ['mvLow', 'VM bajo', 'L/min', .5, 1], ['mvHigh', 'VM alto', 'L/min', .5, 1], ['fHigh', 'Frecuencia alta', 'c/min', 1, 0], ['etLow', 'EtCO₂ bajo', 'mmHg', 1, 0],
  ['etHigh', 'EtCO₂ alto', 'mmHg', 1, 0], ['apnea', 'Tiempo de apnea', 's', 5, 0], ['leak', 'Fuga alta', 'L/min', 5, 0]];
function renderLimits() {
  const d = devOf();
  $('#limRows').innerHTML = LIMDEF.filter(([k]) => k !== 'pHigh' || d.limitsPmax).map(([k, l, u, st, dd]) => {
    const v = k === 'pHigh' ? S.cfg.pmax : lim[k], unit = u === 'p' ? d.u : u, lab = { pHigh: d.al.pHigh, vteLow: d.al.vteLow, vteHigh: d.al.vteHigh, mvLow: d.al.mvLow, mvHigh: d.al.mvHigh, etLow: d.al.etLow, etHigh: d.al.etHigh, fHigh: d.al.fHigh }[k] || l;
    return `<div class="lrow"><span>${lab}${k === 'pHigh' && S.dev.vent === 't1' ? ' <small>presión aplicada ≤ límite − 10</small>' : ''}</span><span class="krow"><button class="sbtn" data-lk="${k}" data-ld="-${st}" aria-label="Bajar ${lab}">−</button><b class="num">${fmt(v, dd)} ${unit}</b><button class="sbtn" data-lk="${k}" data-ld="${st}" aria-label="Subir ${lab}">+</button></span></div>`;
  }).join('');
}
$('#limRows').addEventListener('click', e => {
  const b = e.target.closest('[data-lk]'); if (!b || locked) return;
  const k = b.dataset.lk, dv = +b.dataset.ld;
  if (k === 'pHigh') { const v = clamp(S.cfg.pmax + dv, 15, 65); sim.setCfg(Object.assign({}, S.cfg, { pmax: v })); pend.pmax = v; logIt(`${devOf().al.pHigh}: límite ${v} ${devOf().u}`); }
  else lim[k] = Math.max(0, +(lim[k] + dv).toFixed(1));
  renderLimits();
});
$('#limAuto').addEventListener('click', () => {
  if (M.vte == null || ventOffNow()) return;
  lim.vteLow = Math.round(.7 * M.vte); lim.vteHigh = Math.round(1.4 * M.vte); lim.mvLow = +(.6 * M.vme).toFixed(1); lim.mvHigh = +(1.6 * M.vme + .5).toFixed(1);
  lim.fHigh = Math.max(30, Math.round(1.5 * M.fr)); if (M.et > 5) { lim.etLow = Math.max(10, Math.round(M.et - 8)); lim.etHigh = Math.round(M.et + 10); } lim.pLow = Math.max(5, Math.round(S.cfg.peep + 3));
  logIt('Límites de alarma ajustados a los valores actuales'); renderLimits();
});
function ventAlarmList() {
  const a = [], c = S.cfg, d = devOf(), A = d.al, off = ventOffNow(), L = lim;
  if (S.iface === 'o2' || S.standby) return a;
  if (S.dev.pneumatic && !S.o2.supply) { a.push(['hi', A.gas]); return a; }
  if (!S.o2.supply) a.push(['hi', A.gas]);
  if (S.iface === 'nasal' || off) return a;
  const since = S.t - (S.tReset || 0);
  if (S.t - (S.pmaxHit || -99) < 3) a.push(['hi', d.pneumatic ? A.plim : A.pHigh]);
  const discon = (S.air.disc || S.air.extub) && since > 8 && (M.vte == null || M.vte < .25 * (M.vti || 1));
  if (discon || (M.ppk != null && M.nB >= 1 && M.ppk < L.pLow && since > 8 && c.mode !== 'CPAP' && !(c.mode === 'PSV' && !c.ps) && uMode(c) !== 'DEM')) a.push(['hi', A.pLow]);
  if (since > L.apnea && S.t - S.vent.tb > L.apnea && uMode(c) !== 'MAN') a.push(['hi', A.apnea]);
  if (M.vte != null && M.nB >= 2 && M.vte < L.vteLow && uMode(c) !== 'DEM') a.push([d === DEVS.t1 ? 'med' : 'hi', A.vteLow]);
  if (M.vte != null && M.vte > L.vteHigh && S.iface === 'tube') a.push(['med', A.vteHigh]);
  if (M.nB >= 3 && M.vme < L.mvLow && uMode(c) !== 'MAN') a.push(['hi', A.mvLow]);
  if (M.vme > L.mvHigh) a.push(['med', A.mvHigh]);
  if (M.fr > L.fHigh) a.push(['med', A.fHigh]);
  if (M.et != null && S.iface === 'tube' && M.nB >= 2 && since > 15 && M.et < L.etLow) a.push(['med', A.etLow]);
  if (M.et != null && M.et > L.etHigh) a.push(['med', A.etHigh]);
  if (S.iface === 'mask' && M.leak > L.leak) a.push(['med', A.leak]);
  if ((c.mode === 'APV' || c.mode === 'ASV') && S.apv.p >= c.pmax - 10.5) a.push(['med', A.plim]);
  if (S.dev.vent === 'medumat' && M.calc && M.calc.autopeep > 3) a.push(['hi', A.peepHigh]);
  return a;
}
function ventAlarms() {
  const a = ventAlarmList(), el = $('#alarm'), sil = S.clin < ventSilUntil;
  el.title = '';
  if (S.iface === 'o2' || S.standby) { el.className = 'alarm'; el.textContent = 'En espera'; return a; }
  if (!a.length) { el.className = 'alarm'; el.textContent = 'Sin alarmas'; }
  else { const top = a.find(x => x[0] === 'hi') || a[0]; el.className = 'alarm ' + top[0]; el.textContent = (sil ? 'Silenciada · ' : '') + top[1] + (a.length > 1 ? '  (+' + (a.length - 1) + ')' : ''); el.title = a.map(x => x[1]).join(' · '); }
  return a;
}

/* ---------- sonido ---------- */
function ensureAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } } if (actx && actx.state === 'suspended') actx.resume(); }
document.addEventListener('pointerdown', ensureAudio, { once: true });
function beeps(freq, n, gap) {
  if (!actx || !soundOn || paused) return;
  const t0 = actx.currentTime + .02;
  for (let i = 0; i < n; i++) { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'square'; o.frequency.value = freq; g.gain.setValueAtTime(0, t0 + i * gap); g.gain.linearRampToValueAtTime(.05, t0 + i * gap + .01); g.gain.linearRampToValueAtTime(0, t0 + i * gap + .14); o.connect(g).connect(actx.destination); o.start(t0 + i * gap); o.stop(t0 + i * gap + .16); }
}
function alarmSound(vent, mon) {
  const now = performance.now();
  const hi = (vent.some(x => x[0] === 'hi') && S.clin >= ventSilUntil) || (mon.some(x => x[0] === 'hi') && S.clin >= monSilUntil);
  const med = (vent.some(x => x[0] === 'med') && S.clin >= ventSilUntil) || (mon.some(x => x[0] === 'med') && S.clin >= monSilUntil);
  if (hi && now - lastBeepHi > 5000) { lastBeepHi = now; beeps(960, 5, .2); }
  else if (!hi && med && now - lastBeepMed > 12000) { lastBeepMed = now; beeps(660, 3, .25); }
}
$('#soundBtn').addEventListener('click', () => { soundOn = !soundOn; ensureAudio(); $('#soundBtn').setAttribute('aria-pressed', soundOn); $('#soundBtn').textContent = soundOn ? 'Sonido' : 'Sin sonido'; });

/* ---------- pantalla del ventilador ---------- */
function applyDevUI() {
  const d = devOf();
  $('#devName').textContent = d.name; $('#devSub').textContent = d.sub;
  const v = $('#vent'); v.classList.toggle('medumat', S.dev.vent === 'medumat'); v.classList.toggle('t1', S.dev.vent === 't1');
  $('#legCalc').textContent = d.legend;
}
function applyMonUI() {
  const m = $('#monSel').value, mo = MONS[m];
  $('#zoll').classList.toggle('corpuls', m === 'corpuls');
  $('#monName').textContent = mo.name;
  $('#zJ').innerHTML = mo.energies.map(e => `<option value="${e}" ${e === mo.def ? 'selected' : ''}>${e} J</option>`).join('');
  $('#zRate').innerHTML = Array.from({ length: 31 }, (_, i) => 30 + i * 5).map(r => `<option ${r === 70 ? 'selected' : ''}>${r}</option>`).join('');
  $('#zmA').innerHTML = Array.from({ length: 29 }, (_, i) => i * 5).map(a => `<option value="${a}">${a}</option>`).join('');
  refreshZC();
}
function switchDevice(dev) {
  sim.setDevice(dev);
  if (S.iface === 'nasal' && !DEVS[dev].modes.nasal.length) { sim.setStandby(false); sim.setIface('o2'); sim.setCfg(Object.assign({}, S.cfg, { o2dev: $('#o2dev').value })); logIt('Este equipo no tiene alto flujo: pasas a oxigenoterapia'); }
  sim.setCfg(fitMode(S.cfg, dev, S.iface === 'o2' ? 'tube' : S.iface));
  invCfg = fitMode(invCfg, dev, 'tube'); pend = Object.assign({}, S.cfg); activeK = null; showModes = dev !== 'medumat';
  applyDevUI(); renderVent(); updateUI();
  logIt('Ventilador: ' + DEVS[dev].short);
}
const TL = (k, l, u, c, d, get, calc) => ({ k, l, u, c, d, get, calc });
function tileSet() {
  const v = S.dev.vent, i = S.iface, pu = devOf().u, md = S.cfg.mode, cl = () => M.calc || {};
  const pinspNow = () => md === 'APV' || md === 'ASV' ? S.apv.p : md === 'PCV' || md === 'CPV' ? S.cfg.pinsp : md === 'PSV' || md === 'PST' ? S.cfg.ps : null;
  if (i === 'o2') return [TL('o2q', 'O₂', 'L/min', 'f', 0, () => VMI.O2DEV[S.cfg.o2dev].q), TL('o2fi', 'FiO₂ aprox.', '%', 'v', 0, () => S.fiEff * 100), TL('et', 'EtCO₂', 'mmHg', 'c', 0, () => M.et), TL('capRR', 'FR capno', 'rpm', 'f', 0, () => M.capRR)];
  if (i === 'nasal') return [TL('hflow', v === 't1' ? 'Flow' : 'Flujo', 'L/min', 'f', 0, () => S.cfg.flow), TL('hfio2', v === 't1' ? 'Oxygen' : 'FiO₂', '%', 'v', 0, () => S.cfg.fio2), TL('pmean', 'P media', pu, 'p', 1, () => M.pmean), TL('et', 'EtCO₂', 'mmHg', 'c', 0, () => M.et), TL('capRR', 'FR capno', 'rpm', 'f', 0, () => M.capRR)];
  const vte = l => TL('vte', l, 'mL', 'v', 0, () => M.vte), vme = l => TL('vme', l, 'L/min', 'v', 1, () => M.vme), et = l => TL('et', l, 'mmHg', 'c', 0, () => M.et);
  const ie = TL('ie', 'I:E', '', 'f', 1, () => M.ie), leak = l => TL('leak', l, 'L/min', 'f', 0, () => M.leak);
  const fio2 = l => TL('fio2m', l, '%', 'v', 0, () => S.o2.supply ? (S.clin < S.o2boostUntil ? 100 : S.cfg.fio2) : 21);
  if (v === 't1') {
    if (i === 'mask') return [TL('ppk', 'Ppeak', pu, 'p', 0, () => M.ppk), TL('peep', 'PEEP', pu, 'p', 0, () => M.peep), leak('Leak'), vte('VTE NIV'), vme('MinVol NIV'), TL('fr', 'fTotal', 'c/min', 'f', 0, () => M.fr), TL('fsp', 'fSpont', 'c/min', 'f', 0, () => M.fsp), fio2('Oxygen'), et('PetCO2')];
    return [TL('ppk', 'Ppeak', pu, 'p', 0, () => M.ppk), TL('cpplat', 'Pplateau', pu, 'p', 0, () => cl().pplatEst, 'c'), TL('peep', 'PEEP', pu, 'p', 0, () => M.peep), TL('cautop', 'AutoPEEP', pu, 'p', 1, () => cl().autopeep, 'c'),
      TL('ccst', 'Cstat', 'mL/' + pu, 'p', 0, () => cl().cst, 'c'), TL('crin', 'Rinsp', pu + '/L/s', 'f', 0, () => cl().rinsp, 'c'), TL('crc', 'RCexp', 's', 'f', 2, () => cl().rcexp, 'c'), TL('pinsp', 'Pinsp', pu, 'p', 0, pinspNow),
      vte('VTE'), vme('ExpMinVol'), TL('fr', 'fTotal', 'c/min', 'f', 0, () => M.fr), TL('fsp', 'fSpont', 'c/min', 'f', 0, () => M.fsp), fio2('Oxygen'), et('PetCO2')];
  }
  if (v === 'medumat') {
    const o2 = TL('o2set', 'O₂', '', 'v', 0, () => S.cfg.fio2); o2.show = x => x >= 100 ? '100 %' : 'Air Mix';
    if (i === 'mask') return [TL('ppk', 'pPeak', pu, 'p', 0, () => M.ppk), TL('pmean', 'pMean', pu, 'p', 1, () => M.pmean), TL('peep', 'PEEP', pu, 'p', 0, () => M.peep), leak('Fuga'), vte('Vt'), vme('MV'), TL('fr', 'Frec.', 'c/min', 'f', 0, () => M.fr), TL('fsp', 'fspont', 'c/min', 'f', 0, () => M.fsp), o2, et('etCO₂')];
    return [TL('ppk', 'pPeak', pu, 'p', 0, () => M.ppk), TL('cpplat', 'pPlat', pu, 'p', 0, () => cl().pplat), TL('pmean', 'pMean', pu, 'p', 1, () => M.pmean), TL('peep', 'PEEP', pu, 'p', 0, () => M.peep), vte('Vt'), vme('MV'), TL('fr', 'Frec.', 'c/min', 'f', 0, () => M.fr), TL('fsp', 'fspont', 'c/min', 'f', 0, () => M.fsp), o2, et('etCO₂')];
  }
  if (i === 'mask') return [TL('ppk', 'Ppeak', pu, 'p', 0, () => M.ppk), TL('peep', 'PEEP', pu, 'p', 0, () => M.peep), leak('Fuga'), TL('vti', 'VTi', 'mL', 'v', 0, () => M.vti), vte('VTe'), vme('VMe'), TL('fr', 'FR', 'c/min', 'f', 0, () => M.fr), ie, fio2('FiO₂'), et('EtCO₂')];
  const t = [TL('ppk', 'Ppeak', pu, 'p', 0, () => M.ppk), TL('pplat', 'Pplat', pu, 'p', 0, () => M.pplat, 'p'), TL('peep', 'PEEP', pu, 'p', 0, () => M.peep), TL('peepi', 'PEEPi', pu, 'p', 1, () => M.peepi, 'p'), TL('dp', 'ΔP', pu, 'p', 0, () => M.dp, 'p'), TL('cst', 'Cstat', 'mL/' + pu, 'p', 0, () => M.cst, 'p'),
    vte('VTe'), vme('VMe'), TL('vtkg', 'VTe/PBW', 'mL/kg', 'v', 1, () => M.vte != null ? M.vte / devIbw() : null), TL('fr', 'FR', 'c/min', 'f', 0, () => M.fr), ie, fio2('FiO₂'), et('EtCO₂')];
  if (md === 'APV') t.splice(6, 0, TL('pinsp', 'PI regulada', pu, 'p', 0, pinspNow));
  return t;
}
let TILES = [];
function renderTilesFrame() {
  TILES = tileSet();
  $('#tiles').innerHTML = TILES.map(t => `<div class="tile ${t.c}${t.calc === 'p' ? ' calc' : t.calc === 'c' ? ' calcc' : ''}" id="t_${t.k}"><span class="tl">${t.l}</span><span class="tv" id="v_${t.k}">–</span><span class="tu">${t.u}</span></div>`).join('');
  $('#ifaceLbl').textContent = IFLAB[S.iface];
  frameKey = S.dev.vent + S.iface + S.cfg.mode + (S.standby ? 's' : '');
}
function updateTiles() {
  const off = ventOffNow() && S.iface !== 'o2';
  for (const t of TILES) { const e = $('#v_' + t.k); if (!e) continue; const v = off ? null : t.get(); e.textContent = t.k === 'ie' ? (v ? '1:' + fmt(v, 1) : '–') : t.show ? t.show(v) : fmt(v, t.d); }
  const flag = (k, l) => { const t = $('#t_' + k); if (t) { t.classList.toggle('warn', l === 'warn'); t.classList.toggle('hi', l === 'hi'); } };
  const cl = M.calc || {};
  flag('ppk', S.t - (S.pmaxHit || -99) < 3 ? 'hi' : '');
  flag('pplat', M.pplat > 30 ? 'hi' : ''); flag('cpplat', (S.dev.vent === 't1' ? cl.pplatEst : cl.pplat) > 30 ? 'hi' : '');
  flag('dp', M.dp > 15 ? 'warn' : ''); flag('peepi', M.peepi > 5 ? 'warn' : ''); flag('cautop', cl.autopeep > 5 ? 'warn' : '');
  flag('vte', M.vte != null && M.vte < lim.vteLow ? 'hi' : ''); flag('vtkg', M.vte != null && M.vte / devIbw() > 8.5 ? 'warn' : '');
  flag('fr', M.fr > lim.fHigh ? 'warn' : ''); flag('leak', M.leak > lim.leak ? 'hi' : M.leak > 25 ? 'warn' : '');
  flag('pinsp', (S.cfg.mode === 'APV' || S.cfg.mode === 'ASV') && S.apv.p >= S.cfg.pmax - 10.5 ? 'hi' : '');
  flag('et', M.et < 5 && S.t > 15 && !S.arrest && S.iface === 'tube' ? 'hi' : (M.et > 50 || (M.et < 30 && M.et > 5)) ? 'warn' : '');
}
function modeInfoTxt() {
  const c = S.cfg, pu = devOf().u, um = uMode(c);
  if (S.iface === 'o2') return `Paciente con ${O2LAB[c.o2dev]} (FiO₂ real ≈ ${fmt(S.fiEff * 100)} %). El ventilador está en espera.`;
  if (S.standby) return 'Ventilador en espera: no entrega gas.';
  if (um === 'DEM') return 'RSI · Demand: el paciente respira O₂ al 100 % a demanda, sin presión de soporte. Para preoxigenar.';
  if (um === 'MAN') return 'RSI · Manual: entrega una respiración con el volumen y el límite de presión ajustados cada vez que pulsas «Disparo manual».';
  if (c.mode === 'APV') return `${S.dev.vent === 't1' ? 'APVcmv' : 'Volumen regulado'}: presión que aplica ahora ${fmt(S.apv.p)} ${pu} sobre PEEP para Vt ${fmt(c.vt)} mL (techo ${fmt(c.pmax - 10)}).`;
  if (c.mode === 'ASV') return `Objetivo ASV: VM ${fmt(c.minvol / 100 * .1 * devIbw(), 1)} L/min · f ${fmt(S.asv.f)} c/min · Vt ${fmt(S.asv.vt)} mL · TI ${fmt(S.asv.ti, 2)} s · Pinsp ${fmt(S.apv.p)} ${pu}.`;
  if (c.mode === 'PST') return `Respaldo temporizado a ${fmt(c.fr)} c/min con TI ${fmt(c.ti, 2)} s si no dispara.`;
  if (c.mode === 'CPV') return 'Ventilación para RCP: sigue a las compresiones sin cortar por presión y no se dispara con ellas.';
  if (c.mode === 'HFNC') return `Alto flujo ${fmt(c.flow)} L/min, FiO₂ ${fmt(c.fio2)} %: presión espiratoria ≈ ${fmt(.045 * c.flow, 1)} cmH₂O y lavado del espacio muerto.`;
  if (S.dev.vent === 'medumat') return 'Equipo neumático: limita la presión a pMax sin cortar la inspiración y se para si se acaba el O₂. Consume además ≈ 0,3 L/min propios.';
  return '';
}

/* ---------- monitor-desfibrilador ---------- */
function measurePni(silent) {
  if (pniMeas || !S) return; pniMeas = S.t + 4; $('#zPniBtn').setAttribute('aria-pressed', 'true'); $('#zPnAge').textContent = 'midiendo…';
  if (!silent) logIt('PNI en curso');
}
function finishPni() {
  pniMeas = 0; $('#zPniBtn').setAttribute('aria-pressed', 'false');
  if (S.arrest || S.tas < 45) { pni = { at: S.clin, sys: null }; logIt('PNI: sin medida'); return; }
  const sys = S.tas * (1 + (Math.random() - .5) * .04); pni = { at: S.clin, sys, dia: sys * .55 + 8 };
  logIt(`PNI ${fmt(pni.sys)}/${fmt(pni.dia)} mmHg`);
}
$('#zPniBtn').addEventListener('click', () => measurePni(false));
$('#zAuto').addEventListener('change', e => logIt('PNI automática: ' + (e.target.value === '0' ? 'no' : 'cada ' + e.target.value + ' min')));
function setPace() { sim.pace($('#zPace').checked, +$('#zRate').value, +$('#zmA').value, $('#zPaceMode').value); }
$('#zPace').addEventListener('change', e => { setPace(); logIt(e.target.checked ? `Marcapasos ${$('#zPaceMode').value === 'demand' ? 'a demanda' : 'fijo'}: ${$('#zRate').value} lpm, ${$('#zmA').value} mA` : 'Marcapasos apagado'); });
['#zRate', '#zmA', '#zPaceMode'].forEach(id => $(id).addEventListener('change', () => { setPace(); if ($('#zPace').checked) logIt('Marcapasos: ' + ($('#zPaceMode').value === 'demand' ? 'demanda' : 'fijo') + ' ' + $('#zRate').value + ' lpm ' + $('#zmA').value + ' mA'); }));
$('#zJ').addEventListener('change', () => { if (defib.st !== 'idle') { defib.st = 'idle'; logIt('Desfibrilador descargado internamente al cambiar la energía'); } });
$('#zMode').addEventListener('change', e => { defib.st = 'idle'; aed = { st: 'idle', until: 0 }; syncOn = false; logIt(e.target.value === 'aed' ? 'Modo DEA' : 'Modo manual'); updateDefib(); });
$('#zSync').addEventListener('click', () => { syncOn = !syncOn; logIt(syncOn ? 'Sincronizado activado' : 'Sincronizado desactivado'); updateDefib(); });
$('#zCharge').addEventListener('click', () => { if (defib.st !== 'idle') return; defib = { st: 'charging', until: S.t + 4 }; logIt('Cargando ' + $('#zJ').value + ' J' + (syncOn ? ' (SINC)' : '')); updateDefib(); });
$('#zAnalyze').addEventListener('click', () => {
  if (aed.st !== 'idle') return;
  if (S.arrest && S.cpr.comp !== 'off') { monMsg('Movimiento detectado: detén las compresiones para analizar'); logIt('DEA: análisis interrumpido por movimiento'); return; }
  aed = { st: 'analyzing', until: S.t + Math.max(1, 12 / scale) }; monMsg('Analizando… no toque al paciente'); logIt('DEA: analizando');
});
$('#zShock').addEventListener('click', () => {
  const isAed = $('#zMode').value === 'aed';
  if (defib.st !== 'ready') return;
  const J = isAed ? aedEnergy() : +$('#zJ').value, wasArrest = S.arrest, rhy = S.rhythm, sync = syncOn && !isAed;
  if (sync && (rhy === 'vf' || rhy === 'asys')) { monMsg('SINC: no detecta onda R, no descarga'); logIt('Descarga sincronizada sin onda R: el equipo no descarga'); return; }
  const r = sim.shock(J, sync);
  defib.st = 'idle'; track.shocks++; track.lastShock = S.clin; aed = { st: 'idle', until: 0 };
  if (track.firstShock == null && wasArrest && track.arrestAt != null) track.firstShock = S.clin - track.arrestAt;
  const res = r.result === 'noShockable' ? (wasArrest ? ` en ritmo no desfibrilable (${RLAB[rhy]})` : ': el paciente tiene pulso, descarga sin indicación') : r.result === 'vf' ? ': la descarga no sincronizada ha desencadenado una FV' : '';
  logIt(`Descarga ${J} J${sync ? ' sincronizada' : ''}${res}`); if (isAed) monMsg('Descarga administrada. Reanude la RCP.');
  updateDefib();
});
$('#zSil').addEventListener('click', () => { monSilUntil = S.clin < monSilUntil ? -1 : S.clin + 2; updateDefib(); });
$('#zMarkBtn').addEventListener('click', () => { logIt('Marcador: ' + $('#zMark').value); track.drugs.push([S.clin, 'Marcador: ' + $('#zMark').value]); });
function aedEnergy() { const e = MONS[$('#monSel').value].aed; return e[Math.min(track.shocks, e.length - 1)]; }
function monMsg(t) { zMsg = t; zMsgUntil = performance.now() + 6000; }
function updateDefib() {
  const isAed = $('#zMode').value === 'aed', b = $('#zCharge'), s = $('#zShock');
  $('#zJ').hidden = isAed; $('#zSync').hidden = isAed; $('#zAnalyze').hidden = !isAed; b.hidden = isAed;
  $('#zSync').setAttribute('aria-pressed', syncOn); $('#zSync').textContent = syncOn ? 'SINC activo' : 'SINC';
  b.textContent = defib.st === 'charging' ? 'Cargando…' : defib.st === 'ready' ? 'Cargado' : 'Cargar'; b.disabled = defib.st !== 'idle';
  s.disabled = defib.st !== 'ready'; s.classList.toggle('ready', defib.st === 'ready');
  s.textContent = defib.st === 'ready' ? 'Descarga ' + (isAed ? aedEnergy() : $('#zJ').value) + ' J' : 'Descarga';
  $('#zAnalyze').disabled = aed.st !== 'idle';
  $('#zSil').setAttribute('aria-pressed', S.clin < monSilUntil); $('#zSil').textContent = S.clin < monSilUntil ? 'Silenciado' : 'Silenciar';
  $('#zMsg').textContent = performance.now() < zMsgUntil ? zMsg : '';
}
function updateMonitor() {
  const hyper = VMI.PHENO[S.pk].hyper, sp = S.spo2 * 100, perf = S.arrest ? 0 : clamp((S.tas - 45) / 70, .05, 1), r = S.rhythm, a = [];
  const pausing = S.t < S.pauseUntil && !S.arrest;
  const hr = pausing ? 0 : r === 'vf' || r === 'asys' ? null : r === 'tvsp' ? 190 : S.arrest ? 34 : S.fc;
  $('#zHr').textContent = r === 'asys' || pausing ? '0' : fmt(hr);
  const an = analysis && S.t < analysis.until ? 'Análisis: ' + analysis.txt : null;
  $('#zRhy').textContent = an || (S.arrest ? (S.cpr.comp !== 'off' ? 'RCP: analiza en la pausa' : 'derivación II') : pausing ? 'pausa' : S.pace.on ? (S.pace.capture ? 'estimulado' : 'marcapasos sin captura') : RLAB[r] || 'sinusal');
  const spOk = perf > .12 && !S.arrest;
  $('#zSp').textContent = spOk ? fmt(sp) : '–'; $('#zPi').textContent = spOk ? 'IP ' + fmt(perf * 4, 1) : 'sin señal';
  $('#zSpT').textContent = spOk ? 'SpCO ' + fmt(Math.max(0, M.spco)) + ' %' : '';
  $('#zEt').textContent = fmt(M.et); $('#zRr').textContent = 'FR ' + fmt(M.capRR);
  if (pni && pni.sys) { $('#zPn').textContent = fmt(pni.sys) + '/' + fmt(pni.dia); $('#zPnM').textContent = 'media ' + fmt((pni.sys + 2 * pni.dia) / 3); }
  else { $('#zPn').textContent = pni ? '- - -' : '–/–'; $('#zPnM').textContent = pni ? 'sin medida' : 'media –'; }
  if (!pniMeas) $('#zPnAge').textContent = pni ? 'hace ' + fmt(S.clin - pni.at) + ' min' : 'sin medir';
  if (r === 'vf' || r === 'tvsp') a.push(['hi', 'FV/TV']);
  if (r === 'asys' || pausing) a.push(['hi', 'Asistolia']);
  if (spOk && sp < (hyper ? 85 : 90)) a.push(['hi', 'SpO₂ baja']);
  if (spOk && M.spco > 10) a.push(['med', 'SpCO alta']);
  if (!spOk && !S.arrest) a.push(['med', 'SpO₂: señal débil']);
  if (S.arrest && r === 'aesp') a.push(['hi', 'FC baja']);
  if (hr != null && !S.arrest && !pausing && (hr > 140 || hr < 45)) a.push(['hi', hr < 45 ? 'FC baja' : 'FC alta']);
  if (S.pace.on && !S.pace.capture && !S.arrest && !(S.pace.mode === 'demand' && (S.fcIntr || 0) >= S.pace.rate)) a.push(['med', 'Marcapasos: sin captura']);
  if (pni && pni.sys != null && pni.sys < 90) a.push(['hi', 'PNI baja']);
  if (pni && pni.sys != null && pni.sys > 180) a.push(['med', 'PNI alta']);
  if (M.et > 50 && !hyper && !S.arrest) a.push(['med', 'EtCO₂ alta']);
  if (M.capRR > 30 && !S.arrest) a.push(['med', 'FR alta']);
  const el = $('#zal');
  if (!a.length) { el.className = 'zal'; el.textContent = 'Sin alarmas'; }
  else { const top = a.find(x => x[0] === 'hi') || a[0]; el.className = 'zal ' + top[0]; el.textContent = (S.clin < monSilUntil ? 'Silenciada · ' : '') + top[1] + (a.length > 1 ? ' (+' + (a.length - 1) + ')' : ''); }
  $('#zSpBox').classList.toggle('al', spOk && sp < (hyper ? 85 : 90));
  $('#zHrBox').classList.toggle('al', S.arrest || pausing || hr == null || hr > 140 || hr < 45);
  $('#zPnBox').classList.toggle('al', !!(pni && pni.sys != null && (pni.sys < 90 || pni.sys > 180)));
  $('#zCoBox').classList.toggle('al', M.et > 50 && !hyper && !S.arrest);
  const cp = $('#zCpr');
  if (S.arrest) {
    const c = S.cpr, frac = c.cprTime + c.noFlow > 0 ? c.cprTime / (c.cprTime + c.noFlow) : 0, q = M.cprQ || 0;
    cp.hidden = false;
    cp.textContent = (c.comp === 'off' ? 'SIN COMPRESIONES' : `${MONS[$('#monSel').value].cpr}: ${c.comp === 'mech' ? 102 : 110 + Math.round(Math.sin(S.t / 5) * 4)}/min · profundidad ${fmt(c.comp === 'mech' ? 5.3 : 5.8 * q / .92, 1)} cm` + (c.comp === 'manual' ? ` · relevo hace ${fmt(c.relevo, 1)} min` : ' · compresor')) + ` · fracción ${fmt(frac * 100)} % · descargas ${track.shocks}`;
  } else cp.hidden = true;
  const o = S.o2, useful = Math.max(0, (o.bar - 20) * o.vol), own = S.dev.pneumatic && (S.iface === 'tube' || S.iface === 'mask') && !ventOffNow() ? .3 : 0, cons = o.cons + own, aut = cons > .05 ? useful / cons : null;
  const g = $('#o2Gauge'); g.firstElementChild.style.width = clamp(o.bar / 200 * 100, 0, 100) + '%';
  g.className = 'gauge' + (!o.supply || o.bar < 20 ? ' bad' : aut != null && aut < 30 ? ' warn' : '');
  const what = S.iface === 'o2' ? O2LAB[S.cfg.o2dev] : S.iface === 'nasal' ? 'alto flujo' : S.iface === 'mask' ? 'VMNI, fuga incluida' : S.dev.pneumatic ? 'equipo neumático' : 'mezcla de la turbina';
  $('#o2Txt').textContent = `${fmt(o.bar)} bar · botella de ${o.vol} L · consumo ${fmt(cons, 1)} L/min (${what}) · ` + (o.supply ? (aut != null ? `autonomía ≈ ${fmt(aut)} min (reserva 20 bar)` : 'autonomía amplia') : S.dev.pneumatic && (S.iface === 'tube' || S.iface === 'mask') ? 'vacía: el equipo neumático se para' : 'vacía: sin O₂');
  const pill = $('#o2Pill'); pill.textContent = o.supply ? 'suministro OK' : 'sin O₂'; pill.className = 'chip ' + (o.supply ? 'ok' : 'off');
  const c = CASES[caseKey];
  for (const k in (c.targets || {})) { const e2 = $('#tg_' + k); if (!e2) continue; const v = TGT[k].get(), rg = c.targets[k]; e2.className = 'chip ' + (v == null || !isFinite(v) ? '' : (v >= rg[0] && v <= rg[1]) ? 'ok' : 'off'); }
  const s = Math.round(S.clin * 60); $('#clock').textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(x => String(x).padStart(2, '0')).join(':');
  drawSpark();
  return a;
}

/* ---------- lectura ---------- */
function readings() {
  const out = [], c = S.cfg, P = VMI.PHENO[S.pk], ifc = S.iface, mask = ifc === 'mask', tube = ifc === 'tube', off = ventOffNow(), vent = (tube || mask) && !off, d = devOf();
  const pniS = pni && pni.sys != null && S.clin - pni.at < 15 ? pni.sys : null;
  if (S.arrest) {
    const cp = S.cpr, shock = S.rhythm === 'vf' || S.rhythm === 'tvsp';
    if (cp.comp === 'off' && !resume) out.push(['bad', 'Parada sin compresiones', `Tiempo total sin flujo: ${fmt(cp.noFlow, 1)} min.`, 'Compresiones ya, manuales o con el compresor. Minimiza las pausas.']);
    if (shock && (track.lastShock == null || S.clin - track.lastShock > 2.2)) out.push(['bad', 'Ritmo desfibrilable', 'FV o TV sin pulso en el monitor.', syncOn ? 'Desactiva SINC: en FV no hay onda R y el equipo no descargará.' : 'Carga mientras se comprime, descarga 150–200 J y reanuda las compresiones sin comprobar pulso.']);
    if (cp.comp === 'manual' && cp.relevo > 2) out.push(['warn', 'Compresor cansado', `${fmt(cp.relevo, 1)} min sin relevo: la calidad cae.`, 'Relevo cada 2 min, aprovechando el análisis, o compresor mecánico.']);
    const lastAdr = track.adr.length ? S.clin - track.adr[track.adr.length - 1] : null;
    if (!shock && (lastAdr == null || lastAdr > 5)) out.push(['warn', 'Adrenalina', lastAdr == null ? 'Aún no se ha dado.' : `Última dosis hace ${fmt(lastAdr)} min.`, 'Adrenalina 1 mg cada 3–5 min; en ritmo no desfibrilable, cuanto antes.']);
    if (shock && track.shocks >= 3 && !track.amio) out.push(['warn', 'Tres descargas', 'Ritmo desfibrilable refractario.', 'Adrenalina 1 mg y amiodarona 300 mg tras la tercera descarga.']);
    if (vent && tube && cp.comp !== 'off' && c.mode !== 'CPV' && (d.modes.tube.some(x => x[0] === 'CPV') || c.mode !== 'PCV' || c.fr > 12 || c.trigI < 5)) out.push(['warn', 'Modo no pensado para la RCP', 'Las compresiones disparan ciclos o cortan por presión máxima.', d.modes.tube.find(x => x[0] === 'CPV') ? `Pasa a ${modeLabel('CPV', null, 'tube')}: 10 c/min, FiO₂ 100 %.` : `${modeLabel('PCV', null, 'tube')} con FR 10, PEEP 0–5, FiO₂ 100 % y trigger al máximo para que las compresiones no disparen ciclos; o bolsa a 10/min.`]);
    if (M.et != null && M.et < 10 && cp.comp !== 'off' && S.t > 10) out.push(['warn', 'EtCO₂ < 10 mmHg en RCP', 'Gasto cardiaco muy bajo o tubo mal colocado.', 'Mejora las compresiones y comprueba el tubo.']);
    const cause = { hypox: 'Hipoxia: oxigena y ventila con O₂ al 100 %; vía aérea.', ptx: 'Neumotórax a tensión: descomprime.', hypo: 'Hipovolemia: volumen.', opi: 'Opiáceos: naloxona y ventilación.', tep: 'TEP: fibrinólisis y RCP prolongada con compresor.', anaf: 'Anafilaxia: adrenalina y volumen a chorro.', co: 'CO e hipoxia: O₂ al 100 %.', vt: 'TV: desfibrila.' }[cp.cause];
    if (cause) out.push(['warn', 'Causa reversible probable', '4H y 4T.', cause]);
    if (cp.sinceCheck >= 2) out.push(['warn', 'Toca analizar', `${fmt(cp.sinceCheck, 1)} min desde el último análisis.`, 'Pausa breve (< 10 s) con «Comprobar pulso y ritmo» o con el DEA, relevo y descarga si procede.']);
    else out.push(['ok', 'Ciclo de RCP', `Próximo análisis en ${fmt(Math.max(0, 2 - cp.sinceCheck), 1)} min.`, 'Compresiones de calidad y mínimas pausas.']);
  }
  if (S.isr) out.push(['warn', 'Laringoscopia en curso', S.isr.apox ? 'Apnea con oxigenación apneica por gafas.' : 'El paciente está en apnea: la reserva de O₂ depende de la preoxigenación.', 'Al intubar, el ventilador quedará en espera: revisa los ajustes e inicia.']);
  if (!S.arrest && S.standby && tube && !S.bag && (S.pat.pmax <= 1 || S.relTot > .5)) out.push(['bad', 'Intubado y sin ventilar', 'El ventilador está en espera y el paciente no respira.', 'Pulsa «Iniciar ventilación» o ventila con ambú.']);
  if (!S.arrest && ((S.standby && S.iface !== 'o2') || S.isr) && Math.abs(devIbw() - S.ibw) > .12 * S.ibw) out.push(['warn', 'Datos del paciente en el equipo', `El ${d.short} calcula con ${devPat.sex === 'm' ? 'mujer' : 'varón'} de ${devPat.talla} cm (peso ideal ${fmt(devIbw())} kg); el paciente es ${S.P.sex === 'm' ? 'mujer' : 'varón'} de ${S.P.talla} cm (${fmt(S.ibw)} kg).`, 'Corrige sexo y talla en la pantalla de espera antes de elegir el preajuste.']);
  if (!S.arrest && S.standby && (mask || ifc === 'nasal')) out.push(['warn', 'Interfaz puesta, equipo en espera', 'La mascarilla o la cánula no aportan nada mientras el equipo no funciona.', 'Revisa los ajustes y pulsa «Iniciar ventilación».']);
  if (!S.arrest && S.relTot > .5 && S.sedTot < .4) out.push(['bad', 'Paralizado y despierto', 'Relajante sin hipnótico suficiente.', 'Inductor o sedación ya.']);
  if (!S.arrest && S.relTot > .6 && (ifc === 'o2' || ifc === 'nasal' || (S.standby && !tube)) && !S.isr && !S.bag) out.push(['bad', 'Paralizado sin ventilar', 'Apnea por el relajante.', track.attempts ? 'Oxigena con ambú o VMNI antes de reintentar.' : 'Intuba ya o ventila con ambú.']);
  if (!S.arrest && track.attempts >= 2 && ifc !== 'tube' && !S.isr) out.push(['bad', 'Intubación difícil', `${track.attempts} intentos fallidos.`, S.davMul < 1 ? 'Si no oxigenas (SpO₂ cayendo pese a ambú o VMNI): cricotiroidotomía.' : 'Cambia de plan: videolaringoscopio y bougie; si no intubas ni oxigenas, cricotiroidotomía.']);
  if (!S.arrest && S.opi > .45 && !tube && (S.pat.pmax <= 1 || S.pat.rr < 10)) out.push(['bad', 'Depresión respiratoria por opiáceos', `FR ${fmt(S.pat.pmax > 1 ? S.pat.rr : 0)} rpm y miosis.`, 'Ambú con O₂ y naloxona 0,4 mg IV; repite cada 2–3 min hasta FR ≥ 10.']);
  else if (!S.arrest && track.nalox != null && S.E.nalox < .35 && S.opi > .3) out.push(['warn', 'Resedación', 'La naloxona se agota antes que el opiáceo.', 'Nueva dosis o perfusión, y vigilancia estrecha.']);
  if (!S.arrest && track.intubAt != null && S.clin - track.intubAt < 15 && S.tas < 90) out.push(['bad', 'Hipotensión tras la intubación', `TAS ${fmt(S.tas)} mmHg.`, 'Inductor y presión positiva sin precarga: volumen, noradrenalina o adrenalina en bolo de 10–20 mcg; revisa la PEEP.']);
  if (!S.arrest && S.arr.type && S.arr.type !== 'sbrady') {
    const unstable = S.tas < 90;
    out.push([unstable ? 'bad' : 'warn', RLAB[S.arr.type] + (unstable ? ' inestable' : ' estable'), `FC ${fmt(S.fc)} lpm, TAS ${fmt(S.tas)} mmHg.`, unstable ? 'Cardioversión sincronizada con sedación (TSV o flutter 70–120 J; FA o TV 120–150 J). Activa SINC antes de cargar.' : S.arr.type === 'tsv' ? 'Maniobras vagales y adenosina 6 → 12 → 18 mg.' : S.arr.type === 'tvp' ? 'Amiodarona 300 mg en 10–20 min con el desfibrilador preparado.' : 'Control de frecuencia; anticoagulación según tiempo de evolución.']);
  }
  if (!S.arrest && S.arr.type === 'sbrady') out.push(['bad', 'Bradicardia con bajo gasto', `FC ${fmt(S.fc)} lpm.`, 'Atropina 0,5 mg cada 3–5 min; si no responde, adrenalina 2–10 mcg/min o marcapasos.']);
  if (!S.arrest && S.pace.on && !S.pace.capture && !(S.pace.mode === 'demand' && (S.fcIntr || 0) >= S.pace.rate)) out.push(['warn', 'Marcapasos sin captura', `${S.pace.mA} mA no capturan.`, 'Sube de 10 en 10 mA hasta captura y pulso; deja 10 mA por encima del umbral.']);
  if (!S.arrest && S.pace.on && S.pace.capture && S.pace.mA >= 40 && S.sedTot < .3 && S.opi < .3) out.push(['warn', 'Marcapasos sin analgesia', 'La estimulación transcutánea duele.', 'Fentanilo y midazolam a dosis bajas.']);
  if (!S.arrest && S.bav && !S.pace.capture && S.fc < 45) out.push(['bad', 'BAV completo con bajo gasto', `FC ${fmt(S.fc)} lpm.`, 'Atropina 0,5 mg (suele fallar); marcapasos transcutáneo o adrenalina 2–10 mcg/min.']);
  if (!S.arrest && S.tep > .3) out.push(['warn', 'Patrón de TEP', `EtCO₂ ${fmt(M.et)} frente a PaCO₂ ≈ ${fmt(S.pco2)} mmHg: espacio muerto.`, 'Noradrenalina para TAS ≥ 90, volumen prudente, PEEP baja y fibrinólisis si es de alto riesgo.']);
  if (!S.arrest && S.anaf > .2) out.push([S.tas < 90 ? 'bad' : 'warn', 'Anafilaxia activa', `TAS ${fmt(S.tas)}, broncoespasmo y angioedema.`, 'Adrenalina IM 0,5 mg (repite a los 5 min), volumen; perfusión de adrenalina si es refractaria.']);
  if (!S.arrest && S.cohb > .1) out.push(['warn', 'Carboxihemoglobina', `SpCO ${fmt(M.spco)} %: la SpO₂ de ${fmt(S.spo2 * 100)} % sobrestima el O₂ real.`, S.fiEff < .8 ? 'O₂ al 100 %: reservorio bien ajustado, VMNI con FiO₂ 100 % o intubación.' : 'Mantén O₂ al 100 % y valora cámara hiperbárica.']);
  if (!S.arrest && S.cn > .2) out.push(['bad', 'Posible cianuro', 'Shock y lactato muy alto en un incendio cerrado.', 'Hidroxocobalamina 5 g IV.']);
  if (!S.arrest && S.edAir > .45 && !tube) out.push(['bad', 'Vía aérea que se cierra', 'Estridor y voz ronca: el edema progresa.', 'Intuba ya, con videolaringoscopio; prepara la cricotiroidotomía.']);
  if (!S.arrest && S.icp && S.icp.v > 30) out.push(['bad', 'Signos de herniación', 'Midriasis arreactiva' + (S.fc < 60 && S.tas > 150 ? ', bradicardia e hipertensión (Cushing).' : '.'), 'Hiperventilación breve a EtCO₂ 30–35, salino hipertónico o manitol, TAS ≥ 110, SpO₂ ≥ 94 % y cabecero a 30°.']);
  else if (!S.arrest && S.icp && M.et != null && M.et < 30 && tube) out.push(['warn', 'Hiperventilación mantenida en TCE', `EtCO₂ ${fmt(M.et)} mmHg.`, 'Sin herniación activa, vuelve a EtCO₂ 35–40: la vasoconstricción provoca isquemia.']);
  if (!S.arrest && S.weak > .2 && !tube && S.pco2 > 55) out.push(['bad', 'Fallo ventilatorio neuromuscular', `PaCO₂ ≈ ${fmt(S.pco2)} con SpO₂ ${fmt(S.spo2 * 100)} %: la SpO₂ engaña.`, 'VMNI con PS 10–14; si hay afectación bulbar o empeora, intubación.']);
  if (!S.arrest && S.derec > .3 && tube) out.push(['warn', 'Pulmón desreclutado', 'Tras la desconexión ha subido el shunt.', 'Reconecta, FiO₂ alta y maniobra de reclutamiento si la TA lo permite; la próxima vez pinza el tubo antes de desconectar.']);
  if (!S.arrest && ifc === 'o2') {
    if (S.spo2 < (P.hyper ? .86 : .9)) out.push(['bad', 'Hipoxemia con oxigenoterapia', `SpO₂ ${fmt(S.spo2 * 100)} % con ${O2LAB[c.o2dev]} (FiO₂ real ≈ ${fmt(S.fiEff * 100)} %).`, c.o2dev !== 'reserv' ? 'Escala a reservorio 15 L/min.' : 'Alto flujo o VMNI; si no responde o se agota, intubación.']);
    else if (P.hyper && S.spo2 > .93 && (c.o2dev === 'reserv' || c.o2dev === 'venturi50')) out.push(['warn', 'Mucho O₂ para un retenedor', `SpO₂ ${fmt(S.spo2 * 100)} %.`, 'Venturi 28–35 % para SpO₂ 88–92 %.']);
  }
  if (!S.arrest && ifc === 'nasal' && !S.standby && M.effN >= 2) {
    const rr = M.effRR, rox = S.spo2 * 100 / (c.fio2 / 100) / Math.max(rr, 1);
    out.push([rox < 3.85 ? 'bad' : rox < 4.88 ? 'warn' : 'ok', 'Índice ROX ' + fmt(rox, 1), `SpO₂ ${fmt(S.spo2 * 100)} % / FiO₂ ${fmt(c.fio2 / 100, 2)} / FR ${fmt(rr)}.`, rox < 3.85 ? 'Alto riesgo de fracaso: VMNI o intubación antes del traslado.' : rox < 4.88 ? 'Zona gris: reevalúa en 30–60 min.' : 'Buena respuesta al alto flujo.']);
  }
  if (off && ifc !== 'o2' && !S.standby) out.push(['bad', 'Equipo parado: sin gas', 'El equipo neumático necesita O₂ para funcionar.', 'Cambia la botella y ventila con ambú mientras tanto.']);
  if (vent && !S.arrest) {
    const noReturn = tube && M.nB >= 2 && M.vti > .1 && (M.vte == null || M.vte < .25 * M.vti) && S.t > 10;
    if (noReturn || (tube && M.nB >= 2 && M.et < 5 && S.t > 15 && !S.isr)) out.push(['bad', 'No vuelve volumen ni CO₂', 'El equipo insufla pero el volumen espirado y la EtCO₂ se han ido a cero.', 'Pieza en Y y tubo: desconexión o extubación. Ventila con bolsa mientras lo resuelves.']);
    else if (tube && M.nB >= 3 && M.vte != null && M.vti && M.vte < .8 * M.vti) out.push(['warn', 'Vte menor que el Vt insuflado', `VTi ${fmt(M.vti)} mL y VTe ${fmt(M.vte)} mL.`, 'Fuga: comprueba balón y conexiones.']);
    if (mask && M.leak > 35) out.push(['bad', 'Fuga alta', `Fuga de ${fmt(M.leak)} L/min.`, 'Recoloca o cambia la mascarilla (objetivo < 25–30 L/min).']);
    if (M.nB >= 4 && M.auto / M.nB > .15) out.push(['bad', 'Autodisparo', `${M.auto} ciclos en 30 s sin esfuerzo del paciente.`, 'Corrige la fuga y sube el trigger inspiratorio a 2–3 L/min.']);
    if (M.effN >= 4 && M.ies / M.effN > .1) out.push(['bad', 'Esfuerzos que no disparan', `El paciente respira a ${fmt(M.effRR)} rpm y el ventilador cuenta ${fmt(M.fr)}.`, 'Contrarresta el auto-PEEP subiendo la PEEP 2–3 y acorta la inspiración. Broncodilatadores.']);
    if ((c.mode === 'PSV' || c.mode === 'CPAP') && M.nB >= 4 && M.timax / M.nB > .4) out.push(['warn', 'Ciclado por Ti máx', 'La inspiración termina por tiempo, no por flujo.', mask && M.leak > 30 ? 'Primero corrige la fuga.' : 'Sube el ciclado espiratorio o baja Ti máx.']);
    if (S.t - (S.pmaxHit || -99) < 6) out.push(['bad', 'Presión pico alta', S.dev.pneumatic ? 'Se alcanza pMax y el equipo limita la presión: entra menos volumen.' : 'Se alcanza el límite de presión y el equipo corta la inspiración.', mask ? 'Tos o lucha: revisa ajustes y confort.' : 'Meseta alta: distensibilidad (selectiva, neumotórax). Meseta normal: resistencia (tubo, secreciones, broncoespasmo). Si es lucha, sedación.']);
    if ((c.mode === 'APV' || c.mode === 'ASV') && S.apv.p >= c.pmax - 10.5) out.push(['bad', 'Presión en el techo (límite − 10)', `El equipo ya aplica ${fmt(S.apv.p)} ${d.u} y no puede subir más.`, 'Busca la causa (DOPE). Sube el límite solo si la meseta lo permite.']);
    else if ((c.mode === 'APV' || c.mode === 'ASV') && apvHist.length > 3 && S.apv.p - Math.min(...apvHist.map(x => x[1])) > 5) out.push(['warn', 'El modo adaptativo sube la presión', `De ${fmt(Math.min(...apvHist.map(x => x[1])))} a ${fmt(S.apv.p)} ${d.u} para mantener el Vt.`, 'Algo ha empeorado: Cstat baja = distensibilidad; Rinsp alta = resistencia. Explora.']);
    const pplatR = M.pplat != null ? M.pplat : S.dev.vent === 't1' && M.calc ? M.calc.pplatEst : null;
    if (tube && pplatR != null && pplatR > 30) out.push(['bad', 'Meseta > 30', `Pplat ${fmt(pplatR)} ${d.u}.`, 'Baja el Vt hacia 6 mL/kg de peso ideal.']);
    else if (tube && M.dp != null && M.dp > 15) out.push(['warn', 'Driving pressure > 15', `ΔP ${fmt(M.dp)} ${d.u}.`, 'Baja el Vt; prueba otra PEEP.']);
    const pe = M.peepi != null ? M.peepi : (S.dev.vent === 't1' && M.calc ? M.calc.autopeep : null);
    if (tube && pe != null && pe > 5) out.push(['warn', 'Auto-PEEP', `${fmt(pe, 1)} ${d.u}.`, 'Alarga la espiración: baja FR, acorta Ti. Si la TA cae, desconecta 15 s.']);
    if (tube && M.vtkg != null && c.mode !== 'PSV' && M.vtkg > 8.5) out.push(['warn', 'Vt alto', `${fmt(M.vtkg, 1)} mL/kg de peso ideal (${fmt(S.ibw)} kg).`, 'Baja el Vt a 6–8 mL/kg. Revisa la talla y el sexo metidos en el equipo.']);
    if (mask && M.vtReal < 5.5 * S.ibw && M.nB > 3 && c.mode !== 'CPAP' && !(c.mode === 'PSV' && c.ps === 0)) out.push(['warn', 'Vt bajo', `Vt real ≈ ${fmt(M.vtReal)} mL.`, 'Sube la presión de soporte de 2 en 2 hasta 6–8 mL/kg.']);
    if (tube && S.vent.backup && (c.mode === 'PSV' || c.mode === 'CPAP')) out.push(['bad', 'En apnea con un modo espontáneo', 'El paciente no respira y el equipo va con ventilación de respaldo.', `Pasa a ${modeLabel(d.inv, null, 'tube')}.`]);
    if (tube && M.et > 5 && M.et < 30 && S.tas >= 90 && !S.icp) out.push(['warn', 'EtCO₂ baja', `EtCO₂ ${fmt(M.et)} mmHg.`, 'Hiperventilación: baja FR o Vt. Si la diferencia con la PaCO₂ es grande, piensa en bajo gasto o TEP.']);
    if (tube && M.et > 50 && !P.hyper && caseKey !== 'asma') out.push(['warn', 'EtCO₂ alta', `EtCO₂ ${fmt(M.et)} mmHg.`, 'Hipoventilación: sube FR o Vt.']);
    if (tube && c.mode === 'CPV') out.push(['bad', 'Sigues en el modo de RCP', 'Hay pulso.', `Pasa a ${modeLabel(d.inv, null, 'tube')} con Vt 6–8 mL/kg, FR 12–16, PEEP 5.`]);
    const B = S.breaths.filter(b => b.tb > S.t - 30 && b.cycle);
    if (tube && (c.mode === 'VCV' || c.mode === 'APV') && B.filter(b => b.type === 'pat').length > .3 * B.length && B.length > 4) out.push(['warn', 'El paciente dispara o lucha', 'Respiraciones disparadas por el paciente, picos de presión y taquicardia.', 'Sedoanalgesia, o un modo asistido.']);
    if (mask && P.hyper && S.ph < 7.25 && S.clin > 45) out.push(['bad', 'Posible fracaso de la VMNI', 'Más de 45 min sin corrección suficiente.', 'Si el pH sigue < 7,25 o baja la conciencia: inducción, relajante e intubación.']);
    if (mask && M.effRR > 28) out.push(['warn', 'Taquipnea', `${fmt(M.effRR)} rpm.`, P.edema ? 'Edema que no cede: nitratos (si la TA lo permite) y presión.' : 'Optimiza el soporte y valora el fracaso.']);
  }
  if (!S.arrest && ifc !== 'o2') {
    if (S.spo2 < (P.hyper ? .86 : .9)) out.push(['bad', 'Hipoxemia', `SpO₂ ${fmt(S.spo2 * 100)} %.`, P.edema ? 'Sube la CPAP/PEEP y la FiO₂.' : 'Sube la FiO₂ (o pulsa la tecla de O₂ al 100 %) y descarta DOPE.']);
    else if (P.hyper && S.spo2 > .93 && !S.standby) out.push(['warn', 'Hiperoxia en retenedor', `SpO₂ ${fmt(S.spo2 * 100)} %${S.dev.pneumatic && c.fio2 < 100 ? ' con Air Mix (≈ 60 %)' : ''}.`, S.dev.pneumatic ? (c.fio2 < 100 ? 'Este equipo no baja de Air Mix: vigila pH y EtCO₂; si la PaCO₂ sube, valora un ventilador de turbina con FiO₂ ajustable.' : 'Usa Air Mix y busca SpO₂ 88–92 %.') : 'Baja la FiO₂ para SpO₂ 88–92 %.']);
    else if (S.spo2 > .985 && c.fio2 >= 50 && !(S.dev.pneumatic && c.fio2 < 100) && !S.standby && !S.cohb) out.push(['warn', 'Hiperoxia', `SpO₂ ${fmt(S.spo2 * 100)} % con FiO₂ ${c.fio2} %.`, S.dev.pneumatic ? 'Air Mix si la SpO₂ lo permite.' : 'Baja la FiO₂ hasta SpO₂ 94–98 %.']);
  }
  if (!S.arrest && P.edema && pniS != null && pniS > 160 && S.E.ntg < .4) out.push(['bad', 'TA alta con edema', `PNI ${fmt(pniS)} mmHg.`, 'Nitroglicerina a dosis alta: bolo y perfusión.']);
  if (!S.arrest && P.edema && pniS != null && pniS < 90 && S.E.ntg > .2) out.push(['bad', 'Nitratos con hipotensión', `PNI ${fmt(pniS)} mmHg.`, 'Para la nitroglicerina; noradrenalina.']);
  if (!S.arrest) {
    if (pniS != null && pniS < 90) out.push(['bad', 'Hipotensión', `PNI ${fmt(pniS)} mmHg.`, 'Auto-PEEP, neumotórax, hipovolemia, sedación, nitratos, PEEP alta, arritmia, TEP o anafilaxia.']);
    else if (!pniMeas && (!pni || S.clin - pni.at > 10)) out.push(['warn', 'Sin TA reciente', 'La última PNI tiene más de 10 min.', 'Mide la PNI o programa la automática.']);
  }
  if (!S.o2.supply && !off) out.push(['bad', 'Sin O₂', ifc === 'o2' || ifc === 'nasal' ? 'El paciente respira aire ambiente.' : 'El equipo de turbina sigue ventilando con aire (FiO₂ 0,21).', 'Cambia la botella.']);
  else if (S.o2.supply) { const cons = S.o2.cons + (S.dev.pneumatic && !off && (tube || mask) ? .3 : 0), aut = cons > .05 ? (S.o2.bar - 20) * S.o2.vol / cons : 999; if (aut < 30) out.push(['warn', 'Botella baja', `Autonomía ≈ ${fmt(aut)} min.`, S.dev.pneumatic ? 'Air Mix si la SpO₂ lo permite y prepara el cambio de botella.' : 'Baja la FiO₂ si la SpO₂ lo permite o prepara el cambio de botella.']); }
  if (!out.length) out.push(['ok', 'Sin problemas detectados', 'Parámetros dentro de rangos razonables.', 'Sigue vigilando EtCO₂, SpO₂ y TA.']);
  $('#readList').innerHTML = out.slice(0, 6).map(([l, t, dd, f]) => `<div class="ri ${l}"><b>${t}</b><p>${dd}</p><p class="fix">→ ${f}</p></div>`).join('');
}
function renderTruth() {
  const m = S.mech, r = real(), a = S.air, mask = S.iface === 'mask';
  const air = S.isr ? 'laringoscopia (apnea)' : S.iface === 'o2' ? 'vía aérea natural · ' + O2LAB[S.cfg.o2dev] : S.iface === 'nasal' ? 'vía aérea natural · alto flujo' : mask ? 'mascarilla oronasal' : a.extub ? 'extubado' : a.disc ? 'desconectado' : a.sel ? 'selectiva derecha' : a.obst ? 'tubo parcialmente obstruido' : a.leak ? 'fuga por el balón' : 'tubo en posición';
  const rows = [['Vía aérea', air + (S.bag ? ' · ambú' : '') + (S.standby ? ' · ventilador en espera' : '')], ['Ritmo', RLAB[S.rhythm] + (S.arrest ? ' · sin pulso' : '')], ['pH / PaCO₂', fmt(S.ph, 2) + ' / ' + fmt(S.pco2) + ' mmHg'], ['PAO₂ / FiO₂ real', fmt(S.pao2) + ' mmHg / ' + fmt(S.fiEff * 100) + ' %'],
    ['SaO₂ real (con COHb)', fmt(S.oxEff * 100) + ' %'], ['TA real', fmt(S.tas) + ' mmHg'], ['Vt real en el pulmón', fmt(M.vtReal) + ' mL'], ['FR del paciente', M.effN >= 2 ? fmt(M.effRR) + ' rpm' : 'no respira'],
    ['Esfuerzos ineficaces / autodisparos (30 s)', (M.effN ? M.ies + ' de ' + M.effN : '–') + ' / ' + M.auto + ' de ' + M.nB], ['Meseta real', mask || S.iface === 'o2' || S.iface === 'nasal' ? '–' : fmt(r.pplat, 1) + ' cmH₂O'],
    ['Auto-PEEP real', fmt(M.effN >= 2 ? (S.peepiDyn || 0) : r.peepi, 1) + ' cmH₂O'], ['Distensibilidad', fmt(m.C * 1000) + ' mL/cmH₂O'], ['Resistencia insp / esp', fmt(m.Ri) + ' / ' + fmt(m.Re) + ' cmH₂O/L/s'], ['Shunt', fmt(m.shunt * 100) + ' %'],
    ['Hipnosis / relajación / opiáceo', fmt(S.sedTot * 100) + ' / ' + fmt(S.relTot * 100) + ' / ' + fmt(S.opi * 100) + ' %'], ['Vasoactivos (nora, adrenalina, NTG)', fmt(S.E.nor * 100) + ' / ' + fmt(S.E.adr * 100) + ' / ' + fmt(S.E.ntg * 100) + ' %'],
    ['Déficit de volumen', fmt(S.deficit * 100) + ' %'], ['Neumotórax', fmt((S.ptxActive ? S.ptx : m.ptxEff) * 100) + ' %' + (S.ptxActive ? ' a tensión' : '')], ['Broncoespasmo', fmt(S.bs * 100) + ' %'],
    ['TEP / anafilaxia / broncoaspiración', fmt(S.tep * 100) + ' / ' + fmt(S.anaf * 100) + ' / ' + fmt(S.asp * 100) + ' %'], ['COHb / cianuro', fmt(S.cohb * 100) + ' % / ' + fmt(S.cn * 100) + ' %'],
    ['PIC estimada', S.icp ? fmt(S.icp.v) + ' mmHg' : '–'], ['Edema de vía aérea', fmt(Math.max(S.edAir, .8 * S.anaf) * 100) + ' %'], ['Desreclutamiento', fmt(S.derec * 100) + ' %'],
    ['Umbral de captura del marcapasos', fmt(S.pace.thr) + ' mA'], ['Presión barométrica', fmt(S.pbar) + ' mmHg']];
  $('#truth').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}
function logIt(t) { const s = Math.round((S ? S.clin : 0) * 60); const hh = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); const e = document.createElement('span'); e.textContent = hh + ' · ' + t; $('#log').prepend(e); }

/* ---------- fármacos ---------- */
function renderDrugs() {
  const btn = it => { const ds = it.act ? null : doseOf(it);
    const sub = it.note && ds == null ? it.note : ds != null && it.u ? `${fmt(ds, ds < 1 ? 1 : 0)} ${it.u}${it.mgkg ? ' · ' + fmt(it.mgkg, it.mgkg % 1 ? 1 : 0) + ' ' + it.u + '/kg' : it.tnk ? ' por peso' : ''}` : it.note || '';
    return `<button class="btn" data-drug="${it.id}">${it.lab}${sub ? ` <small>${sub}</small>` : ''}</button>`; };
  const perf = p => `<div class="range"><label class="small" for="pf_${p.id}">${p.lab}</label><select id="pf_${p.id}" data-perf="${p.id}">${p.opts.map(o => `<option value="${o}">${o ? fmt(o, p.d) + ' ' + p.u + (p.extra ? p.extra(o) : '') : 'parada'}</option>`).join('')}</select></div>`;
  $('#drugPanel').innerHTML = `<span class="flabel">Fármacos · dosis para ${fmt(peso)} kg</span>` +
    DRUGSET.map(g => `<details class="dg"${g.open ? ' open' : ''}><summary>${g.g}</summary><div class="abtns">${g.items.map(btn).join('')}</div></details>`).join('') +
    `<details class="dg"><summary>Perfusiones</summary><div class="agroup" style="margin-top:6px">${PERFS.map(perf).join('')}</div></details>`;
}
function giveDrug(id) {
  const it = DRUGITEMS[id];
  if (it.act) { sim.action(it.act); const t = ACTLAB[it.act] || it.lab; logIt(t); track.drugs.push([S.clin, t]); return; }
  const ds = doseOf(it), amt = it.amt != null ? it.amt : ds * fW;
  sim.drug(it.k, amt);
  const route = it.route != null ? it.route : ' IV';
  const txt = it.lab + (ds != null && it.u ? ' ' + fmt(ds, ds < 1 ? 1 : 0) + ' ' + it.u : '') + (it.note ? ' (' + it.note + ')' : '') + route;
  track.drugs.push([S.clin, txt]); logIt(txt);
  if (it.k === 'adr' && it.amt === 100 && S.arrest) track.adr.push(S.clin);
  if (it.k === 'amio' && S.arrest) track.amio += ds;
  if (it.k === 'nalox') track.nalox = S.clin;
  if (['ket', 'eto', 'prop'].includes(it.k) && S.iface !== 'tube' && !track.induct) track.induct = txt;
  if (['rel', 'sux'].includes(it.k) && S.iface !== 'tube' && !track.relax) track.relax = txt;
}
$('#drugPanel').addEventListener('change', e => {
  const s = e.target.closest('[data-perf]'); if (!s) return;
  const p = PERFS.find(x => x.id === s.dataset.perf), r = +s.value;
  p.set(r); track.acts++;
  const txt = r ? `Perfusión de ${p.lab.toLowerCase()} ${fmt(r, p.d)} ${p.u}` : `Perfusión de ${p.lab.toLowerCase()} parada`;
  logIt(txt); track.drugs.push([S.clin, txt]);
});

/* ---------- acciones ---------- */
function showFind(list) { $('#findings').innerHTML = '<ul>' + list.map(x => `<li>${x}</li>`).join('') + '</ul>'; $('#findings').hidden = false; }
function doCheck() {
  const was = S.cpr.comp, r = sim.check();
  const txt = r.pulse ? `pulso presente · ${RLAB[r.rhythm] || r.rhythm}` : `sin pulso · ${RLAB[r.rhythm]} · ${r.rhythm === 'vf' || r.rhythm === 'tvsp' ? 'desfibrilable' : 'no desfibrilable'}`;
  analysis = { until: S.t + 12, txt };
  if (S.arrest && was !== 'off') { sim.compress('off'); resume = { at: S.t + Math.max(.4, 8 / scale), type: was }; }
  showFind(['Análisis: ' + txt]); logIt('Análisis de ritmo y pulso: ' + txt);
}
document.querySelector('.side').addEventListener('click', e => {
  const b = e.target.closest('[data-act],[data-drug]'); if (!b || b.disabled) return;
  track.acts++;
  if (b.dataset.drug) { giveDrug(b.dataset.drug); updateUI(); return; }
  const k = b.dataset.act;
  switch (k) {
    case 'explore': showFind(sim.explore()); logIt('Exploración'); break;
    case 'gas': { const g = sim.gas(); const txt = `Gasometría venosa: pH ${fmt(g.ph, 2)} · pCO₂ ${fmt(g.pco2)} mmHg · HCO₃⁻ ${fmt(g.hco3)} · lactato ${fmt(g.lact, 1)} mmol/L · COHb ${fmt(g.cohb, 1)} %`; showFind([txt]); logIt(txt); break; }
    case 'toO2': sim.setStandby(false); sim.setIface('o2'); sim.setCfg(Object.assign({}, S.cfg, { o2dev: $('#o2dev').value })); logIt('Retiras el soporte: ' + O2LAB[S.cfg.o2dev]); pend = Object.assign({}, S.cfg); renderVent(); break;
    case 'toMask': {
      const st = devOf().start.find(x => x.iface === 'mask' && x.id !== 'rsi');
      sim.setIface('mask'); sim.setStandby(true); S.mask.leak10 = Math.min(S.mask.leak10, 15);
      pend = cleanCfg(st ? st.cfg(devIbw()) : { mode: devOf().niv, ps: 8, peep: 6, rise: .15, trigE: 35, timax: 1.2, trigI: 2, fio2: 100, pmax: 30, fr: 12, vt: 450 });
      pend.fio2 = Math.max(pend.fio2 || 60, S.cfg.fio2 || 60);
      if (devOf().spec.fio2 && devOf().spec.fio2.bin) pend.fio2 = 100;
      sbyHint = null; pendAt = performance.now();
      logIt('Mascarilla de VMNI colocada y conectada: el ventilador está en espera'); renderVent(); break; }
    case 'toNasal': sim.setIface('nasal'); sim.setStandby(true); pend = cleanCfg({ mode: 'HFNC', flow: S.cfg.flow || 50, fio2: Math.max(S.cfg.fio2 || 60, 60) }); sbyHint = null; pendAt = performance.now(); logIt('Cánula de alto flujo colocada: el equipo está en espera'); renderVent(); break;
    case 'intubate': {
      const r = sim.intubate();
      if (!r.ok) { showFind([r.msg]); logIt('Intubación: ' + r.msg); }
      else { if (!track.peri) track.peri = { start: S.clin, end: S.clin + 10, spo2: S.spo2 * 100, tas: S.tas, startSpo2: S.spo2 * 100 }; else track.peri.end = S.clin + 10; logIt(`Laringoscopia${S.davMul < 1 ? ' con videolaringoscopio' : ''}${S.isr.apox ? ' con gafas a 15 L/min' : ''} (apnea)`); }
      break; }
    case 'cric': if (S.iface !== 'tube' && !S.isr) { sim.action('cric'); track.cric = true; if (!track.peri) track.peri = { start: S.clin, end: S.clin + 10, spo2: S.spo2 * 100, tas: S.tas, startSpo2: S.spo2 * 100 }; logIt(ACTLAB.cric); } break;
    case 'bag': sim.action('bag'); logIt(S.bag ? 'Ventilas con ambú y reservorio (10/min)' : 'Dejas el ambú'); break;
    case 'apox': sim.action('apox'); logIt(S.apox ? 'Gafas nasales a 15 L/min para la laringoscopia' : 'Retiras las gafas de 15 L/min'); break;
    case 'compManual': sim.compress('manual'); resume = null; logIt('Compresiones manuales'); break;
    case 'compMech': sim.compress('mech'); resume = null; logIt('Compresor mecánico colocado'); break;
    case 'compOff': sim.compress('off'); resume = null; logIt('Paras las compresiones'); break;
    case 'relevo': sim.relevo(); logIt('Relevo del compresor'); break;
    case 'check': doCheck(); break;
    default: sim.action(k); logIt(ACTLAB[k] || k);
  }
  updateUI();
});
$('#o2dev').addEventListener('change', e => { if (S.iface === 'o2') { sim.setCfg(Object.assign({}, S.cfg, { o2dev: e.target.value })); logIt('Oxigenoterapia: ' + O2LAB[e.target.value]); } else S.cfg.o2dev = e.target.value; });
$('#evBtn').addEventListener('click', () => fireEvent($('#evSel').value, null, false));
$('#alt').addEventListener('input', e => setAltUI(+e.target.value));
$('#alt').addEventListener('change', e => logIt('Altitud de cabina ' + (+e.target.value).toLocaleString('es-ES') + ' m'));
$('#showPmus').addEventListener('change', e => { $('#legIE').hidden = !e.target.checked; });
function updateButtons() {
  const d = devOf();
  $$('[data-if]').forEach(b => { let en = b.dataset.if.split(' ').includes(S.iface) && !S.isr; if (b.dataset.act === 'toNasal') en = en && d.modes.nasal.length > 0; b.disabled = !en; });
  const bag = $('[data-act="bag"]'); bag.setAttribute('aria-pressed', S.bag ? 'true' : 'false'); bag.textContent = S.bag ? 'Ambú: ventilando' : 'Ambú con reservorio';
  $('[data-act="apox"]').setAttribute('aria-pressed', S.apox ? 'true' : 'false');
  $('[data-act="vl"]').setAttribute('aria-pressed', S.davMul < 1 ? 'true' : 'false');
  ['compManual', 'compMech', 'compOff', 'relevo'].forEach(k => { $(`[data-act="${k}"]`).disabled = !S.arrest; });
  $('[data-act="recruit"]').disabled = S.iface !== 'tube' || ventOffNow();
}

/* ---------- debrief ---------- */
const mmss = m => { const s = Math.round(m * 60); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function showDebrief(reason) {
  const c = CASES[caseKey], W = track.worst, H = t => `<h2 style="margin-top:6px">${t}</h2>`;
  const rows = Object.entries(track.t).map(([k, v]) => { const pct = v.tot > 0 ? v.inT / v.tot * 100 : 0, col = pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)';
    return `<tr><td>${TGT[k].lab} ${rangeTxt(c.targets[k], TGT[k])} ${TGT[k].fmt ? '' : TGT[k].u}</td><td style="width:40%"><div class="bar"><span style="width:${pct}%;background:${col}"></span></div></td><td class="n">${fmt(pct)} %</td></tr>`; }).join('');
  const evs = track.events.map(e => `<tr><td>${EVLAB[e.k]}</td><td>min ${fmt(e.at, 1)}</td><td class="n">${e.fixed != null ? 'resuelto en ' + fmt(e.fixed - e.at, 1) + ' min' : 'sin resolver'}</td></tr>`).join('');
  let cpr = '';
  if (track.arrestAt != null) {
    const cp = S.cpr, frac = cp.cprTime + cp.noFlow > 0 ? cp.cprTime / (cp.cprTime + cp.noFlow) : 0;
    cpr = H('Parada') + `<table class="dtable"><tr><td>Primera descarga</td><td class="n">${track.firstShock != null ? 'a los ' + mmss(track.firstShock) + ' min' : '—'}</td></tr><tr><td>Descargas</td><td class="n">${track.shocks}</td></tr>` +
      `<tr><td>Fracción de compresiones</td><td class="n">${fmt(frac * 100)} %</td></tr><tr><td>Tiempo total sin flujo</td><td class="n">${fmt(cp.noFlow, 1)} min</td></tr>` +
      `<tr><td>Adrenalina 1 mg</td><td class="n">${track.adr.length} dosis</td></tr><tr><td>Amiodarona</td><td class="n">${fmt(track.amio)} mg</td></tr>` +
      `<tr><td>RCE</td><td class="n">${track.roscAt != null ? 'a los ' + fmt(track.roscAt - track.arrestAt, 1) + ' min' : 'no'}</td></tr></table>`;
  }
  let isr = '';
  if ((track.intubAt != null || track.attempts) && track.peri) isr = H('Vía aérea') + `<table class="dtable"><tr><td>Inducción</td><td class="n">${track.induct || '—'}</td></tr><tr><td>Relajante</td><td class="n">${track.relax || '—'}</td></tr>` +
    `<tr><td>Intentos fallidos</td><td class="n">${track.attempts}</td></tr><tr><td>Resultado</td><td class="n">${track.intubAt != null ? (track.cric ? 'cricotiroidotomía' : 'intubado') + ' a los ' + fmt(track.intubAt, 1) + ' min' : 'sin vía aérea definitiva'}</td></tr>` +
    `<tr><td>SpO₂ al empezar / mínima peri-intubación</td><td class="n">${fmt(track.peri.startSpo2)} / ${fmt(track.peri.spo2)} %</td></tr><tr><td>TAS mínima peri-intubación</td><td class="n">${fmt(track.peri.tas)} mmHg</td></tr>` +
    `<tr><td>Intubado sin ventilar (equipo en espera)</td><td class="n">${fmt(track.standbyApnea * 60)} s</td></tr></table>`;
  const arr = track.hadArr ? H('Arritmia') + `<table class="dtable"><tr><td>Ritmo sinusal recuperado</td><td class="n">${track.convAt != null ? 'a los ' + fmt(track.convAt, 1) + ' min' : 'no'}</td></tr><tr><td>Descargas</td><td class="n">${track.shocks}</td></tr></table>` : '';
  const drugs = track.drugs.length ? H('Fármacos y marcadores') + `<table class="dtable">${track.drugs.map(([t, x]) => `<tr><td>min ${fmt(t, 1)}</td><td>${x}</td></tr>`).join('')}</table>` : '';
  $('#dbH').textContent = c.title + (reason ? ' · ' + reason : '');
  $('#dbBody').innerHTML = `<p class="small">Tiempo clínico simulado: ${fmt(S.clin, 1)} min · ${DEVS[S.dev.vent].short} · ajustes y acciones: ${track.acts}</p>` +
    (rows ? H('Tiempo en objetivo') + `<table class="dtable">${rows}</table>` : '') + cpr + arr + isr + (evs ? H('Eventos') + `<table class="dtable">${evs}</table>` : '') +
    H('Peores valores') + `<table class="dtable"><tr><td>SpO₂ mínima (fuera de la parada)</td><td class="n">${W.n ? fmt(W.spo2) + ' %' : '—'}</td></tr><tr><td>TAS mínima (fuera de la parada)</td><td class="n">${W.n ? fmt(W.tas) + ' mmHg' : '—'}</td></tr><tr><td>Presión pico máxima</td><td class="n">${W.ppk ? fmt(W.ppk) + ' ' + devOf().u : '—'}</td></tr><tr><td>pH al final</td><td class="n">${fmt(S.ph, 2)}</td></tr></table>` +
    drugs + (c.hint ? H('Solución posible') + `<p>${c.hint}</p>` : '');
  $('#debrief').hidden = false; paused = true; setPauseBtn(); $('#dbRepeat').focus();
}
$('#endBtn').addEventListener('click', () => showDebrief(''));
$('#dbClose').addEventListener('click', () => { $('#debrief').hidden = true; paused = false; setPauseBtn(); });
$('#dbRepeat').addEventListener('click', () => { $('#debrief').hidden = true; paused = false; setPauseBtn(); loadCase(caseKey); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#debrief').hidden) $('#dbClose').click(); });

/* ---------- dibujo del ventilador: curvas y bucles ---------- */
const cv = $('#cv'), ctx = cv.getContext('2d');
const vs = getComputedStyle($('#vent'));
const COL = k => vs.getPropertyValue(k).trim();
const TR = { p: COL('--tr-p'), f: COL('--tr-f'), v: COL('--tr-v'), c: COL('--tr-c'), m: COL('--tr-m'), grid: COL('--scr-line'), txt: COL('--scr-mut'), bg: COL('--scr2') };
let vmaxDisp = 800;
function segs(wi, fl, n, gap) { if (!fl) return [[0, wi]]; const g = wi + gap; if (g >= n) return [[g - n, wi]]; return [[0, wi], [g, n]]; }
$('#viewSeg').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; view = b.dataset.v; $$('#viewSeg button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
function draw() {
  const dpr = window.devicePixelRatio || 1, Wc = cv.clientWidth || 600;
  if (view === 'loops') return drawLoops(dpr, Wc);
  const show = $('#showPmus').checked, chH = Wc < 520 ? 74 : 90;
  let mx = 0; for (let i = 0; i < N; i++) mx = Math.max(mx, buf.v[i]); const want = Math.max(600, Math.ceil(mx * 1.15 / 200) * 200); if (Math.abs(want - vmaxDisp) >= 200) vmaxDisp = want;
  const pu = devOf().u;
  const ch = [{ k: 'p', lab: 'Paw', u: pu, min: -5, max: 45 }, { k: 'f', lab: 'Flujo', u: 'L/min', min: -90, max: 90 }, { k: 'v', lab: 'Volumen', u: 'mL', min: 0, max: vmaxDisp }, { k: 'c', lab: 'CO₂', u: 'mmHg', min: 0, max: 60 }];
  if (show) ch.push({ k: 'm', lab: 'Esfuerzo del paciente (Pmus)', u: 'cmH₂O', min: -10, max: 20 });
  const Hc = chH * ch.length;
  if (cv.width !== Math.round(Wc * dpr) || cv.height !== Math.round(Hc * dpr)) { cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr); cv.style.height = Hc + 'px'; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = TR.bg; ctx.fillRect(0, 0, Wc, Hc);
  const left = 38, plotW = Wc - left - 6, sg = segs(w, filled, N, GAP), xOf = i => left + i / N * plotW;
  ch.forEach((c, ci) => {
    const y0 = ci * chH + 16, h = chH - 24, yOf = v => y0 + h - (clamp(v, c.min, c.max) - c.min) / (c.max - c.min) * h, yz = yOf(0);
    ctx.strokeStyle = TR.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let s = 1; s < 15; s++) { const x = Math.round(left + s / 15 * plotW) + .5; ctx.moveTo(x, y0); ctx.lineTo(x, y0 + h); } ctx.stroke();
    ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(left, Math.round(yz) + .5); ctx.lineTo(left + plotW, Math.round(yz) + .5); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace'; ctx.fillStyle = TR.txt; ctx.textAlign = 'right';
    ctx.fillText(String(c.max), left - 5, y0 + 8); if (yz - y0 > 14 && y0 + h - yz > 4) ctx.fillText('0', left - 5, yz + 3); if (c.min < 0) ctx.fillText(String(c.min), left - 5, y0 + h);
    ctx.textAlign = 'left'; ctx.fillStyle = TR[c.k]; ctx.fillText(c.lab + ' · ' + c.u + (frozen && ci === 0 ? '  · CONGELADO' : ''), left + 4, y0 - 4);
    const b = buf[c.k];
    sg.forEach(([a, e]) => { if (e - a < 2) return;
      ctx.beginPath(); ctx.moveTo(xOf(a), yz); for (let i = a; i < e; i++) ctx.lineTo(xOf(i), yOf(b[i])); ctx.lineTo(xOf(e - 1), yz); ctx.closePath(); ctx.globalAlpha = .18; ctx.fillStyle = TR[c.k]; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); for (let i = a; i < e; i++) { const X = xOf(i), Y = yOf(b[i]); i === a ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); } ctx.strokeStyle = TR[c.k]; ctx.lineWidth = 1.7; ctx.stroke(); });
    if (ci === 0) sg.forEach(([a, e]) => { for (let i = a; i < e; i++) { const ev = buf.ev[i]; if (!ev) continue; const X = xOf(i);
      ctx.fillStyle = ev === 1 ? '#4fd18b' : ev === 2 ? '#6aa8ff' : ev === 4 ? '#ffa53a' : '#ff6a57'; ctx.beginPath(); ctx.moveTo(X - 5, y0 + 1); ctx.lineTo(X + 5, y0 + 1); ctx.lineTo(X, y0 + 9); ctx.closePath(); ctx.fill(); } });
    if (c.k === 'm') sg.forEach(([a, e]) => { for (let i = a; i < e; i++) { if (!buf.ie[i]) continue; const X = xOf(i), Y = y0 + 8; ctx.strokeStyle = '#ff6a57'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X - 4, Y - 4); ctx.lineTo(X + 4, Y + 4); ctx.moveTo(X + 4, Y - 4); ctx.lineTo(X - 4, Y + 4); ctx.stroke(); } });
  });
  if (!frozen) { ctx.fillStyle = 'rgba(142,162,175,.4)'; ctx.fillRect(xOf(w), 0, 2, Hc); }
}
function drawLoops(dpr, Wc) {
  const Hc = Wc < 520 ? 240 : 300;
  if (cv.width !== Math.round(Wc * dpr) || cv.height !== Math.round(Hc * dpr)) { cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr); cv.style.height = Hc + 'px'; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = TR.bg; ctx.fillRect(0, 0, Wc, Hc);
  const span = Math.min(N - GAP, Math.round(60 / Math.max(M.fr || 12, 6) * 2.2 / SR)), idx = []; for (let i = 1; i <= span; i++) idx.push((w - i + N) % N);
  const pw = (Wc - 30) / 2, ph = Hc - 40, pu = devOf().u;
  const loop = (x0, title, xs, ys, xr, yr, col, xl, yl) => {
    ctx.strokeStyle = TR.grid; ctx.lineWidth = 1; ctx.strokeRect(x0 + .5, 20.5, pw, ph);
    const X = v => x0 + (clamp(v, xr[0], xr[1]) - xr[0]) / (xr[1] - xr[0]) * pw, Y = v => 20 + ph - (clamp(v, yr[0], yr[1]) - yr[0]) / (yr[1] - yr[0]) * ph;
    if (yr[0] < 0) { ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x0 + pw, Y(0)); ctx.stroke(); ctx.setLineDash([]); }
    ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(title, x0 + 4, 14);
    ctx.fillStyle = TR.txt; ctx.textAlign = 'right'; ctx.fillText(xl, x0 + pw - 2, 20 + ph + 14); ctx.textAlign = 'left'; ctx.fillText(yl, x0 + 4, 32);
    ctx.beginPath(); idx.forEach((i, n) => { const px = X(xs[i]), py = Y(ys[i]); n ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke();
  };
  loop(10, 'Presión-volumen', buf.p, buf.v, [-5, 45], [0, vmaxDisp], TR.p, 'Paw ' + pu, 'V mL');
  loop(20 + pw, 'Flujo-volumen', buf.v, buf.f, [0, vmaxDisp], [-90, 90], TR.f, 'V mL', 'Flujo L/min');
}

/* ---------- dibujo del monitor: motor de latidos ---------- */
const zcv = $('#zcv'), zctx = zcv.getContext('2d');
let ZC = {};
function refreshZC() { const zs = getComputedStyle($('#zoll')); ZC = { e: zs.getPropertyValue('--z-ecg').trim(), p: zs.getPropertyValue('--z-spo').trim(), c: zs.getPropertyValue('--z-co2').trim(), mut: zs.getPropertyValue('--z-mut').trim(), line: zs.getPropertyValue('--z-line').trim(), bg: zs.getPropertyValue('--z-bg').trim() }; }
refreshZC();
const G = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (2 * s * s));
const EK = {
  sinus: t => .12 * G(t, .07, .025) - .1 * G(t, .155, .008) + 1.0 * G(t, .17, .01) - .28 * G(t, .19, .011) + .3 * G(t, .42, .05),
  narrow: t => -.08 * G(t, .015, .008) + 1.0 * G(t, .03, .01) - .28 * G(t, .05, .011) + .25 * G(t, .24, .045),
  wide: t => .8 * G(t, .06, .03) - .45 * G(t, .13, .035) - .25 * G(t, .38, .07),
  aesp: t => .5 * G(t, .08, .05) - .25 * G(t, .18, .06) + .2 * G(t, .5, .08),
  none: () => 0
};
const RPEAK = { sinus: .17, narrow: .03, wide: .06, aesp: .08 };
let zT = 0, bt = 9, bl = .8, btype = 'sinus', pPh = 0, paceT = 0, spike = 0, markAt = -1, beatAmp = 1;
function nextBeat() {
  const r = S.rhythm, rate = x => 60 / Math.max(x, 15);
  beatAmp = 1;
  if (S.t < S.pauseUntil && !S.arrest) { btype = 'none'; bl = .3; return; }
  if (r === 'vf' || r === 'tvsp' || r === 'asys') { btype = 'none'; bl = .3; return; }
  if (r === 'paced') { btype = 'wide'; bl = rate(S.pace.rate); spike = 2; paceT = 0; }
  else if (r === 'aesp') { btype = 'aesp'; bl = rate(34); }
  else if (r === 'bav' || r === 'tvp') { btype = 'wide'; bl = rate(S.fc); }
  else if (r === 'tsv' || r === 'flutter') { btype = 'narrow'; bl = rate(S.fc); }
  else if (r === 'fa') { btype = 'narrow'; bl = rate(S.fc) * (.55 + .9 * Math.random()); beatAmp = .7 + .6 * Math.min(1, bl / .5); }
  else { btype = 'sinus'; bl = rate(S.fc); }
  if (syncOn && btype !== 'none') markAt = RPEAK[btype];
}
function zSample(dt) {
  zT += dt; bt += dt;
  const r = S.rhythm, arrest = S.arrest, TAU = 2 * Math.PI;
  if (bt >= bl) { bt -= bl; if (bt > bl) bt = 0; nextBeat(); }
  let e = EK[btype](bt);
  if (r === 'vf') { const a = S.cpr.vfAmp; e = a * (.36 * Math.sin(TAU * 5.2 * zT) + .26 * Math.sin(TAU * 6.9 * zT + 1.3) + .18 * Math.sin(TAU * 3.4 * zT + .4)) * (.75 + .25 * Math.sin(TAU * .4 * zT)); }
  else if (r === 'tvsp') e = .85 * Math.sin(TAU * zT * 190 / 60) + .15 * Math.sin(2 * TAU * zT * 190 / 60 + .5);
  else if (r === 'asys') e = .03 * Math.sin(TAU * .3 * zT);
  if (r === 'bav') { pPh = (pPh + dt * 78 / 60) % 1; e += .13 * G(pPh, .5, .03); }
  if (r === 'fa') e += .035 * (Math.sin(TAU * 6.3 * zT) + Math.sin(TAU * 8.7 * zT + 1)) + .02 * (Math.random() - .5);
  if (r === 'flutter') { const s = (zT * 5) % 1; e += .14 * (s < .8 ? -s / .8 : (s - .8) / .2 - 1) + .07; }
  // espigas del marcapasos: fijo siempre; a demanda solo si la frecuencia propia es menor
  const pacing = S.pace.on && S.pace.mA > 0 && !arrest && (S.pace.mode === 'fixed' || (S.fcIntr || 0) < S.pace.rate);
  if (pacing && r !== 'paced') { paceT += dt; if (paceT >= 60 / S.pace.rate) { paceT = 0; spike = 2; } }
  if (spike > 0) { e += 1.3; spike--; }
  zb.mk[zw] = 0;
  if (markAt >= 0 && bt >= markAt) { zb.mk[zw] = 1; markAt = -1; }
  const comp = arrest && S.cpr.comp !== 'off', cph = (zT * 110 / 60) % 1;
  if (comp) e += (S.cpr.comp === 'mech' ? .55 : .5) * Math.max(0, Math.sin(TAU * cph)) - .12;
  const agit = arrest ? 0 : Math.max(S.fight || 0, S.iface === 'mask' ? clamp(S.awake * (S.drive - .6), 0, 1) : 0, S.clin < S.anxUntil ? .8 : 0);
  zb.e[zw] = e + (Math.random() - .5) * (.03 + .2 * agit) + .05 * Math.sin(S.t * TAU * .25) * agit;
  if (arrest) zb.p[zw] = comp ? .3 * (M.cprQ || .8) * Math.max(0, Math.sin(TAU * cph)) : 0;
  else if (btype === 'none') zb.p[zw] = zb.p[(zw - 1 + ZN) % ZN] * .97;
  else { const perf = clamp((S.tas - 45) / 70, .03, 1), ppv = S.iface === 'tube' && !ventOffNow() ? 1 - (.06 + .5 * S.deficit) * clamp((S.Paw - S.cfg.peep) / 15, 0, 1.2) : 1, x = (bt - .12) / Math.max(bl, .3);
    zb.p[zw] = x < 0 ? zb.p[(zw - 1 + ZN) % ZN] * .985 : perf * ppv * beatAmp * (x < .14 ? Math.sin(x / .14 * Math.PI / 2) : Math.exp(-(x - .14) * 3.2) * (1 + .12 * G(x, .42, .04))); }
  zb.c[zw] = S.co2;
  zw = (zw + 1) % ZN; if (zw === 0) zfilled = true;
}
function drawZoll() {
  const dpr = window.devicePixelRatio || 1, Wd = zcv.clientWidth || 380, chH = 58;
  const ecgLab = 'II' + (S.pace.on ? ` · MP ${S.pace.mode === 'demand' ? 'demanda' : 'fijo'} ${S.pace.rate} lpm ${S.pace.mA} mA` : '') + (syncOn ? ' · SINC' : '');
  const ch = [{ k: 'e', lab: ecgLab, min: -.5, max: 1.25, col: ZC.e }, { k: 'p', lab: 'Pleth', min: -.05, max: 1.1, col: ZC.p }, { k: 'c', lab: 'CO₂ 0–60', min: 0, max: 60, col: ZC.c }];
  const Hc = chH * ch.length;
  if (zcv.width !== Math.round(Wd * dpr) || zcv.height !== Math.round(Hc * dpr)) { zcv.width = Math.round(Wd * dpr); zcv.height = Math.round(Hc * dpr); zcv.style.height = Hc + 'px'; }
  zctx.setTransform(dpr, 0, 0, dpr, 0, 0); zctx.fillStyle = ZC.bg; zctx.fillRect(0, 0, Wd, Hc);
  const sg = segs(zw, zfilled, ZN, ZGAP), xOf = i => 4 + i / ZN * (Wd - 8);
  ch.forEach((c, ci) => {
    const y0 = ci * chH + 6, h = chH - 10, yOf = v => y0 + h - (clamp(v, c.min, c.max) - c.min) / (c.max - c.min) * h;
    zctx.font = '10px "JetBrains Mono", monospace'; zctx.fillStyle = c.col; zctx.textAlign = 'left'; zctx.fillText(c.lab, 6, y0 + 9);
    const b = zb[c.k];
    sg.forEach(([a, e]) => { if (e - a < 2) return; zctx.beginPath(); for (let i = a; i < e; i++) { const X = xOf(i), Y = yOf(b[i]); i === a ? zctx.moveTo(X, Y) : zctx.lineTo(X, Y); } zctx.strokeStyle = c.col; zctx.lineWidth = 1.6; zctx.stroke(); });
    if (ci === 0) sg.forEach(([a, e]) => { for (let i = a; i < e; i++) { if (!zb.mk[i]) continue; const X = xOf(i); zctx.fillStyle = '#ffffff'; zctx.beginPath(); zctx.moveTo(X - 4, y0 + 12); zctx.lineTo(X + 4, y0 + 12); zctx.lineTo(X, y0 + 18); zctx.closePath(); zctx.fill(); } });
    if (ci < ch.length - 1) { zctx.strokeStyle = ZC.line; zctx.beginPath(); zctx.moveTo(0, (ci + 1) * chH + .5); zctx.lineTo(Wd, (ci + 1) * chH + .5); zctx.stroke(); }
  });
}
function drawSpark() {
  const c = $('#spark'), x = c.getContext('2d'), dpr = window.devicePixelRatio || 1, Wd = c.clientWidth || 300, H = 70;
  if (c.width !== Math.round(Wd * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(Wd * dpr); c.height = Math.round(H * dpr); c.style.height = H + 'px'; }
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = ZC.bg; x.fillRect(0, 0, Wd, H);
  const tr = S.trend, L = 34, y = (v, lo, hi) => H - 14 - (clamp(v, lo, hi) - lo) / (hi - lo) * (H - 22);
  x.strokeStyle = ZC.line; x.lineWidth = 1; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(L, y(90, 50, 100)); x.lineTo(Wd, y(90, 50, 100)); x.stroke(); x.setLineDash([]);
  x.font = '10px "JetBrains Mono", monospace'; x.fillStyle = ZC.mut; x.textAlign = 'right'; x.fillText('90 %', L - 4, y(90, 50, 100) + 3);
  x.textAlign = 'left'; x.fillStyle = ZC.p; x.fillText('SpO₂', L + 2, H - 2); x.fillStyle = ZC.c; x.fillText('EtCO₂', L + 44, H - 2);
  x.fillStyle = ZC.mut; x.textAlign = 'right'; x.fillText(tr.length ? 'tendencia ' + fmt(Math.min(tr[tr.length - 1].clin - tr[0].clin, 999)) + ' min' : 'tendencia', Wd - 2, H - 2);
  if (tr.length < 2) return;
  const t0 = tr[0].clin, t1 = Math.max(tr[tr.length - 1].clin, t0 + 1), X = t => L + (t - t0) / (t1 - t0) * (Wd - L - 4);
  const line2 = (key, lo, hi, col, mul) => { x.strokeStyle = col; x.lineWidth = 1.8; x.beginPath(); tr.forEach((p, i) => { const v = p[key] * mul; i ? x.lineTo(X(p.clin), y(v, lo, hi)) : x.moveTo(X(p.clin), y(v, lo, hi)); }); x.stroke(); };
  line2('spo2', 50, 100, ZC.p, 100); line2('et', 0, 60, ZC.c, 1);
}

/* ---------- bucle ---------- */
function setPauseBtn() { const b = $('#pauseBtn'); b.textContent = paused ? 'Seguir' : 'Pausa'; b.setAttribute('aria-pressed', paused); }
function updateUI() {
  M = sim.monitor();
  const key = S.dev.vent + S.iface + S.cfg.mode + (S.standby ? 's' : '');
  if (key !== frameKey) { const base = S.dev.vent + S.iface, ifChanged = !frameKey || frameKey.slice(0, base.length) !== base; renderTilesFrame(); renderKeys(); renderStandby(); if (ifChanged) { if (!pendList().length) pend = Object.assign({}, S.cfg); renderModes(); renderKnobs(); renderDials(); renderCase(); } }
  if (pendAt && performance.now() - pendAt > 20000 && !ventOffNow()) cancelPend('Cambios sin confirmar en 20 s: descartados');
  if (frozen && performance.now() > frozen) frozen = 0;
  updateTiles(); const va = ventAlarms(), ma = updateMonitor(); readings(); updateButtons(); updateDefib(); updateKeys(); alarmSound(va, ma);
  $('#modeInfo').textContent = modeInfoTxt();
  if ($('#truthBox').open) renderTruth();
}
let lastEv = 0, lastIe = 0, lastHit = 0;
function frame(now) {
  const dt = clamp((now - lastFrame) / 1000, 0, .1); lastFrame = now;
  if (!paused) {
    const n = Math.max(1, Math.ceil(dt / .004));
    for (let i = 0; i < n; i++) {
      const h = dt / n;
      sim.step(h); sacc += h; zacc += h;
      if (S.evMark) { lastEv = S.evMark; S.evMark = 0; }
      if (S.ieMark) { lastIe = 1; S.ieMark = 0; }
      if (S.pmaxHit && S.pmaxHit !== lastHit) { if (!S.dev.pneumatic) lastEv = 3; lastHit = S.pmaxHit; }
      while (sacc >= SR) { sacc -= SR; if (!frozen) { buf.p[w] = S.Paw; buf.f[w] = S.Qvent * 60; buf.v[w] = S.vmeas * 1000; buf.c[w] = S.co2; buf.m[w] = S.pmus; buf.ev[w] = lastEv; buf.ie[w] = lastIe; w = (w + 1) % N; if (w === 0) filled = true; } lastEv = 0; lastIe = 0; }
      while (zacc >= ZSR) { zacc -= ZSR; zSample(ZSR); }
    }
    if (pniMeas && S.t >= pniMeas) finishPni();
    if (defib.st === 'charging' && S.t >= defib.until) { defib.st = 'ready'; defib.until = S.t; logIt('Desfibrilador cargado'); updateDefib(); }
    if (defib.st === 'ready' && S.t - defib.until > 30) { defib.st = 'idle'; aed = { st: 'idle', until: 0 }; logIt('Carga anulada a los 30 s'); updateDefib(); }
    if (aed.st === 'analyzing') {
      if (S.arrest && S.cpr.comp !== 'off') { aed.st = 'idle'; monMsg('Movimiento detectado: análisis interrumpido'); }
      else if (S.t >= aed.until) { const sh = S.arrest && (S.rhythm === 'vf' || S.rhythm === 'tvsp');
        if (sh) { aed.st = 'charging'; defib = { st: 'charging', until: S.t + 4 }; monMsg('Descarga recomendada. Cargando ' + aedEnergy() + ' J'); logIt('DEA: descarga recomendada'); }
        else { aed.st = 'idle'; monMsg('Descarga no recomendada. Inicie RCP si no hay pulso.'); logIt('DEA: descarga no recomendada'); } }
    }
    if (aed.st === 'charging' && defib.st === 'ready') { aed.st = 'ready'; monMsg('Aléjense del paciente. Pulse Descarga.'); }
    if (resume && S.t >= resume.at) { if (S.arrest) sim.compress(resume.type); resume = null; }
    uacc += dt; if (uacc >= .5) { uacc = 0; updateUI(); }
  }
  draw(); drawZoll(); requestAnimationFrame(frame);
}

/* ---------- arranque ---------- */
$('#caseSel').innerHTML = GROUPS.map(g => `<optgroup label="${g}">` + Object.entries(CASES).filter(([, c]) => c.lvl === g).map(([k, c]) => `<option value="${k}">${c.title}</option>`).join('') + '</optgroup>').join('');
$('#phenoSel').innerHTML = Object.entries(VMI.PHENO).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
$('#evSel').innerHTML = Object.entries(EVLAB).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
$('#caseSel').addEventListener('change', e => loadCase(e.target.value));
$('#phenoSel').addEventListener('change', () => loadCase('libre'));
$('#ifaceSel').addEventListener('change', () => loadCase('libre'));
$('#ventSel').addEventListener('change', e => switchDevice(e.target.value));
$('#monSel').addEventListener('change', e => { applyMonUI(); updateDefib(); logIt('Monitor: ' + MONS[e.target.value].short); });
$('#resetBtn').addEventListener('click', () => loadCase(caseKey));
$('#pauseBtn').addEventListener('click', () => { paused = !paused; setPauseBtn(); });
$('#speedSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; scale = +b.dataset.s; sim.setScale(scale); $$('#speedSeg button').forEach(o => o.setAttribute('aria-pressed', o === b)); });
$('#truthBox').addEventListener('toggle', () => { if ($('#truthBox').open) renderTruth(); });
window.__sim = () => ({ sim, S, M, track, pend, lim });
loadCase('tce');
requestAnimationFrame(frame);
})();
