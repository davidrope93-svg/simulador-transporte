/* Fármacos y perfusiones (v1.2): datos y cálculo de dosis sin DOM. Los usan la interfaz y el validador de casos (tests/validar.js),
   así el validador da exactamente las mismas dosis que un alumno que pulsa los botones. */
(function (root) {
'use strict';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
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
    { id: 'fluid', lab: 'Cristaloide', act: 'fluid', note: '500 mL' }, { id: 'blood', lab: 'Concentrado de hematíes', act: 'blood', note: '1 unidad, si se dispone' }, { id: 'adr1', lab: 'Adrenalina', k: 'adr', dose: 1, u: 'mg', amt: 100 },
    { id: 'adrP', lab: 'Adrenalina en bolo', k: 'adr', dose: 20, u: 'mcg', amt: 4 }, { id: 'amio300', lab: 'Amiodarona', k: 'amio', dose: 300, u: 'mg' },
    { id: 'amio150', lab: 'Amiodarona', k: 'amio', dose: 150, u: 'mg' },
    { id: 'lido100', lab: 'Lidocaína', k: 'lido', dose: 100, u: 'mg' }, { id: 'lido50', lab: 'Lidocaína', k: 'lido', dose: 50, u: 'mg' }, { id: 'tnk', lab: 'Tenecteplasa', k: 'tnk', amt: 1, tnk: true, u: 'mg' }] },
  { g: 'Síndrome coronario', items: [
    { id: 'aas', lab: 'AAS', k: 'aas', dose: 250, u: 'mg', route: ' oral, masticado', noIV: true }, { id: 'tica', lab: 'Ticagrelor', k: 'tica', dose: 180, u: 'mg', route: ' oral', noIV: true },
    { id: 'clopi300', lab: 'Clopidogrel', k: 'clopi', dose: 300, u: 'mg', route: ' oral', noIV: true }, { id: 'clopi600', lab: 'Clopidogrel', k: 'clopi', dose: 600, u: 'mg', route: ' oral', noIV: true },
    { id: 'hnf', lab: 'Heparina sódica', k: 'hnf', mgkg: 70, u: 'UI', note: 'con fibrinólisis: 60 UI/kg, máx. 4.000' }, { id: 'enox', lab: 'Enoxaparina', k: 'enox', dose: 30, u: 'mg', note: 'más 1 mg/kg SC; > 75 años, sin bolo IV' }] },
  { g: 'Arritmias', items: [
    { id: 'aden6', lab: 'Adenosina', k: 'aden', dose: 6, u: 'mg', amt: 6, route: ' IV rápida' }, { id: 'aden12', lab: 'Adenosina', k: 'aden', dose: 12, u: 'mg', amt: 12, route: ' IV rápida' },
    { id: 'aden18', lab: 'Adenosina', k: 'aden', dose: 18, u: 'mg', amt: 18, route: ' IV rápida' }, { id: 'atr', lab: 'Atropina', k: 'atr', dose: .5, u: 'mg' },
    { id: 'vagal', lab: 'Maniobras vagales', act: 'vagal', note: 'Valsalva modificada' }] },
  { g: 'Respiratorio y anafilaxia', items: [
    { id: 'salb', lab: 'Salbutamol + ipratropio', k: 'salb', amt: 1, note: 'nebulizado o en línea', route: '', noIV: true }, { id: 'mgso4', lab: 'Sulfato de magnesio', k: 'mg', dose: 2, u: 'g' },
    { id: 'cort', lab: 'Metilprednisolona', k: 'cort', mgkg: 1, u: 'mg' }, { id: 'adrIM', lab: 'Adrenalina IM', k: 'adrIM', dose: .5, u: 'mg', amt: .5, route: ' en el muslo', noIV: true },
    { id: 'dexclor', lab: 'Dexclorfeniramina', k: 'dexclor', dose: 5, u: 'mg' }, { id: 'adrNeb', lab: 'Adrenalina nebulizada', k: 'adrN', dose: 5, u: 'mg', route: ' nebulizada', noIV: true },
    { id: 'dexa', lab: 'Dexametasona', k: 'dexa', dose: 8, u: 'mg', route: ' oral o IM', noIV: true }] },
  { g: 'Metabólico, tóxicos y obstetricia', items: [
    { id: 'ca', lab: 'Cloruro cálcico 10 %', k: 'ca', dose: 10, u: 'mL', amt: 1 }, { id: 'bic', lab: 'Bicarbonato 1 M', k: 'bic', mgkg: 1, u: 'mEq' },
    { id: 'gluc', lab: 'Glucosa', k: 'gluc', dose: 25, u: 'g', note: 'G50 % 50 mL' }, { id: 'gluc10', lab: 'Glucosa', k: 'gluc', dose: 10, u: 'g', note: 'G10 % 100 mL' },
    { id: 'glucg', lab: 'Glucagón', k: 'glucg', dose: 1, u: 'mg', amt: 1, route: ' IM', noIV: true },
    { id: 'ins', lab: 'Insulina rápida', k: 'ins', dose: 10, u: 'UI', amt: 1, note: 'con 25 g de glucosa' },
    { id: 'mg4', lab: 'Sulfato de magnesio', k: 'mg', dose: 4, u: 'g', note: 'en 15–20 min' }, { id: 'labet', lab: 'Labetalol', k: 'labet', dose: 20, u: 'mg' },
    { id: 'urap', lab: 'Urapidilo', k: 'urap', dose: 25, u: 'mg' }, { id: 'oxito', lab: 'Oxitocina', k: 'oxito', dose: 10, u: 'UI', amt: 10, route: ' IV lenta o IM', noIV: true },
    { id: 'txa', lab: 'Ácido tranexámico', k: 'txa', dose: 1, u: 'g' }, { id: 'sugam', lab: 'Sugammadex', k: 'sugam', mgkg: 16, u: 'mg', note: 'reversión inmediata' },
    { id: 'sugam4', lab: 'Sugammadex', k: 'sugam', mgkg: 4, u: 'mg' }, { id: 'midIN', lab: 'Midazolam intranasal o bucal', k: 'mid', dose: 10, u: 'mg', route: ' IN', noIV: true, bio: .6 }] },
  { g: 'EAP, HTIC e intoxicaciones', items: [
    { id: 'ntgsl', lab: 'NTG sublingual', k: 'ntg', dose: 400, u: 'mcg', amt: 250, route: '', noIV: true }, { id: 'ntgiv', lab: 'NTG en bolo', k: 'ntg', dose: 1, u: 'mg', amt: 900 },
    { id: 'furo', lab: 'Furosemida', k: 'furo', dose: 40, u: 'mg' }, { id: 'shs', lab: 'Salino hipertónico 7,5 %', k: 'shs', amt: 1, note: '250 mL' },
    { id: 'manit', lab: 'Manitol 20 %', k: 'manit', amt: 1, note: '0,5 g/kg' }, { id: 'hidroxo', lab: 'Hidroxocobalamina', k: 'hidroxo', dose: 5, u: 'g' }] }
];
const DRUGITEMS = {}; DRUGSET.forEach(g => g.items.forEach(it => { DRUGITEMS[it.id] = it; }));
const PERFS = [
  { id: 'nor', lab: 'Noradrenalina', u: 'mcg/kg/min', d: 2, opts: [0, .05, .1, .15, .2, .3, .5], run: (sim, r, fW) => sim.setNor(r), extra: (r, peso, fmt) => r ? ` · ${fmt(r * peso)} mcg/min` : '' },
  { id: 'adrI', lab: 'Adrenalina', u: 'mcg/min', d: 0, opts: [0, 2, 5, 10, 20], run: (sim, r, fW) => sim.perfSteady('adr', r) },
  { id: 'ntg', lab: 'Nitroglicerina', u: 'mcg/min', d: 0, opts: [0, 20, 50, 100, 150, 200], run: (sim, r, fW) => sim.setNtg(r) },
  { id: 'prop', lab: 'Propofol', u: 'mg/h', d: 0, opts: [0, 50, 100, 150, 200, 300], run: (sim, r, fW) => sim.perf('prop', r / 60 * fW) },
  { id: 'mid', lab: 'Midazolam', u: 'mg/h', d: 0, opts: [0, 2, 5, 10], run: (sim, r, fW) => sim.perf('mid', r / 60 * fW) },
  { id: 'fent', lab: 'Fentanilo', u: 'mcg/h', d: 0, opts: [0, 50, 100, 150, 200], run: (sim, r, fW) => sim.perf('fent', r / 60 * fW) },
  { id: 'ketP', lab: 'Ketamina', u: 'mg/kg/h', d: 1, opts: [0, .5, 1, 1.5, 2], run: (sim, r, fW) => sim.perf('ket', r * 75 / 60), extra: (r, peso, fmt) => r ? ` · ${fmt(r * peso)} mg/h` : '' },
  { id: 'rocP', lab: 'Rocuronio', u: 'mg/kg/h', d: 1, opts: [0, .3, .6], run: (sim, r, fW) => sim.perf('rel', r * 15 / 60), extra: (r, peso, fmt) => r ? ` · ${fmt(r * peso)} mg/h` : '' },
  { id: 'iso', lab: 'Isoprenalina', u: 'mcg/min', d: 0, opts: [0, 1, 2, 4, 10], run: (sim, r, fW) => sim.perfSteady('iso', r) },
  { id: 'mgP', lab: 'Sulfato de magnesio', u: 'g/h', d: 0, opts: [0, 1, 2], run: (sim, r, fW) => sim.perf('mg', r / 60 * fW) },
  { id: 'g10', lab: 'Glucosa 10 %', u: 'mL/h', d: 0, opts: [0, 50, 100, 150, 250], run: (sim, r, fW) => sim.setGluPerf(r * .1 / 60 * fW) }
];
const roundDose = x => x >= 50 ? Math.round(x / 5) * 5 : x >= 10 ? Math.round(x) : x >= 1 ? Math.round(x * 10) / 10 : Math.round(x * 100) / 100;
const PED = { adr1: { k: .01, max: 1, t: '10 mcg/kg' }, adrP: { k: 1, max: 20, t: '1 mcg/kg' }, amio300: { k: 5, max: 300, t: '5 mg/kg' }, amio150: { k: 5, max: 150, t: '5 mg/kg' },
  lido100: { k: 1, max: 100, t: '1 mg/kg' }, lido50: { k: .5, max: 50, t: '0,5 mg/kg' }, atr: { k: .02, min: .1, max: .5, t: '20 mcg/kg' }, aden6: { k: .1, max: 6, t: '0,1 mg/kg' },
  aden12: { k: .2, max: 12, t: '0,2 mg/kg' }, aden18: { k: .3, max: 18, t: '0,3 mg/kg' }, adrIM: { k: .01, max: .5, t: '10 mcg/kg' }, nalox: { k: .01, max: .4, t: '10 mcg/kg' },
  mid: { k: .05, max: 2, t: '0,05 mg/kg' }, morf: { k: .05, max: 3, t: '0,05 mg/kg' }, mg: { k: .04, max: 2, t: '40 mg/kg' }, dexclor: { k: .15, max: 5, t: '0,15 mg/kg' },
  furo: { k: 1, max: 40, t: '1 mg/kg' }, hidroxo: { k: .07, max: 5, t: '70 mg/kg' }, ca: { k: .2, max: 10, t: '0,2 mL/kg' }, gluc: { k: .2, max: 25, t: '0,2 g/kg (2 mL/kg de G10 %)' },
  gluc10: { k: .2, max: 10, t: '0,2 g/kg' }, glucg: { k: .03, min: .5, max: 1, t: '0,5 mg si < 25 kg' }, txa: { k: 15, max: 1000, t: '15 mg/kg', u: 'mg' }, adrNeb: { k: .5, max: 5, t: '0,5 mg/kg' },
  dexa: { k: .6, max: 16, t: '0,6 mg/kg' }, midIN: { k: .3, max: 10, t: '0,3 mg/kg' }, mg4: { k: .05, max: 2, t: '50 mg/kg' } };
const tnkDose = p => p < 60 ? 30 : p < 70 ? 35 : p < 80 ? 40 : p < 90 ? 45 : 50;
const fWOf = (peso, ped) => ped ? 75 / peso : clamp(75 / peso, .7, 1.4);
/* dosis que se muestra (en la unidad del botón) y cantidad que recibe el motor */
function doseOf(it, peso, ped) { const pd = ped && PED[it.id]; if (pd) { const x = roundDose(clamp(pd.k * peso, pd.min || 0, pd.max)); return pd.u === 'mg' && it.u === 'g' ? x / 1000 : x; } return it.tnk ? tnkDose(peso) : it.mgkg != null ? roundDose(it.mgkg * peso) : it.dose; }
function amountOf(it, peso, ped) { const ds = doseOf(it, peso, ped), pd = ped && PED[it.id]; return (pd ? (it.amt != null ? it.amt * ds / it.dose : ds) * 75 / peso : it.amt != null ? it.amt : ds * fWOf(peso, ped)) * (it.bio || 1); }
root.SIM_DRUGS = { DRUGSET, DRUGITEMS, PERFS, PED, roundDose, tnkDose, fWOf, doseOf, amountOf };
})(typeof window !== 'undefined' ? window : globalThis);
