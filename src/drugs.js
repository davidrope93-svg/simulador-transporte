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
    { id: 'fentS', lab: 'Fentanilo', k: 'fent', mgkg: 1, u: 'mcg' }, { id: 'morf', lab: 'Morfina', k: 'morf', dose: 3, u: 'mg' }, { id: 'ketA', lab: 'Ketamina analgésica', k: 'ket', mgkg: .3, u: 'mg', note: 'IV lenta; 0,5–1 mg/kg IM o IN' },
    { id: 'nalox', lab: 'Naloxona', k: 'nalox', dose: .4, u: 'mg' }, { id: 'sedB', lab: 'Bolo de la bomba de sedación', k: 'sed', amt: 2, note: 'midazolam + fentanilo' },
    { id: 'sedperf', lab: 'Reanudar la bomba de sedación', act: 'sedperf' }] },
  { g: 'Hemodinámica y parada', items: [
    { id: 'fluid', lab: 'Cristaloide', act: 'fluid', note: '500 mL' }, { id: 'blood', lab: 'Concentrado de hematíes', act: 'blood', note: '1 unidad, si se dispone' }, { id: 'adr1', lab: 'Adrenalina', k: 'adr', dose: 1, u: 'mg', amt: 100 },
    { id: 'adrP', lab: 'Adrenalina en bolo', k: 'adr', dose: 20, u: 'mcg', amt: 4 }, { id: 'amio300', lab: 'Amiodarona', k: 'amio', dose: 300, u: 'mg' },
    { id: 'amio150', lab: 'Amiodarona', k: 'amio', dose: 150, u: 'mg' },
    { id: 'lido100', lab: 'Lidocaína', k: 'lido', dose: 100, u: 'mg' }, { id: 'lido50', lab: 'Lidocaína', k: 'lido', dose: 50, u: 'mg' }, { id: 'tnk', lab: 'Tenecteplasa', k: 'tnk', amt: 1, tnk: true, u: 'mg' }] },
  { g: 'Sepsis', items: [
    { id: 'ceftri', lab: 'Ceftriaxona', k: 'atb', dose: 2, u: 'g' }, { id: 'pipta', lab: 'Piperacilina-tazobactam', k: 'atb', dose: 4, u: 'g' }, { id: 'mero', lab: 'Meropenem', k: 'atb', dose: 1, u: 'g' }] },
  { g: 'Neurología', items: [
    { id: 'midCr', lab: 'Midazolam (crisis)', k: 'mid', mgkg: .2, max: 10, u: 'mg', route: ' IV o IM', noIV: true, note: 'repetible una vez a los 5 min' },
    { id: 'lev', lab: 'Levetiracetam', k: 'lev', mgkg: 60, max: 4500, u: 'mg', note: 'IV en 10 min' }, { id: 'vpa', lab: 'Valproato', k: 'vpa', mgkg: 40, max: 3000, u: 'mg', note: 'IV en 10 min' },
    { id: 'ssh3', lab: 'Salino hipertónico 3 %', k: 'ssh3', dose: 100, u: 'mL', amt: 100, note: 'en 10 min' }] },
  { g: 'Tóxicos', items: [
    { id: 'glucgIV', lab: 'Glucagón IV', k: 'glucg', dose: 5, u: 'mg', note: 'en 1–2 min; repetible a los 10 min (vómitos)' }, { id: 'insHD', lab: 'Insulina a dosis altas', k: 'insHD', mgkg: 1, u: 'UI', note: 'con glucosa; después 1 UI/kg/h' },
    { id: 'atr2', lab: 'Atropina', k: 'atr', dose: 2, u: 'mg', note: 'organofosforados: dobla cada 5 min' }, { id: 'atr4', lab: 'Atropina', k: 'atr', dose: 4, u: 'mg' },
    { id: 'atr8', lab: 'Atropina', k: 'atr', dose: 8, u: 'mg' }, { id: 'atr16', lab: 'Atropina', k: 'atr', dose: 16, u: 'mg' },
    { id: 'lipid', lab: 'Emulsión lipídica 20 %', k: 'lipid', mgkg: 1.5, u: 'mL', note: 'en 1 min; rescate' }] },
  { g: 'Síndrome coronario', items: [
    { id: 'aas', lab: 'AAS', k: 'aas', dose: 250, u: 'mg', route: ' oral, masticado', noIV: true }, { id: 'tica', lab: 'Ticagrelor', k: 'tica', dose: 180, u: 'mg', route: ' oral', noIV: true },
    { id: 'clopi300', lab: 'Clopidogrel', k: 'clopi', dose: 300, u: 'mg', route: ' oral', noIV: true }, { id: 'clopi600', lab: 'Clopidogrel', k: 'clopi', dose: 600, u: 'mg', route: ' oral', noIV: true },
    { id: 'hnf', lab: 'Heparina sódica', k: 'hnf', mgkg: 70, u: 'UI', note: 'con fibrinólisis: 60 UI/kg, máx. 4.000' }, { id: 'enox', lab: 'Enoxaparina', k: 'enox', dose: 30, u: 'mg', note: 'más 1 mg/kg SC; > 75 años, sin bolo IV' }] },
  { g: 'Arritmias', items: [
    { id: 'aden6', lab: 'Adenosina', k: 'aden', dose: 6, u: 'mg', amt: 6, route: ' IV rápida' }, { id: 'aden12', lab: 'Adenosina', k: 'aden', dose: 12, u: 'mg', amt: 12, route: ' IV rápida' },
    { id: 'aden18', lab: 'Adenosina', k: 'aden', dose: 18, u: 'mg', amt: 18, route: ' IV rápida' }, { id: 'atr', lab: 'Atropina', k: 'atr', dose: .5, u: 'mg' },
    { id: 'vagal', lab: 'Maniobras vagales', act: 'vagal', note: 'Valsalva modificada' }] },
  { g: 'Respiratorio y anafilaxia', items: [
    { id: 'salb', lab: 'Salbutamol + ipratropio', k: 'salb', amt: 1, note: 'nebulizado o en línea', pnote: '2,5 mg (< 20 kg) o 5 mg + ipratropio 250 mcg nebulizados, cada 20 min la 1.ª hora', route: '', noIV: true }, { id: 'mgso4', lab: 'Sulfato de magnesio', k: 'mg', dose: 2, u: 'g' },
    { id: 'cort', lab: 'Metilprednisolona', k: 'cort', mgkg: 1, u: 'mg' }, { id: 'adrIM', lab: 'Adrenalina IM', k: 'adrIM', dose: .5, u: 'mg', amt: .5, route: ' en el muslo', noIV: true },
    { id: 'dexclor', lab: 'Dexclorfeniramina', k: 'dexclor', dose: 5, u: 'mg' }, { id: 'adrNeb', lab: 'Adrenalina nebulizada', k: 'adrN', dose: 5, u: 'mg', route: ' nebulizada', noIV: true },
    { id: 'dexa', lab: 'Dexametasona', k: 'dexa', dose: 8, u: 'mg', route: ' oral o IM', noIV: true }, { id: 'nifed', lab: 'Nifedipino retard', k: 'nifed', dose: 30, u: 'mg', route: ' oral', noIV: true, note: 'edema de altura' }] },
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
  // v1.13: adrenalina por peso para el niño (shock frío o refractario a volumen)
  { id: 'adrIkg', lab: 'Adrenalina (pediátrica)', u: 'mcg/kg/min', d: 2, opts: [0, .05, .1, .2, .3, .5], run: (sim, r) => sim.perfSteady('adr', r * 75), extra: (r, peso, fmt) => r ? ` · ${fmt(r * peso, 1)} mcg/min` : '' },
  { id: 'ntg', lab: 'Nitroglicerina', u: 'mcg/min', d: 0, opts: [0, 20, 50, 100, 150, 200], run: (sim, r, fW) => sim.setNtg(r) },
  { id: 'prop', lab: 'Propofol', u: 'mg/h', d: 0, opts: [0, 50, 100, 150, 200, 300], run: (sim, r, fW) => sim.perf('prop', r / 60 * fW) },
  { id: 'mid', lab: 'Midazolam', u: 'mg/h', d: 0, opts: [0, 2, 5, 10], run: (sim, r, fW) => sim.perf('mid', r / 60 * fW) },
  { id: 'fent', lab: 'Fentanilo', u: 'mcg/h', d: 0, opts: [0, 50, 100, 150, 200], run: (sim, r, fW) => sim.perf('fent', r / 60 * fW) },
  { id: 'ketP', lab: 'Ketamina', u: 'mg/kg/h', d: 2, opts: [0, .15, .3, .5, 1, 1.5, 2], run: (sim, r, fW) => sim.perf('ket', r * 75 / 60), extra: (r, peso, fmt) => r ? ` · ${fmt(r * peso)} mg/h` : '' },
  { id: 'rocP', lab: 'Rocuronio', u: 'mg/kg/h', d: 1, opts: [0, .3, .6], run: (sim, r, fW) => sim.perf('rel', r * 15 / 60), extra: (r, peso, fmt) => r ? ` · ${fmt(r * peso)} mg/h` : '' },
  { id: 'iso', lab: 'Isoprenalina', u: 'mcg/min', d: 0, opts: [0, 1, 2, 4, 10], run: (sim, r, fW) => sim.perfSteady('iso', r) },
  { id: 'mgP', lab: 'Sulfato de magnesio', u: 'g/h', d: 0, opts: [0, 1, 2], run: (sim, r, fW) => sim.perf('mg', r / 60 * fW) },
  { id: 'g10', lab: 'Glucosa 10 %', u: 'mL/h', d: 0, opts: [0, 50, 100, 150, 250], run: (sim, r, fW) => sim.setGluPerf(r * .1 / 60 * fW) },
  // v1.12: glucosa 10 % por peso para el recién nacido: 3 mL/kg/h ≈ 5 mg/kg/min
  { id: 'g10kg', lab: 'Glucosa 10 % (neonatal)', u: 'mL/kg/h', d: 1, opts: [0, 2.5, 3, 3.5, 4, 5], run: (sim, r) => sim.setGluPerf(r * .1 / 60 * 75), extra: (r, peso, fmt) => r ? ` · ${fmt(r * peso, 1)} mL/h · ${fmt(r * 100 / 60, 1)} mg/kg/min` : '' },
  { id: 'cris', lab: 'Cristaloide en bomba', u: 'mL/h', d: 0, opts: [0, 125, 250, 500, 750, 1000], run: (sim, r) => sim.setFluidRate(r) },
  { id: 'glucgP', lab: 'Glucagón', u: 'mg/h', d: 0, opts: [0, 2, 3, 5], run: (sim, r, fW) => sim.perf('glucg', r / 60 * fW) },
  { id: 'insP', lab: 'Insulina a dosis altas', u: 'UI/kg/h', d: 1, opts: [0, .5, 1, 2], run: (sim, r) => sim.perf('insHD', r / 60) },
  { id: 'insD', lab: 'Insulina (cetoacidosis)', u: 'UI/kg/h', d: 2, opts: [0, .05, .1, .14], run: (sim, r) => sim.perf('ins', r * 75 / 10 / 60), extra: (r, peso, fmt) => r ? ` · ${fmt(r * peso, 1)} UI/h` : '' },
  { id: 'atrP', lab: 'Atropina', u: 'mg/h', d: 0, opts: [0, 1, 2, 4, 8], run: (sim, r, fW) => sim.perf('atr', r / 60 * fW) }
];
const roundDose = x => x >= 50 ? Math.round(x / 5) * 5 : x >= 10 ? Math.round(x) : x >= 1 ? Math.round(x * 10) / 10 : Math.round(x * 100) / 100;
const PED = { glucgIV: { k: .05, max: 5, t: '50 mcg/kg' }, atr2: { k: .05, max: 2, t: '0,05 mg/kg' }, atr4: { k: .1, max: 4, t: '0,1 mg/kg' }, atr8: { k: .2, max: 8, t: '0,2 mg/kg' }, atr16: { k: .4, max: 16, t: '0,4 mg/kg' }, midCr: { k: .2, max: 10, t: '0,2 mg/kg IM, IN o IV' }, lev: { k: 60, max: 4500, t: '60 mg/kg (máx. 4.500 mg)', u: 'mg' }, vpa: { k: 40, max: 3000, t: '40 mg/kg (máx. 3.000 mg; evítalo antes de los 2 años y en enfermedad hepática o metabólica)', u: 'mg' }, ceftri: { k: 80, max: 2000, t: '80 mg/kg', u: 'mg' }, pipta: { k: 100, max: 4000, t: '100 mg/kg', u: 'mg' }, mero: { k: 20, max: 1000, t: '20 mg/kg', u: 'mg' }, adr1: { k: .01, max: 1, t: '10 mcg/kg' }, adrP: { k: 1, max: 20, t: '1 mcg/kg' }, amio300: { k: 5, max: 300, t: '5 mg/kg' }, amio150: { k: 5, max: 150, t: '5 mg/kg' },
  lido100: { k: 1, max: 100, t: '1 mg/kg' }, lido50: { k: .5, max: 50, t: '0,5 mg/kg' }, atr: { k: .02, min: .1, max: .5, t: '20 mcg/kg' }, aden6: { k: .1, max: 6, t: '0,1 mg/kg' },
  aden12: { k: .2, max: 12, t: '0,2 mg/kg' }, aden18: { k: .3, max: 18, t: '0,3 mg/kg' }, adrIM: { k: .01, max: .5, t: '10 mcg/kg' }, nalox: { k: .01, max: .4, t: '10 mcg/kg' },
  mid: { k: .05, max: 2, t: '0,05 mg/kg' }, mgso4: { k: .05, max: 2, t: '50 mg/kg en 20 min (máx. 2 g)' }, ssh3: { k: 5, max: 250, t: '2,5–5 mL/kg en 10–15 min' }, cort: { k: 2, max: 60, t: '2 mg/kg (máx. 60 mg)', u: 'mg' }, morf: { k: .05, max: 3, t: '0,05 mg/kg' }, mg: { k: .04, max: 2, t: '40 mg/kg' }, dexclor: { k: .15, max: 5, t: '0,15 mg/kg' },
  furo: { k: 1, max: 40, t: '1 mg/kg' }, hidroxo: { k: .07, max: 5, t: '70 mg/kg' }, ca: { k: .2, max: 10, t: '0,2 mL/kg' }, gluc: { k: .2, max: 25, t: '0,2 g/kg (2 mL/kg de G10 %)' },
  gluc10: { k: .2, max: 10, t: '0,2 g/kg' }, glucg: { k: .03, min: .5, max: 1, t: '0,5 mg si < 25 kg' }, txa: { k: 15, max: 1000, t: '15 mg/kg', u: 'mg' }, adrNeb: { k: .5, max: 5, t: '0,5 mg/kg' },
  dexa: { k: .6, max: 16, t: '0,6 mg/kg' }, midIN: { k: .3, max: 10, t: '0,3 mg/kg' }, mg4: { k: .05, max: 2, t: '50 mg/kg' } };
const tnkDose = p => p < 60 ? 30 : p < 70 ? 35 : p < 80 ? 40 : p < 90 ? 45 : 50;
const fWOf = (peso, ped) => ped ? 75 / peso : clamp(75 / peso, .7, 1.4);
/* dosis que se muestra (en la unidad del botón) y cantidad que recibe el motor */
// v1.9: en el recién nacido (≤ 5 kg), adrenalina de la reanimación neonatal (ERC 2021: 20 mcg/kg IV)
const PED_NEO = { adr1: { k: .02, max: .1, t: '20 mcg/kg (recién nacido)' }, gluc: { k: .2, max: 1, t: '200 mg/kg: siempre diluida, 2 mL/kg de G10 % (nunca G50 %)' }, gluc10: { k: .2, max: 1, t: '2 mL/kg de G10 % (200 mg/kg) en 5–10 min' } }; // v1.12: hipoglucemia neonatal
const pedEntry = (id, peso, ped) => ped ? (peso <= 5 && PED_NEO[id]) || PED[id] : null;
function doseOf(it, peso, ped) { const pd = pedEntry(it.id, peso, ped); if (pd) { const x = roundDose(clamp(pd.k * peso, pd.min || 0, pd.max)); return pd.u === 'mg' && it.u === 'g' ? x / 1000 : x; } return it.tnk ? tnkDose(peso) : it.mgkg != null ? roundDose(Math.min(it.max || Infinity, it.mgkg * peso)) : it.dose; }
function amountOf(it, peso, ped) { const ds = doseOf(it, peso, ped), pd = pedEntry(it.id, peso, ped); return (pd ? (it.amt != null ? it.amt * ds / it.dose : ds) * 75 / peso : it.amt != null ? it.amt : ds * fWOf(peso, ped)) * (it.bio || 1); }
root.SIM_DRUGS = { DRUGSET, DRUGITEMS, PERFS, PED, pedEntry, roundDose, tnkDose, fWOf, doseOf, amountOf };
})(typeof window !== 'undefined' ? window : globalThis);
