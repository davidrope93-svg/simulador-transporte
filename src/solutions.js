/* Soluciones de referencia (v1.2): lo que haría un equipo experto en cada caso, como pasos [minuto, orden, ...argumentos].
   Las usa el validador (tests/validar.js) para comprobar que cada caso se puede resolver y que no hacer nada suspende.
   Además de estos pasos, el validador actúa como un clínico atento en todos los casos:
     · explora al empezar y hace las pruebas que pidan las acciones clave (glucemia, temperatura, gasometría);
     · ajusta la FiO₂ (o el dispositivo de O₂) a la SpO₂ objetivo y la FR a la EtCO₂ objetivo si el caso las tiene;
     · responde a las complicaciones cuando aparecen (tapón, desconexión, extubación, selectiva, fallo de O₂, broncoespasmo,
       neumotórax, despertar, fuga, broncoaspiración, convulsión, resangrado), un minuto después;
     · si hay parada, sigue el algoritmo de SVA (RCP, análisis cada 2 min, descargas, adrenalina y antiarrítmico, dosis por peso
       en el niño, sin adrenalina y con 3 descargas como máximo por debajo de 30 °C);
     · si un fármaco necesita vía y no la hay, la canaliza (intraósea en la parada o en el niño) y lo da después.
   Órdenes: vt (mL/kg de peso ideal), cfg (ajustes), d (fármaco), a (acción), p (perfusión), niv (VMNI con ajustes), hfnc (flujo, FiO₂),
   o2 (dispositivo), isr (inducción, relajante e intubación; opciones ind, vl, apox, post), cv (cardioversión sincronizada, J),
   pace (frecuencia, mA), pads, mech (compresor mecánico).
   Opciones del caso: nor (TAS con noradrenalina), adrI (TAS con adrenalina), labet (TAS > 160 con labetalol), bicQrs (QRS > 120 con
   bicarbonato), atr (bradicardia con TAS < 90: atropina), norPam (PAM objetivo con noradrenalina), nalox (FR < 10 con naloxona), permissive (TAS 80–90: volumen solo si baja de 80), noAuto (sin ajuste automático de FiO₂). */
(function (root) {
'use strict';
const SOL = {
  tce: { s: [[.5, 'vt', 7], [.5, 'cfg', { fr: 12, peep: 5 }]], nor: 110 },
  htic: { s: [[.5, 'd', 'shs'], [.5, 'vt', 7], [.5, 'cfg', { fr: 16 }]], nor: 110 },
  pcr: { s: [[.5, 'vt', 7], [.5, 'cfg', { fr: 14, peep: 5 }], [1, 'a', 'fluid']], nor: 100 },
  neumo: { s: [[.5, 'vt', 6], [.5, 'cfg', { peep: 12, fr: 24 }]] },
  ahogado: { s: [[.3, 'a', 'suction'], [.5, 'vt', 6], [.5, 'cfg', { peep: 12, fr: 22 }]] },
  aspiracion: { s: [[.5, 'vt', 7], [1.5, 'a', 'suction'], [1.5, 'cfg', { peep: 14 }]] },
  asma: { s: [[.3, 'a', 'opencirc'], [.6, 'vt', 7], [.6, 'cfg', { fr: 10, ti: .8, peep: 0 }], [.7, 'd', 'salb'], [1, 'd', 'mgso4'], [1.2, 'd', 'cort'], [1.4, 'a', 'fluid']] },
  trauma: { s: [[.3, 'cfg', { peep: 5 }], [.4, 'a', 'fluid'], [3, 'a', 'fluid']] },
  traslado: { s: [[.5, 'cfg', { fio2: 40 }]] },
  despierta: { s: [] },
  cambioVent: { s: [[2.8, 'a', 'clamp']] },
  movil: { s: [] },
  hemsApv: { s: [[.5, 'cfg', { vt: 'ibw7' }]] },
  epocHems: { s: [[.5, 'vt', 6.5], [.5, 'cfg', { fr: 11, ti: .9 }], [.7, 'd', 'salb']] },
  ptxAltitud: { s: [[.5, 'a', 'drain']] },
  extubVuelo: { s: [[.5, 'cfg', { fr: 16 }]] },
  epocIni: { s: [[.5, 'niv', { peep: 7, ps: 12, trigE: 45, timax: 1, rise: .15 }], [.8, 'd', 'salb'], [1, 'd', 'cort']] },
  epocAsinc: { s: [[.5, 'niv', { peep: 8, ps: 13, trigE: 45, timax: 1, rise: .15 }], [.8, 'd', 'salb']] },
  eap: { s: [[.5, 'niv', { mode: 'PSV', peep: 10, ps: 8 }], [.7, 'd', 'ntgiv'], [1, 'p', 'ntg', 200], [1.2, 'd', 'furo']] },
  eapShock: { s: [[.5, 'niv', { mode: 'PSV', peep: 10, ps: 8 }], [.6, 'p', 'nor', .1]], nor: 95 },
  neumoVmni: { s: [[.5, 'niv', { peep: 10, ps: 10 }]], post: { peep: 10 } },
  fuga: { s: [[.5, 'a', 'mask'], [.6, 'cfg', { trigI: 3 }]] },
  fracaso: { s: [[.5, 'niv', { peep: 6, ps: 14, trigE: 45, timax: 1 }], [.7, 'd', 'salb'], [4, 'isr', { ind: 'ket' }]], post: { fr: 16, ti: .8, peep: 5, fio2: 40 } },
  miastenia: { s: [[.5, 'niv', { ps: 12, peep: 5 }]] },
  isrSeptico: { s: [[.3, 'a', 'fluid'], [.4, 'p', 'nor', .1], [.5, 'niv', { peep: 6, ps: 6, fio2: 100 }], [3.5, 'isr', { ind: 'ket' }]], nor: 90, post: { peep: 8 } },
  obesoIsr: { s: [[.3, 'niv', { peep: 10, ps: 6, fio2: 100 }], [3, 'a', 'vl'], [3, 'a', 'apox'], [3.5, 'isr', { ind: 'ket' }]], post: { peep: 10 } },
  viaDificil: { s: [[.3, 'a', 'bag'], [.8, 'a', 'vl'], [1, 'isr', { ind: 'ket' }], [3, 'a', 'sga'], [4.2, 'a', 'cric']], post: { peep: 10 } },
  quemado: { s: [[.3, 'o2', 'reserv'], [.5, 'd', 'hidroxo'], [1, 'isr', { ind: 'ket' }]] },
  bronquiolitis: { s: [[.5, 'hfnc', 'kg2', 60]] },
  crup: { s: [[.5, 'd', 'adrNeb'], [.7, 'd', 'dexa']] },
  anafPed: { s: [[.3, 'd', 'adrIM'], [.4, 'o2', 'reserv'], [.6, 'a', 'fluid'], [5, 'd', 'adrIM'], [5.5, 'd', 'salb']] },
  pelvis: { s: [[.3, 'a', 'hemo'], [.4, 'a', 'warm'], [.5, 'd', 'txa']], permissive: true },
  pcrTrauma: { s: [[.2, 'a', 'hemo'], [.3, 'a', 'drain'], [.5, 'a', 'io'], [1.4, 'a', 'blood'], [1.6, 'a', 'blood'], [2, 'a', 'fluid']] },
  eclampsia: { s: [[.3, 'a', 'iv'], [.5, 'd', 'mg4'], [2.5, 'p', 'mgP', 1], [3, 'd', 'labet']], labet: true },
  hpp: { s: [[.2, 'a', 'hemo'], [.3, 'd', 'oxito'], [.4, 'a', 'warm'], [.5, 'd', 'txa'], [2.5, 'a', 'fluid'], [3, 'a', 'blood']] },
  hiperK: { s: [[.3, 'd', 'ca'], [.6, 'd', 'ins'], [.7, 'd', 'gluc'], [.8, 'd', 'salb']] },
  hipotermia: { s: [[.3, 'a', 'warm'], [.4, 'o2', 'reserv']] },
  hipoglucemia: { s: [[.4, 'd', 'glucg'], [.5, 'a', 'iv'], [2.5, 'd', 'gluc'], [3, 'p', 'g10', 100], [12, 'a', 'glu']] },
  opiaceos: { s: [[.2, 'a', 'bag'], [.4, 'd', 'nalox'], [4, 'a', 'bag']], nalox: true },
  triciclicos: { s: [[.4, 'd', 'bic'], [.6, 'd', 'bic']], bicQrs: true, nor: 90 },
  hfnc: { s: [[.5, 'hfnc', 60, 90], [3, 'niv', { peep: 10, ps: 8, fio2: 100 }]] },
  epocO2: { s: [[.5, 'o2', 'venturi28']] },
  co: { s: [[.3, 'o2', 'reserv']], noAuto: true },
  anafilaxia: { s: [[.2, 'd', 'adrIM'], [.4, 'a', 'fluid'], [1.5, 'a', 'fluid'], [5, 'd', 'adrIM'], [5.5, 'd', 'salb']] },
  tepPulso: { s: [[.4, 'p', 'nor', .1], [.6, 'd', 'tnk']], nor: 90 },
  tsvInestable: { s: [[.5, 'cv', 100]] },
  tsvEstable: { s: [[.4, 'a', 'vagal'], [1.2, 'd', 'aden6', 'tsv'], [2.5, 'd', 'aden12', 'tsv'], [4, 'd', 'aden18', 'tsv']] },
  faRapida: { s: [[.5, 'cv', 200]] },
  tvPulso: { s: [[.5, 'cv', 150]] },
  bradiSinusal: { s: [[.4, 'd', 'atr'], [3, 'p', 'adrI', 5]], adrI: 100 },
  bav: { s: [[.4, 'pace', 70, 90], [.5, 'p', 'adrI', 5]], adrI: 90 },
  pcrFv: { s: [] },
  fvRefractaria: { s: [[.3, 'mech']], pads: 3 },
  aespPtx: { s: [[.3, 'a', 'decomp'], [.4, 'a', 'drain'], [.5, 'a', 'fluid']] },
  asistolia: { s: [] },
  pcrTep: { s: [[.3, 'mech'], [.5, 'd', 'tnk']] },
  pcrPedFv: { s: [] },
  sepsisUrin: { s: [[.4, 'a', 'fluid'], [.6, 'd', 'ceftri'], [2.5, 'a', 'fluid'], [4.5, 'a', 'fluid'], [6, 'p', 'nor', .1]], norPam: 65 },
  sepsisIC: { s: [[.4, 'a', 'fluid'], [.8, 'p', 'nor', .1], [1, 'd', 'ceftri'], [2, 'niv', { mode: 'PSV', peep: 8, ps: 6, fio2: 60 }]], norPam: 65 },
  shockNeuro: { s: [[.4, 'a', 'fluid'], [.6, 'd', 'atr'], [1, 'p', 'nor', .1]], norPam: 80 },
  scaAnt: { s: [[.3, 'a', 'ecg12'], [.5, 'd', 'aas'], [.7, 'd', 'hnf'], [1, 'a', 'icp']] },
  scaGomera: { s: [[.3, 'a', 'ecg12'], [.5, 'd', 'aas'], [.6, 'd', 'clopi300'], [.8, 'd', 'enox'], [1, 'd', 'tnk']], atr: true },
  scaVD: { s: [[.3, 'a', 'ecg12'], [.5, 'a', 'fluid'], [.6, 'd', 'aas'], [.8, 'd', 'hnf'], [1, 'a', 'icp'], [3, 'a', 'fluid']], atr: true, nor: 90 },
  taponamiento: { s: [[.3, 'a', 'eco'], [.4, 'a', 'fluid'], [.8, 'a', 'pericardio']] },
  hemotorax: { s: [[.3, 'a', 'eco'], [.5, 'a', 'drain'], [.7, 'a', 'iv'], [2.4, 'd', 'txa'], [2.6, 'd', 'ketA'], [3, 'a', 'blood'], [6, 'a', 'blood']], permissive: true },
  volet: { s: [[.3, 'a', 'eco'], [.5, 'd', 'fentS'], [3, 'niv', { peep: 8, ps: 6 }]] },
  granQuemado: { s: [[.3, 'a', 'warm'], [.5, 'a', 'iv'], [2.2, 'p', 'cris', 500], [2.4, 'd', 'fentS']] },
  rceInestable: { s: [[.3, 'a', 'fluid'], [.4, 'p', 'nor', .1], [.5, 'vt', 7], [.6, 'cfg', { fr: 14 }], [3, 'a', 'fluid']], nor: 100 }
};
root.SIM_SOL = SOL;
})(typeof window !== 'undefined' ? window : globalThis);
