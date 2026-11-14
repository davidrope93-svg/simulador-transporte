/* ===== Motor fisiológico de ventilación y soporte prehospitalario: VMI, VMNI, oxigenoterapia, fármacos y parada (sin interfaz) ===== */
(function (root) {
'use strict';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function makeRng(seed) { let s = (seed >>> 0) || 123456789; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const sat = P => { P = Math.max(P, 1); return 1 / (1 + 23400 / (P * P * P + 150 * P)); };
const pbarAt = h => 760 * Math.pow(1 - 2.25577e-5 * h, 5.25588);

/* Fenotipos. C en L/cmH2O, R en cmH2O/L/s, VD en mL, VCO2/VO2 en mL/min, FRC en L.
   Esfuerzo: rr0→rrMax (rpm) y p0→pM (cmH2O) según el impulso; tiFrac = fracción inspiratoria; push = empuje espiratorio */
const BASE = { vq: 0, co2tau: 6, hco3: 24, co2set: 40, rr0: 12, rrMax: 28, p0: 3, pM: 10, tiFrac: .38, push: 9, hyper: false, edema: false, sympa: 0 };
const PHENO = {
  sano:   { label: 'Pulmón sano', C: .050, Ri: 12, Re: 12, Pcrit: 0, vdAnat: 125, vdAlv: .08, vco2: 200, vo2: 250, shunt0: .05, shuntPeep: 0, shuntMin: .03, frc: 2.4, hemo: 1.0, tas: 130, fc: 80, sv: .72, sex: 'h', talla: 175 },
  sdra:   { label: 'SDRA / neumonía', C: .025, Ri: 12, Re: 12, Pcrit: 0, vdAnat: 150, vdAlv: .22, vco2: 220, vo2: 280, shunt0: .32, shuntPeep: .018, shuntMin: .10, frc: 1.4, hemo: 1.0, tas: 125, fc: 105, sv: .62, sex: 'h', talla: 175, rr0: 18, rrMax: 36, pM: 20 },
  neumo:  { label: 'Neumonía hipoxémica', C: .038, Ri: 11, Re: 11, Pcrit: 0, vdAnat: 140, vdAlv: .15, vco2: 230, vo2: 290, shunt0: .36, vq: .45, shuntPeep: .015, shuntMin: .08, frc: 1.9, hemo: 1.0, tas: 128, fc: 108, sv: .62, sex: 'h', talla: 175, rr0: 18, rrMax: 36, p0: 5, pM: 20, sympa: .4 },
  asma:   { label: 'Asma grave', C: .050, Ri: 25, Re: 40, Pcrit: 8, vdAnat: 150, vdAlv: .14, vco2: 220, vo2: 270, shunt0: .10, shuntPeep: 0, shuntMin: .08, frc: 3.0, hemo: 1.8, tas: 130, fc: 115, sv: .68, sex: 'm', talla: 165, tiFrac: .33 },
  obeso:  { label: 'Obeso', C: .035, Ri: 15, Re: 15, Pcrit: 0, vdAnat: 130, vdAlv: .10, vco2: 260, vo2: 320, shunt0: .15, shuntPeep: .012, shuntMin: .06, frc: 1.2, hemo: 1.0, tas: 145, fc: 95, sv: .68, sex: 'h', talla: 172 },
  trauma: { label: 'Politrauma hipovolémico', C: .045, Ri: 12, Re: 12, Pcrit: 0, vdAnat: 130, vdAlv: .15, vco2: 220, vo2: 270, shunt0: .08, shuntPeep: .005, shuntMin: .05, frc: 2.2, hemo: 1.0, tas: 135, fc: 105, sv: .62, sex: 'h', talla: 180 },
  epoc:   { label: 'EPOC agudizado', C: .070, Ri: 10, Re: 20, Pcrit: 5.5, vdAnat: 150, vdAlv: .35, vco2: 230, vo2: 260, shunt0: .27, vq: .8, shuntPeep: 0, shuntMin: .22, frc: 3.2, hemo: 1.0, tas: 150, fc: 104, sv: .60, sex: 'h', talla: 170,
            hco3: 31, co2set: 52, rr0: 16, rrMax: 32, p0: 6, pM: 18, tiFrac: .40, push: 6, hyper: true, sympa: .6, co2tau: 14 },
  eap:    { label: 'Edema agudo de pulmón', C: .050, Ri: 9, Re: 9, Pcrit: 0, vdAnat: 140, vdAlv: .10, vco2: 230, vo2: 280, shunt0: .06, shuntPeep: 0, shuntMin: .04, frc: 2.3, hemo: .6, tas: 200, fc: 112, sv: .58, sex: 'm', talla: 160,
            hco3: 22, rr0: 16, rrMax: 34, p0: 5, pM: 20, tiFrac: .38, push: 4, edema: true, sympa: 1 },
  bronq:  { label: 'Bronquiolitis', C: .040, Ri: 18, Re: 24, Pcrit: 2, vdAnat: 125, vdAlv: .2, vco2: 200, vo2: 250, shunt0: .14, vq: .5, shuntPeep: .012, shuntMin: .06, frc: 2.0, hemo: 1.0, tas: 130, fc: 80, sv: .68, sex: 'h', talla: 175,
            rr0: 18, rrMax: 34, p0: 4, pM: 18, tiFrac: .36, push: 5, sympa: .2, irrit: .45 },
  sepsis: { label: 'Shock séptico con neumonía', C: .035, Ri: 12, Re: 12, Pcrit: 0, vdAnat: 140, vdAlv: .18, vco2: 260, vo2: 330, shunt0: .22, vq: .4, shuntPeep: .012, shuntMin: .08, frc: 1.8, hemo: 1.4, tas: 112, fc: 122, sv: .55, sex: 'h', talla: 172,
            rr0: 20, rrMax: 36, p0: 5, pM: 20, sympa: .3, hco3: 18 }
};
for (const k in PHENO) PHENO[k] = Object.assign({}, BASE, PHENO[k]);

/* Farmacología: vida media y equilibrio con el lugar de efecto en minutos clínicos; Emax con EC50 en la unidad del fármaco.
   sed y rel = sedación de base y rocuronio del caso en múltiplos de EC50; vasoactivos en unidades de perfusión equivalente */
const DRUGS = {
  sed: { h: 15, on: 3, ec50: 1 }, rel: { h: 18, on: 1.2, ec50: 1 }, sux: { h: 3, on: .7, ec50: 1 },
  prop: { h: 6, on: 1.5, ec50: 20 }, mid: { h: 40, on: 3, ec50: 3 }, ket: { h: 12, on: 1, ec50: 60 }, eto: { h: 4, on: .8, ec50: 12 },
  fent: { h: 30, on: 3, ec50: 80 }, morf: { h: 120, on: 8, ec50: 6 }, nalox: { h: 20, on: 1, ec50: .08 },
  salb: { h: 60, on: 5, ec50: .5 }, mg: { h: 60, on: 4, ec50: 1 }, cort: { h: 240, on: 60, ec50: 40 },
  nor: { h: 2.5, on: 2, ec50: .12 }, adr: { h: 2.5, on: 1, ec50: 10 }, atr: { h: 60, on: 1, ec50: .4 },
  ntg: { h: 3, on: 2, ec50: 300 }, furo: { h: 90, on: 20, ec50: 40 }, amio: { h: 600, on: 2, ec50: 150 },
  aden: { h: .15, on: .05, ec50: 6 }, tnk: { h: 20, on: 2, ec50: .3 }, shs: { h: 120, on: 5, ec50: 1 }, manit: { h: 90, on: 10, ec50: 1 },
  atb: { h: 120, on: 10, ec50: .5 }, aas: { h: 600, on: 5, ec50: 1 }, tica: { h: 500, on: 30, ec50: 1 }, clopi: { h: 500, on: 120, ec50: 1 }, hnf: { h: 90, on: 1, ec50: 1 }, enox: { h: 300, on: 10, ec50: 1 },
  hidroxo: { h: 300, on: 5, ec50: 2.5 }, dexclor: { h: 300, on: 10, ec50: 2.5 }, lido: { h: 90, on: 1, ec50: 100 },
  // v0.7: calcio (1 = 10 mL de cloruro cálcico 10 %), insulina (1 = 10 UI), ácido tranexámico (g), isoprenalina, urapidilo, labetalol,
  // oxitocina (UI), adrenalina nebulizada (1 = 0,5 mg/kg), dexametasona (1 = 0,6 mg/kg) y glucagón (mg)
  ca: { h: 30, on: .5, ec50: .5 }, ins: { h: 120, on: 15, ec50: .5 }, txa: { h: 120, on: 3, ec50: .3 }, iso: { h: 2.5, on: 1, ec50: 2 },
  urap: { h: 180, on: 2, ec50: 25 }, labet: { h: 300, on: 5, ec50: 40 }, oxito: { h: 15, on: 3, ec50: 3 }, adrN: { h: 60, on: 4, ec50: 12 },
  dexa: { h: 600, on: 60, ec50: 15 }, glucg: { h: 20, on: 8, ec50: .5 }
};
const SED_RATE = 3 * Math.LN2 / 15; // perfusión que mantiene la sedación de base al 75 %

const pesoIdeal = (sex, talla) => (sex === 'm' ? 45.5 : 50) + 0.91 * (talla - 152.4);
const defaultCfg = () => ({ mode: 'VCV', vt: 450, fr: 14, ti: 1.0, tplat: 0, pinsp: 15, ps: 10, rise: .15, peep: 5, fio2: 50, trigI: 2, trigE: 25, timax: 1.5, pmax: 40, apneaT: 20, minvol: 100, flow: 40, o2dev: 'reserv' });
const PRESS = { PCV: 1, PSV: 1, CPAP: 1, APV: 1, ASV: 1, PST: 1, CPV: 1, SIMV: 1 };
const TIMED = { VCV: 1, PCV: 1, APV: 1, CPV: 1 };
/* Oxigenoterapia convencional: FiO2 aproximada y caudal de O2 en L/min */
const O2DEV = { gafas: { fi: .28, q: 2, k: 6 }, venturi28: { fi: .28, q: 4 }, venturi35: { fi: .35, q: 9 }, venturi50: { fi: .5, q: 15 }, reserv: { fi: .75, q: 15, k: 6 } };
const o2Fi = (dev, ve) => { const d = O2DEV[dev]; return d.k ? .21 + (d.fi - .21) * clamp(d.k / Math.max(ve, 1), .5, 1) : d.fi; };

function create(opts) {
  const o = Object.assign({ pheno: 'sano', seed: 1, scale: 10, iface: 'tube', vent: 'monnal' }, opts || {});
  const P = Object.assign({}, PHENO[o.pheno]);
  // pediatría (peso < 40 kg): pulmón, espacio muerto y metabolismo escalados al peso; resistencias y frecuencias más altas; constantes por edad
  const ped = o.peso != null && o.peso < 40, kW = ped ? o.peso / 70 : 1;
  if (ped) { const al = Math.pow(70 / o.peso, .25), rs = Math.pow(70 / o.peso, .5), fr = Math.pow(70 / o.peso, .35);
    P.C *= kW; P.frc *= kW; P.vdAnat *= kW; P.vco2 *= kW * al; P.vo2 *= kW * al; P.Ri *= rs; P.Re *= rs; P.rr0 *= fr; P.rrMax *= fr;
    P.fc *= Math.pow(70 / o.peso, .23); P.tas *= Math.pow(o.peso / 70, .17); }
  const rnd = makeRng(o.seed);
  const gauss = () => { let u = 0, w = 0; while (!u) u = rnd(); while (!w) w = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w); };
  const S = {
    P, pk: o.pheno, t: 0, clin: 0, scale: o.scale, iface: o.iface,
    dev: { vent: o.vent, pneumatic: o.vent === 'medumat' },
    cfg: Object.assign(defaultCfg(), o.cfg || {}),
    ibw: ped ? o.peso : pesoIdeal(o.sex || P.sex, o.talla || P.talla), ped, kW, rrF: ped ? Math.pow(70 / o.peso, .35) : 1, rrCap: ped ? Math.min(80, 42 * Math.pow(70 / o.peso, .35)) : 42,
    V: 0, Paw: 0, Qlung: 0, Qvent: 0, palv: 0, pmus: 0, pmeanAlv: 6, pawMean: 5, vmeas: 0,
    pat: { next: 1, ts: -10, tin: 1, pmax: 0, rr: 14, open: false, id: 0, trig: 0, mid: 'exp', end: -10 },
    vent: { phase: 'exp', tb: -10, tc: 0, delivered: 0, peakQ: 0, trigHold: 0, rec: null, holdUntil: 0, lastTrig: 0, backup: false, kind: 'mand', nextMand: -99, mandDone: false },
    req: { inhold: false, exhold: false, manual: false },
    breaths: [], infl: [], efforts: [], ies: [], vin: 0, vinFi: 0, inInfl: false, vexh: 0, co2: 0, etMax: 0, etLast: 0,
    air: { extub: false, disc: false, leak: 0, obst: false, sel: false, reintubT: -1 },
    mask: { leak10: o.leak10 != null ? o.leak10 : 15, est: 0, nz: 0 },
    apv: { p: 12 }, asv: { f: 14, vt: 450, ti: 1 },
    isr: null, bag: false,
    ptx: o.ptx || 0, ptxActive: !!o.ptxTension, bmv: o.bmv != null ? o.bmv : 1, sgaFail: o.sgaFail || .08, odT: 0, shockMul: o.shockMul || 1, bs: o.bs || 1, bs0: o.bs || 1, deficit: o.deficit || 0, fluidPend: 0, sev: P.edema ? (o.sev != null ? o.sev : 1) : 0,
    drug: {}, E: {}, sedTot: 0, relTot: 0, opi: 0, drvMul: 1, anxUntil: -1,
    altitude: o.altitude || 0, pbar: 760,
    o2: { vol: o.bottleL || 5, bar: o.bottleBar || 200, supply: true, cons: 0 }, supAcc: 0, vmiEma: 6,
    pco2: o.pco2 || 40, veEma: 7, fao2: .45, spo2: .97, sao2: .97, tas: P.tas, fc: P.fc, vaEma: 4, drive: .3, awake: 0,
    hypoxT: 0, lowT: 0, lact: 1, lact0: 1, hco3m: null, arrestAt: o.arrest ? 0 : null, arrest: false, rhythm: o.bav ? 'bav' : o.rhythm || 'sinus', bav: !!o.bav,
    arr: { type: o.rhythm || null, pen: o.arrPen != null ? o.arrPen : 40 }, tasAdj: o.tasAdj || 0, fcAdj: o.fcAdj || 0, sevFloor: o.sevFloor || 0,
    tep: o.tep || 0, anaf: o.anaf || 0, cohb: o.cohb || 0, cn: o.cn || 0, weak: o.weak || 0, weak0: o.weak || 0, asp: o.asp || 0, aspT: o.asp || 0, derec: 0, clampUntil: -1,
    icp: o.icp ? { base: o.icp, grow: o.icpGrow || 0, v: o.icp } : null, edAir: o.edAir || 0, edAirRate: o.edAirRate || 0,
    dav: o.dav || .05, davMul: 1, attempts: 0, apox: false, o2boostUntil: -1, depotAdr: 0, adenPending: null, pauseUntil: -1, slowUntil: -1, bump: null, fiEff: .21,
    cpr: { comp: 'off', ratio: 0, paused: false, relevo: 0, noFlow: 0, cprTime: 0, shocks: 0, cause: null, vfAmp: 1, sinceCheck: 0, roscAt: -99, charged: false, ap: false },
    pace: { on: false, mode: 'demand', rate: 70, mA: 0, thr: 55 + Math.round(rnd() * 25), capture: false },
    mech: null, trend: [], log: [], mon: {}, timers: [],
    // v0.7: medio interno, temperatura, sangrado, tóxicos, convulsiones y acceso vascular
    peso: o.peso || null, hco3Off: o.hco3Off || 0, k: o.k || 4.2, kTot: o.k || 4.2, kRate: o.kRate || 0, glu: o.glu != null ? o.glu : 110, gluT: o.gluT != null ? o.gluT : (o.glu != null ? o.glu : 110),
    temp: o.temp || 36.6, tempRate: o.tempRate || 0, warm: false, bleed: o.bleed || 0, bleedSrc: o.bleedSrc || null, hemo: false, fluidKg: 0,
    tca: o.tca || 0, bicKg: 0, ecl: !!o.ecl, croup: o.croup || 0, seizUntil: -1, postIctUntil: -1, seizures: 0, postRosc: !!o.postRosc,
    access: o.access !== false, accessPend: null, ecg: { qrs: .08, t: 1, p: 1, j: 0, st: 0, amp: 1 }, gcs: 15,
    // v1.4: SCACEST (localización, VD, minutos de evolución al empezar, minutos hasta la ICP primaria) y taponamiento (0–1 y crecimiento por minuto)
    stemi: o.stemi ? { loc: o.stemi.loc || 'ant', rv: !!o.stemi.rv, onset: o.stemi.onset || 60, pci: o.stemi.pci != null ? o.stemi.pci : 30, reperf: false, reperfAt: null, tnkAt: null, icp: null } : null,
    tamp: o.tamp || 0, tampRate: o.tampRate || 0, pericPend: null,
    // v1.5: shock distributivo — vasoplejia séptica (0–1 y progresión por minuto hasta el antibiótico), neurogénico (0–1) y volumen que tolera el pulmón (mL/kg)
    vaso: o.vaso || 0, vasoRate: o.vasoRate || 0, neurog: o.neurog || 0, fluidTol: o.fluidTol || 35, atbAt: null, tad: 70, pam: 90
  };
  S.etAlv = S.pco2 * (1 - P.vdAlv);
  for (const k in DRUGS) S.drug[k] = { cp: 0, ce: 0, R: 0 };
  S.drug.sed.cp = S.drug.sed.ce = (o.sedE != null ? o.sedE : 3);
  S.drug.sed.R = o.sedStopped ? 0 : SED_RATE;
  S.drug.rel.cp = S.drug.rel.ce = (o.relCe != null ? o.relCe : 9);
  if (o.ntgPre) S.drug.ntg.cp = S.drug.ntg.ce = o.ntgPre;
  if (o.opioid) S.drug.morf.cp = S.drug.morf.ce = o.opioid;
  S.V = Math.max(o.iface === 'tube' || o.iface === 'mask' ? S.cfg.peep : 0, P.Pcrit) * P.C;
  if (o.arrest) { S.arrest = true; S.rhythm = o.arrest; S.cpr.cause = o.arrestCause || (o.arrest === 'vf' ? 'vf' : 'primary'); S.cpr.cause2 = o.arrestCause2 || null; S.cpr.comp = o.comp || 'off'; S.tas = 0; }
  if (o.postRosc) S.cpr.roscAt = 0;
  updateMech(0);
  S.awake = (1 - .85 * S.sedTot) * (1 - S.relTot);

  const isMask = () => S.iface === 'mask';
  const ventOff = () => S.iface === 'o2' || S.standby || (S.dev.pneumatic && !S.o2.supply && (S.iface === 'tube' || S.iface === 'mask'));
  const isOpen = () => S.air.extub || S.air.disc || !!S.isr || ventOff();
  const mode = () => S.cfg.mode;

  /* ---------- fármacos y mecánica derivada ---------- */
  function updateMech(dtc) {
    const E = S.E;
    for (const k in DRUGS) { const d = DRUGS[k], st = S.drug[k], kel = Math.LN2 / d.h; st.cp = Math.max(0, st.cp + (st.R - kel * st.cp) * dtc); st.ce += (st.cp - st.ce) * Math.min(1, dtc / d.on); E[k] = st.ce > 0 ? st.ce / (st.ce + d.ec50) : 0; }
    const opi = 1 - (1 - E.fent) * (1 - E.morf);
    S.opi = opi * (1 - E.nalox);
    S.sedTot = 1 - (1 - E.sed) * (1 - E.prop) * (1 - E.mid) * (1 - .9 * E.ket) * (1 - E.eto) * (1 - .35 * S.opi) * (1 - .55 * S.tca);
    S.relTot = 1 - (1 - E.rel) * (1 - E.sux);
    S.drvMul = (1 - .85 * S.opi) * (1 - .3 * E.prop) * (1 - .25 * E.mid) * (1 - .3 * S.tca);
    const bronch = 1 - (1 - .8 * E.salb) * (1 - .4 * E.mg) * (1 - .5 * E.adr) * (1 - .3 * E.ket) * (1 - .35 * E.cort);
    const tgt = (S.bs0 + 1.2 * S.anaf) * (1 - .45 * bronch);
    if (S.bs > tgt) S.bs += (tgt - S.bs) * Math.min(1, dtc / 6); else S.bs += (tgt - S.bs) * Math.min(1, dtc / 30);
    if (S.ptxActive) S.ptx = Math.min(1, S.ptx + dtc / 8);
    if (dtc > 0) {
      if (S.depotAdr > 0) { const ab = S.depotAdr * Math.min(1, dtc / 6); S.depotAdr -= ab; S.drug.adr.cp += ab; } // adrenalina IM: absorción lenta
      if (S.anaf > 0) S.anaf = clamp(S.anaf + (.08 * (1 - S.anaf) - (.9 * E.adr + .05 * E.cort + .01 * E.dexclor) * S.anaf) * dtc, 0, 1);
      if (S.tep > 0 && E.tnk > .4 && (!S.arrest || S.cpr.comp !== 'off')) S.tep = Math.max(0, S.tep - S.tep * E.tnk * dtc / 10);
      if (S.cn > 0 && E.hidroxo > .2) S.cn = Math.max(0, S.cn - S.cn * E.hidroxo * dtc / 6);
      S.asp += (S.aspT - S.asp) * Math.min(1, dtc / 8);
      S.edAir = clamp(S.edAir + S.edAirRate * dtc, 0, 1);
      if (P.shuntPeep > .01 && isOpen() && !S.isr && S.clin > S.clampUntil) S.derec += (1 - S.derec) * Math.min(1, dtc / .7);
      else if (!isOpen() && (S.iface === 'tube' || S.iface === 'mask') && S.cfg.peep >= 8) S.derec -= S.derec * Math.min(1, dtc / 10);
      if (E.manit > .2) S.deficit = Math.min(.6, S.deficit + .004 * E.manit * dtc);
    }
    if (S.fluidPend > 0) { const d = Math.min(S.fluidPend, dtc * .04); S.fluidPend -= d; S.deficit = Math.max(0, S.deficit - d); }
    if (P.edema && dtc > 0) {
      const tg = Math.max(S.sevFloor * (1 - .25 * Math.max(0, S.pmeanAlv - 5) / 5), clamp((S.tas - 115) / 85, 0, 1.2) - .03 * Math.max(0, S.pmeanAlv - 5) - .35 * E.furo);
      S.sev += (clamp(tg, 0, 1.2) - S.sev) * Math.min(1, dtc / 12);
    }
    S.pbar = pbarAt(S.altitude);
    const boyle = 760 / S.pbar;
    const ptxEff = S.ptxActive ? S.ptx : Math.min(1, S.ptx * boyle);
    S.croupEff = S.croup * (1 - .65 * E.adrN) * (S.clin < S.anxUntil ? 1.3 : 1);
    const croupR = 62 * Math.pow(1 / S.kW, .5) * S.croupEff + 55 * clamp((S.edAir - .45) / .4, 0, 1); // crup o edema de la vía aérea (humo, angioedema): obstrucción si no hay tubo
    const b = .6 + .4 * S.bs, a = S.air, sv = Math.min(1, S.sev), pe = (S.iface === 'tube' || S.iface === 'mask') ? S.cfg.peep : (S.iface === 'nasal' ? hfPaw() : 0);
    S.mech = {
      C: P.C * (a.sel ? .55 : 1) * (1 - .5 * ptxEff) * (1 - .5 * sv) * (1 - .4 * S.asp) * (1 - .2 * S.derec),
      Ri: P.Ri * b + (a.obst ? 25 : 0) + (a.sel ? 2 : 0) + (S.iface === 'o2' || S.iface === 'nasal' ? -3 : 0) + (S.iface !== 'tube' ? croupR : 0),
      Re: P.Re * b + (a.obst ? 25 : 0) + (S.iface !== 'tube' ? .3 * croupR : 0),
      Pcrit: P.Pcrit * b + 6 * Math.max(0, S.bs - 1),
      shunt: clamp(P.shunt0 - P.shuntPeep * (pe - 5), P.shuntMin, .5) + (a.sel ? .22 : 0) + .25 * ptxEff + (P.edema ? clamp(.3 * S.sev - .025 * (pe - 5) * Math.min(1, S.sev + .2), 0, .4) : 0) + clamp(.33 * S.asp - .015 * (pe - 5) * S.asp, 0, .38) + clamp(.009 * Math.max(0, (S.fluidKg || 0) - S.fluidTol), 0, .2) + .14 * S.derec + .06 * S.tep,
      frc: P.frc * (a.sel ? .6 : 1) * (1 - .4 * ptxEff) * (1 - .4 * sv),
      ptxEff
    };
  }
  function hfPaw() { return S.iface === 'nasal' ? .045 * (S.cfg.flow || 0) * (S.ped ? Math.pow(1 / S.kW, .8) : 1) : 0; }

  /* ---------- esfuerzo del paciente ---------- */
  function startEffort() {
    const pt = S.pat;
    S.peepiDyn = Math.max(0, S.V / S.mech.C - (S.iface === 'tube' || S.iface === 'mask' ? S.cfg.peep : S.iface === 'nasal' ? hfPaw() : 0));
    const narc = clamp((S.pco2 - 85) / 40, 0, .6);
    const met = clamp((P.hco3 - (S.hco3m != null ? S.hco3m : P.hco3)) / 8, 0, 1); // acidosis metabólica (láctica)
    // el CO2 manda: la hipocapnia frena el impulso hipóxico (salvo en el retenedor, que depende más de la hipoxemia)
    // acidosis metabólica: baja el punto de ajuste del CO2 según Winter (PaCO2 ≈ 1,5 × HCO3 + 8), sin hiperventilar por debajo
    const setp = P.co2set - Math.max(0, P.hco3 - (S.hco3m != null ? S.hco3m : P.hco3)) * (P.hyper ? .6 : 1);
    const hyx = Math.max(0, (.92 - S.spo2) / .08), c2 = (S.pco2 - setp) / (P.hyper ? 20 : 12);
    let drive = Math.max(.25 + .1 * met, c2 + .8 * hyx, P.hyper ? hyx : 0) + (P.edema ? .35 * S.sev : 0) + (S.clin < S.anxUntil ? .5 : 0) + .5 * S.tep + .3 * S.anaf + (S.iface !== 'tube' ? .45 * S.croupEff : 0);
    // bronquiolitis: taquipnea superficial por la inflamación, que alivia la presión positiva; sube la frecuencia, no el volumen
    const irr = P.irrit ? P.irrit * (1 - .5 * clamp((S.iface === 'tube' || S.iface === 'mask' ? S.cfg.peep : S.iface === 'nasal' ? hfPaw() : 0) / 4, 0, 1)) * S.drvMul : 0;
    drive = clamp(drive * (1 - narc) * S.drvMul, 0, 1.5);
    const driveV = drive; drive = Math.min(1.5, drive + irr);
    const awake = (1 - .85 * S.sedTot) * (1 - S.relTot) * (1 - narc * .5);
    const rr = clamp((P.rr0 + (P.rrMax - P.rr0) * Math.min(drive, 1.2)) * (1 - .4 * S.sedTot) * (1 - .85 * S.opi) * (1 + .6 * S.weak), 3, S.rrCap);
    let pm = (P.p0 + (P.pM - P.p0) * Math.min(driveV, 1.2)) * awake * (1 + (rnd() - .5) * .2) * (1 - S.weak);
    // vía aérea natural (oxigenoterapia, alto flujo): el paciente despierto moviliza el volumen que pide su impulso; la C del fenotipo es la del paciente ventilado
    if (S.iface === 'o2' || S.iface === 'nasal') { const ti = P.tiFrac * 60 / rr, f = clamp(1 - Math.exp(-ti / (S.mech.Ri * S.mech.C)), .35, .9), shallow = clamp(1 - (rr / S.rrF - 25) * .02, .7, 1);
      const dx = clamp((Math.min(driveV, 1.2) - .25) / .75, 0, 1.27), vtk = P.hyper ? 6.2 + 2.5 * Math.min(driveV, 1.2) : (6.8 + 4.5 * dx) * (1 + .4 * Math.min(dx, 1));
      const need = (S.ibw * vtk * shallow * (1 - .4 * S.opi) / 1000 / (S.mech.C * f) + 1.2 * Math.max(0, S.peepiDyn || 0)) * (1 - S.relTot) * (1 - narc * .5) * (1 - S.weak); pm = Math.min(30, Math.max(pm, need * (1 + (rnd() - .5) * .2))); }
    const m = mode(), lvl = m === 'PSV' || m === 'PST' ? S.cfg.ps : m === 'PCV' ? S.cfg.pinsp : (m === 'APV' || m === 'ASV') ? S.apv.p : 0;
    if (PRESS[m] && (S.iface === 'tube' || S.iface === 'mask')) pm *= (1 - .3 * clamp(lvl / 15, 0, 1));
    const skip = S.opi > .8 && rnd() < (S.opi - .8) * 2.5; // pausas de apnea en la intoxicación grave por opiáceos
    pt.ts = S.t; pt.tin = P.tiFrac * 60 / rr; pt.pmax = S.relTot > .6 || S.arrest || skip ? 0 : pm; pt.rr = rr; pt.open = pt.pmax > 1;
    pt.id++; pt.trig = 0; pt.mid = 'exp'; pt.midDone = false; pt.end = S.t + pt.tin;
    pt.next = S.t + 60 / rr * (1 + (rnd() - .5) * .15);
    if (pt.open) { S.efforts.push(S.t); if (S.efforts.length > 200) S.efforts.shift(); }
    S.drive = drive; S.awake = awake;
  }

  /* ---------- ciclo respiratorio del ventilador ---------- */
  function startBreath(type) {
    const v = S.vent, pt = S.pat, m0 = mode();
    if (v.rec && v.rec.vte == null) v.rec.vte = Math.max(0, -v.rec.vexp);
    // SIMV: mandatorio si toca por tiempo o si el esfuerzo cae en la ventana de sincronización; si no, espontáneo con PS
    // SIMV: mandatorias programadas cada 60/FR s. Un esfuerzo en la ventana de sincronización (último 40 % del intervalo) recibe la
    // mandatoria adelantada sin mover el calendario; fuera de la ventana, o ya dada la de ese intervalo, recibe soporte de presión.
    if (m0 === 'SIMV') {
      const P = 60 / Math.max(1, S.cfg.fr), inWin = S.t >= v.nextMand - .4 * P;
      v.kind = type === 'time' || type === 'man' || (inWin && !v.mandDone) ? 'mand' : 'spont';
      if (v.kind === 'mand') { if (type === 'time') { v.nextMand = S.t + P; v.mandDone = false; } else if (type !== 'man') v.mandDone = true; }
    } else v.kind = 'mand';
    const m = m0 === 'SIMV' ? (v.kind === 'spont' ? 'PSV' : S.cfg.simvMand || 'VCV') : m0;
    // modos adaptativos: ajusta la presión para alcanzar el Vt objetivo (máx. 2 cmH2O por ciclo)
    if ((m0 === 'APV' || m0 === 'ASV' || (m0 === 'SIMV' && S.cfg.simvMand === 'APV')) && v.rec && v.rec.lvl != null && v.rec.vti > .02 && !isOpen()) {
      const target = m0 === 'ASV' ? S.asv.vt : S.cfg.vt, meas = v.rec.vti * 1000, cEst = meas / Math.max(1, v.rec.lvl);
      S.apv.p = clamp(S.apv.p + clamp((target - meas) / Math.max(5, cEst) * .7, -2, 2), 5, S.cfg.pmax - 10);
    }
    S.peepTotReal = S.palv;
    const rec = { tb: S.t, p0: S.palv, type, ppk: S.Paw, vti: 0, vexp: 0, vte: null, v0: S.V, vmax: S.V, pplat: null, cycle: null, peepMeas: S.Paw, mode: m, kind: v.kind, backup: v.backup, effId: pt.open ? pt.id : null, effEnd: pt.open ? pt.end : null, dbl: false, late: false, prem: false, lvl: (m === 'APV' || m === 'ASV') ? S.apv.p : null };
    if (type === 'pat') { if (pt.trig >= 1) rec.dbl = true; pt.trig++; }
    v.rec = rec; S.breaths.push(rec); if (S.breaths.length > 90) S.breaths.shift();
    v.phase = 'insp'; v.tb = S.t; v.delivered = 0; v.peakQ = 0; v.trigHold = 0; S.vmeas = 0;
    if (type === 'pat' || type === 'auto') v.lastTrig = S.t;
    S.evMark = type === 'pat' ? 1 : type === 'auto' ? 4 : 2;
  }
  function cycle(reason) {
    const v = S.vent, r = v.rec, pt = S.pat;
    if (r) { r.cycle = reason; r.ti = S.t - r.tb; r.lungVt = Math.max(0, r.vmax - r.v0); r.palvEnd = S.palv; r.qEnd = S.Qlung;
      if (reason === 'time' && mode() === 'VCV' && !v.backup && S.cfg.tplat >= .1 && !isOpen()) r.pplatAuto = S.Paw;
      if (r.effEnd != null && S.t > r.effEnd + .3) r.late = true;
      if (pt.open && pt.id === r.effId && Math.sin(Math.PI * (S.t - pt.ts) / pt.tin) > .5) r.prem = true; }
    if (S.req.inhold && reason !== 'pmax') { S.req.inhold = false; v.phase = 'inhold'; v.holdUntil = S.t + 2; return; }
    v.phase = 'exp'; v.tc = S.t; S.vexh = 0; S.etMax = 0;
  }

  function step(dt) {
    const cfg = S.cfg, v = S.vent, m = S.mech, a = S.air, pt = S.pat, mask = isMask(), md0 = cfg.mode;
    const md = md0 === 'SIMV' ? (v.kind === 'spont' ? 'PSV' : cfg.simvMand || 'VCV') : md0;
    const leakE = Math.max(a.leak, a.sga ? (S.Paw > 25 ? .4 : .04) : 0); // el supraglótico sella hasta unos 25 cmH2O
    S.t += dt;
    if (S.t >= pt.next) startEffort();
    const x = (S.t - pt.ts) / pt.tin;
    let pmus = (x >= 0 && x < 1) ? pt.pmax * Math.sin(Math.PI * x) : 0;
    if (pt.open && x >= .5 && !pt.midDone) { pt.midDone = true; pt.mid = v.phase === 'insp' ? 'insp' : 'exp'; }
    if (pt.open && x >= 1) {
      pt.open = false;
      if (pt.trig === 0 && pt.mid === 'exp' && md !== 'CPAP' && md !== 'HFNC' && !isOpen() && S.iface !== 'nasal') { S.ies.push(S.t); if (S.ies.length > 200) S.ies.shift(); S.ieMark = 1; }
    }
    S.fight = S.iface === 'tube' && !S.arrest && !S.standby ? clamp((.55 - S.sedTot) / .35, 0, 1) * (1 - S.relTot) * (md === 'VCV' || md === 'APV' || md === 'CPV' || md === 'MAN' ? 1 : md === 'PCV' ? .6 : 0) : 0;
    const pushK = Math.max(S.awake * P.push, 9 * S.fight);
    if (S.t < (S.coughUntil || 0)) { const cp = (S.coughUntil - S.t) % .7; if (cp < .2) pmus -= 25 * Math.sin(Math.PI * cp / .2); }
    if (pushK > .5 && v.phase === 'insp' && x >= 1 && x < 1.8) pmus -= pushK * Math.sin(Math.PI * (x - 1) / .8);
    // compresiones torácicas
    let pComp = 0;
    S.cpr.paused = false;
    if (S.arrest && S.cpr.comp !== 'off' && S.cpr.ratio > 0) { const cyc = S.cpr.ratio * 60 / 110 + 4; if (S.t % cyc > S.cpr.ratio * 60 / 110) S.cpr.paused = true; }
    if (S.arrest && S.cpr.comp !== 'off' && !S.cpr.paused) { const ph = (S.t * 110 / 60) % 1; pComp = ph < .5 ? (S.cpr.comp === 'mech' ? 16 : 15 * cprQuality()) * Math.sin(Math.PI * ph / .5) : 0; }
    S.pComp = pComp;
    const palv = S.V / m.C - pmus + pComp;
    const open = isOpen(), off = ventOff();
    let Paw, Ql = 0, Qv = 0, Qleak = 0;
    const leakDef = () => mask ? Math.max(0, S.mask.leak10 * Math.sqrt(Math.max(cfg.peep + 5, 1) / 10) - 55) * .08 : 0;
    // presión en la boca cuando la vía está abierta al aire: atmósfera o bolsa autoinflable
    const viaMask = S.iface === 'o2' || S.iface === 'mask' || S.iface === 'nasal' || a.extub;
    let bagOn = (S.t % 6) < 1;
    if (S.arrest && S.cpr.comp !== 'off' && S.cpr.ratio > 0) { const cl = S.cpr.ratio * 60 / 110, tp = S.t % (cl + 4) - cl; bagOn = S.cpr.paused && ((tp > .3 && tp < 1.3) || (tp > 2.3 && tp < 3.3)); }
    const bagP = S.bag && open && !S.isr ? (bagOn ? 18 * (viaMask ? .8 * S.bmv : 1) : 0) : 0;

    if (S.iface === 'nasal' && !S.standby) { // alto flujo: presión espiratoria baja y continua, sin ciclos del equipo
      const pAw = hfPaw(), down = Math.max(pAw, m.Pcrit);
      if (palv > down) Ql = -(palv - down) / m.Re; else if (palv < pAw) Ql = (pAw - palv) / m.Ri; else Ql = -(palv - pAw) * .15 / m.Re;
      Paw = pAw; Qv = (cfg.flow || 0) / 60; v.phase = 'exp';
    } else if (off) {
      Paw = 0; Qv = 0; v.phase = 'exp';
    } else if (v.phase === 'insp') {
      const ti = S.t - v.tb;
      const vcLike = md === 'VCV' || md === 'MAN' || v.backup;
      if (vcLike) {
        const tf = Math.max(.2, cfg.ti - cfg.tplat), flow = cfg.vt / 1000 / tf;
        Qv = v.delivered < cfg.vt / 1000 ? flow : 0;
        const lf = mask ? clamp(S.mask.leak10 / 120, 0, .6) : leakE;
        if (open) { Paw = .8 + 1.5 * Qv; }
        else if (Qv > 0) { Ql = Qv * (1 - lf); Paw = palv + m.Ri * Ql; }
        else { Ql = 0; Paw = palv; }
        if (!open && S.dev.pneumatic && Paw > cfg.pmax) { Paw = cfg.pmax; Ql = Math.max(0, (Paw - palv) / m.Ri); Qv = Ql / (1 - lf); S.pmaxHit = S.t; } // limita sin cortar
        v.delivered += Qv * dt;
        if (!open && !S.dev.pneumatic && Paw > cfg.pmax) { S.pmaxHit = S.t; cycle('pmax'); }
        else if (ti >= cfg.ti) cycle('time');
      } else {
        const lvl = md === 'PCV' || md === 'CPV' ? cfg.pinsp : md === 'PSV' || md === 'PST' ? cfg.ps : (md === 'APV' || md === 'ASV') ? S.apv.p : 0;
        const target = cfg.peep + lvl * Math.min(1, ti / Math.max(.03, cfg.rise)) - leakDef();
        if (open) { Paw = Math.min(target, 2.5); Qv = Paw > 1 ? 1.6 : 0; }
        else {
          Paw = md === 'CPAP' ? target - .6 * Math.max(0, S.Qlung) : target;
          Ql = (Paw - palv) / m.Ri; if (Ql < 0) Ql = (Paw - palv) / m.Re;
          Qv = mask ? Ql : (Ql > 0 ? Ql / (1 - leakE) : Ql);
          if (md === 'CPV') Paw = Math.max(Paw, palv - 2); // durante la RCP la presión sigue a las compresiones sin cortar
        }
      }
    } else if (v.phase === 'inhold') {
      Ql = 0; Qv = 0; Paw = open ? 0 : palv;
      if (S.t >= v.holdUntil) { v.tb += 2; if (v.rec) v.rec.pplat = Paw; S.lastPplat = { v: Paw, t: S.t, peep: cfg.peep, vt: v.rec ? v.rec.vti : 0 }; v.phase = 'exp'; v.tc = S.t; S.vexh = 0; S.etMax = 0; }
    } else if (v.phase === 'exhold') {
      Ql = 0; Qv = 0; Paw = open ? 0 : palv;
      if (S.t >= v.holdUntil) { S.lastPeepTot = { v: Paw, t: S.t, peep: cfg.peep }; startBreath('time'); }
    } else { // espiración
      const pAw = open ? 0 : cfg.peep - leakDef() * .5;
      const down = Math.max(pAw, m.Pcrit);
      if (palv > down) Ql = -(palv - down) / (m.Re * (pComp > 0 ? 4 : 1)); // cierre de la vía aérea durante la compresión
      else if (palv < pAw) Ql = (pAw - palv) / m.Ri;
      else Ql = -(palv - pAw) * .15 / m.Re;
      Paw = pAw + (Ql > 0 ? (mask ? -.4 * Ql : 0) : Math.min(1.5, -Ql * .6));
      Qv = open ? 0 : (mask ? Ql : (Ql < 0 ? Ql * (1 - .5 * leakE) : Ql));
    }
    if (open && S.iface !== 'nasal') { // pulmón abierto a la atmósfera o a la bolsa
      const pA = bagP;
      if (palv > Math.max(pA, m.Pcrit)) Ql = -(palv - Math.max(pA, m.Pcrit)) / (m.Re * (pComp > 0 ? 4 : 1)); else if (palv < pA) Ql = (pA - palv) / m.Ri; else Ql = 0;
      if (off) Paw = 0;
    }
    // fuga de mascarilla, compensación del equipo y ruido -> flujo que mide el ventilador
    let Qm = Qv;
    if (mask && !open) {
      Qleak = S.mask.leak10 / 60 * Math.sqrt(Math.max(Paw, 0) / 10);
      S.mask.est += (.92 * Qleak - S.mask.est) * Math.min(1, dt / 3);
      const sig = (.3 + Math.max(0, S.mask.leak10 - 20) * .14) / 60;
      S.mask.nz += -S.mask.nz * dt / .3 + sig * Math.sqrt(2 * dt / .3) * gauss();
      Qm = Ql + (Qleak - S.mask.est) + S.mask.nz;
    }
    // disparo y ciclado sobre el flujo medido
    if (!off && S.iface !== 'nasal') {
      if (v.phase === 'insp') {
        const ti = S.t - v.tb, r = v.rec;
        v.peakQ = Math.max(v.peakQ, Qm);
        if (PRESS[md] && !(md === 'VCV' || v.backup)) {
          if (!open && md !== 'CPV' && Paw > cfg.pmax) { S.pmaxHit = S.t; cycle('pmax'); }
          else if (md === 'PCV' || md === 'APV' || md === 'CPV') { if (ti >= cfg.ti) cycle('time'); }
          else if ((md === 'ASV' || md === 'PST') && r && r.type === 'time') { if (ti >= (md === 'ASV' ? S.asv.ti : cfg.ti)) cycle('time'); }
          else {
            const thr = md === 'CPAP' ? .25 : md === 'ASV' ? .25 : cfg.trigE / 100;
            if (ti > Math.max(.15, cfg.rise) && Qm < thr * v.peakQ) cycle('flow');
            else if (ti >= (md === 'ASV' ? 2 : cfg.timax)) cycle('timax');
          }
        }
        if (v.rec) { v.rec.ppk = Math.max(v.rec.ppk, Paw); v.rec.vti += Math.max(0, Qm) * dt; }
      } else if (v.phase === 'exp') {
        if (v.rec && Qm < 0) v.rec.vexp += Qm * dt;
        const since = S.t - v.tc;
        let trig = null;
        if (S.req.manual && !open && since > .25) { S.req.manual = false; trig = 'man'; }
        if (!trig && !open && since > .25 && md !== 'CPV' && md !== 'MAN') {
          if (Qm * 60 > cfg.trigI) { v.trigHold += dt; if (v.trigHold >= .03) trig = pt.open ? 'pat' : (S.pat.pmax > 1 || mask || S.awake > .2 ? 'auto' : 'pat'); } else v.trigHold = 0;
        }
        if (!trig && md !== 'MAN') {
          if (md0 === 'SIMV') { const P = 60 / cfg.fr; if (S.t >= v.nextMand) { if (!v.mandDone) trig = 'time'; else { v.nextMand += P; if (v.nextMand < S.t) v.nextMand = S.t + P; v.mandDone = false; } } }
          else if (TIMED[md]) { if (S.t - v.tb >= 60 / cfg.fr) trig = 'time'; }
          else if (md === 'ASV') { if (S.t - v.tb >= 60 / S.asv.f) trig = 'time'; }
          else if (md === 'PST') { if (S.t - v.tb >= 60 / cfg.fr) trig = 'time'; }
          else if (S.t - v.lastTrig >= cfg.apneaT && S.t - v.tb >= 60 / cfg.fr) { trig = 'time'; v.backup = true; }
        }
        if (trig && (trig !== 'time' || md === 'PST' || md === 'ASV')) v.backup = false;
        if (trig) {
          if (S.req.exhold && !open) { S.req.exhold = false; v.phase = 'exhold'; v.holdUntil = S.t + 2; if (v.rec && v.rec.vte == null) v.rec.vte = Math.max(0, -v.rec.vexp); }
          else startBreath(trig);
        }
      }
    }
    S.V += Ql * dt; S.Qlung = Ql; S.Qvent = Qm; S.Paw = Paw; S.palv = palv; S.pmus = pmus; S.Qleak = Qleak;
    if (v.rec) v.rec.vmax = Math.max(v.rec.vmax, S.V);
    S.vmeas = S.iface === 'nasal' || off ? 0 : v.phase === 'insp' || v.phase === 'inhold' ? S.vmeas + Math.max(0, Qm) * dt : Math.max(0, S.vmeas + Qm * dt);
    S.pmeanAlv += (palv + pmus - pComp - S.pmeanAlv) * dt / 6;
    S.pawMean += (Paw - S.pawMean) * dt / 6;
    S.supAcc += (S.iface === 'nasal' ? (cfg.flow || 0) / 60 : off ? 0 : mask ? Math.max(0, Ql) + Qleak : Math.max(0, v.phase === 'insp' ? Qv : 0)) * dt;

    // insuflaciones reales del pulmón -> ventilación alveolar
    let fiNow = S.o2.supply ? (S.clin < S.o2boostUntil ? 1 : cfg.fio2 / 100) : .21;
    if (S.iface === 'o2') fiNow = S.o2.supply ? o2Fi(cfg.o2dev, S.veEma) : .21;
    if (S.iface === 'nasal' && Ql * 60 > (cfg.flow || 0)) fiNow = ((cfg.flow || 0) * fiNow + (Ql * 60 - (cfg.flow || 0)) * .21) / (Ql * 60);
    if (open && S.iface !== 'o2') fiNow = S.bag ? (S.o2.supply ? .9 : .21) : (S.isr && S.isr.apox ? .9 : .21);
    if (Ql > 0) { if (!S.inInfl) S.inflSrc = !open && (S.iface === 'tube' || S.iface === 'mask') ? 'vent' : bagP > 0 ? 'bag' : 'pat'; S.vin += Ql * dt; S.vinFi += Ql * dt * fiNow; S.inInfl = true; }
    else if (S.inInfl && Ql < -0.005) {
      S.inInfl = false;
      if (S.vin > .03) {
        const vt = S.vin * 1000, vdA = alvDS(), vdAn = P.vdAnat + (mask ? 30 * S.kW : 0) - (S.iface === 'nasal' ? 40 * S.kW * Math.min(1, (cfg.flow || 0) / (40 * S.kW)) : 0);
        const vd = vdAn + vdA * Math.max(0, vt - vdAn);
        S.infl.push({ t: S.t, va: Math.max(0, vt - vd) / 1000, fi: S.vinFi / S.vin, vt, src: S.inflSrc });
      }
      S.vin = 0; S.vinFi = 0;
    }
    // capnograma en la boca, la mascarilla o la gafa nasal
    const sampled = !(a.extub || a.disc || S.isr) || S.iface === 'o2';
    if (!sampled) S.co2 = Math.max(0, S.co2 - dt * 200);
    else if (Ql < 0 && (v.phase === 'exp' || mask || S.iface === 'o2' || S.iface === 'nasal' || off)) {
      S.vexh += -Ql * dt;
      const k = .035 * (1 + 2.2 * Math.max(0, m.Re / P.Re * (.6 + .4 * S.bs) - 1) + (a.obst ? 1.5 : 0) + (P.Pcrit > 0 ? .8 : 0));
      const vd = P.vdAnat / 1000 * .8, dil = mask ? .85 : S.iface === 'o2' || S.iface === 'nasal' ? .8 : 1;
      S.co2 = S.vexh > vd ? S.etAlv * dil * (1 - Math.exp(-(S.vexh - vd) / k)) : 0;
      S.etMax = Math.max(S.etMax, S.co2);
    } else if (Ql > 0) { if (S.etMax > 3) { S.etLast = S.etMax; S.etT = S.t; } S.etMax = 0; S.vexh = 0; S.co2 = Math.max(0, S.co2 - dt * 600); }
    if (S.t - (S.etT || 0) > 8) S.etLast = Math.max(0, S.etLast - dt * 4);

    if (S.timers.length) { const due = S.timers.filter(q => S.t >= q.at); if (due.length) { S.timers = S.timers.filter(q => S.t < q.at); due.forEach(q => q.fn()); } }
    S.acc = (S.acc || 0) + dt;
    if (S.acc >= .25) { S.acc -= .25; slow(.25); }
  }
  function cprQuality() { return S.cpr.comp === 'mech' ? .95 : clamp(.92 - .06 * S.cpr.relevo, .55, .92); }

  function targets() {
    const E = S.E;
    const sens = 1.2 * P.hemo * (1 + 2 * S.deficit);
    const ptxT = S.ptxActive ? S.ptx : 0;
    const base = P.tas * (1 - .35 * E.ntg) + P.sympa * 30 * (S.drive - .5);
    const dep = (12 * E.sed + 30 * E.prop + 10 * E.mid + 4 * E.eto + 10 * S.opi + 6 * E.mg) * (1 + 1.5 * S.deficit);
    const bump = S.bump && S.clin < S.bump.until ? S.bump.v : 0;
    const icpX = S.icp ? Math.max(0, S.icp.v - 35) : 0;
    const X = S.mx || { kM: 0, tcaE: 0, tf: 0, seiz: false };
    let tas = base + S.tasAdj - bump - 70 * S.anaf * (1 - .6 * E.adr) - 60 * S.tep * (1 + .04 * Math.max(0, S.cfg.peep - 8)) - 40 * S.cn + 2.5 * icpX - 45 * S.deficit - 150 * Math.pow(Math.max(0, S.deficit - .35), 1.2) + 50 * E.nor + 60 * E.adr + 14 * E.ket - dep - 8 * E.furo - sens * Math.max(0, S.pmeanAlv - 8) - 80 * ptxT * ptxT + 18 * (S.fight || 0) - (S.spo2 < .7 ? 40 * (.7 - S.spo2) / .3 : 0) - (S.hypoxT > 1.5 ? 30 : 0) - 55 * X.kM - 55 * X.tcaE - 5 * X.tf - 55 * E.urap - 60 * E.labet - 8 * E.iso + (X.seiz ? 25 : 0) + 6 * E.ca;
    let fc = P.fc + 30 * S.deficit + 22 * clamp((100 - S.tas) / 40, 0, 1) + 20 * (S.fight || 0) - 10 * S.sedTot + 12 * E.salb + 12 * (S.drive - .5) * (S.awake > .3 ? 1 : 0) + 8 * E.ntg + 30 * E.atr + 28 * E.adr + 10 * E.ket - 8 * S.opi - 10 * E.amio + S.fcAdj + 25 * S.tep + 25 * S.anaf + 20 * S.cn + 30 * S.cohb - 1.8 * icpX - 50 * X.kM + 35 * S.tca - 20 * E.labet + 45 * E.iso + 10 * E.adrN + (X.seiz ? 25 : 0) + 15 * clamp((60 - S.glu) / 35, 0, 1);
    fc *= 1 - .055 * X.tf;
    // v1.4: taponamiento (la presión positiva lo empeora; el volumen gana tiempo) e infarto de VD (los nitratos hunden la TA)
    const tE = tampEff();
    if (tE > 0) { tas -= 80 * Math.pow(tE, 1.3) + 4.5 * tE * Math.max(0, S.pmeanAlv - 5) - Math.min(20, 1.2 * (S.fluidKg || 0)) * tE; fc += 60 * tE; }
    if (S.stemi && S.stemi.rv) tas -= 40 * E.ntg;
    // v1.5: vasoplejia séptica (taquicardia) y neurogénica (sin taquicardia refleja y con bradicardia)
    if (S.vaso > 0) { tas -= 62 * S.vaso - 30 * E.nor * S.vaso; fc += 40 * S.vaso; } // la noradrenalina rinde más en la vasoplejia
    if (S.neurog > 0) { tas -= 55 * S.neurog - 45 * E.nor * S.neurog; fc -= S.neurog * (22 * clamp((100 - S.tas) / 40, 0, 1) + 38); }
    const ar = S.arr.type;
    if (ar && !S.pace.capture) {
      fc = ar === 'tsv' ? 186 : ar === 'flutter' ? 150 - 20 * E.amio : ar === 'fa' ? 158 - 45 * E.amio : ar === 'tvp' ? 178 - 15 * E.amio : 36 + 55 * E.atr + 40 * E.adr + 45 * E.iso;
      if (S.t < S.slowUntil) fc *= .55;
      tas -= S.arr.pen * (ar === 'sbrady' ? clamp((62 - fc) / 26, 0, 1) : clamp((fc - 120) / 60, 0, 1.3));
    }
    if (S.bav && !S.pace.capture) { fc = 32 + 8 * E.atr + 30 * E.adr + 35 * E.iso; tas -= 45 - 25 * E.adr - 20 * E.iso; }
    if (S.hypoxT > 1.5) fc = 38 + 30 * E.atr + 25 * E.adr;
    S.fcIntr = fc;
    if (S.pace.capture) { fc = S.pace.rate; tas -= S.bav ? 10 : 0; }
    return { tas: clamp(tas, 30, 240), fc: clamp(fc, 25, 190) };
  }
  function tampEff() { return clamp((S.tamp - .25) / .6, 0, 1.2); }
  function alvDS() { const low = clamp((90 - S.tas) / 40, 0, 1); return P.vdAlv + .25 * low + .1 * S.mech.ptxEff + .35 * S.tep + (P.hyper ? .15 * clamp((S.spo2 - .9) / .07, 0, 1) : 0); }

  /* ---------- medio interno, temperatura, hemorragia, tóxicos y convulsiones (v0.7) ---------- */
  function phShift() { return .35 * clamp((7.4 - (S.ph || 7.4)) / .1, -2, 4); } // la acidosis saca potasio de la célula: ≈ 0,5 mmol/L por cada 0,1 de pH
  function metab(dtc) {
    const E = S.E, peso = S.peso || S.ibw * 1.1;
    if (dtc > 0) {
      S.temp = clamp(S.temp + (S.warm ? .3 * S.tempRate + 1 : S.tempRate) * dtc / 60, 20, 42);
      S.glu += (S.gluT - 55 * E.ins - S.glu) * Math.min(1, dtc / 25) + 3 * E.glucg * dtc;
      S.glu = clamp(S.glu, 10, 700);
      if (S.gluPerf) S.glu += 5 * S.gluPerf * dtc;
      S.kTot += S.kRate * dtc / 60;
      S.bicKg -= S.bicKg * Math.LN2 / 180 * dtc;
      if (S.croup > 0 && E.dexa > .1) S.croup = Math.max(.1, S.croup - .012 * E.dexa * dtc);
      if (S.croup > 0 && S.iface !== 'tube') S.weak = clamp(S.weak + (S.croupEff > .5 ? .04 * (S.croupEff - .5) : -.01) * dtc, 0, .6); // agotamiento por el trabajo respiratorio
      // hemorragia: depende de la presión, del tranexámico, de la hemostasia, de la oxitocina y de la coagulopatía (frío, dilución, acidosis)
      if (S.bleed > 0 && !S.arrest) {
        const pf = Math.pow(clamp(S.tas / 100, .3, 1.6), 1.5), src = S.bleedSrc;
        const hem = S.hemo ? (src === 'ext' ? .1 : src === 'pelv' ? .55 : src === 'uter' ? .6 : 1) : 1;
        const coag = 1 + .08 * clamp(35.5 - S.temp, 0, 6) + .3 * clamp((S.fluidKg - 20) / 40, 0, 1.5) + .4 * clamp((7.2 - (S.ph || 7.4)) / .2, 0, 1);
        S.bleedNow = S.bleed * pf * (1 - .3 * E.txa) * hem * (src === 'uter' ? 1 - .6 * E.oxito : 1) * coag;
        S.deficit = Math.min(.7, S.deficit + S.bleedNow * dtc); S.lost = (S.lost || 0) + S.bleedNow * dtc;
      } else S.bleedNow = 0;
    }
    S.k = S.kTot - 1.0 * E.ins - .7 * E.salb + phShift();
    const kM = clamp((S.k - 6) / 2.5, 0, 1.4) * (1 - .9 * Math.min(1, E.ca / .6)); // el calcio estabiliza la membrana en minutos; el efecto se va en 30–60 min
    const alk = clamp(((S.ph || 7.4) - 7.4) / .12, 0, 1), bicNa = clamp(S.bicKg / 1.5, 0, 1);
    const tcaE = S.tca * (1 - .45 * alk - .45 * bicNa);
    const tf = clamp(36.5 - S.temp, 0, 14);
    const seiz = S.clin < S.seizUntil;
    const stII = S.stemi ? (S.stemi.loc === 'inf' ? 3 : -1) * (S.stemi.reperf ? clamp(1 - (S.clin - S.stemi.reperfAt) / 15, .3, 1) : 1) : 0; // ST en II (mm): inferior eleva, anterior y lateral, descenso especular
    S.ecg = { qrs: .08 + .1 * kM + .1 * tcaE, t: 1 + 2.4 * clamp((S.k - 5.5) / 2, 0, 1), p: 1 - clamp((S.k - 6.5) / 1.5, 0, 1), j: clamp((33 - S.temp) / 4, 0, 1), st: stII, amp: 1 - .45 * tampEff() };
    S.mx = { kM, tcaE, tf, seiz, met: clamp(1 - .065 * (36.6 - S.temp), .35, 1.4) * (seiz ? 1.4 : 1) };
    if (S.arrest) S.gcs = 3;
    // v1.4: SCACEST — reperfusión tras la fibrinólisis (más probable cuanto antes), FV primaria y bradicardia en el inferior
    if (S.stemi && dtc > 0 && !S.arrest) {
      const m = S.stemi;
      if (!m.reperf && S.E.tnk > .4 && m.tnkAt == null) { m.tnkAt = S.clin; const since = m.onset + S.clin; if (rnd() < (since <= 120 ? .82 : since <= 360 ? .68 : .45)) m.reperfAt = S.clin + 15 + 30 * rnd(); }
      if (!m.reperf && m.reperfAt != null && S.clin >= m.reperfAt) { m.reperf = true; S.log.push([S.clin, 'Reperfusión: cede el dolor y baja el ST']); }
      if (!m.reperf && rnd() < dtc * (m.loc === 'ant' ? .006 : .004)) enterArrest('vf');
      else if (!m.reperf && m.loc === 'inf' && !S.arr.type && rnd() < dtc * .006) { S.arr.type = 'sbrady'; S.arr.pen = 35; }
    }
    // v1.5: sepsis — la vasoplejia progresa hasta unos 20 min después del antibiótico; la fuga capilar consume el volumen
    if (S.vaso > 0 && dtc > 0 && !S.arrest) {
      if (S.E.atb > .3 && S.atbAt == null) S.atbAt = S.clin;
      S.vaso = clamp(S.vaso + (S.atbAt != null && S.clin - S.atbAt > 20 ? 0 : S.vasoRate) * dtc, 0, 1);
      S.deficit = clamp(S.deficit + .0025 * S.vaso * dtc, 0, .6);
    }
    // taponamiento: el derrame crece; muy grande, AESP
    if (S.tamp > 0 && dtc > 0) { S.tamp = clamp(S.tamp + S.tampRate * dtc, 0, 1); if (!S.arrest && S.tamp > .88 && rnd() < dtc * .5) enterArrest('tamp'); }
    if (S.pericPend && S.clin >= S.pericPend.until) { const pp = S.pericPend; S.pericPend = null; if (!pp.fail) { S.tamp = Math.max(.12, S.tamp - .65); S.tampRate *= .4; S.log.push([S.clin, 'Pericardiocentesis: salen 150 mL de líquido']); } else S.log.push([S.clin, 'Pericardiocentesis sin éxito: no se obtiene líquido']); }
    // acceso vascular en curso (también durante la parada)
    if (S.accessPend && S.clin >= S.accessPend.until) { const a = S.accessPend; S.accessPend = null; if (!a.fail) S.access = a.kind; if (S.onAccess) S.onAccess(a.kind, !a.fail); }
    if (dtc <= 0 || S.arrest) return;
    // convulsiones: eclampsia (protege el magnesio), tricíclicos, hipoglucemia grave y herniación
    const gluN = clamp((60 - S.glu) / 35, 0, 1);
    const rate = (S.ecl ? .2 * Math.pow(1 - E.mg, 3) * (S.tas > 160 ? 1.5 : 1) : 0) + .05 * tcaE + (gluN > .7 ? .05 : 0) + (S.icp && S.icp.v > 32 ? .02 : 0);
    if (seiz && (E.mid > .25 || S.sedTot > .6 || E.prop > .4)) { S.seizUntil = S.clin; S.postIctUntil = S.clin + 8; S.log.push([S.clin, 'Cede la convulsión']); }
    else if (!seiz && rate > 0 && rnd() < rate * dtc) startSeizure();
    if (seiz && S.clin + dtc >= S.seizUntil) S.postIctUntil = S.seizUntil + 10;
    // arritmias por potasio, tricíclicos e hipotermia
    if (kM > .75 && rnd() < dtc * .12 * (kM - .7)) enterArrest('hyperk');
    else if (S.ecg.qrs > .16 && rnd() < dtc * .04 * clamp((S.ecg.qrs - .15) / .04, 0, 1.5)) { if (S.tas < 70) enterArrest('tca'); else if (!S.arr.type) { S.arr.type = 'tvp'; S.log.push([S.clin, 'TV por QRS ancho']); } }
    else if (S.temp < 30 && rnd() < dtc * .006 * (30 - S.temp)) enterArrest('hypoT');
    // escala de Glasgow aproximada
    let g = 15 - 12 * S.sedTot - 3 * S.opi - 9 * gluN - 1.3 * clamp(32 - S.temp, 0, 8) - (S.pco2 > 80 ? (S.pco2 - 80) / 5 : 0) - (S.oxEff < .75 ? (.75 - S.oxEff) * 30 : 0) - (S.tas < 70 ? (70 - S.tas) / 5 : 0) - (S.cohb > .2 ? (S.cohb - .2) * 25 : 0) - (S.icp && S.icp.v > 22 ? (S.icp.v - 20) / 3 : 0);
    if (seiz) g = Math.min(g, 5); else if (S.clin < S.postIctUntil) g -= 4;
    S.gcs = Math.round(clamp(g, 3, 15));
  }
  function startSeizure() { S.seizUntil = S.clin + 1 + rnd() * 1.5; S.seizures++; S.log.push([S.clin, 'Convulsión tónico-clónica']); if (S.onSeizure) S.onSeizure(); }

  /* ---------- variables lentas (tiempo clínico acelerado) ---------- */
  function slow(dts) {
    const dtc = dts * S.scale / 60; // minutos clínicos
    S.clin += dtc;
    updateMech(dtc);
    const t = S.t;
    // ventilación alveolar a partir de las últimas respiraciones, sin ventana fija de reloj: así no depende de la velocidad elegida
    const ventDelivers = !isOpen() && (S.iface === 'tube' || S.iface === 'mask'), selfBreath = S.pat.pmax > 1 && !S.arrest;
    if (!ventDelivers && !S.bag && !selfBreath) S.infl = []; // apnea conocida: la ventilación cae a cero en el acto
    else if (!ventDelivers || !S.bag || !selfBreath) S.infl = S.infl.filter(e => (e.src !== 'vent' || ventDelivers) && (e.src !== 'bag' || S.bag) && (e.src !== 'pat' || selfBreath)); // fuera las respiraciones de una fuente que ya no ventila
    S.infl = S.infl.filter(e => e.t > t - 40);
    metab(dtc);
    const seizing = S.clin < S.seizUntil;
    const L = S.infl.slice(-4);
    let VA = 0, VE = 0, fiAvg = isOpen() && !S.bag ? .21 : S.cfg.fio2 / 100;
    if (L.length) {
      const last = L[L.length - 1], guess = Math.max(ventDelivers ? (S.cfg.fr || 0) : 0, selfBreath ? S.pat.rr : 0, S.bag ? 10 : 0) || 12;
      const interval = L.length >= 2 ? (last.t - L[0].t) / (L.length - 1) : 60 / guess, effInt = Math.max(interval, t - last.t, .5);
      let va = 0, fiw = 0, vt = 0; for (const e of L) { va += e.va; fiw += e.va * e.fi; vt += e.vt / 1000; }
      VA = va / L.length * 60 / effInt; VE = vt / L.length * 60 / effInt; if (va > 0) fiAvg = fiw / va;
    }
    if (seizing && !ventDelivers) { VA *= .25; VE *= .4; } // convulsión: respiración ineficaz
    S.vaInst = VA; S.veInst = VE; S.fiEff = fiAvg;
    // fatiga de la musculatura débil: empeora mientras trabaja sola con impulso alto; descansa con soporte
    if (S.weak0 > 0) S.weak = clamp(S.weak + (ventDelivers ? -.006 : .03 * Math.max(0, S.drive - .4)) * dtc, S.weak0 * .8, .85);
    S.veEma += (VE - S.veEma) * Math.min(1, dtc / .1);
    S.vaEma += (VA - S.vaEma) * Math.min(1, dtc / .1);
    const vaE = Math.max(S.vaEma, 0);
    // ASV simplificado: frecuencia de mínimo trabajo (Otis) para el volumen minuto objetivo
    if (S.cfg.mode === 'ASV') {
      const VM = S.cfg.minvol / 100 * .1 * S.ibw, VD = 2.2 * S.ibw / 1000, RCe = Math.max(.2, S.mech.Re * S.mech.C), aa = 2 * Math.PI * Math.PI / 60;
      let f = 15; for (let i = 0; i < 8; i++) f = clamp((Math.sqrt(1 + 2 * aa * RCe * Math.max(.1, VM - f * VD) / VD) - 1) / (aa * RCe), 5, 40);
      S.asv.f = f; S.asv.vt = clamp(VM / f * 1000, 4.4 * S.ibw, 15 * S.ibw); S.asv.ti = clamp(Math.min(60 / f * .33, 60 / f - 3 * RCe), .6, 1.5);
    }
    // CO2 y pH
    const metF = S.mx ? S.mx.met : 1;
    const eq = vaE > .4 ? clamp(.863 * P.vco2 * metF / vaE, 15, 140) : 140;
    const tau = vaE > .4 ? P.co2tau : 20;
    S.pco2 += (eq - S.pco2) * Math.min(1, dtc / tau);
    // O2: reserva alveolar (FRC) con lavado por VA y consumo
    const Pb = S.pbar, q = .863 * P.vo2 * metF / (Pb - 47) * (S.tas < 80 ? .9 : 1) * (1 - .22 * clamp(1 - S.vaEma / 1.5, 0, 1));
    const frc = S.mech.frc;
    const apox = S.isr && S.isr.apox && S.o2.supply ? .15 : 1; // oxigenación apneica: el O2 consumido se repone por flujo de masa
    S.fao2 += ((vaE / frc) * (fiAvg - S.fao2) - q * apox / frc) * dtc;
    S.fao2 = clamp(S.fao2, .01, 1);
    const PAO2 = S.fao2 * (Pb - 47);
    const sv = P.sv - .12 * clamp((90 - S.tas) / 40, 0, 1) - (S.fao2 < .08 ? .1 : 0);
    const sc = sat(PAO2);
    const mixed = Math.min(sv, sc), lowVQ = Math.max(mixed, Math.min(sat(PAO2 * .3), sc)); // unidades de baja V/Q: mejoran con más FiO2; el shunt verdadero no
    S.sao2 = clamp((1 - S.mech.shunt) * sc + S.mech.shunt * ((1 - P.vq) * mixed + P.vq * lowVQ), .2, 1);
    S.pao2 = PAO2;
    S.spo2 += (S.sao2 - S.spo2) * Math.min(1, dtc / .35);
    if (S.cohb > 0) { const th = 300 / (1 + 3 * clamp((S.fiEff - .21) / .79, 0, 1)) * clamp(4.5 / Math.max(vaE, .5), .8, 1.6); S.cohb = Math.max(0, S.cohb - S.cohb * Math.LN2 / th * dtc); }
    S.oxEff = S.spo2 * (1 - S.cohb) - .25 * S.cn; // el pulsioxímetro no distingue la COHb
    // lactato (hipoperfusión, hipoxia tisular, sepsis, cianuro, CO, anafilaxia, parada) y equilibrio ácido-base con tampón agudo
    const lt = 1 + 4 * clamp((90 - S.tas) / 40, 0, 1.2) + 4 * clamp((.85 - S.oxEff) / .25, 0, 1.2) + (S.pk === 'sepsis' ? 3 : 0) + 5 * S.vaso + 8 * S.cn + 6 * S.cohb + 3 * S.anaf;
    if (!S.lactInit) { S.lactInit = true; S.lact = S.lact0 = S.arrest ? 2 : lt; }
    if (S.arrest) S.lact += (S.cpr.comp !== 'off' ? .25 : .6) * dtc; else S.lact += (lt - S.lact) * Math.min(1, dtc / (lt > S.lact ? 6 : 40));
    S.hco3m = P.hco3 - .9 * (S.lact - S.lact0) + S.bicKg / .4 + (S.hco3Off || 0);
    S.hco3 = Math.max(4, S.hco3m + (S.pco2 >= P.co2set ? .1 : .2) * (S.pco2 - P.co2set));
    S.ph = 6.1 + Math.log10(S.hco3 / (.03 * S.pco2));
    if (S.icp) { S.icp.base = clamp(S.icp.base + S.icp.grow * dtc, 5, 70); S.icp.v = clamp(S.icp.base - 9 * S.E.shs - 9 * S.E.manit + .9 * (S.pco2 - 40) + .3 * Math.max(0, S.cfg.peep - 5) + 10 * (S.fight || 0) + (S.oxEff < .9 ? 12 * (.9 - S.oxEff) / .2 : 0) + (S.tas > 160 ? (S.tas - 160) * .1 : 0), 3, 90); }
    if (S.adenPending && S.clin >= S.adenPending.at) { const d = S.adenPending.dose; S.adenPending = null; if (!S.arrest) { S.pauseUntil = S.t + 4.5; const t = S.arr.type;
        if (t === 'tsv' && rnd() < (d >= 12 ? .85 : .6)) { S.arr.type = null; S.log.push([S.clin, 'Adenosina: TSV revertida']); }
        else if (t === 'fa' || t === 'flutter' || t === 'tvp') S.slowUntil = S.t + 9; } }
    if (S.arr.type === 'tvp' && rnd() < .2 * S.E.amio * dtc) S.arr.type = null;
    if ((S.arr.type === 'fa' || S.arr.type === 'flutter') && rnd() < .025 * S.E.amio * dtc) S.arr.type = null;
    // marcapasos transcutáneo
    S.pace.capture = S.pace.on && S.pace.mA >= S.pace.thr && !S.arrest && !(S.pace.mode === 'demand' && (S.fcIntr || 0) >= S.pace.rate);
    if (S.pace.capture && S.pace.mode === 'overdrive' && ['tvp', 'flutter', 'tsv'].includes(S.arr.type) && S.pace.rate > (S.fcIntr || 0) + 10) S.odT += dtc;
    // circulación, parada y RCP
    if (!S.arrest && (S.arr.type || S.bav) && !S.pace.capture) {
      const uns = S.tas < 90;
      S.arr.pen += dtc * (uns ? .8 : .1); if (S.bav) S.tasAdj -= dtc * (uns ? .4 : .05);
      if (S.arr.type === 'tvp' && rnd() < dtc * (uns ? .02 : .005)) enterArrest(rnd() < .5 ? 'vf' : 'vt');
    }
    if (!S.arrest) {
      S.hypoxT = S.oxEff < .55 ? S.hypoxT + dtc : Math.max(0, S.hypoxT - dtc);
      S.lowT = S.tas < 50 ? S.lowT + dtc : Math.max(0, S.lowT - 2 * dtc);
      const tg = targets();
      S.tas += (tg.tas - S.tas) * Math.min(1, dtc / 1.5);
      S.fc += (tg.fc - S.fc) * Math.min(1, dtc / 1.5);
      S.tad = clamp(S.tas * .55 + 8 - 18 * S.vaso - 6 * S.neurog, 15, 140); S.pam = (S.tas + 2 * S.tad) / 3; // la vasoplejia baja sobre todo la diastólica
      const ago = S.clin - S.cpr.roscAt;
      S.etAlv = S.pco2 * (1 - alvDS()) + (ago < 4 ? 14 * Math.exp(-ago / 1.5) : 0);
      if (S.postRosc && S.clin - S.cpr.roscAt < 30 && (S.tas < 75 || S.spo2 < .85) && rnd() < dtc * .04) enterArrest(rnd() < .5 ? 'vf' : 'primary'); // nueva parada en el post-RCE inestable
      else if (S.tas < 38 || S.hypoxT > 4 || S.lowT > 2.5) enterArrest(S.hypoxT > 4 ? (S.cohb > .25 ? 'co' : 'hypox') : S.ptxActive ? 'ptx' : S.tep > .4 ? 'tep' : S.anaf > .4 ? 'anaf' : S.arr.type === 'tvp' ? 'vt' : S.deficit > .35 ? 'hypo' : 'primary');
      else S.rhythm = S.pace.capture ? 'paced' : S.bav ? 'bav' : S.arr.type ? S.arr.type : S.hypoxT > 1.5 || S.fc < 50 ? 'brady' : S.fc > 100 ? 'tsinus' : 'sinus';
    } else {
      const c = S.cpr, comp = c.comp !== 'off';
      const pf = comp && c.ratio > 0 ? 4 / (c.ratio * 60 / 110 + 4) : 0;
      if (comp) { c.cprTime += dtc * (1 - pf); c.noFlow += dtc * pf; if (c.comp === 'manual') c.relevo += dtc / 2; } else c.noFlow += dtc;
      c.sinceCheck += dtc;
      const co = comp ? cprQuality() * .25 : 0;
      S.tas = comp ? 30 + 70 * co + 25 * S.E.adr : 0; S.fc = S.rhythm === 'vf' ? 0 : S.rhythm === 'tvsp' ? 190 : S.rhythm === 'asys' ? 0 : 34;
      S.etAlv = comp ? clamp(80 * co - .25 * Math.min(S.clin - (S.arrestAt || 0), 30) - 4 * S.E.adr, 4, 35) : 2;
      if (S.rhythm === 'vf') { c.vfAmp = Math.max(.15, 1 - .07 * c.noFlow - .02 * c.cprTime); if (c.noFlow > 10) S.rhythm = 'asys'; }
      if (S.rhythm === 'aesp' && c.noFlow > 6) S.rhythm = 'asys';
    }
    // botella de O2 (equipo de turbina: gasta el O2 que mezcla; oxigenoterapia: el caudal)
    S.vmiEma += (S.supAcc / Math.max(dts, 1e-6) * 60 - S.vmiEma) * Math.min(1, dts / 8); S.supAcc = 0;
    let cons = 0;
    if (S.o2.supply) {
      if (S.iface === 'o2') cons = O2DEV[S.cfg.o2dev].q;
      else cons = S.vmiEma * Math.max(0, S.cfg.fio2 / 100 - .21) / .79 + (S.bag && isOpen() ? 10 : 0);
    }
    S.o2.cons = cons;
    if (S.o2.supply) { S.o2.bar = Math.max(0, S.o2.bar - cons * dtc / S.o2.vol); if (S.o2.bar < 5) { S.o2.supply = false; S.o2.failed = true; } }
    // acciones diferidas
    if (S.air.reintubT > 0 && S.clin >= S.air.reintubT) { S.air.extub = false; S.air.reintubT = -1; S.log.push([S.clin, 'Reintubado y comprobado']); }
    if (S.isr && S.clin >= S.isr.until && S.isr.fail) { const was = S.isr; S.isr = null; S.breaths = []; S.tReset = S.t; updateMech(0); if (S.onIntubFail) S.onIntubFail(was); }
    if (S.isr && S.clin >= S.isr.until) { S.air.sga = !!S.isr.sga; S.isr = null; S.iface = 'tube'; S.mask.est = 0; S.bag = false; S.breaths = []; S.ies = []; S.tReset = S.t; if (!PRESS[S.cfg.mode] && S.cfg.mode !== 'VCV') S.cfg.mode = 'VCV'; if (S.cfg.mode === 'HFNC') S.cfg.mode = 'VCV'; updateMech(0); if (S.onIntubated) S.onIntubated(); }
    // tendencia cada 2 s
    S.tacc = (S.tacc || 0) + dtc; // tendencia por tiempo clínico: un punto cada 6 s clínicos, 30 min a cualquier velocidad
    if (S.tacc >= .1) { S.tacc = 0; S.trend.push({ clin: S.clin, spo2: S.spo2, et: S.etLast, tas: S.tas, pco2: S.pco2, rr: S.pat.pmax > 1 ? S.pat.rr : 0 }); if (S.trend.length > 300) S.trend.shift(); }
    if (S.onSlow) S.onSlow(dtc);
  }
  function enterArrest(cause) {
    S.arrest = true; S.arrestAt = S.clin; S.arr.type = null; S.rhythm = cause === 'vf' || cause === 'hypoT' ? 'vf' : cause === 'vt' ? 'tvsp' : cause === 'hyperk' || cause === 'tca' ? (rnd() < .45 ? 'vf' : 'aesp') : 'aesp'; S.cpr.cause = cause; S.cpr.noFlow = 0; S.cpr.cprTime = 0; S.cpr.sinceCheck = 0; S.tas = 0;
    S.log.push([S.clin, 'Parada cardiorrespiratoria']);
  }
  function rosc() {
    S.arrest = false; S.rhythm = 'tsinus'; S.tas = 85 + 30 * S.E.adr; S.fc = 115; S.hypoxT = 0; S.lowT = 0; S.cpr.comp = 'off'; S.cpr.roscAt = S.clin;
    S.log.push([S.clin, 'RCE']);
  }
  function causeFixed(c0) {
    const c = c0 || S.cpr.cause;
    if (c === 'hypox') return S.fao2 > .25 && !isOpen() || (S.bag && S.fao2 > .25);
    if (c === 'ptx') return !S.ptxActive;
    if (c === 'hypo') return S.deficit < .2;
    if (c === 'opi') return S.E.nalox > .5;
    if (c === 'tep') return S.tep < .35;
    if (c === 'anaf') return S.anaf < .3 && S.deficit < .25;
    if (c === 'co') return S.cohb < .25 && S.fao2 > .3;
    if (c === 'hyperk') return (S.mx ? S.mx.kM : 0) < .45;
    if (c === 'tca') return (S.mx ? S.mx.tcaE : 0) < .4;
    if (c === 'hypoT') return S.temp >= 32;
    if (c === 'hypoglu') return S.glu > 60;
    if (c === 'tamp') return S.tamp < .45;
    return false;
  }
  const FIXABLE = ['hypox', 'ptx', 'hypo', 'opi', 'tep', 'anaf', 'co', 'hyperk', 'tca', 'hypoT', 'hypoglu', 'tamp'];
  const allFixed = () => causeFixed(S.cpr.cause) && (!S.cpr.cause2 || causeFixed(S.cpr.cause2));

  /* ---------- monitorización ---------- */
  function monitor() {
    const t = S.t, W = Math.min(30, Math.max(t - (S.tReset || 0), 4)), cfg = S.cfg;
    const B = S.breaths.filter(b => b.tb > t - W && b.cycle);
    const last = [...S.breaths].reverse().find(b => b.cycle && b.vte != null) || [...S.breaths].reverse().find(b => b.cycle);
    const fr = S.breaths.filter(b => b.tb > t - W).length * 60 / W;
    const vme = B.reduce((s, b) => s + (b.vte != null ? b.vte : 0), 0) * 60 / W;
    const recent = [...S.breaths].reverse().slice(0, 6).filter(b => b.cycle);
    const vtReal = recent.length ? recent.reduce((s, b) => s + (b.lungVt || 0), 0) / recent.length : (S.infl.length ? S.infl.slice(-4).reduce((s, e) => s + e.vt / 1000, 0) / Math.min(4, S.infl.length) : 0);
    const pl = S.lastPplat && t - S.lastPplat.t < 60 ? S.lastPplat : null;
    const pt = S.lastPeepTot && t - S.lastPeepTot.t < 60 ? S.lastPeepTot : null;
    let pplat = pl ? pl.v : null;
    if (cfg.mode === 'VCV' && cfg.tplat >= .1) { const lp = [...S.breaths].reverse().find(b => b.pplatAuto != null); if (lp && (!pl || lp.tb > pl.t)) pplat = lp.pplatAuto; }
    const peepTot = pt ? pt.v : null;
    const peepi = peepTot != null ? Math.max(0, peepTot - cfg.peep) : null;
    const dp = pplat != null ? pplat - (peepTot != null ? peepTot : cfg.peep) : null;
    const cst = pplat != null && last ? (last.vti * 1000) / Math.max(1, pplat - (peepTot != null ? peepTot : cfg.peep)) : null;
    const effW = S.efforts.filter(e => e > t - W && e < t - .5).length;
    const ies = S.ies.filter(e => e > t - W).length;
    const capRR = S.infl.filter(e => e.t > t - W && e.vt > 80).length * 60 / W;
    // valores calculados de forma continua (estilo Hamilton): meseta al final de inspiración sin flujo, auto-PEEP, Cstat, Rinsp y RCexp
    const lp = [...S.breaths].reverse().find(b => b.cycle && b.palvEnd != null);
    const calc = lp && !isOpen() ? { pplat: Math.abs(lp.qEnd || 0) < .08 ? lp.palvEnd : null, pplatEst: lp.palvEnd, autopeep: Math.max(0, lp.p0 - cfg.peep), cst: S.mech.C * 1000 * (1 + (rnd() - .5) * .04), rinsp: S.mech.Ri * (1 + (rnd() - .5) * .06), rcexp: S.mech.Re * S.mech.C } : {};
    S.mon = {
      ppk: last ? last.ppk : null, pplat, peep: last ? last.peepMeas : cfg.peep, peepTot, peepi, dp, cst, pmean: S.pawMean,
      vte: last && last.vte != null ? last.vte * 1000 : null, vti: last ? last.vti * 1000 : null, vme, fr,
      fsp: B.filter(b => b.type === 'pat').length * 60 / W,
      et: S.etLast, spo2: S.spo2, vtReal: vtReal * 1000, vtkg: last && last.vte != null ? last.vte * 1000 / S.ibw : null,
      ie: last && last.ti ? (60 / Math.max(fr, 1) - last.ti) / last.ti : null,
      leak: isMask() ? S.mask.est * 60 : null, iface: S.iface, pinsp: S.apv.p, calc,
      effRR: effW * 60 / W, effN: effW, ies, auto: B.filter(b => b.type === 'auto').length, dbl: B.filter(b => b.dbl).length,
      late: B.filter(b => b.late).length, timax: B.filter(b => b.cycle === 'timax').length, nB: B.length, capRR,
      spco: S.cohb * 100 + (rnd() - .5) * 2, icp: S.icp ? S.icp.v : null,
      flow: S.iface === 'nasal' ? S.cfg.flow : null, cprQ: S.arrest && S.cpr.comp !== 'off' ? cprQuality() : null
    };
    return S.mon;
  }

  /* ---------- acciones y eventos ---------- */
  function setTimeoutSim(fn, simSeconds) { S.timers.push({ at: S.t + simSeconds, fn }); }
  const api = {
    S, step, monitor, updateMech,
    setCfg(c) { const modeChanged = c.mode !== S.cfg.mode || c.simvMand !== S.cfg.simvMand; S.cfg = Object.assign({}, c); if (modeChanged) { S.vent.backup = false; S.vent.lastTrig = S.t; S.vent.nextMand = -99; S.vent.mandDone = false; if (c.mode === 'APV' || c.mode === 'ASV' || (c.mode === 'SIMV' && c.simvMand === 'APV')) S.apv.p = clamp(c.pinsp || 12, 5, c.pmax - 10); } updateMech(0); },
    setStandby(on) { S.standby = !!on; S.vent.phase = 'exp'; S.vent.tc = S.t; S.vent.lastTrig = S.t; S.breaths = []; S.tReset = S.t; updateMech(0); },
    setDevice(vent) { S.dev = { vent, pneumatic: vent === 'medumat' }; },
    setIface(i) { S.iface = i; S.vent.phase = 'exp'; S.vent.tc = S.t; S.vent.backup = false; S.vent.lastTrig = S.t; S.mask.est = 0; S.breaths = []; S.ies = []; S.tReset = S.t; updateMech(0); },
    inspHold() { S.req.inhold = true; },
    expHold() { S.req.exhold = true; },
    event(k) {
      const a = S.air;
      if (k === 'extub') { if (isMask()) S.mask.leak10 = 140; else if (S.iface === 'tube') a.extub = true; }
      if (k === 'disc') a.disc = true;
      if (k === 'sel' && S.iface === 'tube') a.sel = true;
      if (k === 'obst' && S.iface === 'tube') a.obst = true;
      if (k === 'leak') { if (isMask()) S.mask.leak10 = 70; else a.leak = .35; }
      if (k === 'bronco') { S.bs0 = Math.max(S.bs0, 1) + .6; S.bs = Math.max(S.bs, 1.5); }
      if (k === 'ptx' && !S.drained) { S.ptxActive = true; S.ptx = Math.max(S.ptx, .05); } // con drenaje puesto no se forma un neumotórax a tensión
      if (k === 'o2') { S.o2.supply = false; S.o2.failed = true; }
      if (k === 'wake') { S.drug.sed.R = 0; S.drug.sed.cp *= .1; S.drug.sed.ce *= .6; S.drug.rel.cp = Math.min(S.drug.rel.cp, .2); S.drug.rel.ce = Math.min(S.drug.rel.ce, .4); }
      if (k === 'anx') S.anxUntil = S.clin + 4;
      if (k === 'cough') S.coughUntil = S.t + 2.5;
      if (k === 'vf' && !S.arrest) { enterArrest('vf'); }
      if (k === 'aspir') S.aspT = 1;
      if (k === 'tep') S.tep = Math.max(S.tep, .75);
      if (k === 'anaf') S.anaf = Math.max(S.anaf, .45);
      if ((k === 'tsv' || k === 'fa' || k === 'tvp' || k === 'flutter') && !S.arrest) S.arr.type = k;
      if (k === 'asys' && S.arrest) S.rhythm = 'asys';
      if (k === 'seiz' && !S.arrest && S.clin >= S.seizUntil) startSeizure();
      if (k === 'move' && !S.arrest && S.temp < 30 && rnd() < .3) enterArrest('hypoT'); // movilización brusca en hipotermia grave
      if (k === 'rebleed') { S.bleed = Math.max(S.bleed, .006) * 1.8; S.hemo = false; if (!S.bleedSrc) S.bleedSrc = 'int'; }
      updateMech(0);
    },
    action(k, arg) {
      const a = S.air, d = S.drug;
      switch (k) {
        case 'reconnect': a.disc = false; break;
        case 'reintub': if (a.extub && a.reintubT < 0) a.reintubT = S.clin + 1.5; break;
        case 'pull': a.sel = false; break;
        case 'suction': a.obst = false; break;
        case 'cuff': a.leak = 0; break;
        case 'mask': S.mask.leak10 = 12; break;
        case 'decomp': if (S.ptxActive) { S.ptxActive = false; S.ptx = .12; } break;
        case 'drain': S.ptxActive = false; S.ptx = 0; S.drained = true; break; // toracostomía o drenaje: resuelve el neumotórax, también en altitud
        case 'sga': if ((S.iface !== 'tube') && !S.isr) { const edema = Math.max(S.edAir, .8 * S.anaf); S.isr = { until: S.clin + .5, fail: rnd() < clamp(S.sgaFail + .4 * edema, 0, .95), sga: true, apox: false, from: S.iface }; S.bag = false; } break;
        case 'bottle': S.o2.bar = 200; S.o2.supply = true; S.o2.failed = false; break;
        case 'opencirc': if (!a.disc) { a.disc = true; a.manualOpen = true; setTimeoutSim(() => { if (a.manualOpen) { a.disc = false; a.manualOpen = false; } }, 15); } break;
        case 'bag': S.bag = !S.bag; break;
        case 'fluid': { const mlkg = arg || 500 / (S.peso || 75); S.fluidPend += .15 * mlkg / 7; S.fluidKg += mlkg; break; } // 500 mL en el adulto
        case 'blood': S.fluidPend += .12 * (arg || 1); S.bloodU = (S.bloodU || 0) + 1; break; // concentrado de hematíes: repone sin diluir
        case 'iv': if (!S.access && !S.accessPend) { const pf = clamp((S.arrest ? .45 : S.deficit > .3 ? .4 : .12) + (S.temp < 32 ? .2 : 0) + (S.ped ? .2 : 0) + (S.pk === 'obeso' ? .2 : 0), 0, .9); S.accessPend = { kind: 'iv', until: S.clin + 1.5, fail: rnd() < pf }; } break;
        case 'io': if (!S.access && !S.accessPend) S.accessPend = { kind: 'io', until: S.clin + .75, fail: rnd() < .05 }; break;
        case 'warm': S.warm = !S.warm; break;
        case 'pericardio': if (!S.pericPend) S.pericPend = { until: S.clin + 1, fail: S.tamp < .15 || rnd() < .1 }; break; // ecoguiada, ≈ 1 min
        case 'icp': if (S.stemi && S.stemi.icp == null) S.stemi.icp = S.clin; break;
        case 'hemo': if (S.bleedSrc) S.hemo = true; break;
        case 'sedperf': d.sed.R = SED_RATE; break;
        case 'vagal': if (S.arr.type === 'tsv' && rnd() < .25) S.arr.type = null; break;
        case 'recruit': if (S.iface === 'tube' && !S.arrest) { S.derec = 0; S.bump = { until: S.clin + 1, v: 25 * P.hemo * (1 + S.deficit) }; } break;
        case 'clamp': S.clampUntil = S.clin + 1.5; break;
        case 'vl': S.davMul = .35; break;
        case 'apox': S.apox = !S.apox; break;
        case 'o2boost': S.o2boostUntil = S.clin < S.o2boostUntil ? -1 : S.clin + 2; break;
        case 'manual': S.req.manual = true; break;
        case 'cric': if ((S.iface !== 'tube' || S.air.sga) && !S.isr) { S.air.sga = false; S.isr = { until: S.clin + 1.5, fail: false, cric: true, apox: false, from: S.iface }; S.bag = false; } break;
      }
      updateMech(0);
    },
    drug(k, amount) {
      if (k === 'adrIM') { S.depotAdr += amount * 24; return; }
      if (k === 'sugam') { const mgkg = amount / 75, rev = mgkg >= 12 ? .98 : mgkg >= 4 ? .9 : .65; S.drug.rel.cp *= 1 - rev; updateMech(0); return; } // encapsula el rocuronio, no la succinilcolina
      if (k === 'bic') { S.bicKg += amount / 75; return; } // mEq/kg normalizados a 75 kg
      if (k === 'gluc') { S.glu += 5 * amount; return; } // g normalizados a 75 kg: 25 g suben ≈ 125 mg/dL
      if (k === 'ins') S.glu += 125 * amount; // 10 UI de insulina con 25 g de glucosa
      if (k === 'sux') S.kTot += .5; // la succinilcolina sube el potasio
      S.drug[k].cp += amount;
      if (k === 'aden') S.adenPending = { at: S.clin + .12, dose: amount };
      updateMech(0);
    },
    perf(k, ratePerMin) { S.drug[k].R = ratePerMin; },
    perfSteady(k, rate) { S.drug[k].R = rate * Math.LN2 / DRUGS[k].h; }, // vasoactivos: la concentración estable iguala la velocidad
    intubate() {
      if (S.iface === 'tube' && !S.air.sga) return { ok: false, msg: 'Ya está intubado.' };
      if (S.isr) return { ok: false, msg: 'Ya hay una laringoscopia en curso.' };
      if (S.relTot < .9 && !(S.arrest || S.sedTot > .9)) return { ok: false, msg: S.relTot < .5 ? 'Tiene tono y reflejos: necesitas inducción y relajante antes de la laringoscopia.' : 'El relajante aún no ha hecho efecto completo: espera 45–60 s desde la dosis.' };
      const edema = Math.max(S.edAir, .8 * S.anaf);
      const pFail = clamp((S.dav + .55 * edema) * S.davMul * (S.attempts ? .85 : 1), 0, .97);
      S.attempts++;
      const fail = rnd() < pFail;
      S.isr = { until: S.clin + (fail ? 1.6 : 1.2), fail, apox: S.apox, from: S.iface, edema, attempt: S.attempts };
      S.bag = false; return { ok: true };
    },
    // parada
    compress(type) { S.cpr.comp = type; if (type === 'manual') S.cpr.relevo = 0; },
    relevo() { S.cpr.relevo = 0; },
    shock(J, sync) {
      const c = S.cpr; c.shocks++;
      if (!S.arrest) {
        const t = S.arr.type;
        if (t && t !== 'sbrady') {
          if (!sync && rnd() < .2) { enterArrest('vf'); return { result: 'vf' }; }
          const p = ({ tsv: J >= 70 ? .92 : .6, flutter: J >= 50 ? .9 : .6, fa: J >= 150 ? .78 : J >= 120 ? .62 : .4, tvp: J >= 100 ? .9 : .6 })[t] * (sync ? 1 : .8);
          if (rnd() < p) { S.arr.type = null; S.pauseUntil = S.t + 1.5; return { result: 'converted' }; }
          return { result: 'persist' };
        }
        if (!sync && rnd() < .12) { enterArrest('vf'); return { result: 'vf' }; }
        return { result: 'noShockable' };
      }
      if (sync && (S.rhythm === 'vf' || S.rhythm === 'asys')) { c.shocks--; return { result: 'noSync' }; }
      if (!(S.rhythm === 'vf' || S.rhythm === 'tvsp')) return { result: 'noShockable' };
      const E = S.E, mins = S.clin - (S.arrestAt || 0);
      const eff = S.shockMul < 1 && c.ap ? Math.min(1, S.shockMul * 1.8) : S.shockMul; // parches anteroposteriores en la FV refractaria
      const cz = c.cause, block = S.temp < 30 ? .15 : (cz === 'hyperk' || cz === 'tca') && !causeFixed(cz) ? .4 : 1; // hipotermia < 30 °C, potasio o tricíclicos sin corregir
      const pTerm = clamp((.8 - .04 * c.noFlow - (J < 150 ? .1 : 0) + .1 * E.amio + .07 * E.lido) * eff * block, .03, .92);
      if (rnd() < pTerm) {
        const adrOk = S.temp >= 30 ? 1 : 0;
        const pR = clamp((.32 + (c.cprTime >= 1.5 ? .08 : 0) + .08 * E.adr * adrOk + .05 * E.amio - .03 * c.noFlow - .015 * mins) * (.5 + .5 * eff), .05, .7), u = rnd();
        if (u < pR) { rosc(); return { result: 'rosc' }; }
        if (u < pR + (1 - pR) * .45 * eff) { S.rhythm = 'aesp'; S.cpr.cause = S.cpr.cause === 'vf' ? 'primary' : S.cpr.cause; return { result: 'organized' }; }
        return { result: 'refib' };
      }
      return { result: 'persist' };
    },
    check() { // análisis de ritmo y pulso
      const c = S.cpr;
      if (!S.arrest) return { rhythm: S.rhythm, pulse: true };
      let res = { rhythm: S.rhythm, pulse: false };
      if ((S.rhythm === 'aesp' || S.rhythm === 'asys') && c.sinceCheck >= 1.2) {
        const fixable = FIXABLE.includes(c.cause), fixed = allFixed(), adrOk = S.temp >= 30 ? 1 : 0;
        const ccf = c.cprTime + c.noFlow > 0 ? c.cprTime / (c.cprTime + c.noFlow) : 1, mins = S.clin - (S.arrestAt || 0);
        let p = fixable ? (fixed ? .22 + .2 * S.E.adr * adrOk : .01) : .08 + .2 * S.E.adr * adrOk;
        if (S.rhythm === 'asys') p *= .5;
        p *= clamp(ccf / .8, .3, 1) * Math.exp(-Math.max(0, mins - 10) / 15);
        if (rnd() < clamp(p, .005, .7)) { rosc(); res = { rhythm: 'tsinus', pulse: true }; }
      }
      c.sinceCheck = 0;
      return res;
    },
    setPads(ap) { S.cpr.ap = !!ap; },
    pace(on, rate, mA, mode) {
      if (S.pace.on && !on && S.odT > .15) { if (['tvp', 'flutter', 'tsv'].includes(S.arr.type) && rnd() < .65) { S.arr.type = null; S.pauseUntil = S.t + 1.5; S.log.push([S.clin, 'Sobreestimulación: taquicardia revertida']); } S.odT = 0; }
      S.pace.on = on; S.pace.rate = rate; S.pace.mA = mA; if (mode) S.pace.mode = mode; if (!on) S.odT = 0;
    },
    setRatio(r) { S.cpr.ratio = r; },
    setNor(r) { S.drug.nor.R = r * Math.LN2 / DRUGS.nor.h; S.norRate = r; },
    setNtg(r) { S.drug.ntg.R = r; S.ntgRate = r; },
    setGluPerf(gPerMin) { S.gluPerf = gPerMin; },
    glucemia() { return S.glu * (1 + (rnd() - .5) * .06); },
    temperatura() { return S.temp + (rnd() - .5) * .2; },
    ecg12() {
      if (S.arrest) return 'En parada no se interpreta el ECG de 12 derivaciones: sigue el algoritmo.';
      const f = [], m = S.stemi, e = S.ecg, at = S.arr.type;
      f.push(`${at ? { tsv: 'Taquicardia regular de QRS estrecho', fa: 'Fibrilación auricular', flutter: 'Flutter auricular', tvp: 'Taquicardia regular de QRS ancho', sbrady: 'Bradicardia sinusal' }[at] : S.bav ? 'BAV completo con escape de QRS ancho' : S.pace.capture ? 'Ritmo de marcapasos' : S.fc > 100 ? 'Taquicardia sinusal' : 'Ritmo sinusal'} a ${Math.round(S.fc)} lpm.`);
      if (m) {
        if (m.loc === 'ant') f.push('Elevación del ST de 3–4 mm en V1–V5, I y aVL, con descenso especular en II, III y aVF: SCACEST anterior extenso.');
        else if (m.loc === 'inf') f.push('Elevación del ST de 2–3 mm en II, III y aVF (más en III que en II), con descenso especular en I y aVL: SCACEST inferior.' + (m.rv ? ' En V4R, elevación del ST de 1,5 mm: afectación del ventrículo derecho.' : ' V4R sin elevación del ST.'));
        else f.push('Elevación del ST en I, aVL, V5 y V6, con descenso en III y aVF: SCACEST lateral.');
        if (m.reperf) f.push('El ST ha bajado más de un 50 % respecto al primer ECG: criterio de reperfusión.');
      }
      if (e.t > 1.8) f.push('Ondas T picudas y simétricas.');
      if (e.qrs > .115) f.push(`QRS ancho (${Math.round(e.qrs * 1000)} ms)${S.tca > .2 ? ' con R terminal en aVR.' : '.'}`);
      if (e.j > .25) f.push('Ondas J de Osborn.');
      if (S.tamp > .35) f.push('Bajo voltaje' + (S.tamp > .55 ? ' y alternancia eléctrica.' : '.'));
      if (S.tep > .3) f.push('S1Q3T3 y T negativas de V1 a V4.');
      if (f.length === 1) f.push('Sin alteraciones agudas de la repolarización.');
      return f.join(' ');
    },
    eco() {
      const f = [], tE = tampEff();
      if (S.tamp > .3) f.push(`Derrame pericárdico ${S.tamp > .6 ? 'grande' : 'moderado'}${tE > .3 ? ' con colapso diastólico del VD y vena cava inferior dilatada que no colapsa: taponamiento.' : ', sin colapso de cavidades.'}`);
      else if (S.tamp > 0) f.push('Derrame pericárdico pequeño, sin compromiso.');
      if (S.ptxActive || (S.ptx > .2 && !S.drained)) f.push('Sin deslizamiento pleural en un hemitórax: neumotórax.');
      if (S.tep > .3) f.push('VD dilatado (VD/VI > 1) con septo aplanado: sobrecarga de VD.');
      if (S.stemi && !S.arrest) f.push(S.stemi.loc === 'ant' ? 'Acinesia anteroapical con FEVI reducida.' : 'Hipocinesia inferior' + (S.stemi.rv ? ' y del VD, que está dilatado.' : '.'));
      if ((S.deficit > .25 || (S.vaso > .25 && S.deficit > .12)) && tE < .2) f.push('Vena cava inferior pequeña y colapsable; VI hiperdinámico: probablemente responde a volumen.');
      if ((S.fluidKg || 0) > S.fluidTol + 5) f.push('Líneas B nuevas en ambos campos: ya no tolera más volumen.');
      if (P.edema && S.sev > .4) f.push('Líneas B difusas en ambos campos.');
      if (S.arrest && S.rhythm === 'aesp') f.push(tE > .3 ? 'Hay actividad cardiaca, pero el corazón está comprimido por el derrame.' : 'Actividad mecánica cardiaca mínima.');
      if (S.arrest && S.rhythm === 'asys') f.push('Sin actividad mecánica cardiaca.');
      if (!f.length) f.push('Sin derrame pericárdico ni signos de shock obstructivo; contractilidad conservada.');
      return f.join(' ');
    },
    setAltitude(h) { S.altitude = h; updateMech(0); },
    setScale(x) { S.scale = x; },
    gas() { return { ph: S.ph - .03, pco2: S.pco2 + 6, hco3: (S.hco3 || P.hco3) + 1, lact: S.lact, cohb: S.cohb * 100, k: S.k + .1, glu: S.glu, hb: 14.5 * (1 - .7 * S.deficit) * (1 - .15 * clamp(S.fluidKg / 40, 0, 1)) }; },
    explore() {
      const a = S.air, f = [];
      if (S.arrest) return [S.cpr.comp !== 'off' ? 'Sin pulso central entre compresiones.' : 'Inconsciente, no respira, sin pulso central.'].concat(S.temp < 32 ? ['Muy frío al tacto, rígido.'] : [], S.bleed > 0 && !S.hemo ? ['Sangrado activo.'] : [], !S.access && !S.accessPend ? ['Sin acceso vascular.'] : []);
      if (S.isr) return ['Laringoscopia en curso: el paciente está en apnea.'];
      const seiz = S.clin < S.seizUntil;
      if (seiz) f.push('Convulsión tónico-clónica generalizada: mandíbula cerrada, cianosis peribucal, sialorrea.');
      const glas = S.relTot > .6 ? 'relajado, no valorable' : S.sedTot > .7 ? 'bajo sedación' : seiz ? 'convulsionando' : S.clin < S.postIctUntil ? 'postcrítico, obnubilado' : S.gcs <= 8 ? 'no abre los ojos, emite sonidos y localiza o retira al dolor' : S.gcs <= 12 ? 'somnoliento, abre los ojos al dolor, desorientado' : S.gcs <= 14 ? 'adormilado, confuso' : 'consciente y orientado';
      if (S.iface !== 'tube' || S.relTot < .5) f.push(`Nivel de conciencia: ${glas}${S.relTot > .6 ? '' : ` (GCS ≈ ${S.gcs})`}.`);
      if (S.pat.pmax > 1 && !seiz) {
        f.push(`Cuentas ${Math.round(S.pat.rr)} respiraciones por minuto.`);
        if (S.drive > .8) f.push('Tiraje supraclavicular e intercostal, uso de musculatura accesoria' + (P.hyper ? ', respiración con labios fruncidos.' : '.'));
        else if (S.drive > .5) f.push('Trabajo respiratorio moderado.');
        else f.push('Respira tranquilo, sin tiraje.');
        const ie = S.ies.filter(e => e > S.t - 20).length;
        if (ie >= 2) f.push('Ves esfuerzos inspiratorios que el ventilador no acompaña.');
      } else if (S.iface !== 'tube' && !S.bag && !seiz) f.push('No respira.');
      if (S.opi > .4) f.push('Pupilas puntiformes.');
      if (S.vaso > .25) f.push(S.lact > 4 && S.tas < 90 ? 'Piel moteada en las rodillas, frialdad acra y relleno capilar de más de 3 s.' : 'Piel caliente y enrojecida, pulsos saltones y relleno capilar rápido.');
      if (S.neurog > .25) f.push('Piel caliente y seca; no mueve ni siente por debajo del cuello; respiración abdominal.');
      if ((S.fluidKg || 0) > S.fluidTol + 8) f.push('Crepitantes bilaterales nuevos.');
      if (tampEff() > .25) f.push('Ingurgitación yugular, tonos cardiacos apagados y pulso paradójico.');
      if (S.stemi && !S.stemi.reperf) f.push('Dolor torácico opresivo con sudoración fría' + (S.stemi.rv && S.tas < 100 ? '; campos pulmonares limpios con ingurgitación yugular.' : '.'));
      if (isMask()) f.push(S.mask.leak10 > 45 ? 'Fuga perimascarilla audible; el aire sale hacia los ojos.' : S.mask.leak10 > 25 ? 'Pequeña fuga por la comisura.' : 'Mascarilla bien sellada.');
      if (S.clin < S.anxUntil) f.push('Agitado, quiere quitarse la mascarilla.');
      if (P.edema) f.push(S.sev > .8 ? 'Crepitantes hasta vértices; sudoroso y frío.' : S.sev > .4 ? 'Crepitantes hasta campos medios.' : S.sev > .15 ? 'Crepitantes en bases.' : 'Apenas quedan crepitantes.');
      if (S.pk === 'sepsis') f.push('Febril, piel moteada en rodillas, crepitantes en base derecha.');
      if (a.extub) f.push('La marca del tubo está muy por fuera de la comisura; no se ausculta murmullo; epigastrio distendido.');
      if (a.disc) f.push('La tubuladura está suelta en la pieza en Y.');
      if (a.sel) f.push('Murmullo abolido en el hemitórax izquierdo; la marca del tubo ha entrado 3 cm respecto a la intubación.');
      if (S.ptxActive && S.ptx > .25) f.push('Hemitórax derecho hipoventilado y timpánico; yugulares ingurgitadas' + (S.ptx > .6 ? '; tráquea desviada a la izquierda.' : '.'));
      else if (S.ptxActive) f.push('Hipoventilación leve en la base derecha.');
      if (a.obst) f.push('La sonda de aspiración no progresa bien por el tubo; secreciones espesas.');
      if (S.bs > 1.25) f.push('Sibilancias espiratorias difusas con espiración muy alargada.');
      if ((S.lastPeepTot && S.lastPeepTot.v - S.cfg.peep > 10) || (S.mech.Pcrit > 7 && S.pat.rr > 24)) f.push('Tórax hiperinsuflado que no termina de bajar entre respiraciones.');
      if (a.leak > 0 && S.iface === 'tube') f.push('Gorgoteo audible en la boca en cada inspiración; balón poco inflado.');
      if (a.sga) f.push('Dispositivo supraglótico colocado' + (S.Paw > 25 ? '; se oye fuga por la boca en las inspiraciones con presión alta.' : ', sella bien.'));
      if (S.bmv < .6 && (S.iface === 'o2' || S.iface === 'mask') && S.bag) f.push('Cuesta sellar la mascarilla y el tórax apenas se mueve con el ambú.');
      if (S.iface === 'tube' && S.awake > .35 && S.relTot < .5) f.push('Abre los ojos, tose con el tubo y lleva las manos hacia él.');
      if (S.deficit > .35 && S.vaso < .25 && S.neurog < .25) f.push('Piel fría y pálida, relleno capilar enlentecido.'); // en el shock distributivo la piel está caliente
      if (S.pace.on) f.push(S.pace.capture ? 'Pulso femoral a la frecuencia del marcapasos: hay captura mecánica.' : 'Espigas sin captura: el pulso no sigue al marcapasos.');
      if (S.anaf > .15) f.push('Habones generalizados' + (S.anaf > .4 ? ', angioedema de labios y lengua, voz ronca' : '') + '.');
      if (S.edAir > .25 && S.iface !== 'tube') f.push('Hollín en fosas nasales, vibrisas chamuscadas, voz ronca' + (S.edAir > .55 ? ' y estridor inspiratorio.' : '.'));
      if (S.cohb > .15 && S.iface !== 'tube') f.push('Cefalea, náuseas y confusión' + (S.cohb > .3 ? '; responde mal a órdenes.' : '.'));
      if (S.tep > .3) f.push('Ingurgitación yugular sin crepitantes; extremidades frías.');
      if (S.asp > .2) f.push('Restos de contenido gástrico en orofaringe' + (S.iface === 'tube' ? ' y al aspirar por el tubo' : '') + '; crepitantes en base derecha.');
      if (S.weak > .3) f.push('Tos débil, respiración superficial con movimiento paradójico abdominal; no cuenta hasta 10 de un aliento.');
      if (S.icp) f.push(S.icp.v > 30 ? 'Pupila derecha midriática y arreactiva; la izquierda, reactiva.' : S.icp.v > 22 ? 'Pupilas isocóricas pero perezosas.' : 'Pupilas isocóricas y reactivas.');
      if (S.arr.type && S.arr.type !== 'sbrady') f.push(S.tas < 90 ? 'Pulso rápido y débil; sudoroso, pálido, con mareo.' : 'Palpitaciones; pulso rápido y bien tolerado.');
      if (S.arr.type === 'sbrady') f.push('Pulso lento y regular; mareado y pálido.');
      if (S.glu < 55) f.push('Sudoración profusa, piel fría y pálida' + (S.glu < 40 ? ', no obedece órdenes.' : ', irritable.'));
      if (S.temp < 32) f.push('Frío al tacto, sin tiritona, rigidez muscular; pulso lento y difícil de palpar.'); else if (S.temp < 35) f.push('Tiritona intensa, piel fría.');
      if (S.croupEff > .25) f.push('Estridor inspiratorio en reposo, tos perruna, tiraje supraesternal' + (S.croupEff > .6 ? ' e intercostal; agotado y pálido.' : '.'));
      if (S.tca > .3) f.push('Midriasis, piel caliente y seca, mucosas secas; abdomen sin ruidos.');
      if (S.ecl) f.push('Gestante de tercer trimestre con edemas; hiperreflexia con clonus.');
      if (S.bleed > 0) { const bn = S.bleedNow || 0; f.push(S.bleedSrc === 'ext' ? (S.hemo ? 'Torniquete apretado: la herida ya no sangra.' : 'Sangrado activo, pulsátil, por la herida del muslo.') : S.bleedSrc === 'pelv' ? (S.hemo ? 'Cinturón pélvico colocado; dolor a la compresión pélvica.' : 'Pelvis inestable y dolorosa; equimosis perineal.') : S.bleedSrc === 'uter' ? (bn > .006 ? 'Útero blando, por encima del ombligo; sangrado vaginal abundante con coágulos.' : 'Útero más firme; el sangrado disminuye.') : 'Abdomen distendido y doloroso.'); }
      if (!S.access && !S.accessPend) f.push('Sin acceso vascular.');
      if (!f.length) f.push('Murmullo simétrico, tubo en su marca, sin hallazgos nuevos.');
      return f;
    }
  };
  api.warm = function (sec) {
    const sc = S.scale; S.scale = .2;
    for (let i = 0; i < sec / .004; i++) step(.004);
    S.scale = sc;
    if (S.vaInst != null) { S.vaEma = S.vaInst; S.veEma = S.veInst; }
    if (!S.arrest) { const tg = targets(); S.tas = tg.tas; S.fc = tg.fc; }
    const fi = S.iface === 'o2' ? o2Fi(S.cfg.o2dev, S.veEma) : S.o2.supply ? S.cfg.fio2 / 100 : .21, q = .863 * P.vo2 / (S.pbar - 47);
    S.fao2 = clamp(fi - q / Math.max(S.vaEma, .5), .02, 1);
    slow(0); S.spo2 = S.sao2;
    S.kTot = (o.k || 4.2) - phShift(); metab(0);
    S.clin = 0; S.trend = []; S.log = []; S.o2.bar = o.bottleBar || 200; S.ies = [];
    for (const b of S.breaths) if (b.type === 'auto') b.type = 'mach'; // la compensación de fuga aún no estaba ajustada durante el calentamiento
    if (S.arrest) { S.cpr.noFlow = 0; S.cpr.cprTime = 0; }
  };
  return api;
}

root.VMI = { create, PHENO, DRUGS, O2DEV, pesoIdeal, defaultCfg, sat, pbarAt, clamp };
if (typeof module !== 'undefined') module.exports = root.VMI;
})(typeof window !== 'undefined' ? window : globalThis);
