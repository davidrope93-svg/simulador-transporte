/* ===== Tutorial por caso (v0.9): se elige cuando uno se pierde. Dice qué hacer, señala dónde y avanza solo cuando el paso está hecho.
   Cada caso tiene su guion; los casos propios usan uno generado a partir de sus acciones clave y objetivos. ===== */
const TU = {
  used: (toks, fresh) => () => toks.split('|').some(x => track.usedAt && track.usedAt[x] != null && (!fresh || track.usedAt[x] >= tut.t0)),
  cf: (k, lo, hi) => () => !keysFor(uMode(S.cfg)).includes(k) || (S.cfg[k] >= lo - 1e-6 && S.cfg[k] <= hi + 1e-6),
  vt: (lo, hi) => () => { const v = ['VCV', 'APV', 'SIMV', 'MAN'].includes(S.cfg.mode) ? S.cfg.vt / S.ibw : M.vtkg; return v != null && v >= lo - .1 && v <= hi + .1; },
  fio2: max => () => S.iface === 'o2' || S.cfg.fio2 <= max || (S.dev.pneumatic && S.cfg.fio2 <= 60),
  tg: k => () => { const r = (CASES[caseKey].targets || {})[k]; if (!r) return true; const v0 = TGT[k].get(); if (v0 == null || !isFinite(v0)) return false; const v = TGT[k].fmt ? v0 : +(+v0).toFixed(TGT[k].d); return v >= r[0] && v <= r[1]; },
  ev: k => () => track.events.some(e => e.k === k),
  run: () => !S.standby && ['tube', 'mask', 'nasal'].includes(S.iface),
  tube: () => S.iface === 'tube' && !S.standby,
  acc: () => S.access === true || S.access === 'io',
  comp: () => !S.arrest || S.cpr.comp !== 'off',
  rosc: () => track.roscAt != null && !S.arrest
};
const R = { t: 'Lee el planteamiento y los objetivos de la tarjeta del caso (las etiquetas de la derecha se ponen en verde cuando los cumples).', at: ['#caseCard'] };
const X = (w) => ({ t: 'Explora al paciente.', w: w || 'Antes de tocar nada, mira qué tiene.', at: 'explora', ok: 'act:explore' });
const VTS = (lo, hi, extra) => ({ vts: true, t: () => `Ajusta el Vt a ${lo}–${hi} mL/kg de peso ideal (≈ ${round10(lo * S.ibw)}–${round10(hi * S.ibw)} mL) y pulsa «Confirmar».`, w: extra || 'El volumen se calcula con el peso ideal (talla y sexo), no con el real.', at: 'vt', ok: TU.vt(lo, hi) });
const CF = (k, lo, hi, t, w) => ({ t, w, at: k === 'fio2' ? 'fio2' : k === 'trigI' ? 'trigger' : k === 'trigE' ? 'ciclado' : k === 'ps' ? 'presion de soporte' : k === 'ie' || k === 'ti' ? 'inspiracion ti' : k, ok: TU.cf(k, lo, hi), keyk: k });
const D = (tok, t, w, at) => ({ t, w, at: at || t, ok: tok });
const TG = (k, t, w, at) => ({ t, w, at, ok: TU.tg(k) });
const IND = [D('drug:ket|drug:eto', 'Inductor: ketamina 1–1,5 mg/kg o etomidato 0,3 mg/kg.', 'El propofol a dosis plena hunde la TA en el paciente inestable.', 'ketamina etomidato'), D('drug:rel', 'Rocuronio 1,2 mg/kg.', 'Espera 45–60 s a que haga efecto antes de la laringoscopia.', 'rocuronio')];
const IOT = [{ t: 'Cuando haya pasado el minuto del relajante, pulsa «Intubar».', w: 'Si lo intentas antes, el paciente aún tiene tono.', at: 'intuba', ok: () => !!S.isr || S.iface === 'tube' }, { t: 'Tubo comprobado: revisa los ajustes del ventilador y pulsa «Iniciar ventilación».', w: 'Mientras está en espera, el paciente no respira.', at: 'iniciar ventilacion', ok: TU.tube }];
const SHOCK = (j, txt) => [{ t: 'Sedación para la cardioversión: etomidato, o midazolam con fentanilo.', w: 'El choque despierto duele mucho.', at: 'etomidato midazolam', ok: 'drug:eto|drug:mid|drug:fent|drug:prop' }, { t: 'Activa SINC en el monitor.', w: 'Sincroniza la descarga con la onda R; sin SINC puede caer en la T y provocar una FV.', at: 'sinc', ok: () => syncOn || track.shocks > 0 }, { t: `Elige ${txt} en la energía.`, at: ['#zJ'], ok: () => +$('#zJ').value >= j[0] && +$('#zJ').value <= j[1] || track.shocks > 0 }, { t: 'Pulsa «Cargar» y luego «Descarga».', at: ['#zCharge', '#zShock'], ok: () => track.shocks > 0 }, TG('sinus', 'Comprueba el ritmo. Si no ha revertido, vuelve a cargar (puedes subir la energía).', 'Hasta tres intentos; después, amiodarona.', 'cardioversion')];
const CPR = [{ t: 'Que no paren las compresiones: «Compresiones manuales» o el compresor mecánico.', w: 'Cada pausa baja la presión de perfusión coronaria.', at: 'compresiones', ok: TU.comp }];
const END = { t: 'Mantén los objetivos. Cuando quieras, pulsa «Terminar caso» para ver la nota y la solución.', at: ['#endBtn'], end: true };
const TUT = {
  tce: [R, VTS(6, 8, 'Con 700 mL está en ≈ 9,6 mL/kg: demasiado.'), CF('fr', 12, 16, 'Baja la FR a 14–16 y confirma.', 'Con FR 20 la EtCO₂ cae: la hipocapnia contrae los vasos cerebrales.'), CF('peep', 4, 8, 'Pon PEEP 5 y confirma.'), { t: 'Baja la FiO₂ hasta que la SpO₂ quede en 94–98 %.', w: 'En pulmón sano basta con 30–40 %. La hiperoxia también daña.', at: 'fio2', ok: TU.fio2(60) }, TG('tas', 'Mide la PNI y mantén la TAS ≥ 110 (noradrenalina si hace falta).', 'En el TCE una sola hipotensión empeora el pronóstico.', 'pni noradrenalina'), TG('et', 'Comprueba que la EtCO₂ queda en 35–40.', 'Si sigue baja, baja un poco más la FR.', 'fr'), END],
  htic: [R, X('Mira las pupilas.'), { t: 'Sube la FR para dejar la EtCO₂ en 30–35 (hiperventilación breve).', w: 'Baja la PIC unos minutos mientras llega el tratamiento osmótico.', at: 'fr', ok: () => M.et != null && M.et <= 35 }, D('drug:shs|drug:manit', 'Salino hipertónico 7,5 % (o manitol).', 'Saca agua del cerebro.', 'salino hipertonico manitol'), TG('tas', 'Mantén la TAS ≥ 110: noradrenalina si hace falta.', null, 'noradrenalina'), { t: 'Cuando ceda, vuelve a EtCO₂ 35–40 bajando la FR.', w: 'La hiperventilación mantenida produce isquemia.', at: 'fr', ok: () => M.et >= 34 && (!S.icp || S.icp.v < 28) }, END],
  pcr: [R, VTS(6, 8), CF('fr', 12, 16, 'FR 12–16 y confirma.'), CF('peep', 4, 8, 'PEEP 5 y confirma.'), { t: 'Baja la FiO₂ hasta SpO₂ 94–98 % (en el Medumat, Air Mix).', w: 'Tras la parada, la hiperoxia empeora el daño cerebral.', at: 'fio2 air mix', ok: TU.fio2(60) }, TG('tas', 'TAS ≥ 100: cristaloide y noradrenalina si cae.', null, 'cristaloide noradrenalina'), TG('et', 'EtCO₂ 35–45: ajusta la FR.', null, 'fr'), END],
  neumo: [R, VTS(5.5, 7, 'Pulmón pequeño y rígido: 6 mL/kg.'), CF('peep', 10, 14, 'Sube la PEEP a 10–12 y confirma.', 'Recluta alvéolos y baja el shunt.'), CF('fr', 20, 28, 'FR 22–26 para compensar el Vt bajo.'), TG('spo2', 'Ajusta la FiO₂ para SpO₂ 90–96 %.', null, 'fio2'), { t: 'Mide la meseta con «Pausa insp.» (en el T1 sale calculada).', w: 'Meseta < 30 y driving < 15.', at: 'pausa inspiratoria', when: () => !!$('#vk_inhold'), ok: () => M.pplat != null || S.dev.vent === 't1' || TU.used('key:inhold')() }, END],
  ahogado: [R, D('act:suction', 'Aspira el tubo.', 'Hay agua y secreciones.', 'aspira'), CF('peep', 10, 14, 'PEEP 10–14 y confirma.', 'Vigila la TA al subirla.'), VTS(5.5, 7.5), TG('spo2', 'FiO₂ alta al principio y bájala para SpO₂ 90–98 %.', null, 'fio2'), END],
  aspiracion: [R, { t: 'Vigila la pantalla: en cuanto vomite verás caer la SpO₂.', ok: TU.ev('aspir') }, D('act:suction', 'Aspira el tubo.', null, 'aspira'), { t: 'Sube la FiO₂.', at: 'fio2', ok: () => S.cfg.fio2 >= 60 }, CF('peep', 8, 12, 'PEEP 8–10 y confirma.'), VTS(6, 8), END],
  asma: [R, { t: 'Haz una «Pausa esp.» para medir el auto-PEEP (en el T1 sale calculado).', w: 'El aire atrapado es lo que hunde la TA.', at: 'pausa espiratoria', when: () => !!$('#vk_exhold'), ok: () => TU.used('key:exhold')() || S.dev.vent === 't1' }, { t: 'Si la TA está muy baja, «Desconectar 15 s» para vaciar.', at: 'desconecta 15 s', ok: () => S.tas >= 90 || TU.used('act:opencirc')() }, CF('fr', 8, 12, 'Baja la FR a 10–12 y confirma.', 'Más tiempo para espirar.'), { t: 'Acorta el Ti a 0,8 s (o I:E 1:4) y confirma.', at: 'inspiracion ti', ok: () => S.cfg.ti <= .9 }, D('drug:salb', 'Salbutamol + ipratropio.', null, 'salbutamol'), D('drug:mg', 'Sulfato de magnesio 2 g.', null, 'magnesio'), D('drug:cort', 'Corticoide.', null, 'corticoide'), D('act:fluid', 'Cristaloide.', 'Está seco y la presión positiva baja la precarga.', 'cristaloide'), END],
  trauma: [R, CF('peep', 0, 6, 'Baja la PEEP a 5 y confirma.', 'En el hipovolémico, la PEEP alta hunde la TA.'), D('act:fluid', 'Cristaloide.', null, 'cristaloide'), { t: 'Vigila: en unos minutos algo va a cambiar.', ok: TU.ev('ptx') }, { t: 'Suben las presiones y cae la TA: explora.', at: 'explora', ok: TU.used('act:explore', true) }, D('act:decomp|act:drain', 'Neumotórax a tensión: descomprime.', null, 'descompresion'), END],
  traslado: [R, { t: 'Baja la FiO₂ a 35–40 % (en el Medumat, Air Mix) y confirma.', w: 'Con FiO₂ 100 % la botella no llega.', at: 'fio2 air mix', ok: TU.fio2(45) }, { t: 'Mira la autonomía en la tarjeta de la botella.', at: ['#o2Gauge'] }, TG('spo2', 'Mantén SpO₂ 94–98 %.', null, 'fio2'), END],
  despierta: [R, { t: 'Vigila: en el minuto 2 se acaba la bomba.', ok: TU.ev('wake') }, D('act:sedperf', 'Reanuda la bomba de sedación.', null, 'reanuda'), D('drug:sed', 'Da un bolo de la bomba.', 'La bomba sola tarda en volver a sedar.', 'bolo de la bomba'), TG('fight', 'Comprueba que deja de luchar.', null, 'sedacion'), END],
  cambioVent: [R, D('act:clamp', 'Antes del minuto 3, pinza el tubo («Pinzar tubo»).', 'Sin PEEP, el pulmón se desrecluta en segundos.', 'pinza'), { t: 'Ahora se desconecta: reconecta rápido.', at: 'reconecta', ok: () => TU.ev('disc')() && !S.air.disc }, TG('spo2', 'Si ha caído la SpO₂, sube la FiO₂ y valora un reclutamiento.', null, 'fio2 reclutamiento'), END],
  movil: [R, { t: 'Vigila las presiones del ventilador.', ok: TU.ev('sel') }, { t: 'Suben pico y meseta: explora.', at: 'explora', ok: TU.used('act:explore', true) }, D('act:pull', 'Murmullo abolido en un lado y tubo más dentro: retira 2 cm.', null, 'retirar tubo'), END],
  hemsApv: [R, VTS(6, 8), TG('et', 'Ajusta la FR para EtCO₂ 35–40.', null, 'fr'), { t: 'Vigila la Pcontrol y la Cstat.', ok: TU.ev('sel') }, { t: 'Sube la presión y cae la Cstat: explora.', at: 'explora', ok: TU.used('act:explore', true) }, D('act:pull', 'Selectiva: retira 2 cm.', null, 'retirar tubo'), { t: 'Sigue vigilando: sube la Rinsp más tarde.', ok: TU.ev('obst') }, D('act:suction', 'Tapón: aspira el tubo.', null, 'aspira'), END],
  epocHems: [R, { t: 'Haz una «Pausa esp.» para medir el auto-PEEP (en el T1 sale calculado).', at: 'pausa espiratoria', when: () => !!$('#vk_exhold'), ok: () => TU.used('key:exhold')() || S.dev.vent === 't1' }, CF('fr', 8, 12, 'Baja la FR a 10–12 y confirma.'), { t: 'Ti 0,8–1,0 s y confirma.', at: 'inspiracion ti', ok: () => S.cfg.ti <= 1.05 }, VTS(5.5, 7.5), D('drug:salb', 'Broncodilatadores en línea.', null, 'salbutamol'), TG('spo2', 'FiO₂ para SpO₂ 88–94 %.', 'Es retenedor: más O₂ sube la pCO₂.', 'fio2'), END],
  ptxAltitud: [R, D('act:drain', 'Antes de despegar (minuto 2), pon un drenaje torácico.', 'Con la altitud el neumotórax crece (ley de Boyle).', 'drenaje'), TG('spo2', 'Mantén SpO₂ ≥ 92 % durante el vuelo.', null, 'fio2'), END],
  extubVuelo: [R, { t: 'Vigila la capnografía.', ok: TU.ev('extub') }, D('act:bag', 'Sin curva de CO₂: ambú con FiO₂ 100 %.', 'Hasta que se demuestre lo contrario, está extubado.', 'ambu'), D('act:reintub', 'Reintuba.', null, 'reintubar'), END],
  epocIni: [R, CF('peep', 6, 8, 'PEEP 6–8 y confirma.'), { t: 'PS 10 y súbela de 2 en 2 hasta Vt 6–8 mL/kg y FR < 25.', at: 'presion de soporte', ok: () => S.cfg.ps >= 10 || !keysFor(uMode(S.cfg)).includes('ps') }, CF('trigE', 40, 50, 'Trigger espiratorio 40–50 % y confirma.', 'Que la inspiración no se alargue.'), TG('spo2', 'FiO₂ para SpO₂ 88–92 % (en el Medumat, Air Mix).', null, 'fio2'), D('drug:salb', 'Salbutamol + ipratropio.', null, 'salbutamol'), D('drug:cort', 'Corticoide.', null, 'corticoide'), D('act:gas', 'Gasometría para ver el pH.', null, 'gasometria'), END],
  epocAsinc: [R, { t: 'Marca «Mostrar el esfuerzo del paciente» (en «Lo que pasa dentro»).', w: 'Verás los esfuerzos que el equipo no detecta.', at: ['#showPmus'], ok: () => $('#showPmus').checked }, CF('peep', 7, 9, 'PEEP 7–8 y confirma.', 'Contrarresta el auto-PEEP.'), CF('ps', 12, 14, 'PS 12–14 y confirma.'), CF('trigE', 40, 50, 'Trigger espiratorio 40–50 %.'), CF('timax', .7, 1.1, 'Ti máx 1,0 s.'), D('drug:salb', 'Broncodilatadores.', null, 'salbutamol'), END],
  eap: [R, CF('peep', 9, 12, 'Sube la CPAP a 10 y confirma.'), D('drug:ntg', 'Nitroglicerina en bolo (1 mg).', 'Baja la precarga y la poscarga.', 'nitroglicerina'), { t: 'Perfusión de nitroglicerina a 100–200 mcg/min.', at: ['#pf_ntg'], ok: 'perf:ntg' }, TG('spo2', 'FiO₂ para SpO₂ 94–98 %.', null, 'fio2'), TG('tas', 'Vigila la PNI: TAS 100–160.', null, 'pni'), END],
  eapShock: [R, { t: 'Noradrenalina para TAS ≥ 90.', w: 'Sin nitratos con TAS < 90.', at: ['#pf_nor'], ok: 'perf:nor' }, CF('peep', 5, 8, 'CPAP 5–8 vigilando la TA.'), TG('tas', 'TAS 90–140.', null, 'pni'), END],
  neumoVmni: [R, { t: 'Vigila FR, Vt espirado y SpO₂: en unos minutos empeora.', ok: TU.ev('aspir') }, ...IND, { t: 'Preoxigena en la propia VMNI y pulsa «Intubar» al minuto del relajante.', at: 'intuba', ok: () => !!S.isr || S.iface === 'tube' }, IOT[1], VTS(6, 8), END],
  fuga: [R, D('act:mask', 'Recoloca la mascarilla.', 'Objetivo: fuga < 25–30 L/min.', 'recoloca mascarilla'), CF('trigI', 2, 3.5, 'Sube el trigger inspiratorio a 2–3 L/min.', 'Con fuga, el equipo se autodispara.'), END],
  fracaso: [R, D('drug:salb', 'Broncodilatadores.', null, 'salbutamol'), { t: 'Si no mejora, toca intubar.', w: 'Alargar una VMNI que fracasa empeora el pronóstico.' }, ...IND, ...IOT, VTS(6, 8), CF('fr', 10, 14, 'FR 10–14 y confirma.'), END],
  miastenia: [R, X('La SpO₂ engaña: mira FR, EtCO₂ y el trabajo respiratorio.'), D('act:toMask', 'Coloca la VMNI.', null, 'vmni'), CF('ps', 10, 14, 'PS 10–14 y confirma.'), { t: 'Pulsa «Iniciar ventilación».', at: 'iniciar ventilacion', ok: TU.run }, END],
  isrSeptico: [R, D('act:fluid', 'Cristaloide antes de inducir.', null, 'cristaloide'), { t: 'Noradrenalina antes de inducir.', at: ['#pf_nor'], ok: 'perf:nor' }, { t: 'Preoxigena: VMNI o alto flujo (en el Medumat, RSI · Demand) y pulsa «Iniciar ventilación».', at: 'vmni', ok: () => TU.run() || uMode(S.cfg) === 'DEM' }, ...IND, ...IOT, VTS(6, 8), CF('peep', 8, 10, 'PEEP 8–10 y confirma.'), END],
  obesoIsr: [R, D('act:toMask', 'Coloca la VMNI (PEEP 8–10, FiO₂ 100 %).', 'Preoxigenar con presión gana minutos de apnea.', 'vmni'), { t: 'Pulsa «Iniciar ventilación» y deja 3–5 min.', at: 'iniciar ventilacion', ok: TU.run }, D('act:apox', 'Gafas a 15 L/min para la laringoscopia.', 'Oxigenación apneica.', 'gafas a 15'), D('act:vl', 'Videolaringoscopio de primeras.', null, 'videolaringoscopio'), ...IND, ...IOT, VTS(6, 8), CF('peep', 10, 12, 'PEEP 10–12 y confirma.'), END],
  viaDificil: [R, D('act:bag', 'Ambú con reservorio mientras preparas.', null, 'ambu'), D('act:vl', 'Videolaringoscopio y bougie.', null, 'videolaringoscopio'), ...IND, { t: 'Al minuto del relajante, «Intubar».', at: 'intuba', ok: () => track.attempts > 0 || !!S.isr || S.iface === 'tube' }, { t: 'Si no pasa el tubo: dispositivo supraglótico.', at: 'supraglotico', ok: () => S.iface === 'tube' || TU.used('act:sga')(), when: () => S.iface !== 'tube' }, { t: 'Si tampoco oxigenas: cricotiroidotomía, sin esperar a la parada.', at: 'cricotiroidotomia', ok: () => (S.iface === 'tube' && !S.air.sga) || TU.used('act:cric')(), when: () => S.iface !== 'tube' || S.air.sga && S.spo2 < .85 }, { t: 'Pulsa «Iniciar ventilación».', at: 'iniciar ventilacion', ok: TU.tube }, END],
  quemado: [R, { t: 'Mira la SpCO en el monitor: la SpO₂ no ve el CO.', at: ['#zSpT'] }, { t: 'O₂ al 100 %: mascarilla con reservorio.', at: 'reservorio', ok: () => S.cfg.o2dev === 'reserv' || S.iface !== 'o2' }, D('drug:hidroxo', 'Hidroxocobalamina 5 g.', 'Shock y lactato alto en un incendio cerrado: cianuro.', 'hidroxocobalamina'), D('act:vl', 'Prepara el videolaringoscopio: la vía aérea se cierra.', null, 'videolaringoscopio'), ...IND, ...IOT, END],
  bronquiolitis: [R, D('act:toNasal', 'Coloca el alto flujo.', null, 'alto flujo'), CF('flow', 10, 14, 'Ajusta el flujo a 2 L/kg/min (12 L/min) y confirma.'), { t: 'Pulsa «Iniciar ventilación».', at: 'iniciar ventilacion', ok: TU.run }, TG('spo2', 'FiO₂ para SpO₂ ≥ 92 %.', null, 'fio2'), TG('rr', 'Comprueba que baja la FR.', 'Si a la hora sigue > 70 o tiene apneas: CPAP o intubación.'), END],
  crup: [R, { t: 'Que no llore: en brazos de su madre y O₂ sin forzar.', w: 'El llanto empeora la obstrucción.' }, D('drug:adrN', 'Adrenalina nebulizada 0,5 mg/kg.', null, 'adrenalina nebulizada'), D('drug:dexa', 'Dexametasona 0,6 mg/kg.', null, 'dexametasona'), TG('pco2', 'Vigila que no se agote.', 'Si baja la conciencia o sube la pCO₂: intubación con tubo medio número menor.'), END],
  anafPed: [R, D('drug:adrIM', 'Adrenalina IM 0,01 mg/kg en el muslo.', 'Es el tratamiento; lo demás es secundario.', 'adrenalina im'), D('act:fluid', 'Cristaloide 10 mL/kg.', null, 'cristaloide'), TG('tas', 'Si a los 5 min no mejora, segunda dosis IM.', null, 'adrenalina im'), D('drug:salb', 'Salbutamol si persisten las sibilancias.', null, 'salbutamol'), END],
  pelvis: [R, D('act:hemo', 'Cinturón pélvico.', 'Cierra la pelvis y frena el sangrado venoso.', 'cinturon pelvico'), { t: 'Canaliza una vía venosa.', at: 'via venosa', ok: TU.acc }, D('drug:txa', 'Ácido tranexámico 1 g.', 'Dentro de la primera hora.', 'tranexamico'), D('act:warm', 'Manta y calor activo.', 'El frío empeora la coagulación.', 'calor activo'), TG('tas', 'Hipotensión permisiva: TAS 80–90. Volumen solo si baja de 80.', 'Más volumen diluye y aumenta el sangrado.'), END],
  pcrTrauma: [R, D('act:hemo', 'Torniquete en el muslo.', 'Primero, cerrar el grifo.', 'torniquete'), D('act:drain|act:decomp', 'Toracostomía o descompresión.', 'Neumotórax a tensión.', 'toracostomia'), { t: 'Vía intraósea.', at: 'intraosea', ok: TU.acc }, D('act:blood|act:fluid', 'Sangre (o cristaloide) a chorro.', null, 'sangre'), { t: '«Comprobar pulso y ritmo».', at: 'comprobar pulso', ok: TU.rosc }, END],
  eclampsia: [R, { t: 'Protege la vía aérea y O₂ con reservorio; decúbito lateral izquierdo.' }, { t: 'Canaliza una vía venosa.', at: 'via venosa', ok: TU.acc }, D('drug:mg', 'Sulfato de magnesio 4 g.', 'Trata la convulsión y previene las siguientes.', 'magnesio'), { t: 'Perfusión de magnesio a 1 g/h.', at: ['#pf_mgP'], ok: 'perf:mgP' }, D('drug:labet|drug:urap', 'TAS ≥ 160: labetalol 20 mg (o urapidilo).', null, 'labetalol'), TG('tas', 'TAS 130–160.', null, 'pni'), END],
  hpp: [R, D('act:hemo', 'Masaje uterino bimanual.', null, 'masaje uterino'), { t: 'Canaliza una vía venosa.', at: 'via venosa', ok: TU.acc }, D('drug:oxito', 'Oxitocina 10 UI.', null, 'oxitocina'), D('drug:txa', 'Ácido tranexámico 1 g.', null, 'tranexamico'), D('act:warm', 'Manta y calor activo.', null, 'calor activo'), TG('tas', 'TAS ≥ 90.', null, 'pni'), END],
  hiperK: [R, { t: 'Mira el monitor: bradicardia, QRS ancho y T picudas.', at: ['#zcv'] }, D('drug:ca', 'Cloruro cálcico 10 % 10 mL.', 'Estabiliza la membrana en minutos; no baja el potasio.', 'calcio'), D('drug:ins', 'Insulina rápida 10 UI con 25 g de glucosa.', 'Mete el potasio en la célula.', 'insulina'), D('drug:salb', 'Salbutamol nebulizado.', null, 'salbutamol'), D('act:glu|act:gas', 'Glucemia de control.', 'La insulina puede dar hipoglucemia.', 'glucemia'), TG('qrs', 'Comprueba que el QRS baja de 120 ms.', null, 'calcio'), END],
  hipotermia: [R, D('act:temp', 'Mide la temperatura.', null, 'mide la temperatura'), D('act:warm', 'Manta y calor activo.', 'Quita la ropa mojada; no frotes.', 'calor activo'), { t: 'Manéjalo con mucho cuidado y en horizontal; traslado a un centro con ECMO.', w: 'Por debajo de 30 °C, moverlo bruscamente puede provocar una FV.' }, TG('spo2', 'Mantén SpO₂ ≥ 94 %.', null, 'reservorio'), END],
  hipoglucemia: [R, D('act:glu', 'Glucemia capilar.', 'Ante cualquier bajo nivel de conciencia.', 'glucemia'), D('drug:glucg|drug:gluc', 'Sin vía: glucagón 1 mg IM.', null, 'glucagon'), { t: 'Canaliza una vía (si falla, intraósea).', at: 'via venosa', ok: TU.acc }, D('drug:gluc', 'Glucosa 10–25 g IV.', null, 'glucosa'), { t: 'Repite la glucemia.', at: 'glucemia', ok: TU.used('act:glu', true) }, { t: 'Perfusión de glucosa al 10 %.', w: 'Con sulfonilureas la hipoglucemia vuelve.', at: ['#pf_g10'], ok: 'perf:g10' }, END],
  opiaceos: [R, D('act:bag', 'Ventila con ambú.', 'Primero, oxigenar y ventilar.', 'ambu'), D('drug:nalox', 'Naloxona 0,4 mg.', null, 'naloxona'), TG('rr', 'Repite cada 2–3 min hasta FR ≥ 10.', null, 'naloxona'), { t: 'Vigila la resedación hacia los 30–40 min.', w: 'La naloxona dura menos que el opiáceo.' }, END],
  triciclicos: [R, { t: 'Mira el QRS en el monitor (debajo del nombre del ritmo).', at: ['#zRhy'] }, D('drug:bic', 'Bicarbonato 1 M 1–2 mEq/kg.', 'El sodio y la alcalosis estrechan el QRS.', 'bicarbonato'), TG('qrs', 'Repite hasta QRS < 120 ms.', null, 'bicarbonato'), TG('tas', 'Si la TAS sigue < 90: noradrenalina.', null, 'noradrenalina'), END],
  hfnc: [R, D('act:toNasal', 'Coloca el alto flujo.', null, 'alto flujo'), CF('flow', 50, 60, 'Flujo 50–60 L/min y confirma.'), { t: 'Pulsa «Iniciar ventilación».', at: 'iniciar ventilacion', ok: TU.run }, TG('spo2', 'FiO₂ para SpO₂ 92–96 %.', null, 'fio2'), { t: 'Mira el índice ROX en la Lectura.', w: '< 3,85 predice fracaso.', at: ['.readc'] }, END],
  epocO2: [R, { t: 'Cambia a Venturi 28 %.', w: 'La hiperoxia sube la pCO₂ en el retenedor.', at: 'venturi', ok: () => ['venturi28', 'gafas'].includes(S.cfg.o2dev) }, D('act:gas', 'Gasometría.', null, 'gasometria'), TG('spo2', 'SpO₂ 88–92 %.', null, 'venturi'), END],
  co: [R, { t: 'Mira la SpCO en el monitor.', at: ['#zSpT'] }, { t: 'O₂ al 100 %: mascarilla con reservorio.', at: 'reservorio', ok: () => S.cfg.o2dev === 'reserv' || S.iface !== 'o2' }, END],
  anafilaxia: [R, D('drug:adrIM', 'Adrenalina IM 0,5 mg en el muslo.', null, 'adrenalina im'), D('act:fluid', 'Cristaloide.', null, 'cristaloide'), TG('tas', 'Si a los 5 min no mejora, repite la adrenalina IM.', null, 'adrenalina im'), D('drug:salb', 'Salbutamol si hay broncoespasmo.', null, 'salbutamol'), END],
  tepPulso: [R, D('act:gas', 'Gasometría: compara la pCO₂ con la EtCO₂.', 'Mucha diferencia = espacio muerto.', 'gasometria'), { t: 'Noradrenalina para TAS ≥ 90.', at: ['#pf_nor'], ok: 'perf:nor' }, D('drug:tnk', 'Tenecteplasa.', 'TEP de alto riesgo.', 'tenecteplasa'), END],
  tsvInestable: [R, ...SHOCK([70, 120], '70–120 J'), END],
  tsvEstable: [R, D('act:vagal', 'Maniobras vagales (Valsalva modificada).', null, 'vagales'), D('drug:aden', 'Adenosina 6 mg en bolo rápido.', 'Avisa de la pausa.', 'adenosina'), TG('sinus', 'Si no revierte: 12 mg y luego 18 mg.', null, 'adenosina'), END],
  faRapida: [R, ...SHOCK([150, 360], 'la energía máxima'), END],
  tvPulso: [R, ...SHOCK([120, 200], '120–150 J'), END],
  bradiSinusal: [R, D('drug:atr', 'Atropina 0,5 mg.', null, 'atropina'), TG('tas', 'Si no responde: repite, adrenalina 2–10 mcg/min o marcapasos.', null, 'atropina'), END],
  bav: [R, D('act:pace', 'Enciende el marcapasos (a demanda, 70 lpm).', 'Con QRS ancho la atropina no sirve.', 'marcapasos'), { t: 'Sube los mA de 10 en 10 hasta la captura.', at: ['#zmA'], ok: () => S.pace.capture }, D('drug:fent|drug:mid', 'Analgesia: fentanilo.', 'Estimular duele.', 'fentanilo'), TG('tas', 'TAS ≥ 90.', null, 'pni'), END],
  pcrFv: [R, ...CPR, { t: 'Carga mientras se comprime y descarga 150–200 J.', at: ['#zCharge', '#zShock'], ok: () => track.shocks > 0 }, ...CPR, { t: 'Cada 2 min, «Comprobar pulso y ritmo» y descarga si sigue en FV.', at: 'comprobar pulso', ok: () => track.shocks >= 3 || TU.rosc() }, D('drug:adr', 'Tras la 3.ª descarga: adrenalina 1 mg.', null, 'adrenalina'), D('drug:amio|drug:lido', 'Y amiodarona 300 mg (o lidocaína 100 mg).', null, 'amiodarona'), { t: 'Sigue con ciclos de 2 min hasta la RCE.', at: 'comprobar pulso', ok: TU.rosc }, END],
  fvRefractaria: [R, ...CPR, { t: 'Descarga en cada análisis.', at: ['#zCharge', '#zShock'], ok: () => track.shocks >= 3 || TU.rosc() }, D('act:pads', 'Tras tres descargas: parches anteroposteriores.', 'Cambio de vector (ERC 2025).', 'parches'), D('drug:amio|drug:lido', 'Amiodarona 300 mg (o lidocaína).', null, 'amiodarona'), D('drug:adr', 'Adrenalina 1 mg cada 3–5 min.', null, 'adrenalina'), D('act:compMech', 'Compresor mecánico.', null, 'compresor mecanico'), { t: 'Sigue con ciclos de 2 min hasta la RCE.', at: 'comprobar pulso', ok: TU.rosc }, END],
  aespPtx: [R, ...CPR, X('Busca la causa: 4H y 4T.'), D('act:decomp|act:drain', 'Hemitórax hipoventilado y timpánico: descomprime.', null, 'descompresion'), D('act:fluid', 'Volumen.', null, 'cristaloide'), { t: '«Comprobar pulso y ritmo».', at: 'comprobar pulso', ok: TU.rosc }, END],
  asistolia: [R, D('act:bag', 'Ventila con ambú y O₂ al 100 %.', 'En la parada por hipoxia, la ventilación es lo primero.', 'ambu'), ...CPR, { t: 'Compresiones 15:2 (pediátrica).', at: ['#cprRatio'], ok: () => S.cpr.ratio === 15 || S.iface === 'tube' }, D('drug:adr', 'Adrenalina 10 mcg/kg cuanto antes.', null, 'adrenalina'), { t: 'Cada 2 min, «Comprobar pulso y ritmo».', at: 'comprobar pulso', ok: TU.rosc }, END],
  pcrTep: [R, ...CPR, D('drug:tnk', 'Tenecteplasa durante la RCP.', null, 'tenecteplasa'), D('act:compMech', 'Compresor mecánico: la RCP será larga (60–90 min).', null, 'compresor mecanico'), D('drug:adr', 'Adrenalina 1 mg cada 3–5 min.', null, 'adrenalina'), { t: '«Comprobar pulso y ritmo» cada 2 min.', at: 'comprobar pulso', ok: TU.rosc }, END],
  pcrPedFv: [R, ...CPR, { t: 'Descarga a 4 J/kg (ya está elegida): «Cargar» y «Descarga».', at: ['#zCharge', '#zShock'], ok: () => track.shocks > 0 }, { t: 'RCP 15:2.', at: ['#cprRatio'], ok: () => S.cpr.ratio === 15 || S.iface === 'tube' }, { t: 'Vía intraósea.', at: 'intraosea', ok: TU.acc }, D('drug:adr', 'Tras la 3.ª descarga: adrenalina 10 mcg/kg.', null, 'adrenalina'), D('drug:amio', 'Y amiodarona 5 mg/kg.', null, 'amiodarona'), { t: 'Ciclos de 2 min hasta la RCE.', at: 'comprobar pulso', ok: TU.rosc }, END],
  rceInestable: [R, D('act:fluid', 'Cristaloide.', null, 'cristaloide'), { t: 'Noradrenalina.', at: ['#pf_nor'], ok: 'perf:nor' }, TG('tas', 'TAS ≥ 100 (PAM ≥ 65).', 'Con TAS < 75 puede volver a pararse.', 'noradrenalina'), { t: 'Baja la FiO₂ hasta SpO₂ 94–98 %.', at: 'fio2', ok: TU.fio2(60) }, TG('et', 'EtCO₂ 35–45: ajusta la FR.', null, 'fr'), D('drug:fent|drug:mid|drug:sed', 'Sedoanalgesia.', null, 'fentanilo'), END]
};
/* casos propios o sin guion: a partir de sus acciones clave y sus objetivos */
const TG_AT = { spo2: 'fio2 reservorio', et: 'fr', tas: 'cristaloide noradrenalina', vtkg: 'vt', pplat: 'vt', dp: 'vt', peepi: 'fr', pco2: 'presion de soporte fr', rr: 'presion de soporte', leak: 'recoloca mascarilla', auto: 'trigger', fight: 'sedacion', o2: 'botella fio2', glu: 'glucosa', qrs: 'bicarbonato calcio', fio2: 'fio2', sinus: 'cardioversion', ie: 'peep' };
function tutSteps(k) {
  if (TUT[k]) return TUT[k];
  const c = CASES[k];
  if (c.vbase && TUT[c.vbase] && !c.vcause) return tutVariant(c);
  if (c.vcause) return tutCause(c);
  const st = [R];
  if (!c.arrest) st.push(X()); else st.push(...CPR);
  checksOf(c).forEach(([tok, lab]) => st.push({ t: lab + '.', at: lab, ok: () => checkDone(tok) }));
  Object.entries(c.targets || {}).forEach(([key, r]) => st.push(TG(key, `${TGT[key].lab} ${rangeTxt(r, TGT[key])} ${TGT[key].fmt ? '' : TGT[key].u}`.trim() + '.', null, TG_AT[key])));
  st.push(END); return st;
}
/* variante: el guion del caso original, adaptado (peso ideal de este paciente, sin vía, la complicación añadida) */
function tutVariant(c) {
  const b = CASES[c.vbase], st = TUT[c.vbase].filter(s => !s.end).map(s => s.vts ? Object.assign({}, s, { w: 'El volumen va por el peso ideal de este paciente (está en la tarjeta), no por el real.' }) : s);
  if (c.access === false && b.access !== false) st.splice(1, 0, { t: 'No tiene vía: canaliza una vía venosa (o intraósea si es urgente) antes de los fármacos.', at: 'via venosa', ok: TU.acc });
  if (c.vev && window.SIM_VARIANT) { const [evk, tok, lab, , why] = SIM_VARIANT.EV[c.vev]; st.push({ t: 'Vigila al paciente y el equipo: en esta variante algo va a cambiar.', ok: TU.ev(evk) }, { t: why.charAt(0).toUpperCase() + why.slice(1) + '.', at: lab, ok: () => checkDone(tok) }); }
  st.push(END); return st;
}
/* variante de parada con otra causa: RCP, la pista, las acciones de esa causa y los ciclos hasta la RCE */
function tutCause(c) {
  const ev = c.vev && window.SIM_VARIANT ? SIM_VARIANT.EV[c.vev] : null, st = [R, ...CPR, { t: 'Lee la pista del planteamiento: ¿qué causa reversible explica esta parada?', w: c.vwhy }];
  checksOf(c).filter(([t]) => t !== 'rosc' && (!ev || t !== ev[1])).forEach(([tok, lab]) => st.push({ t: lab + '.', at: lab, ok: () => checkDone(tok) }));
  if (ev) st.push({ t: 'Vigila al paciente y el equipo: algo va a cambiar.', ok: TU.ev(ev[0]) }, { t: ev[4].charAt(0).toUpperCase() + ev[4].slice(1) + '.', at: ev[2], ok: () => checkDone(ev[1]) });
  st.push({ t: 'Sigue los ciclos de 2 min (análisis, relevo y fármacos cuando toque) hasta la RCE.', at: 'comprobar pulso', ok: TU.rosc }, END);
  return st;
}
let tut = { on: false, i: 0, t0: 0, done: false, steps: [] };
function tutStart() {
  if (exam) { toast('El tutorial no está disponible en el modo examen.'); return; }
  tut = { on: true, i: 0, t0: S.clin, done: false, steps: tutSteps(caseKey), okAt: 0 };
  track.tutorial = true; coachMin = false; LS.set('simvmi.coachMin', false);
  if (scale > 5) { setSpeed(5); logIt('Tutorial: velocidad ×5 para que te dé tiempo'); }
  logIt('Tutorial del caso iniciado'); tutEnter();
}
function tutStop(msg) { tut.on = false; coachKey = ''; $('#coach').classList.remove('tut'); if (msg) logIt(msg); coachUpdate(); }
function tutCur() { return tut.steps[tut.i]; }
function tutWhere(st) { if (!st || !st.at) return []; return Array.isArray(st.at) ? st.at.map(x => $(x)).filter(Boolean) : whereOf(st.at); }
function tutEnter() {
  let st = tutCur();
  while (st && st.when && !st.when()) { tut.i++; st = tutCur(); }
  if (!st) return tutStop('Tutorial terminado');
  tut.t0 = S.clin; tut.okAt = 0; coachKey = '';
  const el = tutWhere(st); if (el.length) setTimeout(() => spot(el, true), 150);
  tutRender();
}
function tutOk(st) { if (!st.ok) return false; return typeof st.ok === 'string' ? TU.used(st.ok, st.fresh)() : !!st.ok(); }
function tutTick() {
  if (!tut.on) return;
  const st = tutCur(); if (!st) return tutStop('Tutorial terminado');
  if (!tut.okAt && tutOk(st)) { tut.okAt = performance.now(); tutRender(true); setTimeout(() => { if (tut.on && tutCur() === st) { tut.i++; tutEnter(); } }, 1300); }
}
function tutRender(ok) {
  const st = tutCur(), box = $('#coach'); if (!st) return;
  box.hidden = false; box.classList.add('tut'); box.classList.remove('min');
  const n = tut.steps.length, hasW = tutWhere(st).length, manual = !st.ok;
  $('#coachN').textContent = `${tut.i + 1}/${n}`; $('#coachN').className = 'cn ' + (ok ? 'ok' : 'tutn');
  box.querySelector('.ch b').textContent = 'Tutorial del caso';
  $('#coachBody').innerHTML = `<div class="tdots">${tut.steps.map((_, j) => `<i class="${j < tut.i ? 'd' : j === tut.i ? 'c' : ''}"></i>`).join('')}</div>` +
    (ok ? `<p class="tok">✓ Bien hecho</p>` : '') +
    `<b class="tt">${typeof st.t === 'function' ? st.t() : st.t}</b>${st.w ? `<p>${st.w}</p>` : ''}` +
    `<div class="inrow">${hasW && !ok ? '<button class="btn sm primary" id="tutWhere">Dónde se hace</button>' : ''}${manual && !st.end ? '<button class="btn sm primary" id="tutNext">Entendido</button>' : ''}${st.end ? '<button class="btn sm primary" id="tutEndCase">Terminar caso</button>' : ''}${!manual && !ok ? '<button class="btn sm" id="tutSkip">Saltar paso</button>' : ''}<button class="btn sm" id="tutQuit">Salir del tutorial</button></div>`;
}
function tutInit() {
  $('#coach').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'tutWhere') spot(tutWhere(tutCur()));
    else if (b.id === 'tutNext' || b.id === 'tutSkip') { if (b.id === 'tutSkip') logIt('Tutorial: paso saltado'); tut.i++; tutEnter(); }
    else if (b.id === 'tutQuit') tutStop('Tutorial cerrado');
    else if (b.id === 'tutEndCase') { tutStop(); $('#endBtn').click(); }
    else if (b.id === 'tutGo') tutStart();
  });
  $('#caseCard').addEventListener('click', e => { if (e.target.closest('#tutBtn')) tutStart(); else if (e.target.closest('#varBtn')) newVariant(); else if (e.target.closest('#varSave')) saveVariant(); else if (e.target.closest('#varLink')) linkVariant(); });
  document.addEventListener('click', () => { lastAct = performance.now(); }, true);
}
let lastAct = performance.now();
