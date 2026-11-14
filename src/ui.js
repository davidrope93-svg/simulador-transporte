(function () {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const clamp = VMI.clamp;
const fmt = (x, d = 0) => (x == null || !isFinite(x)) ? '–' : x.toFixed(d).replace('.', ',');
const { SPEC, PKEYS, KEYS, DEVS, KEYLAB, MONS } = window.SIM_DEV;
const CASES = window.SIM_CASES, GROUPS = window.SIM_GROUPS;
const N = 750, SR = .02, GAP = 12, ZN = 750, ZSR = .008, ZGAP = 20;
const MODEL_KEYS = ['pco2', 'deficit', 'bs', 'opioid', 'rhythm', 'arrPen', 'tep', 'anaf', 'cohb', 'cn', 'icp', 'icpGrow', 'weak', 'dav', 'edAir', 'edAirRate', 'asp', 'arrest', 'arrestCause', 'comp', 'bav', 'tasAdj', 'fcAdj', 'sevFloor', 'bottleL', 'bottleBar', 'leak10', 'relCe', 'sedE', 'sedStopped', 'sev', 'ptx', 'ptxTension', 'shockMul', 'bmv', 'sgaFail', 'peso', 'k', 'kRate', 'glu', 'gluT', 'temp', 'tempRate', 'bleed', 'bleedSrc', 'tca', 'ecl', 'croup', 'postRosc', 'access', 'arrestCause2', 'hco3Off', 'stemi', 'tamp', 'tampRate', 'vaso', 'vasoRate', 'neurog', 'fluidTol', 'htx', 'flail', 'pain', 'burn', 'se', 'stroke', 'na', 'cv', 'op', 'opRate', 'cocaine', 'dka', 'neo', 'dci', 'heat', 'drown', 'edad', 'tire', 'pneu', 'cedema'];
const O2LAB = { gafas: 'gafas nasales 2 L/min', venturi28: 'Venturi 28 %', venturi35: 'Venturi 35 %', venturi50: 'Venturi 50 %', reserv: 'mascarilla con reservorio 15 L/min' };
const IFLAB = { tube: 'tubo endotraqueal', mask: 'mascarilla oronasal', nasal: 'cánula nasal de alto flujo', o2: 'paciente sin conectar' };
const IFSHORT = { tube: 'intubado', mask: 'VMNI', nasal: 'alto flujo', o2: 'oxigenoterapia' };
const RLAB = { sinus: 'sinusal', tsinus: 'taquicardia sinusal', brady: 'bradicardia', sbrady: 'bradicardia sinusal', bav: 'BAV completo', paced: 'ritmo de marcapasos', aesp: 'AESP', vf: 'FV', tvsp: 'TVSP', asys: 'asistolia', tsv: 'TSV', fa: 'FA rápida', flutter: 'flutter auricular', tvp: 'TV con pulso' };
const rhyLab = r => { const e = S.ecg || {}; return (RLAB[r] || r) + (S.arrest || ['vf', 'tvsp', 'asys'].includes(r) ? '' : (e.qrs > .115 ? ` · QRS ${fmt(e.qrs * 1000)} ms` : '') + (e.t > 1.8 ? ' · T picudas' : '') + (e.j > .25 ? ' · ondas J' : '') + (Math.abs(e.st || 0) >= .8 ? ` · ST ${e.st > 0 ? '+' : '−'}${fmt(Math.abs(e.st), 1)} mm` : '')); };
const FALLBACK = { CPV: ['CPR_M', 'VCV', 'APV', 'PCV'], CPR_M: ['CPV', 'VCV', 'APV'], CPV_RCE: ['PCV', 'APV'], SIMV_V: ['SIMV_A', 'SIMV_P', 'VCV'], SIMV_A: ['SIMV_V', 'SIMV_P', 'APV'], SIMV_P: ['SIMV_A', 'SIMV_V', 'PCV'], ASV: ['APV', 'VCV'], APV: ['VCV'], PST: ['PSV'], CPAP: ['PSV'], VCV: ['APV'], PCV: ['APV'], PSV: ['CPAP'], HFNC: [], DEM: ['CPAP', 'PSV'], MAN: ['VCV', 'APV'] };

/* ---------- fármacos: datos y dosis en drugs.js ---------- */
const { DRUGSET, DRUGITEMS, PED, roundDose, tnkDose } = window.SIM_DRUGS;
const perfNowOf = id => { const e = document.querySelector('#pf_' + id); return e ? +e.value || 0 : 0; }; // v1.13: perfusión en marcha según su selector
const PERFS = SIM_DRUGS.PERFS.map(p => Object.assign({}, p, { set: r => p.run(sim, r, fW), extra: p.extra ? r => p.extra(r, peso, fmt) : null }));
const isPed = () => !!(CASES[caseKey] && CASES[caseKey].ped);
const pedOf = it => SIM_DRUGS.pedEntry(it.id, peso, isPed());
const dd = x => x == null ? 0 : x < 1 ? (Math.round(x * 100) % 10 ? 2 : 1) : x % 1 ? 1 : 0;
const doseOf = it => SIM_DRUGS.doseOf(it, peso, isPed());

const TGT = {
  spo2: { lab: 'SpO₂', u: '%', get: () => S.spo2 * 100, d: 0 }, et: { lab: 'EtCO₂', u: 'mmHg', get: () => M.et, d: 0 },
  tas: { lab: 'TAS', u: 'mmHg', get: () => S.arrest ? null : S.tas, d: 0 }, pam: { lab: 'PAM', u: 'mmHg', get: () => S.arrest ? null : S.pam, d: 0 }, vtkg: { lab: 'Vt/kg', u: 'mL/kg', get: () => M.vtkg, d: 1 },
  pplat: { lab: 'Meseta', u: 'cmH₂O', get: () => real().pplat, d: 0 }, dp: { lab: 'Driving', u: 'cmH₂O', get: () => real().dp, d: 0 },
  peepi: { lab: 'Auto-PEEP', u: 'cmH₂O', get: () => real().peepi, d: 0 }, pco2: { lab: 'PaCO₂', u: 'mmHg', get: () => S.pco2, d: 0 },
  rr: { lab: 'FR del paciente', u: 'rpm', get: () => S.arrest ? null : (M.effN >= 2 ? M.effRR : 0), d: 0 },
  ie: { lab: 'Esfuerzos ineficaces', u: '', get: () => M.effN >= 4 ? M.ies / M.effN : null, d: 2, fmt: true },
  auto: { lab: 'Autodisparos', u: '', get: () => M.nB >= 4 ? M.auto / M.nB : null, d: 2, fmt: true },
  leak: { lab: 'Fuga', u: 'L/min', get: () => M.leak, d: 0 }, o2: { lab: 'O₂ disponible', u: '', get: () => S.o2.supply ? 1 : 0, d: 0, fmt: true },
  fight: { lab: 'Sin lucha', u: '', get: () => S.fight || 0, d: 2, fmt: true },
  sinus: { lab: 'Ritmo sinusal', u: '', get: () => S.arr.type || S.arrest ? 0 : 1, d: 0, fmt: true },
  glu: { lab: 'Glucemia', u: 'mg/dL', get: () => S.glu, d: 0 }, temp: { lab: 'Temperatura', u: '°C', get: () => S.temp, d: 1 }, na: { lab: 'Na⁺', u: 'mmol/L', get: () => S.na, d: 0 }, fc: { lab: 'FC', u: 'lpm', get: () => S.arrest ? null : S.fc, d: 0 }, gcs: { lab: 'Glasgow', u: '', get: () => S.arrest ? null : S.gcs, d: 0 }, alt: { lab: 'Altitud de cabina', u: 'm', get: () => S.altitude, d: 0 }, k: { lab: 'K⁺', u: 'mmol/L', get: () => S.k, d: 1 }, naUp: { lab: 'Subida de Na⁺', u: 'mmol/L', get: () => S.na - S.na0, d: 1 }, seizFree: { lab: 'Sin convulsión', u: '', get: () => S.arrest ? null : (S.clin >= S.seizUntil ? 1 : 0), d: 0, fmt: true }, fluidRate: { lab: 'Cristaloide en bomba', u: 'mL/h', get: () => S.fluidRate || 0, d: 0 }, spco: { lab: 'SpCO', u: '%', get: () => S.cohb * 100, d: 0 }, reperf: { lab: 'Reperfusión adecuada', u: '', get: () => reperfOk() ? 1 : 0, d: 0, fmt: true }, qrs: { lab: 'QRS', u: 'ms', get: () => S.arrest ? null : S.ecg.qrs * 1000, d: 0 },
  fio2: { lab: 'FiO₂', u: '%', get: () => (S.iface === 'tube' || S.iface === 'mask') && !ventOffNow() ? S.cfg.fio2 : null, d: 0 }
};
const EVLAB = { seiz: 'Convulsión', move: 'Movilización brusca', rebleed: 'Resangrado', extub: 'Extubación o retirada de mascarilla', disc: 'Desconexión', sel: 'Intubación selectiva', obst: 'Tapón o acodamiento', bronco: 'Broncoespasmo', ptx: 'Neumotórax a tensión', leak: 'Fuga', o2: 'Fallo de O₂', wake: 'Se despierta', anx: 'Ansiedad', cough: 'Tos', vf: 'Fibrilación ventricular', aspir: 'Broncoaspiración', tep: 'TEP', anaf: 'Anafilaxia', tsv: 'TSV', fa: 'FA rápida', tvp: 'TV con pulso' };
const EVFIX = { seiz: () => S.clin >= S.seizUntil, move: () => true, rebleed: () => S.hemo || !S.bleed, extub: () => !S.air.extub && !(S.iface === 'mask' && S.mask.leak10 > 100), disc: () => !S.air.disc, sel: () => !S.air.sel, obst: () => !S.air.obst, bronco: () => S.bs < 1.2, ptx: () => !S.ptxActive, leak: () => S.air.leak === 0 && !(S.iface === 'mask' && S.mask.leak10 > 40), o2: () => S.o2.supply, wake: () => (S.fight || 0) < .1, anx: () => S.clin >= S.anxUntil, cough: () => true, vf: () => !S.arrest, aspir: () => false, tep: () => S.tep < .3, anaf: () => S.anaf < .2, tsv: () => !S.arr.type, fa: () => !S.arr.type, tvp: () => !S.arr.type };
const HEMOLAB = { ext: 'Torniquete', pelv: 'Cinturón pélvico', uter: 'Masaje uterino bimanual', int: 'Compresión y empaquetado' };
const ACTLAB = { cpap: 'CPAP con pieza en T y mascarilla', plast: 'Bolsa de plástico hasta el cuello, sin secar, y gorro', infl: '5 insuflaciones de 2–3 s a 30 cmH₂O con mascarilla', neoPos: 'Cabeza en posición neutra, tracción mandibular y sellado a dos manos', neoSuct: 'Aspiración suave de boca y nariz', uvc: 'Catéter venoso umbilical (≈ 2 min)', decont: 'Descontaminación con protección: ropa retirada en bolsa cerrada y piel lavada con agua y jabón', ictus: 'Código ictus activado: pre-aviso al hospital con trombectomía', pericardio: 'Pericardiocentesis ecoguiada (≈ 1 min)', icp: 'Código infarto activado: ICP primaria, traslado directo a la sala de hemodinámica', iv: 'Canalizando vía venosa periférica (≈ 1,5 min)', io: 'Vía intraósea en tibia proximal (≈ 45 s)', blood: 'Concentrado de hematíes (1 U)', sga: 'Dispositivo supraglótico (i-gel): insertando (≈ 30 s)', drain: 'Toracostomía / drenaje torácico', reconnect: 'Tubuladura reconectada', reintub: 'Reintubación en curso (1,5 min)', pull: 'Tubo retirado 2 cm', suction: 'Aspirado y revisado el tubo', cuff: 'Balón inflado', opencirc: 'Desconexión 15 s para vaciar', decomp: 'Descompresión con aguja', bottle: 'Botella cambiada', fluid: 'Cristaloide 500 mL', mask: 'Mascarilla recolocada', sedperf: 'Bomba de sedación reanudada', vagal: 'Maniobra de Valsalva modificada', recruit: 'Maniobra de reclutamiento (CPAP 40 cmH₂O 30 s)', clamp: 'Tubo pinzado para desconectar', vl: 'Videolaringoscopio y bougie preparados', cric: 'Cricotiroidotomía quirúrgica (≈ 1,5 min)' };

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

const IE_LIST = [.25, 1 / 3, .5, 2 / 3, 1, 1.5, 2, 3, 4];
const ieShow = v => { if (v == null) return '–'; const t = x => fmt(x, Math.abs(x - Math.round(x)) > .01 ? 1 : 0); return v >= 1 ? `${t(v)}:1` : `1:${t(1 / v)}`; };
const tiFromIE = c => clamp(60 / Math.max(4, c.fr || 12) * c.ie / (1 + c.ie), .3, 3);
const ieFromTi = c => { const r = (c.ti || 1) / Math.max(.2, 60 / Math.max(4, c.fr || 12) - (c.ti || 1)); return IE_LIST.reduce((b, x) => Math.abs(Math.log(x / r)) < Math.abs(Math.log(b / r)) ? x : b, .5); };
const SPONT_M = { PSV: 1, PST: 1, ASV: 1 };
function spec(k, c) {
  c = c || pend || (S && S.cfg) || {};
  const d = devOf(), s = Object.assign({}, SPEC[k], (d.spec || {})[k] || {});
  if (PKEYS[k]) s.u = d.u;
  if (S && pendIface() === 'mask' && d.nivSpec && d.nivSpec[k]) Object.assign(s, d.nivSpec[k]);
  if (s.spontMax != null && SPONT_M[c.mode]) s.max = s.spontMax;
  if (s.ms) { s.u = 'ms'; s.show = v => fmt((v || 0) * 1000); }
  if (k === 'ie') s.show = ieShow;
  if (k === 'fio2' && d.spec.fio2 && d.spec.fio2.bin) { s.u = ''; s.show = v => v >= 100 ? '100 %' : 'Air Mix'; }
  return s;
}
const showV = (k, v) => { const s = spec(k); return s.show ? s.show(v) : fmt(v, s.d); };
function labOf(k, c) {
  c = c || pend; const d = devOf(), um = uMode(c), mode = c.mode;
  const ml = d.modeLab && d.modeLab[um]; if (ml && ml[k]) return ml[k];
  if ((mode === 'PSV' || mode === 'CPAP') && (k === 'vt' || k === 'fr')) return (k === 'vt' ? 'Vt' : (d.lab.fr || 'Fr')) + ' apnea';
  if (mode === 'CPAP' && k === 'peep' && S.dev.vent === 'monnal') return 'CPAP';
  return d.lab[k] || SPEC[k].lab;
}
function keysFor(um) {
  const d = devOf(); let k = (d.modeKeys && d.modeKeys[um]) || KEYS[um] || [];
  if (d.swap) k = k.map(x => d.swap[x] || x);
  if (d.limitsPmax) k = k.filter(x => x !== 'pmax');
  return k;
}
function modeList(iface) { return devOf().modes[iface || S.iface] || []; }
function modeLabel(m, dev, iface) {
  const d = DEVS[dev || S.dev.vent], i = iface || S.iface;
  const hit = (d.modes[i] || []).find(x => x[0] === m) || Object.values(d.modes).flat().find(x => x[0] === m);
  return hit ? hit[1] : m;
}
const uMode = c => c.umode || c.mode;
/* modos de interfaz que el motor resuelve con otro modo interno */
let ratioUI = 0;
const UMODES = {
  DEM: () => ({ mode: 'CPAP', peep: 0, fio2: 100 }), MAN: () => ({ mode: 'MAN' }),
  SIMV_V: () => ({ mode: 'SIMV', simvMand: 'VCV' }), SIMV_P: () => ({ mode: 'SIMV', simvMand: 'PCV' }), SIMV_A: () => ({ mode: 'SIMV', simvMand: 'APV' }),
  CPV_RCE: () => ({ mode: 'PCV', rce: true }),
  CPR_M: c => ratioUI > 0 ? { mode: 'MAN', peep: 0 } : { mode: 'VCV', peep: 0, fr: c.fr || 10, pmax: Math.max(c.pmax || 0, 60) } // Medumat CPR: 30:2 con MEDUtrigger o continuo
};
function toModel(c, dev) {
  const D = DEVS[dev || (S ? S.dev.vent : 'monnal')], m = uMode(c);
  if (UMODES[m]) Object.assign(c, { umode: m }, UMODES[m](c)); else { delete c.umode; delete c.rce; }
  if (c.mode === 'CPV') { if (c.ph == null) c.ph = (c.peep || 0) + (c.pinsp || 15); c.pinsp = Math.max(0, c.ph - (c.peep || 0)); } // Monnal: PH absoluta
  if (D.swap && D.swap.ti === 'ie') { if (c.ie == null) c.ie = ieFromTi(c); c.ti = tiFromIE(c); } // Medumat: I:E
  return c;
}
function fitMode(cfg, dev, iface) {
  const list = DEVS[dev].modes[iface] || [], c = Object.assign({}, cfg);
  if (DEVS[dev].spec.fio2 && DEVS[dev].spec.fio2.bin) c.fio2 = (c.fio2 || 100) > 80 ? 100 : 60;
  const m = uMode(c);
  if (!list.length || list.find(x => x[0] === m)) return toModel(c, dev);
  for (const f of FALLBACK[m] || []) if (list.find(x => x[0] === f)) {
    if (m === 'CPAP' && f === 'PSV') c.ps = 0;
    if ((m === 'CPV' || m === 'CPR_M') && f !== 'CPV' && f !== 'CPR_M') { c.trigI = ((DEVS[dev].spec.trigI || {}).max) || SPEC.trigI.max; c.fr = Math.min(c.fr || 10, 10); c.peep = Math.min(c.peep || 0, 5); c.pmax = 60; } /* ERC 2025: volumen control, PEEP 0–5, alarma de pico 60–70 */
    c.mode = f; if (UMODES[f]) c.umode = f; else delete c.umode; return toModel(c, dev);
  }
  c.mode = list[0][0]; if (UMODES[c.mode]) c.umode = c.mode; else delete c.umode; return toModel(c, dev);
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
  ratioUI = c.arrest && (iface === 'o2' || iface === 'mask') ? (c.ped ? 15 : 30) : 0; $('#cprRatio').value = String(ratioUI);
  const invBase = fitMode(Object.assign({ mode: DEVS[dev].inv, vt: 480, fr: 16, ti: 1, tplat: 0, rise: .15, peep: 5, pmax: 40, trigI: 2, pinsp: 15, fio2: 100 }, (iface === 'o2' || iface === 'tube') ? c.cfg : {}), dev, 'tube');
  cfg = fitMode(cfg, dev, iface === 'o2' ? 'tube' : iface);
  if (c.altitude != null) setAltUI(c.altitude, true);
  setSpeed(c.speed || GROUP_SPEED[c.lvl] || 10);
  const opts = { pheno: pk, seed: hashSeed(k + pk + iface + dev), scale, cfg, vent: dev, sex: c.sex, talla: c.talla, altitude: +$('#alt').value, iface };
  for (const key of MODEL_KEYS) if (c[key] != null) opts[key] = c[key];
  if (opts.pco2 == null) opts.pco2 = pk === 'epoc' ? 64 : 40;
  if (opts.bs == null && pk === 'epoc') opts.bs = 1.3;
  if (awake) { opts.relCe = 0; opts.sedE = 0; opts.sedStopped = true; }
  sim = VMI.create(opts);
  sim.warm(12); sim.setRatio(ratioUI);
  S = sim.S; pend = Object.assign({}, S.cfg); activeK = null; pendAt = 0;
  invCfg = invBase; if (!c.cfg || !c.cfg.vt) invCfg.vt = round10(7 * S.ibw);
  peso = c.peso || Math.round(S.ibw * 1.15); fW = c.ped ? 75 / peso : clamp(75 / peso, .7, 1.4);
  // datos del paciente en el ventilador: si ya estaba conectado, los metió quien lo conectó; si no, los de fábrica (Monnal: mujer de 165 cm)
  devPat = iface !== 'o2' ? { sex: c.sex || S.P.sex, talla: c.talla || S.P.talla } : dev === 'monnal' ? { sex: 'm', talla: 165 } : { sex: 'h', talla: 170 };
  track = { t: {}, worst: { spo2: 100, tas: 300, ppk: 0 }, events: [], acts: 0, drugs: [], intubAt: null, peri: null, induct: null, relax: null, attempts: 0, cric: false, seizures: 0, gluAt: null, gluVal: null, tempAt: null, accessAt: S.access ? 0 : null, fluidMl: 0, bloodU: 0,
    arrestAt: S.arrest ? 0 : null, firstShock: null, lastShock: null, shocks: 0, adr: [], amio: 0, lido: 0, roscAt: null, nalox: null, convAt: null, hadArr: false, standbyApnea: 0 };
  for (const key in (c.targets || {})) track.t[key] = { inT: 0, tot: 0 };
  sched = (c.events || []).map(e => Object.assign({ fired: false }, e));
  S.onSlow = onSlow; S.onIntubated = onIntubated; S.onIntubFail = onIntubFail; S.onAccess = onAccess; S.onSeizure = () => { track.seizures++; logIt('Convulsión tónico-clónica generalizada'); }; ended = false; prevArrest = S.arrest;
  buf = { p: new Float32Array(N), f: new Float32Array(N), v: new Float32Array(N), c: new Float32Array(N), m: new Float32Array(N), ev: new Int8Array(N), ie: new Int8Array(N) };
  zb = { e: new Float32Array(ZN), p: new Float32Array(ZN), c: new Float32Array(ZN), mk: new Int8Array(ZN) };
  w = 0; filled = false; zw = 0; zfilled = false; frameKey = '';
  pni = null; pniMeas = 0; defib = { st: 'idle', until: 0 }; aed = { st: 'idle', until: 0 }; syncOn = false; analysis = null; resume = null; apvHist = [];
  ventSilUntil = -1; monSilUntil = -1; locked = false; sbyHint = null; frozen = 0; cprPrev = null; showModes = dev !== 'medumat';
  $('#zPace').checked = false; $('#zPaceMode').value = 'demand'; paceRateOpts(70); $('#zMode').value = 'manual';
  $('#findings').hidden = true; $('#log').innerHTML = '';
  setLimits(true);
  renderDrugs(); renderPedKit(); applyDevUI(); applyMonUI();
  logIt('Caso: ' + c.title + ' · ' + DEVS[dev].short + ' · ' + MONS[$('#monSel').value].short);
  renderCase(); renderVent(); updateUI();
  if (!S.arrest) measurePni(true);
  teachOnLoad();
}
function setAltUI(v, silent) { $('#alt').value = v; $('#altV').textContent = (+v).toLocaleString('es-ES') + ' m'; if (sim && !silent) sim.setAltitude(+v); }

function onIntubated() {
  track.intubAt = S.clin;
  // tras intubar, el ventilador queda en espera con ajustes invasivos preparados: revisar y pulsar Iniciar
  const src = Object.assign({}, S.cfg, invCfg, { fio2: Math.max(S.cfg.fio2 || 100, 60) }); if (!invCfg.umode) delete src.umode;
  const base = fitMode(src, S.dev.vent, 'tube');
  sim.setCfg(base); sim.setStandby(true);
  pend = Object.assign({}, S.cfg); activeK = null; sbyHint = null; pendAt = 0;
  if (S.air.sga) track.sga = true;
  logIt(`${S.air.sga ? 'Dispositivo supraglótico colocado (sella hasta ≈ 25 cmH₂O)' : track.cric ? 'Cánula de cricotiroidotomía' : 'Tubo'} comprobado con capnografía. Ventilador en espera con ${modeLabel(uMode(S.cfg), null, 'tube')} preparado: revisa los ajustes y pulsa «Iniciar ventilación».`);
  renderVent(); renderCase();
}
function onAccess(kind, ok) {
  if (ok) { track.accessAt = S.clin; logIt(kind === 'io' ? 'Vía intraósea colocada y comprobada' : 'Vía venosa periférica canalizada'); }
  else { logIt(kind === 'io' ? 'Vía intraósea fallida' : 'Intento de vía venosa fallido'); showFind([kind === 'io' ? 'La aguja intraósea no ha quedado bien: inténtalo en otro hueso.' : 'No consigues canalizar la vía. Si es urgente, intraósea.']); }
  updateButtons();
}
function onIntubFail(isr) {
  if (isr.sga) { track.sgaFails = (track.sgaFails || 0) + 1; showFind(['El dispositivo supraglótico no sella: no hay ventilación eficaz. Retíralo y pasa al siguiente paso; si no oxigenas, cricotiroidotomía.']); logIt('Supraglótico sin sellado: no ventila'); return; }
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
  if (S.arrest && !prevArrest) { track.arrestAt = S.clin; track.roscAt = null; logIt('Parada cardiorrespiratoria'); if (scale > 1) { setSpeed(1); logIt('Velocidad ×1: en la parada el tiempo corre como en la realidad'); } }
  if (!S.arrest && prevArrest) { track.roscAt = S.clin; logIt('RCE: pulso central palpable'); resume = null; setTimeout(() => measurePni(false), 0); }
  prevArrest = S.arrest;
  if (S.arr.type) track.hadArr = true;
  if (track.hadArr && !S.arr.type && track.convAt == null && !S.arrest) { track.convAt = S.clin; logIt('Ritmo sinusal recuperado'); }
  if (S.pace.on && S.pace.capture && S.pace.mA >= 40 && S.sedTot < .3 && S.opi < .3 && !S.arrest) S.anxUntil = Math.max(S.anxUntil, S.clin + .3);
  if (track.peri && S.clin <= track.peri.end) { track.peri.spo2 = Math.min(track.peri.spo2, S.spo2 * 100); track.peri.tas = Math.min(track.peri.tas, S.tas); }
  if (S.standby && S.iface === 'tube' && !S.bag && S.relTot > .5) track.standbyApnea += dtc;
  if (S.cfg.mode === 'APV' || S.cfg.mode === 'ASV') { if (!apvHist.length || S.clin - apvHist[apvHist.length - 1][0] > .25) apvHist.push([S.clin, S.apv.p]); apvHist = apvHist.filter(x => x[0] > S.clin - 6); } else apvHist = [];
  teachOnSlow();
  if (!M || M.fr == null) return;
  for (const key in track.t) {
    const tg = TGT[key], rng = c.targets[key], v0 = tg.get(), v = v0 == null || tg.fmt ? v0 : +(+v0).toFixed(tg.d); // el valor que se ve en pantalla
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
/* SCACEST: ICP primaria si llega en ≤ 120 min; si no, fibrinólisis */
function reperfOk() { const m = S.stemi; return !!m && (m.pci <= 120 ? m.icp != null : m.tnkAt != null || S.E.tnk > .1); }
function rangeTxt(r, t) { if (t.fmt) return r[0] === 1 && r[1] === 1 ? '' : r[1] < 1 ? '≤ ' + fmt(r[1] * 100) + ' %' : ''; if (r[1] >= 200) return '≥ ' + fmt(r[0], t.d); if (r[0] <= 0) return '≤ ' + fmt(r[1], t.d); if (r[1] >= 40 && t === TGT.rr) return '≥ ' + fmt(r[0], t.d); return fmt(r[0], t.d) + '–' + fmt(r[1], t.d); }
function renderCase() {
  const c = CASES[caseKey];
  const tg = Object.entries(c.targets || {}).map(([k, r]) => `<span class="chip" id="tg_${k}">${TGT[k].lab} ${rangeTxt(r, TGT[k])}</span>`).join('');
  $('#caseCard').innerHTML = `<div><span class="eyebrow">${c.vlvl ? esc(c.vlvl) + ' · variante ' + esc(c.vcode) : c.lvl} · ${VMI.PHENO[S.pk].label} · ${IFSHORT[S.iface]} · ${(c.sex || S.P.sex) === 'm' ? 'mujer' : 'varón'} de ${c.talla || S.P.talla} cm · peso ideal ${fmt(S.ibw)} kg · peso ${fmt(peso)} kg</span><h2 class="ctitle">${c.title}</h2><p>${c.goal}</p></div><div class="targets">${tg}</div>` +
    `<div class="caseact"><button class="btn sm" id="tutBtn">Guíame en este caso</button>${c.pheno ? `<button class="btn sm" id="varBtn" title="Otro paciente y otra complicación a partir de este caso">${c.vbase ? 'Otra variante' : 'Nueva variante'}</button>` : ''}${c.vbase ? '<button class="btn sm" id="varSave">Guardar variante</button><button class="btn sm" id="varLink">Copiar enlace</button>' : ''}${c.hint ? `<details><summary>Ver una solución posible</summary><p>${c.hint}</p></details>` : ''}${c.vbase && CASES[c.vbase] ? `<p class="small vnote">Variante ${esc(c.vcode)} de «${esc(CASES[c.vbase].title)}»: otro paciente${c.vcause ? ', otra causa y otro ritmo' : ''} y, quizá, una complicación que no está en el original. La solución se adapta a esta variante.</p>` : ''}<input class="vlink" id="varUrl" readonly hidden aria-label="Enlace de la variante"></div>`;
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
  const ks = keysFor(uMode(pend));
  $('#knobs').innerHTML = ks.map(k => { const s = spec(k), lb = labOf(k, pend);
    return `<div class="knob${isPend(k) ? ' pend' : ''}${activeK === k ? ' act' : ''}" id="k_${k}" data-sel="${k}"><button class="ksel kl" data-sel="${k}" aria-label="Seleccionar ${lb}"><span>${lb}</span><span>${s.u}${s.note ? ' · ' + s.note : ''}</span></button>
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
  else if (s.list) { const L = s.list, cur = pend[k] != null ? pend[k] : .5; let i = L.reduce((bi, x, j) => Math.abs(x - cur) < Math.abs(L[bi] - cur) ? j : bi, 0); pend[k] = L[clamp(i + d, 0, L.length - 1)]; }
  else { const cur = pend[k] != null ? pend[k] : s.min; pend[k] = +clamp(Math.round((cur + s.step * d) / s.step) * s.step, s.min, s.max).toFixed(3); }
  if (!pendAt) pendAt = performance.now();
  const el = $('#kv_' + k); if (el) el.textContent = showV(k, pend[k]);
  const kn = $('#k_' + k); if (kn) kn.classList.toggle('pend', isPend(k));
  renderConfirm(); updateDialLabels();
}
function confirmPend() {
  if (!pendList().length) return;
  const i = pendIface(), ch = pendList().map(k => k === 'mode' ? 'modo ' + modeLabel(uMode(pend), null, i) : `${labOf(k, pend)} ${showV(k, pend[k])}`);
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
$('#modes').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (!b || locked) return; const m = b.dataset.m; sbyHint = null; pend.mode = m; if (UMODES[m]) pend.umode = m; else delete pend.umode; if (m === 'CPV' || m === 'CPR_M') Object.assign(pend, { fr: 10, peep: 0, fio2: 100 }); pend = toModel(pend); if (!pendAt) pendAt = performance.now(); activeK = null; renderModes(); renderKnobs(); renderDials(); renderStandby(); });
$('#confirm').addEventListener('click', e => { if (e.target.id === 'cOk') confirmPend(); if (e.target.id === 'cNo') cancelPend(); });

/* mandos giratorios: uno (rueda o pulsar y girar) o tres (Medumat) */
function dialBindings() {
  const d = devOf(), m = pend.mode, um = uMode(pend);
  if (d.knob !== 'three') return [{ id: 'main', k: activeK, lab: d.knob === 'pt' ? 'Mando de pulsar y girar' : 'Rueda de control' }];
  const left = m === 'PCV' || m === 'CPV' ? 'pinsp' : m === 'PSV' ? 'ps' : (m === 'CPAP' || um === 'DEM') ? 'peep' : 'vt';
  const center = (m === 'CPAP' || m === 'PSV' || um === 'DEM' || m === 'MAN') ? null : 'fr';
  const ks = keysFor(um);
  const right = activeK && ks.includes(activeK) && activeK !== left && activeK !== center ? activeK : ks.find(k => k !== left && k !== center) || null;
  return [{ id: 'L', k: left, lab: 'Mando izquierdo' }, { id: 'C', k: center, lab: 'Mando central' }, { id: 'R', k: right, lab: 'Mando derecho' }];
}
function renderDials() {
  const B = dialBindings();
  $('#dials').innerHTML = B.map(b => `<div class="dial" data-dial="${b.id}" data-k="${b.k || ''}">
      <div class="dlab">${b.lab}</div>
      <div class="dwrap"><div class="dring" tabindex="0" role="slider" aria-label="${b.lab}: ${b.k ? labOf(b.k, pend) : 'sin asignar'}"${b.k ? ` aria-valuenow="${+pend[b.k] || 0}" aria-valuemin="${spec(b.k).min}" aria-valuemax="${spec(b.k).max}" aria-valuetext="${showV(b.k, pend[b.k])}"` : ' aria-valuenow="0" aria-valuetext="sin asignar"'}><div class="dmark"></div></div><button class="dpress" aria-label="Pulsar para confirmar">OK</button></div>
      <div class="dval" id="dv_${b.id}">${b.k ? labOf(b.k, pend) + ' ' + showV(b.k, pend[b.k]) : (devOf().knob === 'three' ? '—' : 'toca un control')}</div>
    </div>`).join('');
  $$('.dial').forEach(setupDial);
}
function updateDialLabels() { dialBindings().forEach(b => { const e = $('#dv_' + b.id); if (e && b.k) { e.textContent = labOf(b.k, pend) + ' ' + showV(b.k, pend[b.k]); const r = e.parentElement.querySelector('.dring'); if (r) { r.setAttribute('aria-valuenow', +pend[b.k] || 0); r.setAttribute('aria-valuetext', showV(b.k, pend[b.k])); } } }); }
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
  if (S.dev.vent === 'monnal' && ['CPV', 'CPV_RCE'].includes(uMode(S.cfg))) keys.splice(1, 0, 'rce');
  $('#vkeys').innerHTML = keys.map(k => `<button class="vbtn" data-vk="${k}" id="vk_${k}">${k === 'rce' ? (uMode(S.cfg) === 'CPV' ? 'Fase RCE' : 'Fase compresiones') : KEYLAB[k](d)}</button>`).join('');
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
  set('menu', showModes); set('airmix', S.cfg.fio2 < 100, !S.o2.supply); set('o2full', S.cfg.fio2 >= 100); set('cpr', uMode(S.cfg) === 'CPR_M');
}
let manualDown = 0;
$('#vkeys').addEventListener('pointerdown', e => { const b = e.target.closest('[data-vk="manual"]'); if (b && !b.disabled) manualDown = performance.now(); });
$('#vkeys').addEventListener('click', e => {
  const b = e.target.closest('[data-vk]'); if (!b || b.disabled) return;
  const k = b.dataset.vk, d = devOf(); markUse('key:' + k);
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
      else { sim.action('manual'); logIt(d === DEVS.medumat ? 'MEDUtrigger: ventilación manual' : 'Respiración manual'); }
      break;
    case 'neb': b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); logIt(b.getAttribute('aria-pressed') === 'true' ? 'Nebulizador en línea encendido' : 'Nebulizador apagado'); break;
    case 'menu': showModes = !showModes; renderModes(); break;
    case 'airmix': case 'o2full': { const f = k === 'airmix' ? 60 : 100; sim.setCfg(Object.assign({}, S.cfg, { fio2: f })); pend.fio2 = f; logIt(k === 'airmix' ? 'Air Mix activado' : 'O₂ al 100 %'); renderKnobs(); break; }
    case 'cpr':
      if (uMode(S.cfg) !== 'CPR_M') { cprPrev = Object.assign({}, S.cfg); sim.setCfg(toModel(Object.assign({}, S.cfg, { umode: 'CPR_M', mode: 'CPR_M', fr: 10, peep: 0, fio2: 100 }))); logIt(ratioUI > 0 ? `Modo CPR ${ratioUI}:2: dos ventilaciones con MEDUtrigger en cada pausa; metrónomo a 110/min` : 'Modo CPR continuo: IPPV a 10/min con PEEP 0; metrónomo a 110/min'); }
      else { const pv = cprPrev || { mode: 'VCV', peep: 5, fr: 12 }; sim.setCfg(toModel(Object.assign({}, S.cfg, pv, { umode: pv.umode }))); cprPrev = null; logIt('Sales de CPR'); }
      pend = Object.assign({}, S.cfg); renderVent(); break;
    case 'rce':
      if (uMode(S.cfg) === 'CPV') { sim.setCfg(toModel(Object.assign({}, S.cfg, { umode: 'CPV_RCE', mode: 'CPV_RCE', fr: 12, pinsp: Math.max(8, (S.cfg.ph || 15) - 5), peep: 5, trigI: 2 }))); logIt('CPV, fase RCE: ventilación asistida con FR mínima 12, PEEP 5 y PI ajustable'); }
      else { const c = Object.assign({}, S.cfg, { mode: 'CPV', fr: 10, peep: 0 }); delete c.umode; sim.setCfg(toModel(c)); logIt('CPV, fase de compresiones'); }
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
  else { const top = a.find(x => x[0] === 'hi') || a[0]; el.className = 'alarm ' + top[0]; el.textContent = (sil && !(S.dev.vent === 'medumat' && top[1] === devOf().al.gas) ? 'Silenciada · ' : '') + top[1] + (a.length > 1 ? '  (+' + (a.length - 1) + ')' : ''); el.title = a.map(x => x[1]).join(' · '); }
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
  const gasStuck = S.dev.vent === 'medumat' && vent.some(x => x[1] === devOf().al.gas); // el Medumat no silencia la alarma de suministro < 2,7 bar
  const hi = (vent.some(x => x[0] === 'hi') && (S.clin >= ventSilUntil || gasStuck)) || (mon.some(x => x[0] === 'hi') && S.clin >= monSilUntil);
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
  const def = isPed() ? mo.energies.reduce((b, e) => Math.abs(e - 4 * peso) < Math.abs(b - 4 * peso) ? e : b, mo.energies[0]) : mo.def;
  $('#zJ').innerHTML = mo.energies.map(e => `<option value="${e}" ${e === def ? 'selected' : ''}>${e} J</option>`).join('');
  $('#zAuto').innerHTML = [0, ...mo.nibp].map(v => `<option value="${v}" ${v === 5 ? 'selected' : ''}>${v ? v + ' min' : 'no'}</option>`).join('');
  $('#zPaceMode').innerHTML = mo.paceModes.map(v => `<option value="${v}">${{ demand: 'Demanda', fixed: 'Fijo', overdrive: 'Overdrive' }[v]}</option>`).join('');
  paceRateOpts(70);
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
  const pinspNow = () => md === 'APV' || md === 'ASV' || (md === 'SIMV' && S.cfg.simvMand === 'APV') ? S.apv.p : md === 'SIMV' ? S.cfg.pinsp : md === 'PCV' || md === 'CPV' ? S.cfg.pinsp : md === 'PSV' || md === 'PST' ? S.cfg.ps : null;
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
  $('#ifaceLbl').textContent = S.air.sga ? 'dispositivo supraglótico' : IFLAB[S.iface];
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
  if (um === 'CPR_M') return S.cpr.ratio > 0 ? `CPR ${S.cpr.ratio}:2: el equipo no ventila solo; pulsa MEDUtrigger dos veces en cada pausa de las compresiones. Metrónomo a 110/min.` : `CPR continuo: IPPV a ${fmt(c.fr)}/min con PEEP 0 y pMax ${fmt(c.pmax)} mbar mientras se comprime sin pausas. Metrónomo a 110/min.`;
  if (c.mode === 'SIMV') return `${modeLabel(um)}: ${fmt(c.fr)} ciclos ${c.simvMand === 'VCV' ? 'de volumen' : c.simvMand === 'APV' ? 'de volumen con presión regulada' : 'de presión'} por minuto, sincronizados con el esfuerzo; entre ellos, respiraciones espontáneas con presión de soporte ${fmt(c.ps)} ${pu}.`;
  if (um === 'CPV_RCE') return 'CPV, fase RCE: ventilación asistida por presión con frecuencia mínima, PEEP y trigger. Vuelve a la fase de compresiones si se pierde el pulso.';
  if (um === 'DEM') return 'RSI · Demand: el paciente respira O₂ al 100 % a demanda, sin presión de soporte. Para preoxigenar.';
  if (um === 'MAN') return 'RSI · Manual: entrega una respiración con el volumen y el límite de presión ajustados cada vez que pulsas «Disparo manual».';
  if (c.mode === 'APV') return `${S.dev.vent === 't1' ? 'APVcmv' : 'Volumen regulado'}: presión que aplica ahora ${fmt(S.apv.p)} ${pu} sobre PEEP para Vt ${fmt(c.vt)} mL (techo ${fmt(c.pmax - 10)}).`;
  if (c.mode === 'ASV') return `Objetivo ASV: VM ${fmt(c.minvol / 100 * .1 * devIbw(), 1)} L/min · f ${fmt(S.asv.f)} c/min · Vt ${fmt(S.asv.vt)} mL · TI ${fmt(S.asv.ti, 2)} s · Pinsp ${fmt(S.apv.p)} ${pu}.`;
  if (c.mode === 'PST') return `Respaldo temporizado a ${fmt(c.fr)} c/min con TI ${fmt(c.ti, 2)} s si no dispara.`;
  if (c.mode === 'CPV') return `CPV: presión alta ${fmt(c.ph)} y baja ${fmt(c.peep)} ${pu} sincronizadas con las compresiones, ${fmt(c.fr)}/min; no corta por presión ni se dispara con ellas.`;
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
  const sys = S.tas * (1 + (Math.random() - .5) * .04); pni = { at: S.clin, sys, dia: (S.tad || S.tas * .55 + 8) * sys / Math.max(1, S.tas) }; // la vasoplejia ensancha la presión de pulso
  logIt(`PNI ${fmt(pni.sys)}/${fmt(pni.dia)} mmHg`);
}
$('#zPniBtn').addEventListener('click', () => measurePni(false));
$('#zAuto').addEventListener('change', e => logIt('PNI automática: ' + (e.target.value === '0' ? 'no' : 'cada ' + e.target.value + ' min')));
function paceRateOpts(sel) {
  const mo = MONS[$('#monSel').value], max = $('#zPaceMode').value === 'overdrive' && mo.odMax ? mo.odMax : mo.paceRates[1];
  sel = clamp(Math.round(sel / 5) * 5, mo.paceRates[0], max);
  $('#zRate').innerHTML = Array.from({ length: (max - mo.paceRates[0]) / 5 + 1 }, (_, i) => mo.paceRates[0] + i * 5).map(r => `<option ${r === sel ? 'selected' : ''}>${r}</option>`).join('');
}
function setPace() { sim.pace($('#zPace').checked, +$('#zRate').value, +$('#zmA').value, $('#zPaceMode').value); }
$('#zPace').addEventListener('change', e => { setPace(); if (e.target.checked) markUse('act:pace'); logIt(e.target.checked ? `Marcapasos ${{ demand: 'a demanda', fixed: 'fijo', overdrive: 'en sobreestimulación (overdrive)' }[$('#zPaceMode').value]}: ${$('#zRate').value} lpm, ${$('#zmA').value} mA` : 'Marcapasos apagado'); });
['#zRate', '#zmA', '#zPaceMode'].forEach(id => $(id).addEventListener('change', () => { if (id === '#zPaceMode') paceRateOpts(+$('#zRate').value); setPace(); if ($('#zPace').checked) logIt('Marcapasos: ' + { demand: 'demanda', fixed: 'fijo', overdrive: 'overdrive' }[$('#zPaceMode').value] + ' ' + $('#zRate').value + ' lpm ' + $('#zmA').value + ' mA'); }));
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
  defib.st = 'idle'; track.shocks++; track.lastShock = S.clin; track.shockT.push(S.clin); markUse('shock'); aed = { st: 'idle', until: 0 };
  if (track.firstShock == null && wasArrest && track.arrestAt != null) track.firstShock = S.clin - track.arrestAt;
  const res = r.result === 'noShockable' ? (wasArrest ? ` en ritmo no desfibrilable (${RLAB[rhy]})` : ': el paciente tiene pulso, descarga sin indicación') : r.result === 'vf' ? ': la descarga no sincronizada ha desencadenado una FV' : '';
  logIt(`Descarga ${J} J${sync ? ' sincronizada' : ''}${res}`); if (isAed) monMsg('Descarga administrada. Reanude la RCP.');
  updateDefib();
});
$('#zPads').addEventListener('click', () => { sim.setPads(!S.cpr.ap); if (S.cpr.ap) markUse('act:pads'); logIt(S.cpr.ap ? 'Parches en posición anteroposterior (cambio de vector)' : 'Parches en posición anterolateral'); track.drugs.push([S.clin, S.cpr.ap ? 'Parches anteroposteriores' : 'Parches anterolaterales']); updateDefib(); });
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
  $('#zPads').setAttribute('aria-pressed', S.cpr.ap ? 'true' : 'false'); $('#zPads').textContent = S.cpr.ap ? 'Parches AP' : 'Parches AL';
  $('#zSil').setAttribute('aria-pressed', S.clin < monSilUntil); $('#zSil').textContent = S.clin < monSilUntil ? 'Silenciado' : 'Silenciar';
  $('#zMsg').textContent = performance.now() < zMsgUntil ? zMsg : '';
}
function updateMonitor() {
  const hyper = VMI.PHENO[S.pk].hyper, sp = S.spo2 * 100, perf = S.arrest ? 0 : clamp((S.tas - 45) / 70, .05, 1), r = S.rhythm, a = [];
  const pausing = S.t < S.pauseUntil && !S.arrest;
  const hr = pausing ? 0 : r === 'vf' || r === 'asys' ? null : r === 'tvsp' ? 190 : S.arrest ? 34 : S.fc;
  $('#zHr').textContent = r === 'asys' || pausing ? '0' : fmt(hr);
  const an = analysis && S.t < analysis.until ? 'Análisis: ' + analysis.txt : null;
  $('#zRhy').textContent = an || (S.arrest ? (S.cpr.comp !== 'off' ? 'RCP: analiza en la pausa' : 'derivación II') : pausing ? 'pausa' : S.pace.on ? (S.pace.capture ? 'estimulado' : 'marcapasos sin captura') : rhyLab(r) || 'sinusal');
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
    cp.textContent = (c.comp === 'off' ? 'SIN COMPRESIONES' : `${MONS[$('#monSel').value].cpr}: ${c.paused ? 'PAUSA para ventilar · ' : ''}${c.ratio ? c.ratio + ':2 · ' : ''}${c.comp === 'mech' ? 102 : 110 + Math.round(Math.sin(S.t / 5) * 4)}/min · profundidad ${fmt(c.comp === 'mech' ? 5.3 : 5.8 * q / .92, 1)} cm` + (c.comp === 'manual' ? ` · relevo hace ${fmt(c.relevo, 1)} min` : ' · compresor')) + ` · fracción ${fmt(frac * 100)} % · descargas ${track.shocks}`;
  } else cp.hidden = true;
  const o = S.o2, useful = Math.max(0, (o.bar - 20) * o.vol), own = S.dev.pneumatic && (S.iface === 'tube' || S.iface === 'mask') && !ventOffNow() ? .3 : 0, cons = o.cons + own, aut = cons > .05 ? useful / cons : null;
  const g = $('#o2Gauge'); g.firstElementChild.style.width = clamp(o.bar / 200 * 100, 0, 100) + '%';
  g.className = 'gauge' + (!o.supply || o.bar < 20 ? ' bad' : aut != null && aut < 30 ? ' warn' : '');
  const what = S.iface === 'o2' ? O2LAB[S.cfg.o2dev] : S.iface === 'nasal' ? 'alto flujo' : S.iface === 'mask' ? 'VMNI, fuga incluida' : S.dev.pneumatic ? 'equipo neumático' : 'mezcla de la turbina';
  $('#o2Txt').textContent = `${fmt(o.bar)} bar · botella de ${o.vol} L · consumo ${fmt(cons, 1)} L/min (${what}) · ` + (o.supply ? (aut != null ? `autonomía ≈ ${fmt(aut)} min (reserva 20 bar)` : 'autonomía amplia') : S.dev.pneumatic && (S.iface === 'tube' || S.iface === 'mask') ? 'vacía: el equipo neumático se para' : 'vacía: sin O₂');
  const pill = $('#o2Pill'); pill.textContent = o.supply ? 'suministro OK' : 'sin O₂'; pill.className = 'chip ' + (o.supply ? 'ok' : 'off');
  const c = CASES[caseKey];
  for (const k in (c.targets || {})) { const e2 = $('#tg_' + k); if (!e2) continue; const v0 = TGT[k].get(), rg = c.targets[k], v = v0 == null || TGT[k].fmt ? v0 : +(+v0).toFixed(TGT[k].d); e2.className = 'chip ' + (v == null || !isFinite(v) ? '' : (v >= rg[0] && v <= rg[1]) ? 'ok' : 'off'); }
  const s = Math.round(S.clin * 60); $('#clock').textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(x => String(x).padStart(2, '0')).join(':');
  drawSpark();
  return a;
}

/* ---------- lectura ---------- */
function neoReadings(out, c) { // v1.9: algoritmo de reanimación neonatal (ERC 2021); v1.12: prematuro y transporte neonatal
  const nn = S.neo, min = S.clin + nn.t0, sp = S.spo2 * 100, pr = nn.prem && nn.prem < 32, late = nn.t0 > 30, pIns = pr ? 25 : 30;
  const tgt = late ? 90 : min < 3 ? 65 : min < 4 ? 70 : min < 5 ? 80 : min < 10 ? 85 : 90, sup = S.bag || nn.cpap;
  if (!S.warm) out.push(['warn', late ? 'Incubadora sin encender' : pr ? 'Calor' : 'Sécalo y abrígalo', late ? 'Se enfría durante el traslado.' : pr ? `Prematuro de ${nn.prem} semanas: pierde calor muy rápido.` : 'Mojado: pierde calor muy rápido.', late ? 'Enciende y precalienta la incubadora de transporte, con nido y gorro, y ajústala a su temperatura axilar (objetivo 36,5–37,5 °C); temperatura cada 15–30 min.' : pr ? 'Gorro y calor radiante, con el habitáculo a 25 °C o más; no lo seques si va en bolsa.' : 'Secar estimulando, retirar la toalla mojada, gorro y calor (bolsa de plástico en el prematuro).']);
  if (pr && !late && !S.plast) out.push(['warn', 'Bolsa de plástico', `Prematuro de ${nn.prem} semanas: piel fina, pierde calor por evaporación.`, 'Sin secarlo, métele en una bolsa de polietileno hasta el cuello y ponle gorro.']);
  if (nn.apnea && !S.bag) out.push(['bad', 'No respira', `FC ≈ ${fmt(Math.round(nn.hr / 10) * 10)} lpm.`, `Vía aérea en posición neutra y 5 insuflaciones de 2–3 s a ${pIns} cmH₂O${nn.prem ? ' con PEEP 5–6' : ''}.`]);
  if (S.bag && nn.infl === 0 && nn.aer < .5) out.push(['warn', 'Faltan las insuflaciones iniciales', 'El pulmón aún está lleno de líquido.', `5 insuflaciones de 2–3 s a ${pIns} cmH₂O antes de ventilar a 30/min.`]);
  if (nn.prem && !nn.apnea && !sup && nn.aer < .75) out.push([sp < tgt - 10 ? 'bad' : 'warn', 'Dificultad respiratoria del prematuro', `Quejido, aleteo y tiraje; SpO₂ ${fmt(sp)} %.`, `CPAP con pieza en T y mascarilla a 5–8 cmH₂O${pr && nn.prem < 28 ? ' con FiO₂ 30 %' : ''}; si deja de respirar o la FC baja de 100, ventila con PEEP.`]);
  if (pr && !late && min < 3 && c.fio2 < 30 && nn.prem < 28) out.push(['warn', 'FiO₂ inicial', `${fmt(c.fio2)} % en un prematuro de ${nn.prem} semanas.`, '< 28 semanas: empieza con FiO₂ 30 % (28–31 semanas, 21–30 %) y ajústala a la SpO₂ de cada minuto.']);
  if (S.bag && nn.obs > .35) out.push(['bad', 'El tórax no se mueve', 'Las insuflaciones no entran.', 'Corrige la ventilación: posición neutra, sellado a dos manos y tracción mandibular, aspira boca y nariz, abre la boca, sube la presión; si no, supraglótico o tubo. Después, repite las 5 insuflaciones.']);
  else if (nn.hr < 60 && S.bag && nn.aer > .6 && !nn.comp) out.push(['bad', 'FC < 60 con ventilación eficaz', `FC ≈ ${fmt(Math.round(nn.hr / 10) * 10)} lpm con el tórax moviéndose.`, 'Compresiones 3:1 (90 compresiones y 30 insuflaciones por minuto) con FiO₂ 100 %; reevalúa cada 30 s.']);
  if (S.bag && pr && nn.pip >= 30 && nn.obs <= .35) out.push(['warn', 'Presión alta para un prematuro', `PIP ${fmt(nn.pip)} cmH₂O.`, 'Si el tórax se mueve, ventila con 20–25 cmH₂O: más presión daña el pulmón inmaduro.']);
  if (nn.comp && nn.hr >= 60) out.push(['warn', 'FC por encima de 60', `FC ≈ ${fmt(Math.round(nn.hr / 10) * 10)} lpm.`, 'Para las compresiones y sigue ventilando.']);
  if (nn.comp && nn.hr < 60 && nn.compT > .5) out.push(['bad', 'Sigue por debajo de 60', 'Con compresiones y ventilación eficaz.', !S.access ? 'Catéter venoso umbilical (o intraósea) y adrenalina 20 mcg/kg; volumen 10 mL/kg si hay pérdida de sangre.' : `Adrenalina 20 mcg/kg IV (${fmt(.02 * peso * 1000)} mcg) cada 3–5 min; volumen 10 mL/kg; descarta neumotórax.`]);
  if (nn.comp && c.fio2 < 100) out.push(['warn', 'FiO₂ durante las compresiones', `${fmt(c.fio2)} %.`, 'Con compresiones, FiO₂ 100 %.']);
  if (S.ptxActive && S.ptx > .3) out.push(['bad', 'Desaturación brusca con asimetría torácica', `SpO₂ ${fmt(sp)} % y FC ≈ ${fmt(Math.round(nn.hr / 10) * 10)} lpm${nn.cpap || S.bag ? ' con presión positiva' : ''}.`, 'Neumotórax a tensión: transiluminación o ecografía si da tiempo; punción con catéter de 22–24 G en el 2.º espacio intercostal, línea medioclavicular, y después drenaje.']);
  else if (!nn.comp && sup && nn.hr >= 60 && sp < tgt - 5 && c.fio2 < 100) out.push(['warn', 'SpO₂ por debajo del objetivo', `SpO₂ ${fmt(sp)} % ${late ? '(objetivo 90–95 %)' : `en el minuto ${fmt(Math.floor(min))} (objetivo ≈ ${tgt} %)`}.`, nn.prem && nn.peep < 7 && c.fio2 >= 30 ? `Comprueba el sellado y sube la PEEP a ${nn.peep + 1}–8 cmH₂O antes que la FiO₂.` : 'Comprueba que el tórax se mueve y sube la FiO₂ de 10 en 10 o de 20 en 20.']);
  if (!nn.comp && sp > 95 && c.fio2 > 21) out.push(['warn', 'Hiperoxia', `SpO₂ ${fmt(sp)} % con FiO₂ ${fmt(c.fio2)} %.`, `Baja la FiO₂: el exceso de oxígeno daña al recién nacido${nn.prem ? ' y, en el prematuro, la retina y el pulmón (objetivo 90–95 %)' : ''}.`]);
  if (!nn.apnea && nn.hr > 100 && S.bag && nn.firstBreath != null && S.clin - nn.firstBreath > .5) out.push(['warn', 'Respira solo', 'FC > 100 y respiraciones eficaces.', nn.prem ? 'Deja de ventilar y mantén la CPAP a 5–8 cmH₂O.' : 'Deja de ventilar y vigila; piel con piel con la madre si es posible.']);
  if (S.temp < 36.5 && track.tempAt != null) out.push(['warn', 'Hipotermia', `${fmt(S.temp, 1)} °C.`, late ? 'Sube la temperatura de la incubadora, nido y gorro; no la abras más de lo imprescindible.' : nn.prem ? 'Bolsa de plástico, gorro, calor radiante y habitáculo a 25 °C o más.' : 'Calor: piel con piel, gorro, mantas precalentadas y habitáculo caliente.']);
  if (S.temp > 37.5 && track.tempAt != null) out.push(['warn', 'Hipertermia', `${fmt(S.temp, 1)} °C.`, 'Baja el calor: objetivo 36,5–37,5 °C.']);
  if (track.gluAt == null && (late ? S.clin > 1 : nn.prem ? S.clin > 3 : nn.hr100 != null && min > 8)) out.push(['warn', 'Glucemia', late ? 'Antes de salir y durante el traslado.' : nn.prem ? 'El prematuro tiene muy poca reserva de glucógeno.' : 'Tras la reanimación.', 'Glucemia capilar; si < 45 mg/dL, glucosa 10 % 2 mL/kg.']);
  if (track.gluVal != null && track.gluVal < 45 && S.clin - track.gluAt < 15) out.push(['bad', 'Hipoglucemia', `Glucemia ${fmt(track.gluVal)} mg/dL.`, S.access ? `G10 % 2 mL/kg (${fmt(2 * peso, 1)} mL) en 5–10 min y perfusión de G10 % a 3 mL/kg/h (${fmt(3 * peso, 1)} mL/h, ≈ 5 mg/kg/min); repite la glucemia a los 30 min.` : 'Catéter venoso umbilical o intraósea; después, G10 % 2 mL/kg y perfusión a 3 mL/kg/h.']);
  else if (nn.prem && track.gluAt != null && !S.gluPerf) out.push(['warn', 'Sin aporte de glucosa', 'El prematuro no tiene reservas y la glucemia caerá.', S.access ? `Perfusión de G10 % a 3 mL/kg/h (${fmt(3 * peso, 1)} mL/h, ≈ 5 mg/kg/min) sin interrupciones.` : 'Catéter venoso umbilical o intraósea y perfusión de G10 % a 3 mL/kg/h.']);
  return out;
}
function readings() {
  const out = [];
  if (S.neo) neoReadings(out, S.cfg); else readingsMain(out);
  if (!out.length) out.push(S.neo ? ['ok', 'Sin problemas detectados', 'FC, SpO₂ y temperatura en objetivo.', 'Sigue vigilando la FC, la respiración y la temperatura.'] : ['ok', 'Sin problemas detectados', 'Parámetros dentro de rangos razonables.', 'Sigue vigilando EtCO₂, SpO₂ y TA.']);
  lastReads = out.slice(0, 6);
  $('#readList').innerHTML = out.slice(0, 6).map(([l, t, dd, f]) => `<div class="ri ${l}"><b>${t}</b><p>${dd}</p><p class="fix">→ ${f}${l !== 'ok' && whereOf(f + ' ' + t).length ? ` <button class="wbtn" data-where="${encodeURIComponent(f + ' ' + t)}">Dónde</button>` : ''}</p></div>`).join('');
  coachUpdate();
}
function readingsMain(out) {
  const c = S.cfg, P = VMI.PHENO[S.pk], ifc = S.iface, mask = ifc === 'mask', tube = ifc === 'tube', off = ventOffNow(), vent = (tube || mask) && !off, d = devOf();
  const pniS = pni && pni.sys != null && S.clin - pni.at < 15 ? pni.sys : null;
  if (S.arrest) {
    const cp = S.cpr, shock = S.rhythm === 'vf' || S.rhythm === 'tvsp';
    if (cp.comp === 'off' && !resume) out.push(['bad', 'Parada sin compresiones', `Tiempo total sin flujo: ${fmt(cp.noFlow, 1)} min.`, 'Compresiones ya, manuales o con el compresor. Minimiza las pausas.']);
    if (shock && (track.lastShock == null || S.clin - track.lastShock > 2.2)) out.push(['bad', 'Ritmo desfibrilable', 'FV o TV sin pulso en el monitor.', syncOn ? 'Desactiva SINC: en FV no hay onda R y el equipo no descargará.' : `Carga mientras se comprime, descarga ${isPed() ? `4 J/kg (≈ ${fmt(4 * peso)} J)` : '150–200 J'} y reanuda las compresiones sin comprobar pulso.`]);
    if (cp.comp === 'manual' && cp.relevo > 2) out.push(['warn', 'Compresor cansado', `${fmt(cp.relevo, 1)} min sin relevo: la calidad cae.`, 'Relevo cada 2 min, aprovechando el análisis, o compresor mecánico.']);
    const lastAdr = track.adr.length ? S.clin - track.adr[track.adr.length - 1] : null;
    const adrTxt = isPed() ? `Adrenalina 10 mcg/kg (${fmt(Math.min(1, .01 * peso), 2)} mg)` : 'Adrenalina 1 mg';
    if (S.temp < 30) out.push(['bad', 'Parada en hipotermia < 30 °C', `Temperatura ≈ ${track.tempAt != null ? fmt(S.temp, 1) + ' °C' : 'sin medir'}.`, 'Hasta 3 descargas y no más hasta superar 30 °C; sin adrenalina; compresor mecánico y traslado con RCP a un centro con ECMO.']);
    if (!S.access && !S.accessPend) out.push(['bad', 'Parada sin acceso vascular', 'No puedes dar adrenalina ni volumen.', 'Vía intraósea ya: es más rápida y segura que buscar una vena en la parada.']);
    if (!shock && S.temp >= 30 && (lastAdr == null || lastAdr > 5)) out.push(['warn', 'Adrenalina', lastAdr == null ? 'Aún no se ha dado.' : `Última dosis hace ${fmt(lastAdr)} min.`, `${adrTxt} cada 3–5 min; en ritmo no desfibrilable, cuanto antes.`]);
    if (shock && track.shocks >= 3 && (!track.amio && !track.lido || !S.cpr.ap)) out.push(['warn', 'FV refractaria', `${track.shocks} descargas sin éxito.`, `${!track.amio && !track.lido ? `${adrTxt} y ${isPed() ? 'amiodarona 5 mg/kg' : 'amiodarona 300 mg (o lidocaína 100 mg)'} tras la tercera descarga. ` : ''}${!S.cpr.ap ? 'Cambia los parches a anteroposterior en el próximo análisis (ERC 2025).' : ''}`]);
    const cprMode = d.modes.tube.find(x => x[0] === 'CPV' || x[0] === 'CPR_M'), inCpr = ['CPV', 'CPR_M'].includes(uMode(c)), hasCpv = !!cprMode;
    if (vent && tube && cp.comp !== 'off' && !inCpr && (hasCpv || !['VCV', 'APV'].includes(c.mode) || c.fr > 12 || c.trigI < 5 || c.peep > 5 || c.pmax < 55)) out.push(['warn', 'Ventilador no ajustado para la RCP', 'Las compresiones disparan ciclos o cortan por presión máxima.', hasCpv ? `Pasa a ${cprMode[1]}: 10 c/min, FiO₂ 100 %.` : `ERC 2025: ${modeLabel(d.modes.tube.some(x => x[0] === 'VCV') ? 'VCV' : 'APV', null, 'tube')} con 6–8 mL/kg, FR 10, PEEP 0–5, FiO₂ 100 %, trigger al máximo y alarma de presión alta en 60–70; o bolsa a 10/min.`]);
    if (cp.comp !== 'off' && tube && cp.ratio > 0) out.push(['warn', 'Pausas con vía aérea avanzada', `Compresiones ${cp.ratio}:2 con ${S.air.sga ? 'supraglótico' : 'tubo'}.`, 'Con vía aérea avanzada, compresiones continuas y 10 ventilaciones por minuto.']);
    else if (cp.comp !== 'off' && !tube && cp.ratio === 0 && S.bag) out.push(['warn', 'Sin vía aérea avanzada', 'Ventilar con bolsa durante compresiones continuas es poco eficaz.', `${isPed() ? '15:2' : '30:2'} con dos insuflaciones en cada pausa.`]);
    if (M.et != null && M.et < 10 && cp.comp !== 'off' && S.t > 10) out.push(['warn', 'EtCO₂ < 10 mmHg en RCP', 'Gasto cardiaco muy bajo o tubo mal colocado.', 'Mejora las compresiones y comprueba el tubo.']);
    const cause = { hypox: 'Hipoxia: oxigena y ventila con O₂ al 100 %; vía aérea.', ptx: 'Neumotórax a tensión: descomprime.', hypo: 'Hipovolemia: volumen.', opi: 'Opiáceos: naloxona y ventilación.', tep: 'TEP: fibrinólisis y RCP prolongada con compresor.', anaf: 'Anafilaxia: adrenalina y volumen a chorro.', co: 'CO e hipoxia: O₂ al 100 %.', vt: 'TV: desfibrila.', hyperk: 'Hiperpotasemia: cloruro cálcico 10 % 10 mL, insulina con glucosa y bicarbonato durante la RCP.', tca: 'Tricíclicos: bicarbonato 1–2 mEq/kg en bolo, repetible.', hypoT: 'Hipotermia: calentar en ECMO; RCP mecánica prolongada.', hypoglu: 'Hipoglucemia: glucosa IV/IO.' };
    const cz = [cp.cause, cp.cause2].filter(x => cause[x]).map(x => cause[x]).join(' ');
    if (cz) out.push(['warn', cp.cause2 ? 'Parada traumática: trata las causas' : 'Causa reversible probable', cp.cause2 ? 'Hipovolemia, oxigenación, neumotórax a tensión y taponamiento antes que la adrenalina.' : '4H y 4T.', cz]);
    if (cp.sinceCheck >= 2) out.push(['warn', 'Toca analizar', `${fmt(cp.sinceCheck, 1)} min desde el último análisis.`, 'Pausa breve (< 10 s) con «Comprobar pulso y ritmo» o con el DEA, relevo y descarga si procede.']);
    else out.push(['ok', 'Ciclo de RCP', `Próximo análisis en ${fmt(Math.max(0, 2 - cp.sinceCheck), 1)} min.`, 'Compresiones de calidad y mínimas pausas.']);
  }
  if (S.isr) out.push(['warn', 'Laringoscopia en curso', S.isr.apox ? 'Apnea con oxigenación apneica por gafas.' : 'El paciente está en apnea: la reserva de O₂ depende de la preoxigenación.', 'Al intubar, el ventilador quedará en espera: revisa los ajustes e inicia.']);
  if (!S.arrest && S.standby && tube && !S.bag && (S.pat.pmax <= 1 || S.relTot > .5)) out.push(['bad', 'Intubado y sin ventilar', 'El ventilador está en espera y el paciente no respira.', 'Pulsa «Iniciar ventilación» o ventila con ambú.']);
  if (!S.arrest && ((S.standby && S.iface !== 'o2') || S.isr) && Math.abs(devIbw() - S.ibw) > .12 * S.ibw) out.push(['warn', 'Datos del paciente en el equipo', `El ${d.short} calcula con ${devPat.sex === 'm' ? 'mujer' : 'varón'} de ${devPat.talla} cm (peso ideal ${fmt(devIbw())} kg); el paciente es ${S.P.sex === 'm' ? 'mujer' : 'varón'} de ${S.P.talla} cm (${fmt(S.ibw)} kg).`, 'Corrige sexo y talla en la pantalla de espera antes de elegir el preajuste.']);
  if (!S.arrest && S.standby && (mask || ifc === 'nasal')) out.push(['warn', 'Interfaz puesta, equipo en espera', 'La mascarilla o la cánula no aportan nada mientras el equipo no funciona.', 'Revisa los ajustes y pulsa «Iniciar ventilación».']);
  if (!S.arrest && S.relTot > .5 && S.sedTot < .4) out.push(['bad', 'Paralizado y despierto', 'Relajante sin hipnótico suficiente.', 'Inductor o sedación ya.']);
  if (!S.arrest && S.relTot > .6 && (ifc === 'o2' || ifc === 'nasal' || (S.standby && !tube)) && !S.isr && !S.bag) out.push(['bad', 'Paralizado sin ventilar', 'Apnea por el relajante.', track.attempts ? 'Oxigena con ambú o VMNI antes de reintentar.' : 'Intuba ya o ventila con ambú.']);
  if (!S.arrest && S.bag && S.bmv < .6 && (ifc === 'o2' || ifc === 'mask') && S.spo2 < .9 && !S.isr) out.push(['bad', 'No oxigenas con bolsa', `SpO₂ ${fmt(S.spo2 * 100)} % pese al ambú.`, 'Cánula orofaríngea y dos manos. Si no mejora: dispositivo supraglótico (plan B). Si tampoco: cricotiroidotomía (no intubable, no oxigenable).']);
  if (!S.arrest && track.attempts >= 2 && ifc !== 'tube' && !S.isr) out.push(['bad', 'Intubación difícil', `${track.attempts} intentos fallidos.`, S.davMul < 1 ? 'Si no oxigenas (SpO₂ cayendo pese a ambú o VMNI): cricotiroidotomía.' : 'Cambia de plan: videolaringoscopio y bougie; si no intubas ni oxigenas, cricotiroidotomía.']);
  if (!S.arrest && S.opi > .45 && !tube && (S.pat.pmax <= 1 || S.pat.rr < 10)) out.push(['bad', 'Depresión respiratoria por opiáceos', `FR ${fmt(S.pat.pmax > 1 ? S.pat.rr : 0)} rpm y miosis.`, 'Ambú con O₂ y naloxona 0,4 mg IV; repite cada 2–3 min hasta FR ≥ 10.']);
  else if (!S.arrest && track.nalox != null && S.E.nalox < .35 && S.opi > .3) out.push(['warn', 'Resedación', 'La naloxona se agota antes que el opiáceo.', 'Nueva dosis o perfusión, y vigilancia estrecha.']);
  if (!S.arrest && track.intubAt != null && S.clin - track.intubAt < 15 && S.tas < 90) out.push(['bad', 'Hipotensión tras la intubación', `TAS ${fmt(S.tas)} mmHg.`, 'Inductor y presión positiva sin precarga: volumen, noradrenalina o adrenalina en bolo de 10–20 mcg; revisa la PEEP.']);
  if (!S.arrest && S.arr.type && S.arr.type !== 'sbrady') {
    const unstable = S.tas < 90;
    out.push([unstable ? 'bad' : 'warn', RLAB[S.arr.type] + (unstable ? ' inestable' : ' estable'), `FC ${fmt(S.fc)} lpm, TAS ${fmt(S.tas)} mmHg.`, unstable ? `Cardioversión sincronizada con sedación: TSV o flutter 70–120 J; TV 120–150 J; FA a la energía máxima (${Math.max(...MONS[$('#monSel').value].energies)} J). Activa SINC antes de cargar.` : S.arr.type === 'tsv' ? 'Maniobras vagales y adenosina 6 → 12 → 18 mg.' : S.arr.type === 'tvp' ? 'Amiodarona 300 mg en 10–20 min con el desfibrilador preparado.' : 'Control de frecuencia; anticoagulación según tiempo de evolución.']);
  }
  if (!S.arrest && S.arr.type === 'sbrady') out.push(['bad', 'Bradicardia con bajo gasto', `FC ${fmt(S.fc)} lpm.`, 'Atropina 0,5 mg cada 3–5 min; si no responde, adrenalina 2–10 mcg/min o marcapasos.']);
  if (!S.arrest && S.pace.on && !S.pace.capture && !(S.pace.mode === 'demand' && (S.fcIntr || 0) >= S.pace.rate)) out.push(['warn', 'Marcapasos sin captura', `${S.pace.mA} mA no capturan.`, 'Sube de 10 en 10 mA hasta captura y pulso; deja 10 mA por encima del umbral.']);
  if (!S.arrest && S.pace.on && S.pace.capture && S.pace.mA >= 40 && S.sedTot < .3 && S.opi < .3) out.push(['warn', 'Marcapasos sin analgesia', 'La estimulación transcutánea duele.', 'Fentanilo y midazolam a dosis bajas.']);
  if (!S.arrest && S.bav && !S.pace.capture && S.fc < 45) out.push(['bad', 'BAV completo con bajo gasto', `FC ${fmt(S.fc)} lpm, escape de QRS ancho.`, 'Con QRS ancho la atropina no está indicada (ERC 2025): marcapasos transcutáneo o adrenalina 2–10 mcg/min.']);
  if (!S.arrest && S.stemi) {
    const m = S.stemi, decided = m.icp != null || S.E.tnk > .1 || (track.used && track.used.has('drug:tnk'));
    if (m.pci <= 120 && (S.E.tnk > .1 || (track.used && track.used.has('drug:tnk')))) out.push(['warn', 'Fibrinólisis con ICP a tiempo', `La hemodinámica está a ${m.pci} min.`, 'Con la ICP primaria a menos de 120 min, la estrategia es ICP primaria; la fibrinólisis añade riesgo de sangrado sin beneficio. Activa el código infarto.']);
    if (track.ecg12At == null) out.push(['bad', 'Dolor torácico', 'Puede ser un síndrome coronario agudo.', 'ECG de 12 derivaciones en menos de 10 minutos.']);
    else if (!decided) out.push(['bad', 'SCACEST ' + { ant: 'anterior', inf: 'inferior', lat: 'lateral' }[m.loc], 'Elevación del ST en el ECG de 12 derivaciones' + (m.rv ? ' con afectación del VD' : '') + '.', 'Decide la reperfusión ya: ICP primaria si llega a hemodinámica en ≤ 120 min; si no, fibrinólisis en < 10 min (tenecteplasa por peso) y traslado a un centro con ICP.']);
    if (track.ecg12At != null && !(track.used && track.used.has('drug:aas'))) out.push(['warn', 'Antiagregación', 'Aún sin AAS.', 'AAS 150–300 mg masticado (o IV) y anticoagulación (heparina o enoxaparina).']);
    if (m.rv && S.E.ntg > .1) out.push(['bad', 'Nitratos con infarto de VD', `TAS ${fmt(S.tas)} mmHg.`, 'Suspende los nitratos y da volumen: el VD depende de la precarga.']);
  }
  if (!S.arrest && S.vaso > .2 && isPed()) { const pnS = VMI.pedNorms(S.age || 0), vaso = (perfNowOf('adrIkg') || perfNowOf('nor')) > 0, over = (S.fluidKg || 0) > S.fluidTol + 5; // v1.13: shock séptico pediátrico
    const shockS = S.fc > pnS.fc[1] || S.tas < pnS.tasMin + 10 || S.lact > 2.5;
    if (shockS && !over && (S.fluidKg || 0) < 40) out.push(['bad', 'Shock séptico', `FC ${fmt(S.fc)}, TAS ${fmt(S.tas)}; relleno lento y extremidades frías.`, `${!S.access ? 'Intraósea si la vena no sale a la primera; después, ' : ''}bolo de 10 mL/kg (${fmt(10 * peso)} mL) en 5–10 min y reevalúa tras cada uno (FC, relleno, conciencia, crepitantes, hígado). Llevas ${fmt(S.fluidKg || 0)} mL/kg.`]);
    else if (shockS && !vaso) out.push(['bad', 'Shock refractario a volumen', `${fmt(S.fluidKg || 0)} mL/kg${over ? ' y ya hay sobrecarga' : ''}.`, 'Adrenalina 0,05–0,3 mcg/kg/min (o noradrenalina si es un shock caliente) por vía periférica o intraósea, sin esperar a una vía central.']);
    if (!(track.used && track.used.has('drug:atb'))) out.push(['warn', 'Sepsis sin antibiótico', 'En el shock séptico, en la primera hora.', `Ceftriaxona 80–100 mg/kg (≈ ${fmt(Math.min(2000, 80 * peso))} mg; máx. 2 g) IV o IO.`]);
    if (track.gluAt == null) out.push(['warn', 'Glucemia', 'El niño en shock se hipoglucemia con facilidad.', 'Glucemia capilar.']); }
  else if (!S.arrest && S.vaso > .2) {
    if (S.pam < 65) out.push(['bad', 'Shock distributivo', `PAM ≈ ${fmt(S.pam)} mmHg con piel caliente y diastólica baja.`, (S.fluidKg || 0) < 25 ? 'Cristaloide en bolos de 500 mL reevaluando (hasta ≈ 30 mL/kg) y noradrenalina si la PAM sigue < 65; no esperes a terminar el volumen.' : 'Ya lleva volumen: noradrenalina para PAM ≥ 65 (por vía periférica es seguro un tiempo).']);
    if (!(track.used && track.used.has('drug:atb'))) out.push(['warn', 'Sepsis sin antibiótico', 'Cada hora de retraso empeora el pronóstico en el shock séptico.', 'Antibiótico IV en la primera hora: ceftriaxona 2 g si el foco es urinario o respiratorio comunitario.']);
  }
  if (!S.arrest && (S.fluidKg || 0) > S.fluidTol + 5) out.push(['warn', 'Sobrecarga de volumen', isPed() ? 'Crepitantes nuevos, hígado que crece y más necesidad de O₂.' : 'Crepitantes nuevos y peor oxigenación.', isPed() ? 'No más bolos: adrenalina o noradrenalina para la perfusión y alto flujo o CPAP si hace falta.' : 'No más volumen: noradrenalina para la PAM y O₂ o VMNI si hace falta.']);
  if (!S.arrest && S.neurog > .2 && S.pam < 80) out.push(['bad', 'Shock neurogénico', `PAM ≈ ${fmt(S.pam)} con FC ${fmt(S.fc)} y piel caliente.`, 'Descarta la hemorragia; volumen prudente, atropina si FC < 50 y noradrenalina para PAM ≥ 80–85.']);
  if (!S.arrest && S.tamp > .35 && S.tas < 100) out.push(['bad', 'Shock obstructivo', 'Hipotensión con ingurgitación yugular y tonos apagados.', 'Ecografía clínica; si hay taponamiento, volumen y pericardiocentesis. Evita intubar y la PEEP alta.']);
  if (!S.arrest && S.tep > .3) out.push(['warn', 'Patrón de TEP', `EtCO₂ ${fmt(M.et)} frente a PaCO₂ ≈ ${fmt(S.pco2)} mmHg: espacio muerto.`, 'Noradrenalina para TAS ≥ 90, volumen prudente, PEEP baja y fibrinólisis si es de alto riesgo.']);
  if (!S.arrest && S.anaf > .2) out.push([S.tas < (isPed() ? VMI.pedNorms(S.age || 0).tasMin : 90) ? 'bad' : 'warn', 'Anafilaxia activa', `TAS ${fmt(S.tas)}, broncoespasmo y angioedema.`, `Adrenalina IM ${isPed() ? fmt(Math.min(.5, .01 * peso), 2) + ' mg (0,01 mg/kg)' : '0,5 mg'} en el muslo (repite a los 5 min), volumen${isPed() ? ' 10 mL/kg' : ''}; perfusión de adrenalina si es refractaria.`]);
  const seizing = S.clin < S.seizUntil;
  if (!S.arrest && seizing && !S.se) out.push(['bad', 'Convulsión', 'Crisis tónico-clónica activa.', S.ecl ? 'Sulfato de magnesio 4 g IV (si no lo lleva) y midazolam si no cede; O₂ y lateral izquierdo.' : `Midazolam ${S.access ? 'IV 2–5 mg' : 'intranasal o bucal 10 mg (0,3 mg/kg)'}; O₂ y vía aérea. Glucemia.`]);
  if (!S.arrest && !S.access && !S.accessPend && (S.tas < 90 || S.gcs <= 12 || S.bleed > 0 || seizing)) out.push(['warn', 'Sin acceso vascular', 'Lo vas a necesitar para fármacos y volumen.', 'Vía venosa periférica; si fallan dos intentos o es urgente, intraósea.']);
  if (!S.arrest && S.gcs <= 13 && S.relTot < .5 && (track.gluAt == null || S.clin - track.gluAt > 20)) out.push(['warn', 'Bajo nivel de conciencia', `GCS ≈ ${S.gcs}.`, 'Glucemia capilar: la hipoglucemia es la causa más fácil de corregir.']);
  if (!S.arrest && track.gluVal != null && track.gluVal < 70 && S.clin - track.gluAt < 15) out.push(['bad', 'Hipoglucemia', `Glucemia ${fmt(track.gluVal)} mg/dL.`, S.access ? `Glucosa ${isPed() ? '0,2 g/kg' : '10–25 g'} IV y repite la glucemia a los 10–15 min; si recurre, perfusión de glucosa al 10 %.` : 'Glucagón 1 mg IM mientras canalizas; con vía, glucosa IV.']);
  if (!S.arrest && (S.ecg.t > 1.8 || S.ecg.qrs > .12) && S.tca < .2 && !S.cocaine && S.E.ca < .3) out.push(['bad', 'T picudas y QRS ancho', `QRS ${fmt(S.ecg.qrs * 1000)} ms con bradicardia: sospecha de hiperpotasemia.`, 'Cloruro cálcico 10 % 10 mL ya (estabiliza la membrana); después insulina con glucosa y salbutamol; bicarbonato si hay acidosis.']);
  else if (!S.arrest && S.k > 6.5 && S.E.ins < .3 && S.E.ca >= .3) out.push(['warn', 'Potasio aún alto', 'El calcio protege unos 30–60 min, pero no baja el potasio.', 'Insulina 10 UI con 25 g de glucosa y salbutamol nebulizado; diálisis.']);
  if (!S.arrest && S.tca > .2 && S.ecg.qrs > .12) out.push(['bad', 'QRS ancho en intoxicación', `QRS ${fmt(S.ecg.qrs * 1000)} ms.`, 'Bicarbonato 1 M 1–2 mEq/kg en bolo, repetible hasta QRS < 120 ms y pH 7,45–7,55. Evita la amiodarona.']);
  if (!S.arrest && S.temp < 35 && track.tempAt == null) out.push(['warn', 'Paciente frío', 'Al tacto está muy frío.', 'Mide la temperatura y aísla del frío.']);
  else if (!S.arrest && S.temp < 32) out.push(['bad', 'Hipotermia grave', `${fmt(S.temp, 1)} °C: riesgo de FV al movilizar.`, `${S.warm ? '' : 'Quita la ropa mojada, aísla y calor activo. '}Manejo cuidadoso y horizontal; traslado a un centro con ECMO.`]);
  if (!S.arrest && S.bleed > 0 && !S.hemo && S.bleedSrc && S.bleedSrc !== 'thor') out.push(['bad', 'Sangrado activo', S.bleedSrc === 'ext' ? 'Hemorragia externa en el muslo.' : S.bleedSrc === 'pelv' ? 'Pelvis inestable: sangrado retroperitoneal.' : S.bleedSrc === 'uter' ? 'Atonía uterina.' : 'Sangrado interno.', HEMOLAB[S.bleedSrc] + (S.bleedSrc === 'uter' ? ' y oxitocina 10 UI.' : ' ya.')]);
  if (!S.arrest && S.bleed > 0 && S.E.txa < .3) out.push(['warn', 'Ácido tranexámico', 'Hemorragia en la primera hora.', 'Ácido tranexámico 1 g IV (15 mg/kg en niños) en 10 min.']);
  if (!S.arrest && S.bleed > 0 && pniS != null && pniS > 110 && track.fluidMl >= 1000) out.push(['warn', 'Hipotensión permisiva', `PNI ${fmt(pniS)} mmHg tras ${fmt(track.fluidMl)} mL.`, 'Sin TCE, TAS 80–90 basta hasta la hemostasia: más volumen sube la TA, diluye y aumenta el sangrado.']);
  // v1.6: trauma torácico, dolor y quemado
  if (!S.arrest && S.htx > .3) out.push(['bad', 'Hemotórax', `Hemitórax derecho mate e hipoventilado${S.tas < 90 ? ', con shock' : ''}.`, 'Drenaje torácico en el 5.º espacio, línea medioaxilar, con sangre preparada; avisa a cirugía torácica.']);
  if (!S.arrest && S.bleedSrc === 'thor' && S.drained) { const mlh = (S.bleedNow || 0) * 240000; if ((S.htxFirst || 0) >= 1500 || mlh > 200) out.push(['bad', 'Criterio de toracotomía', (S.htxFirst || 0) >= 1500 ? `${fmt(S.htxFirst)} mL al colocar el drenaje.` : `Drena ≈ ${fmt(Math.round(mlh / 50) * 50)} mL/h.`, 'Avisa al hospital para ir directo a quirófano; tranexámico, sangre e hipotensión permisiva hasta entonces.']); }
  if (!S.arrest && S.flail && S.painEff > .4) out.push(['bad', 'El dolor no le deja respirar', 'Volet costal: respira rápido y superficial.', 'Analgesia potente ya: ketamina 0,3 mg/kg o fentanilo 1 mcg/kg, repetida según respuesta.']);
  else if (!S.arrest && S.flail && S.spo2 < .92 && !tube && ifc !== 'mask') out.push(['warn', 'Hipoxemia por contusión pulmonar', `SpO₂ ${fmt(S.spo2 * 100)} % con O₂.`, 'Descarta el neumotórax y valora VMNI: PEEP 6–8 con soporte bajo estabiliza el volet y recluta la contusión.']);
  else if (!S.arrest && S.painEff > .5) out.push(['warn', 'Dolor sin controlar', 'EVA 8–9/10: taquicardia e hipertensión por dolor.', `Analgesia: fentanilo 1 mcg/kg, ketamina 0,3 mg/kg${S.tas < 100 ? ' (mejor en el hipotenso)' : ''} o morfina en bolos de 2–3 mg.`]);
  if (!S.arrest && S.burn > 0) { const rate = !isPed() || peso >= 45 ? 500 : peso >= 20 ? 250 : 125;
    if (S.burn >= (isPed() ? 10 : 20) && !(S.fluidRate > 0)) out.push(['bad', 'Gran quemado sin fluidos', `≈ ${fmt(S.burn)} % de superficie corporal quemada.`, `Cristaloide balanceado en bomba a ${rate} mL/h hasta que se calcule en el hospital (2 mL/kg/% en 24 h).`]);
    else if (S.fluidRate > rate * 1.6) out.push(['warn', 'Demasiado ritmo de fluidos', `${fmt(S.fluidRate)} mL/h.`, `En la fase prehospitalaria bastan ${rate} mL/h: el exceso da edema, síndrome compartimental y peor vía aérea.`]);
    if (!S.warm) out.push(['warn', 'Quemado sin aislar del frío', 'Pierde calor por la piel quemada y mojada.', 'Sábanas limpias y secas, manta térmica y habitáculo caliente; no sigas enfriando.']); }
  // v1.10: ambiental
  if (!S.arrest && S.temp > 40 && !S.cool) out.push(['bad', 'Hipertermia grave', track.tempAt != null ? `${fmt(S.temp, 1)} °C.` : 'Piel muy caliente, confuso.', 'Enfriamiento activo ya: desnudar, agua pulverizada con ventilación, hielo en cuello, axilas e ingles y suero frío. Los antitérmicos no sirven.']);
  if (!S.arrest && S.cool && S.temp < 38.6) out.push(['warn', 'Para el enfriamiento', `${fmt(S.temp, 1)} °C.`, 'Entre 38,5 y 39 °C, retira el enfriamiento activo para no provocar hipotermia.']);
  if (!S.arrest && S.dci && S.dciE > .2) {
    if (S.fiEff < .7) out.push(['bad', 'Enfermedad descompresiva sin O₂ al 100 %', 'El O₂ lava el nitrógeno y encoge las burbujas.', 'Máxima FiO₂ posible: mascarilla con reservorio a 15 L/min bien ajustada, aunque la SpO₂ sea normal.']);
    if (S.altitude > 300) out.push(['bad', 'Altitud de cabina', `${fmt(S.altitude)} m: por Boyle las burbujas crecen × ${fmt(760 / S.pbar, 2)}.`, 'Pide al piloto la cota más baja posible (≤ 300 m) o cabina presurizada.']);
    if ((S.fluidKg || 0) < 8 && !(S.fluidRate > 0)) out.push(['warn', 'Volumen', 'La deshidratación empeora la descompresión.', 'Cristaloide 1 L IV (o líquidos orales si está consciente y sin náuseas).']); }
  if (!S.arrest && (S.asp > .3 || S.drown > .3) && ifc === 'o2' && S.spo2 < .92) out.push(['bad', 'Hipoxemia con crepitantes', `SpO₂ ${fmt(S.spo2 * 100)} % con ${O2LAB[c.o2dev] || 'O₂'}.`, 'Agua o contenido en el alveolo: VMNI con PEEP 8–10 y FiO₂ alta si está consciente y protege la vía aérea; si no, intubación.']);
  // v1.8: tóxicos y cetoacidosis
  if (!S.arrest && S.cv && S.cvT > .35) { const bb = S.cv.type === 'bb', hd = (S.E.insHD || 0) > .2;
    out.push(['bad', bb ? 'Intoxicación por betabloqueante' : 'Intoxicación por calcioantagonista', `FC ${fmt(S.fc)} y TAS ${fmt(S.tas)}${!bb && track.gluAt != null ? ` con glucemia de ${fmt(S.glu)} mg/dL (la hiperglucemia marca la gravedad)` : ''}.`, !hd ? (bb ? 'Glucagón 5 mg IV (50 mcg/kg) y perfusión de 2–5 mg/h; si no responde, insulina a dosis altas. ' : 'Cloruro cálcico 10 % 10–20 mL e insulina a dosis altas: 1 UI/kg en bolo y 1 UI/kg/h, con glucosa. ') + 'Noradrenalina o adrenalina y marcapasos si no responde.' : 'La insulina tarda 15–30 min: sostén con vasopresor, calcio y marcapasos; emulsión lipídica o ECMO como rescate.']); }
  if (!S.arrest && (S.E.insHD || 0) > .2 && S.glu < 100) out.push(['bad', 'Hipoglucemia por la insulina', `${fmt(S.glu)} mg/dL.`, 'Glucosa 10 % en perfusión (y bolo si < 70); glucemia cada 15 min.']);
  if (!S.arrest && track.gasAt != null && ((S.E.insHD || 0) > .2 || (S.E.ins || 0) > .3) && S.k < 3.3) out.push(['warn', 'Potasio bajo con insulina', `K⁺ ${fmt(S.k, 1)} mmol/L.`, 'La insulina mete el potasio en la célula: repónlo antes de seguir subiéndola.']);
  if (!S.arrest && S.op > .15) {
    if (!S.decont) out.push(['bad', 'Riesgo para el equipo', 'Ropa y piel impregnadas de organofosforado: sigue absorbiéndose.', 'Guantes y protección; retira la ropa y lava la piel (Descontaminar).']);
    if (S.opM > .2) out.push(['bad', 'Síndrome colinérgico sin atropinizar', `FC ${fmt(S.fc)}, broncorrea, SpO₂ ${fmt(S.spo2 * 100)} %.`, 'Atropina 2 mg IV doblando la dosis cada 5 min (2, 4, 8, 16…) hasta tórax seco, FC > 80 y TAS > 80; la miosis no es el objetivo.']);
    else if (+($('#pf_atrP') || {}).value === 0 || !$('#pf_atrP')) out.push(['warn', 'Atropinizado', 'Tórax seco y FC por encima de 80.', 'Mantén la atropinización: perfusión del 10–20 % de la dosis total por hora.']);
    if (S.opN > .3 && (S.E.prali || 0) < .2) out.push(['warn', 'Debilidad nicotínica', 'La atropina no la corrige: puede acabar en parada respiratoria.', 'Pre-aviso al hospital para la pralidoxima. Si hay que intubar: rocuronio, nunca succinilcolina.']); }
  if (!S.arrest && S.cocaine > 0) {
    if (S.cocE > .35) out.push(['bad', 'Síndrome simpaticomimético', `FC ${fmt(S.fc)} y TAS ${fmt(S.tas)}, agitado.`, `Benzodiacepinas primero y sin miedo: midazolam ${isPed() ? '0,2 mg/kg' : '5–10 mg'} IV o IM, repetible. Evita los betabloqueantes.`]);
    if (track.ecg12At == null && S.cocE > .2) out.push(['warn', 'Dolor torácico con cocaína', 'Puede haber isquemia por vasoespasmo.', 'ECG de 12 derivaciones; AAS y nitroglicerina si hay isquemia.']); }
    if (S.ecg.qrs > .12 && S.bicKg < .5) out.push(['warn', 'QRS ancho por cocaína', `QRS ${fmt(S.ecg.qrs * 1000)} ms: bloqueo de canales de sodio.`, 'Bicarbonato 1 M 1–2 mEq/kg si sigue ancho o hay arritmias.']);
  if (!S.arrest && S.dka) {
    if (track.gasAt != null && S.ph < 7.1 && tube) out.push(['bad', 'Acidemia grave en el intubado', `pH ${fmt(S.ph, 2)} con pCO₂ ${fmt(S.pco2)} mmHg.`, `Mantén su compensación: FR 26–30 y Vt 7–8 mL/kg para una pCO₂ de 20–25 (Winter: 1,5 × HCO₃⁻ + 8 ≈ ${fmt(1.5 * S.hco3m + 8)}); vigila la auto-PEEP.`]);
    if (track.gasAt == null) out.push(['warn', 'Cetoacidosis sin gasometría', 'Necesitas el pH, la pCO₂ y el potasio.', 'Gasometría venosa: guía la ventilación y si puedes empezar la insulina (K⁺ ≥ 3,3).']);
    if (S.ced) { const used = k => track.used && track.used.has(k), pnD = VMI.pedNorms(S.age || 0); // v1.13: cetoacidosis pediátrica y edema cerebral
      if (S.fluidKg < 9 && S.tas >= pnD.tasMin) out.push(['warn', 'Rehidratación prudente', 'Deshidratada, sin shock.', `Suero fisiológico 10 mL/kg (${fmt(10 * peso)} mL) en 30–60 min; después, el déficit en 48 h. Bolos de 10 mL/kg solo si hay shock.`]);
      if (S.fluidKg > 20) out.push(['warn', 'Demasiado volumen en la cetoacidosis', `${fmt(S.fluidKg)} mL/kg en poco tiempo.`, 'Más líquido rápido aumenta el riesgo de edema cerebral: para los bolos si no hay shock.']);
      if (used('drug:bic')) out.push(['bad', 'Bicarbonato en la cetoacidosis pediátrica', 'Se asocia a edema cerebral y no mejora el pronóstico.', 'No más bicarbonato: solo en la hiperpotasemia con riesgo vital.']);
      if (used('drug:ins')) out.push(['bad', 'Bolo de insulina', 'En el niño no se da bolo: más riesgo de edema cerebral e hipopotasemia.', 'Perfusión de 0,05–0,1 UI/kg/h, 1–2 h después de empezar los líquidos y con K⁺ ≥ 3,5.']);
      else if (S.E.ins > .1 && S.clin < 60) out.push(['warn', 'Insulina demasiado pronto', 'Se empieza 1–2 h después de los líquidos.', 'Detén la perfusión y deja que la inicie la UCI pediátrica, salvo indicación del pediatra.']);
      if (S.ced.on && S.icp && S.icp.v > 22 && S.E.manit < .2 && S.E.shs < .2) out.push(['bad', 'Edema cerebral', `Cefalea que empeora, vómitos y Glasgow ${fmt(S.gcs)}${S.icp.v > 35 ? `, con FC ${fmt(S.fc)} y TAS ${fmt(S.tas)} (Cushing)` : ''}.`, `Manitol 0,5–1 g/kg (${fmt(.5 * peso)}–${fmt(peso)} g) en 10–15 min o salino hipertónico 3 % 2,5–5 mL/kg (${fmt(2.5 * peso)}–${fmt(5 * peso)} mL); cabecero a 30°, reduce los líquidos y avisa. Si hay que intubar, mantén la hiperventilación que traía.`]);
      if (tube && S.pco2 > S.ced.pRef + 8) out.push(['bad', 'Normoventilada tras intubar', `pCO₂ ${fmt(S.pco2)} mmHg (traía ≈ ${fmt(S.ced.pRef)}).`, 'Sube la FR y el Vt hasta su pCO₂ previa: la subida del CO₂ empeora la acidosis y la presión intracraneal.']); }
    else if (S.fluidKg < 15 && !(S.fluidRate > 0)) out.push(['warn', 'Deshidratación', 'Déficit de agua de 5–8 L.', 'Cristaloide 500–1.000 mL/h la primera hora.']); }
  // v1.7: neurología y sodio
  if (!S.arrest && S.se && S.se.on && S.relTot > .6) out.push(['bad', 'Crisis que no se ve bajo el relajante', 'El rocuronio quita los movimientos, no la crisis: sigue taquicárdico, hipertenso y con midriasis.', 'Perfusión anestésica ya: propofol 2–4 mg/kg/h o midazolam 0,2 mg/kg/h.']);
  else if (!S.arrest && S.se && S.se.on) { const aed = (S.E.lev || 0) + (S.E.vpa || 0) > .3;
    out.push(['bad', 'Estatus epiléptico', `${fmt(S.se.since)} min de crisis: cada minuto las benzodiacepinas funcionan peor.`, S.E.mid < .3 ? `Midazolam ${isPed() ? fmt(Math.min(10, .2 * peso), 1) + ' mg (0,2 mg/kg)' : '10 mg'} IM o IV ya.` : !aed ? 'Segunda línea sin esperar: levetiracetam 60 mg/kg (máx. 4.500 mg) o valproato 40 mg/kg (máx. 3.000 mg) IV en 10 min.' : 'Refractario: ISR con propofol o midazolam y perfusión anestésica.']); }
  if (!S.arrest && S.se && !S.se.on && S.se.by === 'anes' && !tube) out.push(['warn', 'Crisis controlada con dosis anestésicas', 'Sin la vía aérea protegida.', 'ISR y perfusión anestésica: al bajar la dosis, el estatus refractario vuelve.']);
  if (!S.arrest && S.stroke) { const k = S.stroke, ta = pniS;
    if (k.type === 'isq') {
      if (k.code == null) out.push(['bad', 'Código ictus sin activar', `Déficit focal de ${fmt(k.onset + S.clin)} min de evolución; RACE ${sim.race()}.`, `Activa el código ictus con pre-aviso${sim.race() >= 5 ? ': RACE ≥ 5, hospital con trombectomía aunque haya otro más cerca' : ''}.`]);
      if (ta != null && ta > 185) out.push(['bad', 'TA por encima de 185/110', `PNI ${fmt(ta)} mmHg: así no puede recibir trombólisis.`, 'Labetalol 10–20 mg IV lento (o urapidilo 12,5–25 mg) hasta < 185/110, sin bajarla más de un 15 %.']);
      else if (ta != null && ta < 140) out.push(['warn', 'TA baja para la penumbra', `PNI ${fmt(ta)} mmHg.`, 'No más antihipertensivo: la penumbra depende de la presión. Cristaloide si la TAS baja de 120.']);
    } else {
      if (ta != null && ta > 160) out.push(['bad', 'TA alta en la hemorragia cerebral', `PNI ${fmt(ta)} mmHg: el hematoma crece.`, 'Labetalol 10–20 mg IV cada 10 min o urapidilo 12,5–25 mg (se pueden sumar) hasta TAS 140–160.']);
      else if (ta != null && ta < 130) out.push(['warn', 'TA demasiado baja', `PNI ${fmt(ta)} mmHg.`, 'No bajes de 130: menos presión es menos perfusión cerebral.']);
      if (S.gcs <= 8 && !tube) out.push(['bad', 'Deterioro neurológico', `GCS ${S.gcs}${k.vom ? ' y ha vomitado' : ''}.`, 'ISR para proteger la vía aérea, normocapnia (EtCO₂ 35–40) y aviso a neurocirugía.']);
    }
    if (track.gluAt != null && S.glu > 180) out.push(['warn', 'Hiperglucemia en el ictus', `${fmt(S.glu)} mg/dL.`, 'Sin sueros glucosados; objetivo 140–180 mg/dL.']);
    if ((S.E.aas || 0) > .05 || (S.E.hnf || 0) > .05 || (S.E.enox || 0) > .05) out.push(['bad', 'Antitrombótico antes de la TC', k.type === 'hem' ? 'Es una hemorragia.' : 'Puede ser una hemorragia.', 'Nada de AAS ni heparina antes de la TC.']);
    if (ifc === 'o2' && S.cfg.o2dev === 'reserv' && S.spo2 > .97) out.push(['warn', 'Oxígeno sin hipoxemia', `SpO₂ ${fmt(S.spo2 * 100)} %.`, 'En el ictus, O₂ solo si la SpO₂ baja de 94 %.']); }
  if (!S.arrest && S.na < 125) { const sym = S.gcs < 14 || S.clin < S.seizUntil;
    out.push([sym ? 'bad' : 'warn', 'Hiponatremia' + (sym ? ' sintomática' : ''), track.gasAt != null ? `Na⁺ ${fmt(S.na)} mmol/L.` : 'Mucha agua durante un esfuerzo largo, vómitos y confusión.', sym ? `Salino hipertónico 3 % ${isPed() ? fmt(Math.min(100, 2 * peso)) + ' mL (2 mL/kg)' : '100 mL'} en 10 min, repetible hasta 3 veces; sin sueros hipotónicos.` : 'Restricción de líquidos y control analítico.']); }
  if (!S.arrest && S.na - S.naMin > 8) out.push(['warn', 'Corrección rápida del sodio', `+${fmt(S.na - S.naMin)} mmol/L.`, 'Para el hipertónico: no más de 10 mmol/L en 24 h (riesgo de desmielinización osmótica).']);
  if (!S.arrest && S.na < 125 && track.fluidMl >= 500) out.push(['warn', 'Volumen en la hiponatremia', `${fmt(track.fluidMl)} mL de cristaloide.`, 'No corrige el sodio y aumenta el edema: restringe líquidos salvo shock.']);
  if (!S.arrest && S.ecl && S.E.mg < .5) out.push(['bad', 'Eclampsia sin magnesio', 'Riesgo alto de nuevas convulsiones.', 'Sulfato de magnesio 4 g IV en 15–20 min y perfusión de 1 g/h.']);
  if (!S.arrest && S.ecl && pniS != null && pniS >= 160) out.push(['warn', 'TA grave en la gestante', `PNI ${fmt(pniS)} mmHg.`, 'Labetalol 20 mg IV (repetible a los 10 min) o urapidilo, hasta 140–150.']);
  if (!S.arrest && S.croupEff > .4 && S.E.adrN < .3) out.push(['bad', 'Obstrucción de la vía aérea alta', 'Estridor en reposo y tiraje.', `Adrenalina nebulizada ${isPed() ? fmt(Math.min(5, .5 * peso), 1) + ' mg (0,5 mg/kg)' : '5 mg'} y dexametasona; no lo agites.`]);
  if (!S.arrest && S.postRosc && pniS != null && pniS < 100) out.push(['bad', 'TA baja tras la RCE', `PNI ${fmt(pniS)} mmHg: riesgo de nueva parada.`, 'Cristaloide y noradrenalina para TAS ≥ 100 (PAM ≥ 65).']);
  const pn = isPed() ? VMI.pedNorms(S.age || 0) : null;
  if (!S.arrest && isPed() && S.fc < 60 && (S.tas < pn.tasMin || S.spo2 < .9)) out.push(['bad', 'Bradicardia con mala perfusión', `FC ${fmt(S.fc)} lpm: en el niño es una parada inminente.`, 'Ventila con O₂ al 100 %; si sigue por debajo de 60 con mala perfusión, compresiones 15:2 y adrenalina 10 mcg/kg.']);
  if (!S.arrest && isPed() && tube && !ventOffNow() && c.mode !== 'PSV' && (c.fr < pn.vfr[0] - 4 || c.fr > pn.vfr[1] + 8)) out.push(['warn', 'FR para la edad', `FR ${fmt(c.fr)} rpm.`, `A esta edad, ${pn.vfr[0]}–${pn.vfr[1]} rpm; ajústala después por la EtCO₂.`]);
  if (!S.arrest && isPed() && tube && S.dev.vent === 'medumat' && c.mode === 'VCV' && peso < 15) out.push(['warn', 'Vt pequeño en el Medumat', 'El Vt se ajusta de 50 en 50 mL.', 'En el niño pequeño, ventila por presión (PCV) y vigila el Vt espirado.']);
  if (!S.arrest && isPed() && !tube && M.effN >= 2 && M.effRR > pn.fr[1] * 1.3) out.push(['warn', 'Taquipnea con trabajo respiratorio', `FR ${fmt(M.effRR)} rpm (normal a esta edad: ${pn.fr[0]}–${pn.fr[1]}).`, ifc === 'nasal' ? 'Alto flujo a 2 L/kg/min; si no mejora en 1 h, CPAP o intubación.' : `Alto flujo a 2 L/kg/min (${fmt(Math.min(60, 2 * peso))} L/min) o VMNI.`]);
  if (!S.arrest && S.tire && S.iface !== 'tube') { const used = k => track.used && track.used.has(k), nSalb = track.drugs.filter(d => /Salbutamol/.test(d[1])).length; // v1.13: asma pediátrica
    if (S.weak > .3) out.push(['bad', 'Agotamiento: parada inminente', `PaCO₂ ≈ ${fmt(S.pco2)} mmHg${S.bs > 1.6 ? ', tórax casi silente' : ''}, somnoliento.`, 'O₂ al 100 %, adrenalina IM 10 mcg/kg si apenas entra aire, magnesio IV y prepara la intubación (ketamina, FR baja y espiración larga). La PaCO₂ «normal» en un asmático que trabaja así es mala señal.']);
    if (S.bs > 1.6 && S.E.salb < .3) out.push([nSalb ? 'warn' : 'bad', 'Broncoespasmo grave', nSalb ? `Llevas ${nSalb} nebulización${nSalb > 1 ? 'es' : ''}.` : 'Sin broncodilatador.', `Salbutamol ${peso < 20 ? '2,5' : '5'} mg con ipratropio 250 mcg nebulizados con O₂, cada 20 min la primera hora.`]);
    if (S.bs > 1.4 && !used('drug:cort') && !used('drug:dexa')) out.push(['warn', 'Corticoide', 'Tarda horas en actuar: dalo pronto.', `Metilprednisolona ${fmt(Math.min(60, 2 * peso))} mg IV (1–2 mg/kg) o dexametasona 0,6 mg/kg.`]);
    if (S.bs > 1.7 && nSalb >= 2 && !used('drug:mg')) out.push(['warn', 'No responde a los broncodilatadores', `Tras ${nSalb} nebulizaciones.`, `Sulfato de magnesio ${fmt(Math.min(2, .05 * peso), 1)} g IV (40–50 mg/kg, máx. 2 g) en 20 min; vigila la TA.`]); }
  if (!S.arrest && isPed() && !S.vaso && !S.dka && !S.bleed && S.deficit > .15 && (S.fc > pn.fc[1] || S.tas < pn.tasMin)) out.push(['bad', 'Shock hipovolémico', `FC ${fmt(S.fc)}, relleno lento y pulsos débiles.`, `${!S.access ? 'Intraósea si no hay vena en 1–2 intentos; después, ' : ''}bolos de 10 mL/kg (${fmt(10 * peso)} mL) reevaluando tras cada uno, hasta 40 mL/kg. Llevas ${fmt(S.fluidKg || 0)} mL/kg.`]);
  if (!S.arrest && isPed() && !S.neo && track.gluAt == null && S.deficit > .15 && !S.vaso) out.push(['warn', 'Glucemia', 'El lactante deshidratado se hipoglucemia.', 'Glucemia capilar; si < 60 mg/dL, G10 % 2 mL/kg.']);
  if (!S.arrest && S.cohb > .1) out.push(['warn', 'Carboxihemoglobina', `SpCO ${fmt(M.spco)} %: la SpO₂ de ${fmt(S.spo2 * 100)} % sobrestima el O₂ real.`, S.fiEff < .8 ? 'O₂ al 100 %: reservorio bien ajustado, VMNI con FiO₂ 100 % o intubación.' : 'Mantén O₂ al 100 % y valora cámara hiperbárica.']);
  if (!S.arrest && S.cn > .2) out.push(['bad', 'Posible cianuro', 'Shock y lactato muy alto en un incendio cerrado.', 'Hidroxocobalamina 5 g IV.']);
  if (!S.arrest && S.edAir > .45 && !tube) out.push(['bad', 'Vía aérea que se cierra', 'Estridor y voz ronca: el edema progresa.', 'Intuba ya, con videolaringoscopio; prepara la cricotiroidotomía.']);
  if (!S.arrest && S.icp && S.icp.v > 30 && !S.ced) out.push(['bad', 'Signos de herniación', 'Midriasis arreactiva' + (S.fc < 60 && S.tas > 150 ? ', bradicardia e hipertensión (Cushing).' : '.'), 'Hiperventilación breve a EtCO₂ 30–35, salino hipertónico o manitol, TAS ≥ 110, SpO₂ ≥ 94 % y cabecero a 30°.']);
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
    if (S.air.sga && M.ppk > 25) out.push(['warn', 'Fuga por el supraglótico', `Ppico ${fmt(M.ppk)}: por encima de ≈ 25 cmH₂O deja de sellar.`, 'Baja el Vt o la presión, o cámbialo por un tubo (a través del dispositivo o con videolaringoscopio).']);
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
    if (tube && M.et > 5 && M.et < 30 && S.tas >= 90 && !S.icp && (S.hco3m == null || S.hco3m > 17)) out.push(['warn', 'EtCO₂ baja', `EtCO₂ ${fmt(M.et)} mmHg.`, 'Hiperventilación: baja FR o Vt. Si la diferencia con la PaCO₂ es grande, piensa en bajo gasto o TEP.']);
    if (tube && M.et > 50 && !P.hyper && caseKey !== 'asma') out.push(['warn', 'EtCO₂ alta', `EtCO₂ ${fmt(M.et)} mmHg.`, 'Hipoventilación: sube FR o Vt.']);
    if (tube && ['CPV', 'CPR_M'].includes(uMode(c))) out.push(['bad', 'Sigues en el modo de RCP', 'Hay pulso.', `Pasa a ${modeLabel(d.inv, null, 'tube')} con Vt 6–8 mL/kg, FR 12–16, PEEP 5.`]);
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
    if (pniS != null && pniS < (isPed() ? VMI.pedNorms(S.age || 0).tasMin : 90) && !(S.cv && S.cvT > .35)) out.push(['bad', 'Hipotensión', `PNI ${fmt(pniS)} mmHg${isPed() ? ` (mínima para la edad: ${VMI.pedNorms(S.age || 0).tasMin})` : ''}.`, 'Auto-PEEP, neumotórax, hipovolemia, sedación, nitratos, PEEP alta, arritmia, TEP o anafilaxia.']);
    else if (!pniMeas && (!pni || S.clin - pni.at > 10)) out.push(['warn', 'Sin TA reciente', 'La última PNI tiene más de 10 min.', 'Mide la PNI o programa la automática.']);
  }
  if (!S.o2.supply && !off) out.push(['bad', 'Sin O₂', ifc === 'o2' || ifc === 'nasal' ? 'El paciente respira aire ambiente.' : 'El equipo de turbina sigue ventilando con aire (FiO₂ 0,21).', 'Cambia la botella.']);
  else if (S.o2.supply) { const cons = S.o2.cons + (S.dev.pneumatic && !off && (tube || mask) ? .3 : 0), aut = cons > .05 ? (S.o2.bar - 20) * S.o2.vol / cons : 999; if (aut < 30) out.push(['warn', 'Botella baja', `Autonomía ≈ ${fmt(aut)} min.`, S.dev.pneumatic ? 'Air Mix si la SpO₂ lo permite y prepara el cambio de botella.' : 'Baja la FiO₂ si la SpO₂ lo permite o prepara el cambio de botella.']); }
}
function renderTruth() { $('#truth').innerHTML = truthRows().map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join(''); }
function truthRows() {
  const m = S.mech, r = real(), a = S.air, mask = S.iface === 'mask';
  const air = S.isr ? 'laringoscopia (apnea)' : S.iface === 'o2' ? 'vía aérea natural · ' + O2LAB[S.cfg.o2dev] : S.iface === 'nasal' ? 'vía aérea natural · alto flujo' : mask ? 'mascarilla oronasal' : a.extub ? 'extubado' : a.disc ? 'desconectado' : a.sel ? 'selectiva derecha' : a.obst ? 'tubo parcialmente obstruido' : a.leak ? 'fuga por el balón' : 'tubo en posición';
  const rows = [['Vía aérea', air + (S.bag ? ' · ambú' : '') + (S.standby ? ' · ventilador en espera' : '')], ['Ritmo', rhyLab(S.rhythm) + (S.arrest ? ' · sin pulso' : '')], ['K⁺ / glucemia / temperatura', fmt(S.k, 1) + ' mmol/L / ' + fmt(S.glu) + ' mg/dL / ' + fmt(S.temp, 1) + ' °C'], ['GCS estimado', S.relTot > .6 ? 'no valorable (relajado)' : fmt(S.gcs)],
    ['Sangrado', S.bleed ? fmt((S.bleedNow || 0) * 1000, 1) + ' ‰ de volemia/min' + (S.hemo ? ' · hemostasia puesta' : '') : 'no'], ['Tricíclicos / crup', fmt((S.mx ? S.mx.tcaE : 0) * 100) + ' / ' + fmt((S.croupEff || 0) * 100) + ' %'], ['Acceso vascular', S.access === 'io' ? 'intraósea' : S.access ? 'venoso' : S.accessPend ? 'en curso' : 'no'], ['pH / PaCO₂', fmt(S.ph, 2) + ' / ' + fmt(S.pco2) + ' mmHg'], ['PAO₂ / FiO₂ real', fmt(S.pao2) + ' mmHg / ' + fmt(S.fiEff * 100) + ' %'],
    ['SaO₂ real (con COHb)', fmt(S.oxEff * 100) + ' %'], ['TA real', fmt(S.tas) + ' mmHg'], ['Vt real en el pulmón', fmt(M.vtReal) + ' mL'], ['FR del paciente', M.effN >= 2 ? fmt(M.effRR) + ' rpm' : 'no respira'],
    ['Esfuerzos ineficaces / autodisparos (30 s)', (M.effN ? M.ies + ' de ' + M.effN : '–') + ' / ' + M.auto + ' de ' + M.nB], ['Meseta real', mask || S.iface === 'o2' || S.iface === 'nasal' ? '–' : fmt(r.pplat, 1) + ' cmH₂O'],
    ['Auto-PEEP real', fmt(M.effN >= 2 ? (S.peepiDyn || 0) : r.peepi, 1) + ' cmH₂O'], ['Distensibilidad', fmt(m.C * 1000) + ' mL/cmH₂O'], ['Resistencia insp / esp', fmt(m.Ri) + ' / ' + fmt(m.Re) + ' cmH₂O/L/s'], ['Shunt', fmt(m.shunt * 100) + ' %'],
    ['Hipnosis / relajación / opiáceo', fmt(S.sedTot * 100) + ' / ' + fmt(S.relTot * 100) + ' / ' + fmt(S.opi * 100) + ' %'], ['Vasoactivos (nora, adrenalina, NTG)', fmt(S.E.nor * 100) + ' / ' + fmt(S.E.adr * 100) + ' / ' + fmt(S.E.ntg * 100) + ' %'],
    ['Déficit de volumen', fmt(S.deficit * 100) + ' %'], ['Neumotórax', fmt((S.ptxActive ? S.ptx : m.ptxEff) * 100) + ' %' + (S.ptxActive ? ' a tensión' : '')], ['Broncoespasmo', fmt(S.bs * 100) + ' %'],
    ['TEP / anafilaxia / broncoaspiración', fmt(S.tep * 100) + ' / ' + fmt(S.anaf * 100) + ' / ' + fmt(S.asp * 100) + ' %'], ['COHb / cianuro', fmt(S.cohb * 100) + ' % / ' + fmt(S.cn * 100) + ' %'],
    ['PIC estimada', S.icp ? fmt(S.icp.v) + ' mmHg' : '–'], ['Edema de vía aérea', fmt(Math.max(S.edAir, .8 * S.anaf) * 100) + ' %'], ['Desreclutamiento', fmt(S.derec * 100) + ' %'],
    ['Umbral de captura del marcapasos', fmt(S.pace.thr) + ' mA'], ['Presión barométrica', fmt(S.pbar) + ' mmHg']];
  return rows;
}
function logIt(t) { const s = Math.round((S ? S.clin : 0) * 60); const hh = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); const e = document.createElement('span'); e.textContent = hh + ' · ' + t; $('#log').prepend(e); }

/* ---------- fármacos ---------- */
function renderPedKit() { // v1.11: material, normalidad y dosis por peso y edad
  const box = $('#pedKit'); if (!box) return; box.hidden = !isPed(); if (!isPed()) return;
  const a = S.age || 0, k = VMI.pedKit(peso, a), n = VMI.pedNorms(a), neo = !!S.neo, edad = a < 1 ? (a * 12 < 1 ? 'recién nacido' : `${fmt(a * 12)} meses`) : `${fmt(a, a < 3 ? 1 : 0)} años`;
  $('#pedKitBody').innerHTML = [`<p><b>${edad}</b> · ${fmt(peso, peso < 10 ? 1 : 0)} kg${a >= 1 ? ` (por edad se estimarían ${fmt(VMI.pesoPorEdad(a))} kg)` : ''}</p>`,
    `<p>Normalidad: FC ${n.fc[0]}–${n.fc[1]} · FR ${n.fr[0]}–${n.fr[1]} · TAS mínima ${n.tasMin} mmHg</p>`,
    `<p>Vía aérea: tubo ${neo || a < 1 ? fmt(k.tubo, 1) : `con balón ${fmt(k.tubo, 1)} (sin balón ${fmt(k.tubo + .5, 1)})`} a ${k.prof} cm de la comisura · i-gel ${k.igel} · pala ${k.pala} · sonda de aspiración ${k.sonda} Fr</p>`,
    `<p>Ventilación: Vt ${k.vt[0]}–${k.vt[1]} mL (6–8 mL/kg) · FR ${k.fr[0]}–${k.fr[1]}</p>`,
    `<p>Desfibrilación 4 J/kg = ${k.julios} J · adrenalina ${neo ? `20 mcg/kg = ${fmt(20 * peso)}` : `10 mcg/kg = ${k.adr}`} mcg · líquidos 10 mL/kg = ${k.liq} mL · glucosa 10 % 2 mL/kg = ${k.glu} mL</p>`].join('');
}
function renderDrugs() {
  const btn = it => { const ds = it.act ? null : doseOf(it), pd = pedOf(it);
    const sub = it.note && ds == null ? (isPed() && it.pnote) || it.note : ds != null && it.u ? `${fmt(ds, dd(ds))} ${it.u}${pd ? ' · ' + pd.t : it.mgkg ? ' · ' + fmt(it.mgkg, it.mgkg % 1 ? 1 : 0) + ' ' + it.u + '/kg' : it.tnk ? ' por peso' : ''}` : it.note || '';
    const sub2 = it.act === 'fluid' && isPed() ? `${fmt(10 * peso)} mL · 10 mL/kg` : it.act === 'blood' && isPed() ? `${fmt(10 * peso)} mL · 10 mL/kg` : sub;
    return `<button class="btn" data-drug="${it.id}"${it.noIV ? ' data-noiv="1"' : ''}>${it.lab}${sub2 ? ` <small>${sub2}</small>` : ''}</button>`; };
  const perf = p => `<div class="range"><label class="small" for="pf_${p.id}">${p.lab}</label><select id="pf_${p.id}" data-perf="${p.id}">${p.opts.map(o => `<option value="${o}">${o ? fmt(o, p.d) + ' ' + p.u + (p.extra ? p.extra(o) : '') : 'parada'}</option>`).join('')}</select></div>`;
  $('#drugPanel').innerHTML = `<span class="flabel">Fármacos · ${isPed() ? 'dosis pediátricas por peso' : 'dosis'} para ${fmt(peso)} kg<span id="accessTag"></span></span>` +
    DRUGSET.map(g => `<details class="dg"${g.open ? ' open' : ''}><summary>${g.g}</summary><div class="abtns">${g.items.map(btn).join('')}</div></details>`).join('') +
    `<details class="dg"><summary>Perfusiones</summary><div class="agroup" style="margin-top:6px">${PERFS.filter(p => p.id === 'g10kg' ? peso <= 10 : p.id === 'g10' ? peso > 10 : p.id === 'adrIkg' ? isPed() : p.id === 'adrI' ? !isPed() : true).map(perf).join('')}</div></details>`;
}
function giveDrug(id) {
  const it = DRUGITEMS[id];
  if (!S.access && !it.noIV && (it.k || it.act === 'fluid' || it.act === 'blood')) { showFind(['Sin acceso vascular: canaliza una vía venosa o, si es urgente, intraósea.']); logIt('Sin acceso vascular: no puedes administrar ' + it.lab.toLowerCase()); return; }
  if (it.act) markUse('act:' + it.act);
  if (it.act === 'fluid') { const ml = isPed() ? 10 * peso : 500; sim.action('fluid', ml / peso); track.fluidMl += ml; const t = `Cristaloide ${fmt(ml)} mL${isPed() ? ' (10 mL/kg)' : ''}`; logIt(t); track.drugs.push([S.clin, t]); return; }
  if (it.act === 'blood') { sim.action('blood', isPed() ? peso * 10 / 300 : 1); track.bloodU++; const t = isPed() ? `Concentrado de hematíes ${fmt(peso * 10)} mL (10 mL/kg)` : 'Concentrado de hematíes, 1 unidad'; logIt(t); track.drugs.push([S.clin, t]); return; }
  if (it.act) { sim.action(it.act); const t = ACTLAB[it.act] || it.lab; logIt(t); track.drugs.push([S.clin, t]); return; }
  markUse('drug:' + it.k); markUse('drug:' + it.id);
  const ds = doseOf(it), pd = pedOf(it);
  if (it.k === 'atr' && ds) track.atrMg = (track.atrMg || 0) + ds;
  const amt = SIM_DRUGS.amountOf(it, peso, isPed());
  sim.drug(it.k, amt);
  const route = it.route != null ? it.route : ' IV';
  const txt = it.lab + (ds != null && it.u ? ' ' + fmt(ds, dd(ds)) + ' ' + it.u : '') + (it.note ? ' (' + it.note + ')' : '') + route;
  track.drugs.push([S.clin, txt]); logIt(txt);
  if (it.k === 'adr' && it.amt === 100 && S.arrest) track.adr.push(S.clin);
  if (it.k === 'amio' && S.arrest) track.amio += ds;
  if (it.k === 'lido' && S.arrest) track.lido += ds;
  if (it.k === 'nalox') track.nalox = S.clin;
  if (['ket', 'eto', 'prop'].includes(it.k) && S.iface !== 'tube' && !track.induct) track.induct = txt;
  if (['rel', 'sux'].includes(it.k) && S.iface !== 'tube' && !track.relax) track.relax = txt;
}
$('#drugPanel').addEventListener('change', e => {
  const s = e.target.closest('[data-perf]'); if (!s) return;
  const p = PERFS.find(x => x.id === s.dataset.perf), r = +s.value;
  p.set(r); track.acts++; if (r) markUse('perf:' + p.id);
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
  const k = b.dataset.act; markUse('act:' + k); if (!['explore', 'gas', 'glu', 'temp'].includes(k)) track.actsLog.push([S.clin, ACTLAB[k] || b.textContent.trim()]);
  switch (k) {
    case 'explore': showFind(sim.explore()); logIt('Exploración'); break;
    case 'gas': { if (!S.access) { showFind(['Sin acceso vascular no hay muestra: canaliza una vía.']); break; } const g = sim.gas(); const txt = `Gasometría venosa: Na⁺ ${fmt(g.na)} mmol/L · pH ${fmt(g.ph, 2)} · pCO₂ ${fmt(g.pco2)} mmHg · HCO₃⁻ ${fmt(g.hco3)} · lactato ${fmt(g.lact, 1)} mmol/L · K⁺ ${fmt(g.k, 1)} · glucosa ${fmt(g.glu)} mg/dL · Hb ${fmt(g.hb, 1)} g/dL · COHb ${fmt(g.cohb, 1)} %`; track.gluAt = S.clin; track.gluVal = g.glu; track.gasAt = S.clin; showFind([txt]); logIt(txt); break; }
    case 'toO2': sim.setStandby(false); sim.setIface('o2'); sim.setCfg(Object.assign({}, S.cfg, { o2dev: $('#o2dev').value })); logIt('Retiras el soporte: ' + O2LAB[S.cfg.o2dev]); pend = Object.assign({}, S.cfg); renderVent(); break;
    case 'toMask': {
      const st = devOf().start.find(x => x.iface === 'mask' && x.id !== 'rsi');
      sim.setIface('mask'); sim.setStandby(true); S.mask.leak10 = Math.min(S.mask.leak10, 15);
      pend = cleanCfg(st ? st.cfg(devIbw()) : { mode: devOf().niv, ps: 8, peep: 6, rise: .15, trigE: 35, timax: 1.2, trigI: 2, fio2: 100, pmax: 30, fr: 12, vt: 450 });
      pend.fio2 = Math.max(pend.fio2 || 60, S.cfg.fio2 || 60);
      if (devOf().spec.fio2 && devOf().spec.fio2.bin) pend.fio2 = 100;
      sbyHint = null; pendAt = performance.now();
      logIt('Mascarilla de VMNI colocada y conectada: el ventilador está en espera'); renderVent(); break; }
    case 'toNasal': sim.setIface('nasal'); sim.setStandby(true); pend = cleanCfg({ mode: 'HFNC', flow: isPed() ? Math.min(60, Math.round(2 * peso)) : S.cfg.flow || 50, fio2: Math.max(S.cfg.fio2 || 60, 60) }); sbyHint = null; pendAt = performance.now(); logIt('Cánula de alto flujo colocada: el equipo está en espera'); renderVent(); break;
    case 'intubate': {
      const r = sim.intubate();
      if (!r.ok) { showFind([r.msg]); logIt('Intubación: ' + r.msg); }
      else { if (!track.peri) track.peri = { start: S.clin, end: S.clin + 10, spo2: S.spo2 * 100, tas: S.tas, startSpo2: S.spo2 * 100 }; else track.peri.end = S.clin + 10; logIt(`Laringoscopia${S.davMul < 1 ? ' con videolaringoscopio' : ''}${S.isr.apox ? ' con gafas a 15 L/min' : ''} (apnea)`); }
      break; }
    case 'sga':
      if (S.iface === 'tube' || S.isr) break;
      if (S.relTot < .5 && S.sedTot < .9 && !S.arrest) { showFind(['Conserva reflejos de vía aérea: el supraglótico necesita inconsciencia profunda o relajación.']); break; }
      sim.action('sga'); if (!track.peri) track.peri = { start: S.clin, end: S.clin + 10, spo2: S.spo2 * 100, tas: S.tas, startSpo2: S.spo2 * 100 }; logIt(ACTLAB.sga); break;
    case 'iv': case 'io': if (S.access || S.accessPend) break; sim.action(k); logIt(ACTLAB[k]); break;
    case 'glu': { const g = sim.glucemia(); track.gluAt = S.clin; track.gluVal = g; const t = 'Glucemia capilar: ' + (g < 20 ? 'LO (< 20)' : g > 600 ? 'HI (> 600)' : fmt(g) + ' mg/dL'); showFind([t]); logIt(t); break; }
    case 'ecg12': { const t = 'ECG de 12 derivaciones: ' + sim.ecg12(); track.ecg12At = S.clin; showFind([t]); logIt(t); break; }
    case 'eco': { const t = 'Ecografía clínica: ' + sim.eco(); showFind([t]); logIt(t); break; }
    case 'pericardio': if (S.pericPend) break; sim.action('pericardio'); logIt(ACTLAB.pericardio); break;
    case 'ictus': if (!S.stroke || S.stroke.type !== 'isq') { showFind(['No hay un déficit neurológico agudo que justifique activar el código ictus.']); break; } sim.action('ictus'); logIt(ACTLAB.ictus); break;
    case 'icp': if (!S.stemi) { showFind(['No hay un SCACEST que justifique activar la ICP primaria.']); break; } sim.action('icp'); logIt(ACTLAB.icp); break;
    case 'temp': { const v = sim.temperatura(); track.tempAt = S.clin; const t = (S.neo ? 'Temperatura axilar: ' : S.iface === 'tube' ? 'Temperatura esofágica: ' : 'Temperatura timpánica: ') + fmt(v, 1) + ' °C'; showFind([t]); logIt(t); break; }
    case 'warm': sim.action('warm'); logIt(S.warm ? (S.neo ? (S.neo.t0 > 30 ? 'Incubadora de transporte encendida y precalentada, nido y gorro' : S.neo.prem && S.neo.prem < 32 ? 'Gorro, calor radiante y habitáculo a 25 °C o más' : 'Secado, toalla mojada fuera, gorro y calor') : 'Ropa mojada fuera, manta térmica y calor activo') : 'Retiras el calor activo'); break;
    case 'cool': sim.action('cool'); logIt(S.cool ? 'Enfriamiento activo: desnudo, agua pulverizada con ventilación, hielo en ingles y axilas' : 'Retiras el enfriamiento activo'); break;
    case 'decont': if (S.decont) { showFind(['Ya está descontaminado.']); break; } sim.action('decont'); logIt(ACTLAB.decont); break;
    case 'hemo': if (S.bleedSrc === 'thor') { showFind(['El sangrado es intratorácico: no hay hemostasia posible fuera del quirófano. Drenaje, tranexámico, sangre y toracotomía.']); break; } if (!S.bleedSrc || S.hemo) { showFind([S.hemo ? 'La hemostasia ya está puesta.' : 'No hay un foco de sangrado accesible.']); break; } sim.action('hemo'); logIt(HEMOLAB[S.bleedSrc] + (S.bleedSrc === 'uter' ? ' mantenido' : ' colocado')); break;
    case 'drain': sim.action('drain'); logIt(S.drained ? 'Toracostomía y drenaje torácico: el neumotórax ya no puede volver a tensarse' : ACTLAB.drain); break;
    case 'cric': if ((S.iface !== 'tube' || S.air.sga) && !S.isr) { sim.action('cric'); track.cric = true; if (!track.peri) track.peri = { start: S.clin, end: S.clin + 10, spo2: S.spo2 * 100, tas: S.tas, startSpo2: S.spo2 * 100 }; logIt(ACTLAB.cric); } break;
    case 'bag': sim.action('bag'); logIt(S.neo ? (S.bag ? 'Ventilas con pieza en T a 30/min (25 cmH₂O)' : 'Dejas de ventilar') : S.bag ? 'Ventilas con ambú y reservorio (10/min)' : 'Dejas el ambú'); break;
    case 'infl': sim.action('infl'); markUse('act:bag'); logIt(ACTLAB.infl.replace('30 cmH₂O', S.neo && S.neo.prem && S.neo.prem < 32 ? '25 cmH₂O' : '30 cmH₂O') + '; después, ventilación a 30/min'); break;
    case 'cpap': sim.action('cpap'); logIt(S.neo && S.neo.cpap ? `CPAP con pieza en T y mascarilla a ${S.neo.peep} cmH₂O` : 'Retiras la CPAP'); break;
    case 'plast': sim.action('plast'); logIt(S.plast ? ACTLAB.plast : 'Retiras la bolsa de plástico'); break;
    case 'neoComp': sim.action('neoComp'); logIt(S.neo && S.neo.comp ? 'Compresiones 3:1 con los dos pulgares (90/30 por minuto)' : 'Paras las compresiones'); break;
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
$('#cprRatio').addEventListener('change', e => { ratioUI = +e.target.value; sim.setRatio(ratioUI); if (uMode(S.cfg) === 'CPR_M') { sim.setCfg(toModel(Object.assign({}, S.cfg))); pend = Object.assign({}, S.cfg); renderVent(); } logIt('Compresiones: ' + (ratioUI ? ratioUI + ':2' : 'continuas')); });
$('#neoFio2').addEventListener('change', e => { const v = +e.target.value; sim.setCfg(Object.assign({}, S.cfg, { fio2: v })); markUse('cfg:fio2'); logIt(`FiO₂ de la pieza en T: ${v} %`); });
$('#neoPeep').addEventListener('change', e => { const v = +e.target.value; sim.setNeo({ peep: v }); markUse('cfg:neoPeep'); logIt(`PEEP de la pieza en T: ${v} cmH₂O`); });
$('#neoPip').addEventListener('change', e => { const v = +e.target.value; sim.setNeo({ pip: v }); markUse('cfg:neoPip'); logIt(`Presión inspiratoria de la pieza en T: ${v} cmH₂O`); });
$('#o2dev').addEventListener('change', e => { markUse('o2:' + e.target.value); if (S.iface === 'o2') { sim.setCfg(Object.assign({}, S.cfg, { o2dev: e.target.value })); logIt('Oxigenoterapia: ' + O2LAB[e.target.value]); } else S.cfg.o2dev = e.target.value; });
$('#evBtn').addEventListener('click', () => fireEvent($('#evSel').value, null, false));
$('#alt').addEventListener('input', e => setAltUI(+e.target.value));
$('#alt').addEventListener('change', e => markUse(+e.target.value <= 300 ? 'alt' : 'altUp') || logIt('Altitud de cabina ' + (+e.target.value).toLocaleString('es-ES') + ' m'));
$('#showPmus').addEventListener('change', e => { $('#legIE').hidden = !e.target.checked; });
function updateButtons() {
  const d = devOf();
  $$('[data-if]').forEach(b => { let en = b.dataset.if.split(' ').includes(S.iface) && !S.isr; if (b.dataset.act === 'toNasal') en = en && d.modes.nasal.length > 0; b.disabled = !en; });
  const bag = $('[data-act="bag"]'); bag.setAttribute('aria-pressed', S.bag ? 'true' : 'false'); bag.textContent = S.neo ? (S.bag ? 'Pieza en T: ventilando a 30/min' : 'Ventilar con pieza en T (30/min)') : S.bag ? 'Ambú: ventilando' : 'Ambú con reservorio';
  const ng = $('#neoGrp'); if (ng) { ng.hidden = !S.neo; const nc = $('[data-act="neoComp"]'); if (nc) nc.setAttribute('aria-pressed', S.neo && S.neo.comp ? 'true' : 'false'); const fs = $('#neoFio2'); if (fs && S.neo && document.activeElement !== fs) fs.value = String(S.cfg.fio2);
    if (S.neo) { const cp = $('[data-act="cpap"]'), pl = $('[data-act="plast"]'), pe = $('#neoPeep'), pi = $('#neoPip'), ib = $('#inflBtn'), lowGa = S.neo.prem && S.neo.prem < 32;
      cp.setAttribute('aria-pressed', S.neo.cpap ? 'true' : 'false'); cp.textContent = S.neo.cpap ? `CPAP a ${S.neo.peep} cmH₂O: en marcha` : 'CPAP con pieza en T';
      pl.setAttribute('aria-pressed', S.plast ? 'true' : 'false'); pl.hidden = !lowGa;
      if (document.activeElement !== pe) pe.value = String(S.neo.peep); if (document.activeElement !== pi) pi.value = String(S.neo.pip);
      ib.textContent = `5 insuflaciones (${S.neo.prem && S.neo.prem < 32 ? 25 : 30} cmH₂O, 2–3 s)`; } }
  $('[data-act="apox"]').setAttribute('aria-pressed', S.apox ? 'true' : 'false');
  $('[data-act="vl"]').setAttribute('aria-pressed', S.davMul < 1 ? 'true' : 'false');
  ['compManual', 'compMech', 'compOff', 'relevo'].forEach(k => { $(`[data-act="${k}"]`).disabled = !S.arrest; });
  if (S.air.sga) ['intubate', 'cric'].forEach(k => { const x = $(`[data-act="${k}"]`); if (x) x.disabled = !!S.isr; });
  $('[data-act="recruit"]').disabled = S.iface !== 'tube' || ventOffNow();
  const hasAcc = !!S.access; // true, 'iv' o 'io'
  ['iv', 'io'].forEach(k => { const x = $(`[data-act="${k}"]`); if (x) x.disabled = hasAcc || !!S.accessPend; });
  const ic = $('[data-act="ictus"]'); if (ic) { ic.hidden = !(S.stroke && S.stroke.type === 'isq'); ic.disabled = !!(S.stroke && S.stroke.code != null); }
  const ib = $('[data-act="icp"]'); if (ib) { ib.hidden = !S.stemi; ib.disabled = !!(S.stemi && S.stemi.icp != null); }
  const hb = $('[data-act="hemo"]'); if (hb) { hb.hidden = !S.bleedSrc || S.bleedSrc === 'thor'; hb.textContent = HEMOLAB[S.bleedSrc] || 'Hemostasia'; hb.disabled = !!S.hemo; }
  const cb = $('[data-act="cool"]'); if (cb) { cb.setAttribute('aria-pressed', S.cool ? 'true' : 'false'); cb.textContent = S.cool ? 'Enfriando' : 'Enfriamiento activo'; }
  const db = $('[data-act="decont"]'); if (db) db.disabled = !!S.decont;
  const wb = $('[data-act="warm"]'); if (wb) { wb.setAttribute('aria-pressed', S.warm ? 'true' : 'false'); wb.textContent = S.warm ? 'Calor activo puesto' : S.neo ? (S.neo.t0 > 30 ? 'Encender la incubadora de transporte' : S.neo.prem && S.neo.prem < 32 ? 'Gorro y calor radiante' : 'Secar, gorro y calor') : 'Manta y calor activo'; }
  const at = $('#accessTag'); if (at) at.textContent = hasAcc ? (S.access === 'io' ? ' · vía intraósea' : '') : S.accessPend ? ' · canalizando vía…' : ' · sin acceso vascular';
  $$('#drugPanel [data-drug]').forEach(b => { const it = DRUGITEMS[b.dataset.drug]; b.classList.toggle('noacc', !hasAcc && !it.noIV && !!(it.k || it.act === 'fluid' || it.act === 'blood')); });
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
      `<tr><td>Adrenalina 1 mg</td><td class="n">${track.adr.length} dosis</td></tr><tr><td>Amiodarona / lidocaína</td><td class="n">${fmt(track.amio)} / ${fmt(track.lido)} mg</td></tr><tr><td>Parches</td><td class="n">${S.cpr.ap ? 'anteroposteriores' : 'anterolaterales'}</td></tr>` +
      `<tr><td>RCE</td><td class="n">${track.roscAt != null ? 'a los ' + fmt(track.roscAt - track.arrestAt, 1) + ' min' : 'no'}</td></tr></table>`;
  }
  let isr = '';
  if ((track.intubAt != null || track.attempts) && track.peri) isr = H('Vía aérea') + `<table class="dtable"><tr><td>Inducción</td><td class="n">${track.induct || '—'}</td></tr><tr><td>Relajante</td><td class="n">${track.relax || '—'}</td></tr>` +
    `<tr><td>Intentos fallidos</td><td class="n">${track.attempts}</td></tr><tr><td>Resultado</td><td class="n">${track.intubAt != null ? (track.cric ? 'cricotiroidotomía' : 'intubado') + ' a los ' + fmt(track.intubAt, 1) + ' min' : 'sin vía aérea definitiva'}</td></tr>` +
    `<tr><td>SpO₂ al empezar / mínima peri-intubación</td><td class="n">${fmt(track.peri.startSpo2)} / ${fmt(track.peri.spo2)} %</td></tr><tr><td>TAS mínima peri-intubación</td><td class="n">${fmt(track.peri.tas)} mmHg</td></tr>` +
    `<tr><td>Intubado sin ventilar (equipo en espera)</td><td class="n">${fmt(track.standbyApnea * 60)} s</td></tr></table>`;
  const arr = track.hadArr ? H('Arritmia') + `<table class="dtable"><tr><td>Ritmo sinusal recuperado</td><td class="n">${track.convAt != null ? 'a los ' + fmt(track.convAt, 1) + ' min' : 'no'}</td></tr><tr><td>Descargas</td><td class="n">${track.shocks}</td></tr></table>` : '';
  const c7 = CASES[caseKey], extra = [];
  if (track.accessAt != null && (c7.access === false)) extra.push(['Acceso vascular', 'a los ' + mmss(track.accessAt) + ' min']); else if (c7.access === false) extra.push(['Acceso vascular', 'no se consiguió']);
  if (c7.glu != null || track.gluAt != null) extra.push(['Glucemia medida', track.gluAt != null ? 'sí, ' + fmt(track.gluVal) + ' mg/dL' : 'no'], ['Glucemia al final', fmt(S.glu) + ' mg/dL']);
  if (c7.temp != null) extra.push(['Temperatura medida', track.tempAt != null ? 'sí' : 'no'], ['Temperatura al final', fmt(S.temp, 1) + ' °C'], ['Calor activo', S.warm ? 'sí' : 'no']);
  if (c7.k != null) extra.push(['K⁺ al final', fmt(S.k, 1) + ' mmol/L'], ['QRS al final', fmt(S.ecg.qrs * 1000) + ' ms']);
  if (c7.tca) extra.push(['QRS al final', fmt(S.ecg.qrs * 1000) + ' ms'], ['pH al final', fmt(S.ph, 2)]);
  if (c7.bleedSrc === 'thor') extra.push(['Drenaje torácico', S.drained ? `sí: ${fmt(S.htxFirst || 0)} mL al colocarlo, ${fmt(Math.round((S.htxOut || 0) / 50) * 50)} mL en total` : 'no']);
  if (c7.neo && !c7.neo.prem) extra.push(['FC > 60', S.neo.hr60 != null ? 'a los ' + mmss(S.neo.hr60) + ' min' : 'no'], ['FC > 100', S.neo.hr100 != null ? 'a los ' + mmss(S.neo.hr100) + ' min' : 'no'], ['Primeras respiraciones', S.neo.firstBreath != null ? 'a los ' + mmss(S.neo.firstBreath) + ' min' : 'no'], ['Insuflaciones', S.neo.infl], ['Temperatura al final', fmt(S.temp, 1) + ' °C']);
  if (c7.neo && c7.neo.prem) extra.push(['Edad gestacional', S.neo.prem + ' semanas'], ['CPAP al final', S.neo.cpap ? `sí, PEEP ${S.neo.peep} cmH₂O` : S.bag ? 'ventilando con pieza en T' : 'no'], ['FiO₂ al final', S.cfg.fio2 + ' %'], ...(S.neo.prem < 32 && !(c7.neo.t0 > 30) ? [['Bolsa de plástico', S.plast ? 'sí' : 'no']] : []), ['Calor o incubadora', S.warm ? 'sí' : 'no'], ['Temperatura al final', fmt(S.temp, 1) + ' °C'], ['Glucosa 10 % en perfusión', S.gluPerf ? 'sí' : 'no']); // v1.12
  if (c7.cv) extra.push(['FC / TAS al final', `${fmt(S.fc)} lpm / ${fmt(S.tas)} mmHg`], ['Insulina a dosis altas', (S.E.insHD || 0) > .1 ? 'sí' : 'no'], ['Glucemia al final', fmt(S.glu) + ' mg/dL']);
  if (c7.op) extra.push(['Descontaminación', S.decont ? 'sí' : 'no'], ['Atropina total', `≈ ${fmt(track.atrMg || 0)} mg`]);
  if (c7.cocaine) extra.push(['Temperatura al final', fmt(S.temp, 1) + ' °C'], ['Enfriamiento activo', S.cool ? 'sí' : 'no']);
  if (c7.dka) extra.push(['pH / pCO₂ al final', `${fmt(S.ph, 2)} / ${fmt(S.pco2)} mmHg`], ['K⁺ al final', fmt(S.k, 1) + ' mmol/L'], ['Glucemia al final', fmt(S.glu) + ' mg/dL']);
  if (c7.se) extra.push(['Crisis controlada', S.se.ctrlAt != null ? 'a los ' + fmt(S.se.ctrlAt, 1) + ' min' : 'no'], ['Convulsiona al terminar', S.clin < S.seizUntil ? 'sí' : 'no']);
  if (c7.stroke) extra.push(c7.stroke.type === 'isq' ? ['Código ictus', S.stroke.code != null ? 'a los ' + fmt(S.stroke.code, 1) + ' min' : 'no'] : ['Hematoma al final', `≈ ${fmt(S.stroke.vol)} mL (al salir, ${fmt(S.stroke.vol0)})`], ['GCS al final', S.gcs]);
  if (c7.na != null) extra.push(['Na⁺ inicial / final', `${fmt(S.na0)} / ${fmt(S.na, 1)} mmol/L`]);
  if (c7.burn) extra.push(['Superficie quemada', fmt(c7.burn) + ' %'], ['Cristaloide en bomba', S.fluidPerfMl ? `${fmt(Math.round(S.fluidPerfMl / 10) * 10)} mL (a ${fmt(S.fluidRate)} mL/h al final)` : 'no'], ['Bolos de cristaloide', fmt(track.fluidMl) + ' mL']);
  if (c7.bleed) extra.push(['Hemostasia', c7.bleedSrc === 'thor' ? 'no aplicable' : S.hemo ? HEMOLAB[S.bleedSrc].toLowerCase() : 'no'], ['Ácido tranexámico', S.E.txa > .2 ? 'sí' : 'no'], ['Cristaloide / sangre', fmt(track.fluidMl) + ' mL / ' + track.bloodU + ' U'], ['Pérdida de volemia al final', fmt(S.deficit * 100) + ' %']);
  if (track.seizures || c7.ecl) extra.push(['Convulsiones', track.seizures]);
  const metaT = extra.length ? H('Circulación y medio interno') + `<table class="dtable">${extra.map(([a, b]) => `<tr><td>${a}</td><td class="n">${b}</td></tr>`).join('')}</table>` : '';
  const drugs = track.drugs.length ? H('Fármacos y marcadores') + `<table class="dtable">${track.drugs.map(([t, x]) => `<tr><td>min ${fmt(t, 1)}</td><td>${x}</td></tr>`).join('')}</table>` : '';
  $('#dbH').textContent = c.title + (reason ? ' · ' + reason : '');
  $('#dbBody').innerHTML = `<p class="small">Tiempo clínico simulado: ${fmt(S.clin, 1)} min · ${DEVS[S.dev.vent].short} · ajustes y acciones: ${track.acts}</p>` +
    (rows ? H('Tiempo en objetivo') + `<table class="dtable">${rows}</table>` : '') + cpr + arr + isr + metaT + (evs ? H('Eventos') + `<table class="dtable">${evs}</table>` : '') +
    H('Peores valores') + `<table class="dtable"><tr><td>SpO₂ mínima (fuera de la parada)</td><td class="n">${W.n ? fmt(W.spo2) + ' %' : '—'}</td></tr><tr><td>TAS mínima (fuera de la parada)</td><td class="n">${W.n ? fmt(W.tas) + ' mmHg' : '—'}</td></tr><tr><td>Presión pico máxima</td><td class="n">${W.ppk ? fmt(W.ppk) + ' ' + devOf().u : '—'}</td></tr><tr><td>pH al final</td><td class="n">${fmt(S.ph, 2)}</td></tr></table>` +
    drugs + (c.hint ? H('Solución posible') + `<p>${c.hint}</p>` : '');
  teachDebrief(reason);
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
  sinus: t => { const e = S.ecg || { qrs: .08, t: 1, p: 1, j: 0 }, w = e.qrs / .08, d = .012 * (w - 1);
    return .12 * e.p * G(t, .07, .025) - .1 * G(t, .155, .008 * w) + G(t, .17, .01 * w) - .28 * G(t, .19 + d, .011 * w) + .25 * e.j * G(t, .2 + d, .014) + .3 * e.t * G(t, .42 + d, .05 / (1 + .25 * (e.t - 1))) + .1 * (e.st || 0) * G(t, .3 + d, .075); }, // ST: 0,1 por mm
  narrow: t => -.08 * G(t, .015, .008) + 1.0 * G(t, .03, .01) - .28 * G(t, .05, .011) + .25 * G(t, .24, .045),
  wide: t => .8 * G(t, .06, .03) - .45 * G(t, .13, .035) - .25 * G(t, .38, .07),
  aesp: t => .5 * G(t, .08, .05) - .25 * G(t, .18, .06) + .2 * G(t, .5, .08),
  none: () => 0
};
const RPEAK = { sinus: .17, narrow: .03, wide: .06, aesp: .08 };
let zT = 0, bt = 9, bl = .8, btype = 'sinus', pPh = 0, paceT = 0, spike = 0, markAt = -1, beatAmp = 1, ecgAmp = 1, altB = false;
function nextBeat() {
  const r = S.rhythm, rate = x => 60 / Math.max(x, 15);
  beatAmp = 1; altB = !altB;
  ecgAmp = ((S.ecg && S.ecg.amp) || 1) * (S.tamp > .55 && !S.arrest ? (altB ? 1 : .65) : 1); // taponamiento: bajo voltaje y alternancia eléctrica
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
  let e = EK[btype](bt) * ecgAmp;
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
  const agit = arrest ? 0 : S.clin < S.seizUntil ? 2.5 : Math.max(S.fight || 0, S.iface === 'mask' ? clamp(S.awake * (S.drive - .6), 0, 1) : 0, S.clin < S.anxUntil ? .8 : 0);
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
const GROUP_SPEED = { 'Parada': 1, 'Arritmias': 5 };
function setSpeed(v) { scale = v; if (sim) sim.setScale(v); $$('#speedSeg button').forEach(o => o.setAttribute('aria-pressed', +o.dataset.s === v ? 'true' : 'false')); }
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
let lastEv = 0, lastIe = 0, lastHit = 0, lastTick = 0;
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
    if (soundOn && actx && S.arrest && S.cpr.comp !== 'off' && !S.cpr.paused && uMode(S.cfg) === 'CPR_M' && now - lastTick > 545) { lastTick = now; const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 1500; g.gain.setValueAtTime(.04, actx.currentTime); g.gain.linearRampToValueAtTime(0, actx.currentTime + .04); o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + .05); }
    uacc += dt; if (uacc >= .5) { uacc = 0; updateUI(); tabAlerts(); }
    sendState(false);
  }
  draw(); drawZoll(); requestAnimationFrame(frame);
}

/*TEACH*/
/*GUIDE*/
/*TUTOR*/
/*LIBRARY*/

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
$('#speedSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setSpeed(+b.dataset.s); });
$('#truthBox').addEventListener('toggle', () => { if ($('#truthBox').open) renderTruth(); });
window.__sim = () => ({ sim, S, M, track, pend, lim, exam, LINK, tut, tutSteps, tutWhere });
if (INSTR) startInstructor();
else { teachInit(); guideInit(); tutInit(); libInit(); const k0 = loadSharedFromHash(); if (k0) $('#caseSel').value = k0; loadCase(k0 || 'tce'); requestAnimationFrame(frame); }
})();
