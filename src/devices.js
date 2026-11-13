/* Equipos del simulador.
   Cada ventilador aproxima la lógica de manejo de un modelo real (modos, nombres de mandos, unidades, rangos, teclas de función,
   flujo de puesta en marcha y alarmas). No reproduce su aspecto ni su software. Los valores marcados como «supuesto» no
   están confirmados en la documentación pública del fabricante. */
(function (root) {
'use strict';

/* Mandos: rango, paso y decimales comunes; cada equipo puede renombrarlos (lab) o cambiar sus límites (spec) */
const SPEC = {
  vt: { lab: 'Vt', u: 'mL', min: 50, max: 2000, step: 10, d: 0 }, fr: { lab: 'Fr', u: 'c/min', min: 4, max: 50, step: 1, d: 0 },
  ti: { lab: 'Ti', u: 's', min: .3, max: 3, step: .05, d: 2 }, tplat: { lab: 'Tplat', u: 's', min: 0, max: .5, step: .05, d: 2 },
  pinsp: { lab: 'Pinsp', u: 'cmH₂O', min: 5, max: 60, step: 1, d: 0, note: 'sobre PEEP' }, ps: { lab: 'PS', u: 'cmH₂O', min: 0, max: 30, step: 1, d: 0, note: 'sobre PEEP' },
  rise: { lab: 'Rampa', u: 's', min: .05, max: .6, step: .05, d: 2 }, peep: { lab: 'PEEP', u: 'cmH₂O', min: 0, max: 20, step: 1, d: 0 },
  fio2: { lab: 'FiO₂', u: '%', min: 21, max: 100, step: 1, d: 0 }, trigI: { lab: 'Trig. I', u: 'L/min', min: .5, max: 10, step: .5, d: 1 },
  trigE: { lab: 'Trig. E', u: '%', min: 5, max: 80, step: 5, d: 0 }, timax: { lab: 'Ti máx', u: 's', min: .5, max: 3, step: .1, d: 1 },
  pmax: { lab: 'P máx', u: 'cmH₂O', min: 10, max: 65, step: 1, d: 0, note: 'límite' },
  minvol: { lab: '%VM', u: '%', min: 25, max: 350, step: 5, d: 0 }, flow: { lab: 'Flujo', u: 'L/min', min: 2, max: 60, step: 1, d: 0 },
  ie: { lab: 'I:E', u: '', min: .25, max: 4, list: [.25, 1 / 3, .5, 2 / 3, 1, 1.5, 2, 3, 4], d: 2 }, // relación I:E (Medumat); el motor la convierte en Ti
  ph: { lab: 'PH', u: 'cmH₂O', min: 5, max: 60, step: 1, d: 0, note: 'presión alta absoluta' }
};
const PKEYS = { pinsp: 1, ps: 1, peep: 1, pmax: 1, ph: 1 };

/* Mandos de cada modo interno del motor */
const KEYS = {
  VCV: ['vt', 'fr', 'ti', 'tplat', 'peep', 'fio2', 'trigI', 'pmax'], PCV: ['pinsp', 'fr', 'ti', 'rise', 'peep', 'fio2', 'trigI', 'pmax'],
  APV: ['vt', 'fr', 'ti', 'rise', 'peep', 'fio2', 'trigI', 'pmax'], ASV: ['minvol', 'peep', 'fio2', 'rise', 'trigI', 'trigE', 'pmax'],
  PSV: ['ps', 'peep', 'fio2', 'rise', 'trigI', 'trigE', 'timax', 'vt', 'fr', 'pmax'], PST: ['ps', 'peep', 'fio2', 'fr', 'ti', 'rise', 'trigI', 'trigE', 'pmax'],
  CPAP: ['peep', 'fio2', 'trigI', 'vt', 'fr', 'pmax'], CPV: ['pinsp', 'fr', 'ti', 'peep', 'fio2'], HFNC: ['flow', 'fio2'],
  MAN: ['vt', 'ti', 'peep', 'fio2', 'pmax'], DEM: ['fio2'],
  /* modos de interfaz que el motor resuelve con otro modo (ver UMODES en ui.js) */
  SIMV_V: ['vt', 'fr', 'ti', 'ps', 'peep', 'fio2', 'trigI', 'trigE', 'pmax'], SIMV_P: ['pinsp', 'fr', 'ti', 'ps', 'peep', 'fio2', 'rise', 'trigI', 'trigE', 'pmax'],
  SIMV_A: ['vt', 'fr', 'ti', 'ps', 'peep', 'fio2', 'rise', 'trigI', 'trigE', 'pmax'], CPV_RCE: ['fr', 'pinsp', 'peep', 'trigI', 'fio2'], CPR_M: ['vt', 'fr', 'pmax', 'fio2']
};

const DEVS = {
  monnal: {
    name: 'Estilo Monnal T60', short: 'Monnal T60', sub: 'turbina · cmH₂O', u: 'cmH₂O', inv: 'VCV', niv: 'PSV',
    knob: 'wheel', // rueda: tocar el mando, girar y pulsar la rueda para validar
    holds: [1, 1],
    modes: { tube: [['VCV', '(A)VCV'], ['PCV', '(A)PCV'], ['APV', 'PRVC'], ['SIMV_V', 'VSIMV'], ['SIMV_P', 'PSIMV'], ['PSV', 'PSV'], ['CPV', 'CPV'], ['CPV_RCE', 'CPV · RCE']], mask: [['CPAP', 'CPAP VNI'], ['PSV', 'PSV VNI'], ['PCV', '(A)PCV VNI']], nasal: [['HFNC', 'Oxigenoterapia AF']] },
    lab: { fr: 'FR', trigI: 'Trig. I', trigE: 'Trig. E', pinsp: 'PI', rise: 'Pendiente', tplat: 'Tplat' },
    spec: { pinsp: { min: 5, max: 60 }, peep: { max: 20 } },
    nivSpec: { ps: { max: 25 }, peep: { max: 20 } }, // en VNI la PS no pasa de 25
    modeKeys: { CPV: ['ph', 'peep', 'ti', 'fr', 'fio2'] }, // CPV: presión alta y baja absolutas, sincronizadas con las compresiones
    modeLab: { CPV: { ph: 'PH sync', peep: 'PL sync', ti: 'T alto', fr: 'FR CPV' }, CPV_RCE: { fr: 'FR mín', pinsp: 'PI' }, SIMV_V: { fr: 'FR SIMV' }, SIMV_P: { fr: 'FR SIMV' } },
    limitsPmax: true, // la presión máxima es un umbral de alarma (Ppico máx) que corta la inspiración
    keys: ['o2boost', 'inhold', 'exhold', 'freeze', 'lock', 'silence', 'standby'],
    silence: 2, o2boost: { lab: 'O₂ 100 %', min: 2, note: 'duración supuesta' },
    legend: '·p = solo tras pausa',
    start: [
      { id: 'emerg', lab: 'Emergencia VC', note: 'Vt 8 mL/kg de peso predicho', cfg: ibw => ({ mode: 'VCV', vt: r10(8 * ibw), fr: 15, ti: 1.0, tplat: 0, peep: 5, fio2: 100, trigI: 2, pmax: 40 }) },
      { id: 'preox', lab: 'Preoxigenación', note: 'PSV VNI con FiO₂ 100 %', iface: 'mask', cfg: () => ({ mode: 'PSV', ps: 5, peep: 5, rise: .15, trigE: 50, timax: 1.2, trigI: 2, fio2: 100, pmax: 30, fr: 12, vt: 450 }) },
      { id: 'vni', lab: 'VNI', note: 'PSV VNI', iface: 'mask', cfg: () => ({ mode: 'PSV', ps: 8, peep: 6, rise: .15, trigE: 50, timax: 1.2, trigI: 2, fio2: 60, pmax: 30, fr: 12, vt: 450 }) },
      { id: 'af', lab: 'Oxigenoterapia AF', iface: 'nasal', cfg: () => ({ mode: 'HFNC', flow: 50, fio2: 60 }) },
      { id: 'prev', lab: 'Ajustes actuales', cfg: null }
    ],
    al: { pHigh: 'Ppico alta', pLow: 'Desconexión', vteLow: 'VTe bajo', vteHigh: 'VTe alto', mvLow: 'VMe bajo', mvHigh: 'VMe alto', fHigh: 'FR alta', apnea: 'Apnea', etLow: 'EtCO₂ bajo', etHigh: 'EtCO₂ alto', leak: 'Fuga alta', gas: 'Fallo de O₂: ventila con aire', plim: 'VT objetivo y presión incompatibles', peepHigh: 'PEEP alta' }
  },
  medumat: {
    name: 'Estilo Medumat Standard²', short: 'Medumat Standard²', sub: 'neumático · mbar', u: 'mbar', inv: 'VCV', niv: 'PSV', pneumatic: true,
    knob: 'three', // tres mandos: izquierdo Vt (o presión), central frecuencia, derecho el resto
    holds: [0, 0],
    modes: { tube: [['VCV', 'IPPV'], ['SIMV_V', 'SIMV + ASB'], ['PCV', 'BiLevel + ASB'], ['APV', 'PRVC + ASB'], ['PSV', 'CPAP + ASB'], ['CPR_M', 'CPR']], mask: [['DEM', 'RSI · Demand'], ['MAN', 'RSI · Manual'], ['VCV', 'IPPV'], ['CPAP', 'CPAP VNI'], ['PSV', 'CPAP + ASB VNI'], ['PCV', 'aPCV VNI'], ['CPR_M', 'CPR']], nasal: [] },
    lab: { fr: 'Frec.', ps: 'ΔpASB', pinsp: 'pInsp', trigI: 'Trigger', trigE: 'Fin insp.', fio2: 'O₂', pmax: 'pMax', ti: 'Ti' },
    spec: { vt: { min: 50, max: 2000, step: 50 }, fr: { min: 5, max: 50 }, peep: { min: 0, max: 30 }, ps: { max: 35 }, pinsp: { min: 3, max: 60 }, pmax: { min: 10, max: 65 }, fio2: { min: 60, max: 100, step: 40, bin: true } },
    swap: { ti: 'ie' }, // se ajusta la relación I:E, no el Ti
    modeKeys: { MAN: ['vt', 'pmax', 'fio2'] },
    modeLab: { CPR_M: { fr: 'Frec. (continua)' }, SIMV_V: { fr: 'Frec. SIMV' } },
    limitsPmax: false, // pMax es un mando: limita la presión sin cortar la inspiración
    keys: ['menu', 'airmix', 'o2full', 'cpr', 'manual', 'silence', 'standby'],
    silence: 2,
    legend: 'pPlat solo si el flujo llega a cero al final de la inspiración',
    start: [
      { id: 'new', lab: 'Paciente nuevo', note: 'talla y sexo → IPPV', cfg: ibw => ({ mode: 'VCV', vt: r50(7 * ibw), fr: 12, ti: 1.7, tplat: 0, peep: 5, fio2: 100, trigI: 2, pmax: 40 }) },
      { id: 'emA', lab: 'Emergencia adulto', note: 'IPPV preajustada', cfg: () => ({ mode: 'VCV', vt: 500, fr: 12, ti: 1.7, tplat: 0, peep: 5, fio2: 100, trigI: 2, pmax: 40 }) },
      { id: 'rsi', lab: 'RSI', note: 'Demand con O₂ 100 %', iface: 'mask', cfg: ibw => ({ mode: 'DEM', peep: 0, fio2: 100, pmax: 40, vt: r50(7 * ibw), ti: 1.5, fr: 12 }) },
      { id: 'rsiippv', lab: 'RSI → IPPV', note: 'tras intubar: IPPV con los datos del RSI', cfg: ibw => ({ mode: 'VCV', vt: r50(7 * ibw), fr: 12, ie: .5, tplat: 0, peep: 5, fio2: 100, trigI: 2, pmax: 40 }) },
      { id: 'cpr', lab: 'CPR', note: '30:2 con MEDUtrigger o continua a 10/min', cfg: ibw => ({ mode: 'CPR_M', umode: 'CPR_M', fr: 10, ie: .5, peep: 0, fio2: 100, pmax: 60, vt: r50(7 * ibw) }) },
      { id: 'prev', lab: 'Paciente anterior', cfg: null }
    ],
    al: { pHigh: 'Presión de vía aérea alta', pLow: 'Desconexión / fuga', vteLow: 'Volumen bajo', vteHigh: 'Volumen alto', mvLow: 'Volumen minuto bajo', mvHigh: 'Volumen minuto alto', fHigh: 'Frecuencia alta', apnea: 'Apnea', etLow: 'etCO₂ bajo', etHigh: 'etCO₂ alto', leak: 'Fuga', gas: 'Presión de suministro < 2,7 bar', plim: 'pMax alcanzada', peepHigh: 'PEEP alta' }
  },
  t1: {
    name: 'Estilo Hamilton T1', short: 'Hamilton T1', sub: 'turbina · cmH₂O', u: 'cmH₂O', inv: 'APV', niv: 'PSV',
    knob: 'pt', // mando de pulsar y girar: tocar el control, girar, confirmar tocando de nuevo o pulsando el mando
    holds: [1, 0],
    modes: { tube: [['APV', 'APVcmv'], ['SIMV_A', 'APVsimv'], ['PCV', 'PCV+'], ['SIMV_P', 'PSIMV+'], ['PSV', 'SPONT'], ['ASV', 'ASV']], mask: [['PSV', 'NIV'], ['PST', 'NIV-ST']], nasal: [['HFNC', 'HiFlowO2']] },
    lab: { fr: 'Rate', ti: 'TI', peep: 'PEEP/CPAP', pinsp: 'Pcontrol', ps: 'Psupport', trigI: 'Flowtrigger', trigE: 'ETS', rise: 'P-ramp', fio2: 'Oxygen', pmax: 'Pmax', timax: 'TI max', minvol: '%MinVol', flow: 'Flow', vt: 'Vt' },
    spec: { vt: { min: 20, max: 2000 }, fr: { min: 4, max: 80 }, ti: { min: .1, max: 12 }, peep: { max: 35 }, ps: { max: 60 }, trigI: { min: .5, max: 20 }, trigE: { min: 5, max: 80 }, flow: { min: 2, max: 60 },
      rise: { min: 0, max: 2, step: .025, ms: true, spontMax: .2 } }, // P-ramp en ms: 0–2000, hasta 200 en modos espontáneos
    limitsPmax: true, // el límite de presión alta está en Alarmas; la presión aplicada no pasa de límite − 10
    keys: ['o2boost', 'manual', 'neb', 'freeze', 'lock', 'silence', 'standby'],
    silence: 2, o2boost: { lab: 'O₂ enrichment', min: 2 },
    legend: '·c = calculado en cada ciclo, sin pausa',
    start: [
      { id: 'qs1', lab: 'Quick setup 1 · Adulto', note: 'APVcmv, Vt 8 mL/kg (supuesto)', cfg: ibw => ({ mode: 'APV', vt: r10(8 * ibw), fr: 14, ti: 1.0, rise: .1, peep: 5, fio2: 50, trigI: 2, pmax: 40 }) },
      { id: 'qs2', lab: 'Quick setup 2 · NIV', iface: 'mask', cfg: () => ({ mode: 'PSV', ps: 8, peep: 6, rise: .1, trigE: 40, timax: 1.2, trigI: 2, fio2: 60, pmax: 30, fr: 12, vt: 450 }) },
      { id: 'qs3', lab: 'Quick setup 3 · HiFlowO2', iface: 'nasal', cfg: () => ({ mode: 'HFNC', flow: 50, fio2: 60 }) },
      { id: 'prev', lab: 'Ajustes actuales', cfg: null }
    ],
    al: { pHigh: 'Presión alta', pLow: 'Desconexión', vteLow: 'Vt bajo', vteHigh: 'Vt alto', mvLow: 'Vol. minuto bajo', mvHigh: 'Vol. minuto alto', fHigh: 'fTotal alta', apnea: 'Apnea', etLow: 'PetCO2 baja', etHigh: 'PetCO2 alta', leak: 'Fuga alta', gas: 'Fallo de O₂', plim: 'Limitación de presión', peepHigh: 'PEEP alta' }
  }
};
function r10(x) { return Math.round(x / 10) * 10; }
function r50(x) { return Math.round(x / 50) * 50; }

/* Teclas de función: etiqueta por equipo */
const KEYLAB = {
  o2boost: d => d.o2boost ? d.o2boost.lab : 'O₂ 100 %', inhold: () => 'Pausa insp.', exhold: () => 'Pausa esp.', freeze: () => 'Congelar', lock: () => 'Bloqueo',
  silence: d => 'Silenciar ' + (d === DEVS.medumat ? '120 s' : '2 min'), standby: d => d === DEVS.medumat ? 'On / espera' : 'En espera',
  manual: d => d === DEVS.t1 ? 'Resp. manual · mantén = pausa insp.' : d === DEVS.medumat ? 'MEDUtrigger' : 'Disparo manual', neb: () => 'Nebulizador', menu: () => 'Menú',
  airmix: () => 'Air Mix', o2full: () => '100 % O₂', cpr: () => 'CPR'
};

/* Monitores-desfibriladores */
const MONS = {
  zoll: { name: 'Estilo ZOLL X Series', short: 'ZOLL X Series', energies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50, 70, 85, 100, 120, 150, 200], def: 150, aed: [120, 150, 200], paceRates: [30, 180], paceMa: [0, 140], paceModes: ['demand', 'fixed'], nibp: [1, 2, 3, 5, 10, 15, 30, 60], cpr: 'Real CPR Help', rainbow: 'SpCO (opción rainbow)' },
  corpuls: { name: 'Estilo corpuls3', short: 'corpuls3', energies: [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50, 70, 100, 120, 150, 200], def: 150, aed: [150, 200, 200], paceRates: [30, 150], odMax: 300, paceMa: [0, 140], paceModes: ['demand', 'fixed', 'overdrive'], nibp: [1, 2, 3, 5, 10, 15, 30, 60], cpr: 'feedback de RCP', rainbow: 'SpCO (rainbow)' }
};

root.SIM_DEV = { SPEC, PKEYS, KEYS, DEVS, KEYLAB, MONS };
})(typeof window !== 'undefined' ? window : globalThis);
