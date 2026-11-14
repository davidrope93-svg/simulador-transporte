/* Variantes de un caso (v1.0). A partir de un caso y una semilla crea otro caso, siempre el mismo para la misma semilla, que cambia
   la conducta y no solo las cifras: el paciente (talla, peso y peso ideal; con IMC ≥ 35, fenotipo obeso), la gravedad, el acceso
   vascular, la altitud de cabina en HEMS, una complicación añadida con su acción clave y, en la parada del adulto, la causa y el ritmo.
   Sin DOM: lo usan la interfaz y las pruebas del motor. */
(function (root) {
'use strict';
const CASES = root.SIM_CASES;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ibwOf = (sex, cm) => (sex === 'm' ? 45.5 : 50) + .91 * (cm - 152.4);
const r10 = x => Math.round(x / 10) * 10;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const fmtAlt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const codeOf = seed => (seed >>> 0).toString(36).toUpperCase().slice(-4).padStart(4, '0');

/* gravedad: [mínimo, máximo, valor sin enfermedad] de los parámetros que escalan la patología */
const SEV = { deficit: [0, .55], bs: [1, 4, 1], opioid: [0, 30], tep: [0, .95], anaf: [0, .95], cohb: [0, .5], cn: [0, 1], icp: [10, 45, 10], icpGrow: [0, .6],
  weak: [0, .95], edAir: [0, .95], edAirRate: [0, .2], asp: [0, .9], kRate: [0, .6], bleed: [0, .012], tca: [0, 1], croup: [0, 1], sevFloor: [0, .9], arrPen: [0, 60], sev: [0, 1], tampRate: [0, .04], vaso: [0, .9], vasoRate: [0, .02], neurog: [0, 1],
  htx: [0, 2.4], flail: [0, 1], burn: [0, 90], drown: [0, 1], na: [105, 140, 140], op: [0, 1], opRate: [0, .03], cocaine: [0, 1] };

/* complicaciones que se pueden añadir: evento del motor, acción clave, texto del registro y explicación para la solución */
const EV = {
  obst: ['obst', 'act:suction', 'Aspirar y revisar el tubo', 'Tapón de secreciones en el tubo', 'tapón o acodamiento del tubo: sube el pico con la meseta igual y cae el volumen; aspira y revisa el tubo'],
  disc: ['disc', 'act:reconnect', 'Reconectar la tubuladura', 'Se suelta la tubuladura al mover la camilla', 'desconexión: cae la presión, desaparece la EtCO₂ y salta la alarma de volumen bajo; reconecta'],
  extub: ['extub', 'act:reintub', 'Reintubar', 'Movimiento brusco al pasar a la camilla', 'extubación accidental: sin EtCO₂ y sin volumen espirado; ambú con O₂ y reintuba'],
  sel: ['sel', 'act:pull', 'Retirar el tubo 2 cm', 'El tubo se desplaza al movilizar', 'intubación selectiva: sube la presión, baja la SpO₂ y el murmullo se apaga en un lado; retira el tubo 2 cm'],
  o2: ['o2', 'act:bottle', 'Cambiar la botella', 'Fallo del suministro de oxígeno', 'fallo del suministro de O₂: alarma de gas y la FiO₂ cae a la del aire; cambia la botella'],
  bronco: ['bronco', 'drug:salb', 'Broncodilatador', 'Broncoespasmo', 'broncoespasmo: sube el pico pero no la meseta, aparece auto-PEEP y el flujo espiratorio no llega a cero; salbutamol'],
  ptx: ['ptx', 'act:decomp|act:drain', 'Descompresión o drenaje', 'Neumotórax a tensión', 'neumotórax a tensión: suben pico y meseta, cae la SpO₂ y después la TA, murmullo abolido en un lado; descomprime'],
  wake: ['wake', 'drug:sed|drug:mid|drug:prop|drug:fent|act:sedperf', 'Sedación', 'Se acaba la bomba de sedación', 'se despierta y lucha con el respirador (tos, taquicardia, HTA); reanuda la bomba y da un bolo'],
  cuff: ['leak', 'act:cuff', 'Inflar el balón', 'Fuga por el balón', 'fuga por el balón: el volumen espirado es menor que el inspirado y se oye el escape; infla el balón'],
  leak: ['leak', 'act:mask', 'Recolocar la mascarilla', 'Se mueve la mascarilla', 'fuga grande: cae el Vt espirado y hay autodisparos; recoloca la mascarilla'],
  aspir: ['aspir', 'intub', 'Vía aérea definitiva', 'Vómito con la mascarilla puesta', 'broncoaspiración en VMNI: empeoran la oxigenación y la conciencia; retira la mascarilla, aspira e intuba'],
  vf: ['vf', 'shock', 'Desfibrilar', 'La taquicardia degenera en FV', 'la TV degenera en FV: desfibrila sin demora y sigue el algoritmo de parada'],
  seiz: ['seiz', 'drug:mg|drug:mid', 'Tratar la convulsión', 'Convulsión', 'convulsión tónico-clónica: en la eclampsia, sulfato de magnesio (4 g IV, o 2 g más si ya lo lleva) y midazolam si no cede'],
  rebleed: ['rebleed', 'act:hemo', 'Hemostasia de nuevo', 'Vuelve a sangrar', 'resangrado: tras estabilizarse cae la TA y sube la FC; revisa la hemostasia (torniquete, cinturón pélvico o masaje uterino), volumen prudente y sangre']
};

/* causas de parada del adulto: ritmo(s), parámetros del motor, pista en el planteamiento, acciones clave y solución */
const CAUSE = {
  cardio: { r: ['vf'], p: {}, clue: () => 'Dolor torácico opresivo desde hace una hora; se desploma delante de la familia.',
    chk: [['shock', 'Descarga precoz'], ['drug:amio|drug:lido', 'Antiarrítmico']], why: 'Origen cardíaco probable: tras la RCE, ECG de 12 derivaciones y traslado a un centro con hemodinámica.' },
  hypox: { r: ['asys', 'aesp'], p: { arrestCause: 'hypox' }, clue: () => 'Se atragantó comiendo; le sacaron el bolo con los dedos, pero ya no respiraba.',
    chk: [['act:bag|intub', 'Ventilar con O₂ al 100 %']], why: 'Parada por hipoxia: lo primero es ventilar y oxigenar con O₂ al 100 %; sin oxigenación no habrá RCE.' },
  hypo: { r: ['aesp'], p: { arrestCause: 'hypo', deficit: .45 }, clue: () => 'Toma anticoagulantes y lleva desde ayer con melenas y vómitos en posos de café.',
    chk: [['act:fluid|act:blood', 'Volumen y sangre']], why: 'Hemorragia digestiva con anticoagulantes: volumen y concentrados de hematíes por dos accesos (o intraósea) sin esperar; el tranexámico no está indicado en la hemorragia digestiva.' },
  tep: { r: ['aesp'], p: { arrestCause: 'tep', tep: .95 }, clue: f => `${f ? 'Operada' : 'Operado'} de rodilla hace 12 días; disnea brusca y síncope antes de pararse.`,
    chk: [['drug:tnk', 'Fibrinólisis'], ['act:compMech', 'Compresor mecánico']], why: 'TEP masivo probable: fibrinólisis (tenecteplasa por peso) durante la RCP y prolongarla 60–90 min con compresor mecánico.' },
  ptx: { r: ['aesp'], p: { arrestCause: 'ptx', ptx: .9, ptxTension: true, deficit: .1 }, clue: () => 'Caída en casa con un golpe en el costado izquierdo hace una hora; disnea progresiva hasta pararse.',
    chk: [['act:decomp|act:drain', 'Descompresión']], why: 'Neumotórax a tensión: descompresión con aguja o toracostomía (en el intubado, mejor toracostomía).' },
  opi: { r: ['asys', 'aesp'], p: { arrestCause: 'opi', opioid: 26 }, clue: f => `${f ? 'Encontrada' : 'Encontrado'} en un baño público con una jeringa al lado; pupilas puntiformes.`,
    chk: [['drug:nalox', 'Naloxona']], why: 'Opiáceos: lo primero es ventilar y oxigenar; considera la naloxona (en el simulador revierte la causa).' },
  hyperk: { r: ['aesp'], p: { arrestCause: 'hyperk', k: 8.5, hco3Off: -6 }, clue: () => 'Está en hemodiálisis y no fue a su última sesión; ayer ya tenía debilidad.',
    chk: [['drug:ca', 'Calcio'], ['drug:ins|drug:bic', 'Insulina con glucosa o bicarbonato']], why: 'Hiperpotasemia: cloruro cálcico 10 % 10 mL IV, insulina 10 UI con 25 g de glucosa y bicarbonato; considera prolongar la RCP.' },
  tca: { r: ['aesp'], p: { arrestCause: 'tca', tca: .7 }, clue: f => `A su lado, blísteres vacíos de amitriptilina; hace una hora estaba ${f ? 'somnolienta' : 'somnoliento'}.`,
    chk: [['drug:bic', 'Bicarbonato']], why: 'Tricíclicos: bicarbonato 1 mEq/kg en bolos hasta estrechar el QRS (pH 7,45–7,55) y RCP prolongada.' },
  hypoT: { r: ['vf'], p: { arrestCause: 'hypoT', temp: 27, tempRate: 0, noRosc: true }, clue: f => `${f ? 'Encontrada' : 'Encontrado'} de madrugada en el monte tras perderse; la piel está helada.`,
    chk: [['act:temp', 'Medir la temperatura'], ['act:warm', 'Recalentamiento'], ['act:compMech', 'Compresor mecánico']], why: 'Hipotermia por debajo de 30 °C: mide la temperatura, máximo 3 descargas y sin adrenalina hasta los 30 °C; recalentamiento, compresor mecánico y traslado a un centro con ECMO.' },
  tamp: { r: ['aesp'], p: { arrestCause: 'tamp', tamp: .93, tampRate: .005 }, clue: f => `${f ? 'Herida' : 'Herido'} por arma blanca en el hemitórax izquierdo hace 20 minutos; antes de pararse tenía las yugulares ingurgitadas.`,
    chk: [['act:pericardio', 'Pericardiocentesis']], why: 'Taponamiento cardiaco: pericardiocentesis ecoguiada durante la RCP (en el traumático, toracotomía si hay equipo) y volumen.' },
  anaf: { r: ['aesp'], p: { arrestCause: 'anaf', anaf: .9, deficit: .3 }, clue: () => 'Le picó una avispa en el jardín; en minutos, habones, ronquera y colapso.',
    chk: [['act:fluid', 'Volumen']], why: 'Anafilaxia: adrenalina IV según el algoritmo de parada y volumen agresivo (2–3 L).' }
};
const RHY = { vf: 'En el monitor, FV.', aesp: 'En el monitor, un ritmo organizado sin pulso (AESP).', asys: 'En el monitor, asistolia.' };
const ALS = { vf: 'Ritmo desfibrilable: carga mientras se comprime, descarga 150–200 J y reanuda las compresiones sin comprobar el pulso; adrenalina 1 mg y amiodarona 300 mg tras la 3.ª descarga, adrenalina cada 3–5 min y amiodarona 150 mg tras la 5.ª.',
  nf: 'Ritmo no desfibrilable: compresiones de calidad, adrenalina 1 mg cuanto antes y cada 3–5 min, análisis cada 2 min; busca y trata la causa (4H y 4T).' };
const ARREST_KEYS = ['tamp', 'tampRate', 'arrestCause', 'arrestCause2', 'ptx', 'ptxTension', 'tep', 'deficit', 'shockMul', 'bleed', 'bleedSrc', 'anaf', 'cohb', 'opioid', 'k', 'kRate', 'hco3Off', 'tca', 'temp', 'tempRate', 'glu', 'gluT', 'asp'];
const pio2 = alt => (760 * Math.pow(1 - 2.25577e-5 * alt, 5.25588) - 47) * .21;

function make(baseKey, seed) {
  const b0 = CASES[baseKey]; if (!b0 || !b0.pheno) return null;
  const R = rng(seed), rr = (a, c) => a + R() * (c - a), pick = a => a[Math.floor(R() * a.length)];
  const c = JSON.parse(JSON.stringify(b0)), code = codeOf(seed), lines = [], sum = [];
  const iface = c.iface || 'tube', f = c.sex === 'm';
  Object.assign(c, { vbase: baseKey, vseed: seed >>> 0, vcode: code, vlvl: b0.lvl, lvl: 'Mis casos' });
  delete c.vev; delete c.vcause; delete c.vwhy;

  /* 1. paciente */
  let demo = null;
  const mA = /^(Varón|Mujer|Motorista|Senderista|Paciente|Surfista|Buceador|Buceadora|Corredor|Corredora|Socorrista|Jugador de rugby|Jugadora de rugby) de (\d+) años((?:, \d+ cm)?(?:, \d+ kg)?)/.exec(c.goal || '');
  const mP = /^((?:Lactante|Niño|Niña) de \d+ (?:meses|años)) y (\d+) kg/.exec(c.goal || '');
  if (mA && !c.ped) {
    const age = clamp(+mA[2] + Math.round(rr(-12, 12)), 18, 92);
    const talla = Math.round(f ? rr(150, 176) : rr(160, 192));
    const obese = c.pheno === 'obeso' || (c.pheno === 'sano' && !c.arrest && !c.noObese && R() < .2); // v1.16: noObese cuando la constitución es parte de la historia
    const bmi = c.pheno === 'obeso' ? rr(38, 50) : obese ? rr(35, 45) : rr(20, 31);
    const peso = Math.round(bmi * Math.pow(talla / 100, 2));
    if (obese && c.pheno === 'sano') { c.pheno = 'obeso'; c.tasAdj = (c.tasAdj || 0) - 15; c.fcAdj = (c.fcAdj || 0) - 15; } // que la TA y la FC sigan siendo las del planteamiento
    const rest = c.goal.slice(mA[0].length);
    c.goal = `${mA[1]} de ${age} años, ${talla} cm, ${peso} kg${/^[.,;:]/.test(rest) ? '' : ','}${rest}`;
    Object.assign(c, { talla, peso });
    demo = { age, talla, peso, ibw: ibwOf(c.sex, talla), bmi, obese };
  } else if (mP) {
    let peso = Math.max(3, Math.round(+mP[2] * rr(.85, 1.15))); if (peso === +mP[2]) peso += R() < .5 && peso > 3 ? -1 : 1;
    c.goal = c.goal.replace(mP[0], `${mP[1]} y ${peso} kg`); c.peso = peso;
    demo = { peso, ped: true };
  }
  if (demo && !demo.ped) {
    const pre = /\d\s*(kg|mL)\b/.test(b0.hint || '') ? 'Las cifras de arriba son del caso original; las de este paciente: ' : 'Cifras de este paciente: ';
    lines.push(iface === 'tube' || iface === 'mask' && c.cfg && c.cfg.mode === 'VCV'
      ? `${pre}peso ideal ≈ ${Math.round(demo.ibw)} kg, así que Vt 6–8 mL/kg = ${r10(6 * demo.ibw)}–${r10(8 * demo.ibw)} mL; peso real ${demo.peso} kg (las dosis del panel ya están calculadas con él).`
      : `${pre}peso real ${demo.peso} kg (las dosis del panel ya están calculadas con él) y peso ideal ≈ ${Math.round(demo.ibw)} kg si hubiera que intubar (Vt ${r10(6 * demo.ibw)}–${r10(8 * demo.ibw)} mL).`);
    if (demo.obese) lines.push('Con IMC ≥ 35: desatura antes en apnea (preoxigena bien y en rampa), PEEP más alta (8–10) y el Vt siempre por el peso ideal, nunca por el real.');
  } else if (demo) lines.push(`Peso de este niño: ${demo.peso} kg; las dosis y las energías del panel ya están calculadas con él.`);

  /* 2. parada del adulto: otra causa y otro ritmo */
  let cause = null;
  if (c.arrest && !c.ped && b0.lvl === 'Parada') {
    const ck = pick(Object.keys(CAUSE)), C = CAUSE[ck], rhy = pick(C.r);
    for (const k of ARREST_KEYS) delete c[k];
    for (const k of ['preg', 'tdp', 'witnessed', 'noRosc', 'anaf', 'tamp', 'tampRate', 'tca', 'opioid', 'hco3Off', 'drown', 'tep', 'ptx', 'ptxTension', 'arrestCause2', 'bleed', 'bleedSrc']) delete c[k]; // v1.15: la variante cambia de causa: fuera la fisiopatología de la original
    Object.assign(c, { pheno: 'sano', arrest: rhy }, JSON.parse(JSON.stringify(C.p)));
    const tubed = iface === 'tube';
    const demoTxt = demo ? `${f ? 'Mujer' : 'Varón'} de ${demo.age} años, ${demo.talla} cm, ${demo.peso} kg.` : '';
    c.goal = `${demoTxt} ${C.clue(f)} ${RHY[rhy]} Tu compañero comprime; ${tubed ? `ya está ${f ? 'intubada' : 'intubado'} y ${f ? 'conectada' : 'conectado'} al ventilador.` : 'aún no tiene vía aérea avanzada.'}`.trim();
    c.title = `Parada · variante ${code}`;
    c.checks = [...(rhy === 'vf' ? [['shock', 'Descarga precoz']] : [['drug:adr', 'Adrenalina precoz']]), ...C.chk.filter(x => !(rhy === 'vf' && x[0] === 'shock') && !(tubed && x[0] === 'act:bag|intub')), ...(rhy === 'vf' && ck !== 'hypoT' ? [['drug:adr', 'Adrenalina']] : []), ...(c.noRosc ? [] : [['rosc', 'RCE']])];
    c.hint = [ALS[rhy === 'vf' ? 'vf' : 'nf'], C.why].join(' ');
    c.events = (c.events || []).filter(e => e.alt != null);
    cause = ck; c.vcause = ck; c.vwhy = C.why;
  } else {
    c.title = `${b0.title} · variante ${code}`;
    /* 3. gravedad (oculta: es lo que el equipo descubre) */
    if (!c.arrest) {
      const u = R(), fct = u < .25 ? rr(.75, .9) : u < .65 ? rr(.9, 1.1) : rr(1.1, 1.35);
      let n = 0; for (const [k, [lo, hi, z]] of Object.entries(SEV)) if (typeof c[k] === 'number') { const z0 = z || 0; c[k] = +clamp(z0 + (c[k] - z0) * fct, lo, hi).toFixed(4); n++; }
      if (c.neo && c.neo.prem) { // v1.12: prematuro más o menos inmaduro (edad gestacional, peso y pulmón)
        const ga0 = c.neo.prem, late = (c.neo.t0 || 0) > 30, d = fct > 1.1 ? -(R() < .5 ? 1 : 2) : fct < .9 ? (R() < .5 ? 1 : 2) : (R() < .5 ? -1 : 1);
        const ga = clamp(ga0 + d, late ? 29 : 24, late ? 34 : 31), PW = { 24: .65, 25: .75, 26: .85, 27: 1, 28: 1.1, 29: 1.25, 30: 1.4, 31: 1.55, 32: 1.7, 33: 1.9, 34: 2.1 };
        c.neo = Object.assign({}, c.neo, { prem: ga, aer: +clamp(c.neo.aer - .04 * (ga0 - ga) * (late ? .5 : 1), .25, .9).toFixed(3) }); c.peso = PW[ga];
        const rep = t => t.replace(new RegExp(ga0 + ' semanas', 'g'), ga + ' semanas').replace(/Peso estimado [\d,]+ kg/, `Peso estimado ${String(c.peso).replace('.', ',')} kg`);
        c.goal = rep(c.goal); c.title = rep(c.title); n++;
        lines.push(`Prematuro de ${ga} semanas (${String(c.peso).replace('.', ',')} kg): ${ga < ga0 ? 'más inmaduro' : 'algo más maduro'} que en el caso original${ga < ga0 ? ', con más tendencia al colapso alveolar' : ''}.`); }
      else if (c.neo) { let hr = Math.round(clamp(c.neo.hr / fct, 25, 110) / 5) * 5; if (hr === c.neo.hr) hr += fct > 1 ? -5 : 5; c.neo = Object.assign({}, c.neo, { m: +clamp(c.neo.m / fct, .06, .9).toFixed(3), hr }); c.goal = c.goal.replace(/FC ≈ \d+/, `FC ≈ ${hr}`); n++; // v1.9: asfixia más o menos profunda
        if (!c.neo.sec && R() < .5) { c.neo.obs = .55; c.neo.sec = true; lines.push('Nace con secreciones espesas: el tórax no se moverá hasta que recoloques la cabeza y aspires la boca y la nariz.'); c.checks = (c.checks || []).concat([['act:neoPos|act:neoSuct', 'Corregir la ventilación']]); }
        else lines.push(`La asfixia es ${fct > 1 ? 'más profunda' : 'algo más leve'} que en el caso original: FC al nacer ≈ ${c.neo.hr} lpm.`); }
      if (n && fct > 1.12) lines.push('Es más grave que el caso original: lo mismo, con menos margen y menos tiempo.');
      if (n && fct < .88) lines.push('Es algo más leve que el caso original: no hace falta todo el arsenal.');
    }
  }

  /* 4. acceso vascular */
  const noAccess = () => {
    c.access = false; sum.push('sin vía venosa');
    lines.push('Llega sin vía venosa: canalízala (o intraósea si es urgente) antes de los fármacos.');
    c.checks = c.checks || []; if (!c.checks.some(x => /act:(iv|io)/.test(x[0]))) c.checks.unshift(['act:iv|act:io', 'Acceso vascular']);
  };
  /* solo si el caso necesita fármacos o volumen (a una bronquiolitis no se le pide una vía) */
  const needsIV = c.arrest || (c.checks || []).some(x => /drug:|perf:|act:fluid|act:blood|shock\|drug/.test(x[0])) || /\d\s?(mg|mcg|UI|mEq)\b|perfusi[oó]n|noradrenalina|cristaloide|volumen|bolo/i.test(b0.hint || '');
  if (needsIV && c.access !== false && R() < .3) noAccess();

  /* 5. altitud de cabina */
  let alt = null;
  if (!c.arrest && (b0.lvl === 'VMI · HEMS' || b0.altitude != null)) alt = pick([300, 900, 1500, 2100, 2700]);
  else if (!c.arrest && b0.lvl === 'VMI · SVA' && iface === 'tube' && R() < .15) { alt = 1500; c.goal += ' Traslado secundario en helicóptero: la cabina irá a 1.500 m.'; }
  if (alt != null) {
    const at = fmtAlt(alt); c.altitude = alt; sum.push(`cabina a ${at} m`);
    if (/cabina a [\d.]+ m/i.test(c.goal)) c.goal = c.goal.replace(/cabina a [\d.]+ m/gi, `cabina a ${at} m`); else if (!/cabina irá/.test(c.goal)) c.goal += ` Cabina a ${at} m.`;
    lines.push(`Cabina a ${fmtAlt(alt)} m: la PiO₂ baja a ≈ ${Math.round(pio2(alt))} mmHg (149 a nivel del mar), así que hace falta más FiO₂ para la misma SpO₂; el gas atrapado se expande (neumotórax, balón del tubo).`);
  }

  /* 6. una complicación añadida */
  const has = k => (c.events || []).some(e => e.k === k);
  let pool = [];
  if (c.arrest) { if (iface === 'tube' && R() < .35) pool = ['extub', 'disc']; }
  else if (c.rhythm === 'tvp') { if (R() < .5) pool = ['vf']; }
  else if (c.ecl) pool = ['seiz'];
  else if (c.bleed && c.bleedSrc !== 'thor' && !has('rebleed')) pool = ['rebleed'];
  else if (c.flail && !has('ptx')) pool = ['ptx']; // v1.6: neumotórax que se pone a tensión bajo el volet
  else if (iface === 'tube') {
    pool = ['obst', 'disc', 'extub', 'sel', 'o2', 'cuff'];
    if (!['asma', 'epoc'].includes(c.pheno) && !c.bs) pool.push('bronco');
    if (!c.ptx && !has('ptx')) pool.push('ptx');
    if (c.sedE !== 0 && !c.sedStopped && !has('wake')) pool.push('wake');
  } else if (iface === 'mask') { pool = ['leak', 'o2']; if (!c.asp && !has('aspir')) pool.push('aspir'); }
  pool = pool.filter(k => k === 'seiz' || !has(EV[k][0])); // en la eclampsia, una segunda convulsión es justo lo que hay que saber tratar
  if (pool.length && (c.arrest || c.rhythm || R() < .75 || !lines.length)) {
    const k = pick(pool), [evk, tok, lab, txt, why] = EV[k], dur = c.duration || 20, used = (c.events || []).map(e => e.at);
    let at = 0; for (let i = 0; i < 6; i++) { at = Math.round(rr(4, Math.max(6, Math.min(16, dur * .7))) * 2) / 2; if (!used.some(u => Math.abs(u - at) < 3)) break; }
    c.events = [...(c.events || []), { at, k: evk, txt }].sort((a, b) => a.at - b.at);
    c.checks = c.checks || []; if (!c.checks.some(x => x[0] === tok)) c.checks.push([tok, lab]);
    lines.push(`Hacia el minuto ${String(at).replace('.', ',')}, ${why}.`);
    c.vev = k;
  }

  if (!lines.length && needsIV && c.access !== false) noAccess(); // que nunca salga igual que el original
  if (cause) c.hint = [c.hint, ...lines].join(' ');
  else if (lines.length) c.hint = (c.hint ? c.hint + ' ' : '') + 'Esta variante: ' + lines.join(' ');
  c.vsum = sum;
  return c;
}

root.SIM_VARIANT = { make, codeOf, EV };
})(typeof window !== 'undefined' ? window : globalThis);
