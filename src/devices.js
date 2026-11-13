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
  minvol: { lab: '%VM', u: '%', min: 25, max: 350, step: 5, d: 0 }, flow: { lab: 'Flujo', u: 'L/min', min: 2, max: 60, step: 1, d: 0 }
};
const PKEYS = { pinsp: 1, ps: 1, peep: 1, pmax: 1 };

/* Mandos de cada modo interno del motor */
const KEYS = {
  VCV: ['vt', 'fr', 'ti', 'tplat', 'peep', 'fio2', 'trigI', 'pmax'], PCV: ['pinsp', 'fr', 'ti', 'rise', 'peep', 'fio2', 'trigI', 'pmax'],
  APV: ['vt', 'fr', 'ti', 'rise', 'peep', 'fio2', 'trigI', 'pmax'], ASV: ['minvol', 'peep', 'fio2', 'rise', 'trigI', 'trigE', 'pmax'],
  PSV: ['ps', 'peep', 'fio2', 'rise', 'trigI', 'trigE', 'timax', 'vt', 'fr', 'pmax'], PST: ['ps', 'peep', 'fio2', 'fr', 'ti', 'rise', 'trigI', 'trigE', 'pmax'],
  CPAP: ['peep', 'fio2', 'trigI', 'vt', 'fr', 'pmax'], CPV: ['pinsp', 'fr', 'ti', 'peep', 'fio2'], HFNC: ['flow', 'fio2'],
  MAN: ['vt', 'ti', 'peep', 'fio2', 'pmax'], DEM: ['fio2']
};

const DEVS = {
  monnal: {
    name: 'Estilo Monnal T60', short: 'Monnal T60', sub: 'turbina · cmH₂O', u: 'cmH₂O', inv: 'VCV', niv: 'PSV',
    knob: 'wheel', // rueda: tocar el mando, girar y pulsar la rueda para validar
    holds: [1, 1],
    modes: { tube: [['VCV', '(A)VCV'], ['PCV', '(A)PCV'], ['APV', 'PRVC'], ['PSV', 'PSV'], ['CPV', 'CPV']], mask: [['CPAP', 'CPAP VNI'], ['PSV', 'PSV VNI'], ['PCV', '(A)PCV VNI']], nasal: [['HFNC', 'Oxigenoterapia AF']] },
    lab: { fr: 'FR', trigI: 'Trig. I', trigE: 'Trig. E', pinsp: 'PI', rise: 'Pendiente', tplat: 'Tplat' },
    spec: { pinsp: { min: 5, max: 60 }, peep: { max: 20 } },
    limitsPmax: true, // la presión máxima es un umbral de alarma (Ppico máx) que corta la inspiración
    keys: ['o2boost', 'inhold', 'exhold', 'freeze', 'lock', 'silence', 'standby'],
    silence: 2, o2boost: { lab: 'O₂ 100 %', min: 2, note: 'duración supuesta' },
    legend: '·p = solo tras pausa',
    start: [
      { id: 'emerg', lab: 'Emergencia VC', note: 'Vt 8 mL/kg de peso predicho', cfg: ibw => ({ mode: 'VCV', vt: r10(8 * ibw), fr: 15, ti: 1.0, tplat: 0, peep: 5, fio2: 100, trigI: 2, pmax: 40 }) },
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
    modes: { tube: [['VCV', 'IPPV'], ['PCV', 'BiLevel + ASB'], ['APV', 'PRVC + ASB'], ['PSV', 'CPAP + ASB'], ['CPV', 'CPR']], mask: [['DEM', 'RSI · Demand'], ['MAN', 'RSI · Manual'], ['VCV', 'IPPV'], ['CPAP', 'CPAP VNI'], ['PSV', 'CPAP + ASB VNI'], ['PCV', 'aPCV VNI']], nasal: [] },
    lab: { fr: 'Frec.', ps: 'ΔpASB', pinsp: 'pInsp', trigI: 'Trigger', trigE: 'Fin insp.', fio2: 'O₂', pmax: 'pMax', ti: 'Ti' },
    spec: { vt: { min: 50, max: 2000, step: 50 }, fr: { min: 5, max: 50 }, peep: { min: 0, max: 20 }, pmax: { min: 10, max: 65 }, fio2: { min: 60, max: 100, step: 40, bin: true } },
    limitsPmax: false, // pMax es un mando: limita la presión sin cortar la inspiración
    keys: ['menu', 'airmix', 'o2full', 'cpr', 'manual', 'silence', 'standby'],
    silence: 2,
    legend: 'pPlat solo si el flujo llega a cero al final de la inspiración',
    start: [
      { id: 'new', lab: 'Paciente nuevo', note: 'talla y sexo → IPPV', cfg: ibw => ({ mode: 'VCV', vt: r50(7 * ibw), fr: 12, ti: 1.7, tplat: 0, peep: 5, fio2: 100, trigI: 2, pmax: 40 }) },
      { id: 'emA', lab: 'Emergencia adulto', note: 'IPPV preajustada', cfg: () => ({ mode: 'VCV', vt: 500, fr: 12, ti: 1.7, tplat: 0, peep: 5, fio2: 100, trigI: 2, pmax: 40 }) },
      { id: 'rsi', lab: 'RSI', note: 'Demand con O₂ 100 %', iface: 'mask', cfg: ibw => ({ mode: 'DEM', peep: 0, fio2: 100, pmax: 40, vt: r50(7 * ibw), ti: 1.5, fr: 12 }) },
      { id: 'cpr', lab: 'CPR', note: 'continua a 10/min', cfg: ibw => ({ mode: 'CPV', pinsp: 15, fr: 10, ti: 1.0, peep: 0, fio2: 100, pmax: 60, vt: r50(7 * ibw) }) },
      { id: 'prev', lab: 'Paciente anterior', cfg: null }
    ],
    al: { pHigh: 'Presión de vía aérea alta', pLow: 'Desconexión / fuga', vteLow: 'Volumen bajo', vteHigh: 'Volumen alto', mvLow: 'Volumen minuto bajo', mvHigh: 'Volumen minuto alto', fHigh: 'Frecuencia alta', apnea: 'Apnea', etLow: 'etCO₂ bajo', etHigh: 'etCO₂ alto', leak: 'Fuga', gas: 'Presión de suministro < 2,7 bar', plim: 'pMax alcanzada', peepHigh: 'PEEP alta' }
  },
  t1: {
    name: 'Estilo Hamilton T1', short: 'Hamilton T1', sub: 'turbina · cmH₂O', u: 'cmH₂O', inv: 'APV', niv: 'PSV',
    knob: 'pt', // mando de pulsar y girar: tocar el control, girar, confirmar tocando de nuevo o pulsando el mando
    holds: [1, 0],
    modes: { tube: [['APV', 'APVcmv'], ['PCV', 'PCV+'], ['PSV', 'SPONT'], ['ASV', 'ASV']], mask: [['PSV', 'NIV'], ['PST', 'NIV-ST']], nasal: [['HFNC', 'HiFlowO2']] },
    lab: { fr: 'Rate', ti: 'TI', peep: 'PEEP/CPAP', pinsp: 'Pcontrol', ps: 'Psupport', trigI: 'Flowtrigger', trigE: 'ETS', rise: 'P-ramp', fio2: 'Oxygen', pmax: 'Pmax', timax: 'TI max', minvol: '%MinVol', flow: 'Flow', vt: 'Vt' },
    spec: { fr: { min: 4, max: 80 }, peep: { max: 35 }, ps: { max: 60 }, trigI: { min: .5, max: 20 }, trigE: { min: 5, max: 80 }, flow: { min: 2, max: 60 } },
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
  manual: d => d === DEVS.t1 ? 'Resp. manual · mantén = pausa insp.' : 'Disparo manual', neb: () => 'Nebulizador', menu: () => 'Menú',
  airmix: () => 'Air Mix', o2full: () => '100 % O₂', cpr: () => 'CPR'
};

/* Monitores-desfibriladores */
const MONS = {
  zoll: { name: 'Estilo ZOLL X Series', short: 'ZOLL X Series', energies: [50, 70, 85, 100, 120, 150, 200], def: 150, aed: [120, 150, 200], paceRates: [30, 180], paceMa: [0, 140], cpr: 'Real CPR Help', rainbow: 'SpCO (opción rainbow)' },
  corpuls: { name: 'Estilo corpuls3', short: 'corpuls3', energies: [50, 70, 100, 120, 150, 200], def: 150, aed: [150, 200, 200], paceRates: [30, 180], paceMa: [0, 140], cpr: 'feedback de RCP', rainbow: 'SpCO (rainbow)' }
};

root.SIM_DEV = { SPEC, PKEYS, KEYS, DEVS, KEYLAB, MONS };
})(typeof window !== 'undefined' ? window : globalThis);
