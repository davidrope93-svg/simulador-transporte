/* ===== Orientación (v0.8): guía paso a paso, «Dónde» en la Lectura, ayudante con el siguiente paso y buscador de acciones.
   Se inserta dentro de la interfaz, después de la docencia. ===== */
const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/₂/g, '2');
const $d = (...ids) => () => ids.map(id => $(`[data-drug="${id}"]`));
const $a = (...ks) => () => ks.map(k => $(`[data-act="${k}"]`));
const $p = (...ids) => () => ids.map(id => $('#pf_' + id));
const $s = (...sels) => () => sels.map(x => $(x));
const $k = (...ks) => () => { for (const k of ks) { const e = $('#k_' + k); if (e) return [e]; } return devOf().knob === 'three' ? [$('#dials')] : [$('#knobs')]; };
/* palabras de la Lectura → dónde está el mando (el orden importa: lo más específico primero) */
const WHERE = [
  [/glucagon (5 mg|iv)/, $d('glucgIV')], [/glucagon .*mg\/h|perfusion de glucagon/, $p('glucgP')], [/insulina a dosis altas|1 ui\/kg en bolo/, $d('insHD')], [/1 ui\/kg\/h/, $p('insP')], [/0,1 ui\/kg\/h|insulina en perfusion/, $p('insD')],
  [/atropina 2 mg|doblando la dosis|dobla la dosis/, $d('atr2', 'atr4', 'atr8', 'atr16')], [/perfusion del 10.20 %|perfusion de atropina/, $p('atrP')], [/pralidoxima|oxima/, $d('prali')], [/emulsion lipidica/, $d('lipid')], [/enfriamiento activo/, $a('cool')], [/descontamina|lava la piel/, $a('decont')],
  [/5 insuflaciones|insuflaciones/, $a('infl')], [/posicion neutra|sellado|recoloca la cabeza/, $a('neoPos')], [/aspira boca|aspirar la boca|aspira la boca/, $a('neoSuct')], [/compresiones 3:1|3:1/, $a('neoComp')], [/cateter venoso umbilical|umbilical/, $a('uvc')], [/fio₂ de la pieza|sube la fio₂ de 10|baja la fio₂|fio₂ 100 %|fio2 100/, () => S.neo ? [$('#neoFio2')] : []],
  [/perfusion de propofol|propofol 2.4 mg/, $p('prop')], [/propofol/, $d('propI')], [/levetiracetam/, $d('lev')], [/valproato/, $d('vpa')], [/midazolam 0,15|midazolam 10|midazolam \(crisis\)|benzodiacepina/, $d('midCr', 'midIN')], [/salino hipertonico 3/, $d('ssh3')], [/codigo ictus/, $a('ictus')],
  [/cloruro calcico|\bcalcio\b/, $d('ca')], [/insulina/, $d('ins')], [/bicarbonato/, $d('bic')], [/glucagon/, $d('glucg')], [/perfusion de glucosa/, $p('g10')], [/glucosa/, $d('gluc', 'gluc10')],
  [/perfusion de 1 g\/h/, $p('mgP')], [/magnesio/, $d('mg4', 'mgso4')], [/labetalol/, $d('labet')], [/urapidilo/, $d('urap')], [/oxitocina/, $d('oxito')], [/tranexamico/, $d('txa')], [/sugammadex/, $d('sugam')],
  [/intranasal|bucal/, $d('midIN')], [/adrenalina nebulizada/, $d('adrNeb')], [/dexametasona/, $d('dexa')], [/adrenalina im\b|adrenalina im |intramuscular/, $d('adrIM')],
  [/perfusion de adrenalina|adrenalina 2.10 mcg|mcg\/min/, $p('adrI')], [/bolo de 10.20 mcg/, $d('adrP')], [/adrenalina/, $d('adr1')], [/noradrenalina/, $p('nor')],
  [/amiodarona/, $d('amio300', 'amio150')], [/lidocaina/, $d('lido100')], [/adenosina/, $d('aden6', 'aden12', 'aden18')], [/atropina/, $d('atr')], [/vagales|valsalva/, $d('vagal')], [/naloxona/, $d('nalox')],
  [/nitroglicerina|nitratos/, $d('ntgiv', 'ntgsl')], [/salbutamol/, $d('salb')], [/furosemida/, $d('furo')], [/salino hipertonico/, $d('shs')], [/manitol/, $d('manit')], [/hidroxocobalamina/, $d('hidroxo')], [/fibrinolisis|tenecteplasa/, $d('tnk')],
  [/ketamina analgesica|ketamina 0,3/, $d('ketA')], [/fentanilo/, $d('fentS', 'fentI')], [/morfina/, $d('morf')], [/ketamina/, $d('ket')], [/etomidato/, $d('eto')], [/rocuronio|relajante/, $d('roc')], [/antibiotico|ceftriaxona/, $d('ceftri', 'pipta', 'mero')], [/ecg de 12|12 derivaciones|v4r/, $a('ecg12')], [/ecografia/, $a('eco')], [/pericardiocentesis/, $a('pericardio')], [/icp primaria|codigo infarto/, $a('icp')], [/\baas\b|antiagrega/, $d('aas')], [/ticagrelor/, $d('tica')], [/clopidogrel/, $d('clopi300', 'clopi600')], [/heparina|anticoagula/, $d('hnf', 'enox')], [/enoxaparina/, $d('enox')], [/bolo de la bomba/, $d('sedB')], [/reintub/, $a('reintub')], [/via aerea definitiva/, $a('intubate')], [/broncodilatador/, $d('salb')], [/antiarritmico/, $d('amio300', 'lido100')], [/recalent/, $a('warm')], [/medir la temperatura/, $a('temp')], [/acceso vascular/, $a('iv', 'io')], [/ventilar con o2/, $a('bag')], [/reanuda/, $d('sedperf')], [/retirar? (el )?tubo|retira 2 cm/, $a('pull')], [/inductor|sedoanalgesia|sedacion|midazolam|fentanilo/, $d('fentS', 'mid')], [/corticoide|metilprednisolona/, $d('cort')], [/antihistaminico/, $d('dexclor')],
  [/sangre/, $d('blood')], [/cristaloide en bomba|ml\/h/, $p('cris')], [/cristaloide|volumen|bolos? pequenos/, $d('fluid')],
  [/ambu|bolsa/, $a('bag')], [/videolaringoscopio/, $a('vl')], [/gafas a 15|oxigenacion apneica/, $a('apox')], [/supraglotico/, $a('sga')], [/cricotiroidotomia/, $a('cric')], [/intuba/, $a('intubate')],
  [/toracostomia|drenaje/, $a('drain')], [/descompresion|descomprime/, $a('decomp')], [/intraosea/, $a('io')], [/via venosa|via periferica|canaliza/, $a('iv')], [/glucemia/, $a('glu')], [/mide la temperatura/, $a('temp')],
  [/calor activo|aisla/, $a('warm')], [/torniquete|cinturon pelvico|masaje uterino|hemostasia/, $a('hemo')], [/compresor mecanico/, $a('compMech')], [/compresiones/, $a('compManual', 'compMech')], [/relevo/, $a('relevo')],
  [/analizar|comprobar pulso|pausa breve/, $a('check')], [/vmni|ventilacion no invasiva/, $a('toMask')], [/alto flujo/, $a('toNasal')], [/reservorio|venturi/, $s('#o2dev')], [/botella/, $a('bottle')],
  [/reconecta|pieza en y/, $a('reconnect')], [/balon/, $a('cuff')], [/aspira|secreciones/, $a('suction')], [/reclutamiento/, $a('recruit')], [/gasometria/, $a('gas')], [/explora|pupilas/, $a('explore')],
  [/recoloca|cambia la mascarilla/, $a('mask')], [/pinza/, $a('clamp')], [/desconecta 15 s/, $a('opencirc')], [/30:2|15:2/, $s('#cprRatio')],
  [/iniciar ventilacion/, $s('#sbyGo')], [/air mix/, $s('#vk_airmix')], [/tecla de o2|o2 al 100/, $s('#vk_o2boost', '#vk_o2full')], [/fio2/, $k('fio2')], [/\bpeep\b|cpap/, $k('peep')],
  [/presion de soporte|\bps\b/, $k('ps')], [/\bvt\b/, $k('vt')], [/\bfr\b|frecuencia/, $k('fr')], [/trigger/, $k('trigI')], [/timax|ti max/, $k('timax')], [/ciclado/, $k('trigE')], [/inspiracion ti|\bi:e\b/, $k('ti', 'ie')], [/\bflow\b|flujo a \d|flujo \d/, $k('flow')], [/pasa a /, $s('#modes')], [/alarma de presion/, $s('#limBox')],
  [/cardioversion|sinc/, $s('#zSync', '#zCharge')], [/parches/, $s('#zPads')], [/marcapasos|ma por encima/, $s('#zPace', '#zmA')], [/descarga|desfibrila|\d+ j\b|j\/kg/, $s('#zJ', '#zCharge', '#zShock')],
  [/pausa inspiratoria/, $s('#vk_inhold')], [/pausa espiratoria/, $s('#vk_exhold')], [/pni|mide la ta/, $s('#zPniBtn')], [/programa la automatica/, $s('#zAuto')]
];
function whereOf(text) {
  const t = norm(text), out = [];
  for (const [re, f] of WHERE) if (re.test(t)) for (const e of f()) if (e && !out.includes(e)) out.push(e);
  return out.slice(0, 4);
}
/* señala uno o varios mandos: abre su grupo, cambia de pestaña en el móvil, lo centra y lo hace parpadear */
function spot(els, quiet) {
  els = els.filter(Boolean); if (!els.length) return false;
  const tb = $('#tabbar'), mobile = tb && getComputedStyle(tb).display !== 'none';
  els.forEach(e => { let d = e.closest('details'); while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); } });
  const sec = els[0].closest('[data-tabsec]'); if (mobile && sec) setTab(sec.dataset.tabsec);
  requestAnimationFrame(() => { const c = $('#coach'), low = mobile && c && !c.hidden; if (low) { const r = els[0].getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top - innerHeight * .22, behavior: 'smooth' }); } else els[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  els.forEach(e => { e.classList.remove('spot'); void e.offsetWidth; e.classList.add('spot'); setTimeout(() => e.classList.remove('spot'), 4200); });
  if (!quiet && els[0].disabled) toast('Ese mando está desactivado ahora: ' + (els[0].closest('[data-drug]') && !S.access ? 'falta un acceso vascular.' : 'no se puede usar en esta situación.'));
  return true;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-where]'); if (!b) return; e.preventDefault(); if (!spot(whereOf(decodeURIComponent(b.dataset.where)))) toast('No hay un botón concreto para esto: es una decisión de manejo.'); });

/* ---------- ayudante flotante: el siguiente paso ---------- */
let coachMin = LS.get('simvmi.coachMin', false), coachKey = '';
function coachUpdate() {
  const box = $('#coach'); if (!box) return;
  if (exam || INSTR) { box.hidden = true; return; }
  if (tut.on) { tutTick(); return; }
  box.hidden = false; box.classList.toggle('min', coachMin); box.querySelector('.ch b').textContent = 'Siguiente paso';
  const lost = performance.now() - lastAct > 60000;
  const r = lastReads.find(x => x[0] === 'bad') || lastReads.find(x => x[0] === 'warn') || lastReads[0];
  const n = lastReads.filter(x => x[0] !== 'ok').length;
  $('#coachN').textContent = n ? String(n) : '✓';
  $('#coachN').className = 'cn ' + (r ? r[0] : 'ok');
  if (!r) return;
  const key = r[1] + r[3] + lost; if (key === coachKey) return; coachKey = key;
  const has = whereOf(r[3] + ' ' + r[1]).length;
  $('#coachBody').innerHTML = (lost ? '<p class="lost">¿Te has perdido? El tutorial te lleva paso a paso por este caso.</p>' : '') + `<b>${r[1]}</b><p>${r[2]}</p><p class="fix">→ ${r[3]}</p><div class="inrow">${has ? `<button class="btn sm primary" data-where="${encodeURIComponent(r[3] + ' ' + r[1])}">Dónde se hace</button>` : ''}<button class="btn sm" id="coachAll">Ver toda la Lectura${n > 1 ? ' (' + n + ')' : ''}</button><button class="btn sm${lost ? ' primary' : ''}" id="tutGo">Guíame en este caso</button></div>`;
}

/* ---------- buscador de acciones, fármacos y mandos ---------- */
const QSYN = { ca: 'calcio', bic: 'bicarbonato sodico alcalinizar', gluc: 'glucosa hipoglucemia dextrosa', gluc10: 'glucosa hipoglucemia dextrosa', glucg: 'glucagon hipoglucemia', ins: 'insulina hiperpotasemia potasio', mg4: 'magnesio eclampsia convulsion',
  mgso4: 'magnesio asma', labet: 'labetalol hipertension tension', urap: 'urapidilo hipertension tension', oxito: 'oxitocina hemorragia posparto utero', txa: 'tranexamico amchafibrin hemorragia', sugam: 'sugammadex bridion revertir relajante', sugam4: 'sugammadex revertir',
  midIN: 'midazolam intranasal bucal convulsion', adrNeb: 'adrenalina nebulizada crup estridor', dexa: 'dexametasona corticoide crup', adr1: 'adrenalina parada epinefrina', adrP: 'adrenalina bolo push dose', adrIM: 'adrenalina intramuscular anafilaxia',
  amio300: 'amiodarona trangorex', amio150: 'amiodarona', lido100: 'lidocaina', lido50: 'lidocaina', aden6: 'adenosina tsv', aden12: 'adenosina', aden18: 'adenosina', atr: 'atropina bradicardia', vagal: 'vagal valsalva', nalox: 'naloxona opiaceos',
  fluid: 'suero cristaloide fisiologico volumen ringer', blood: 'sangre hematies transfusion', roc: 'rocuronio relajante isr', sux: 'succinilcolina anectine relajante', ket: 'ketamina induccion', eto: 'etomidato hypnomidate induccion', propI: 'propofol induccion', fentI: 'fentanilo',
  salb: 'salbutamol ventolin broncoespasmo', cort: 'metilprednisolona urbason corticoide', ntgsl: 'nitroglicerina solinitrina', ntgiv: 'nitroglicerina', furo: 'furosemida seguril', shs: 'salino hipertonico htic', manit: 'manitol htic', hidroxo: 'hidroxocobalamina cyanokit cianuro', tnk: 'tenecteplasa metalyse fibrinolisis', dexclor: 'dexclorfeniramina polaramine' };
const QACT = { infl: 'insuflaciones recien nacido neonatal', neoPos: 'posicion neutra sellado mascarilla neonatal', neoSuct: 'aspirar boca nariz recien nacido meconio', neoComp: 'compresiones 3:1 neonatal recien nacido', uvc: 'cateter venoso umbilical acceso neonatal', cool: 'enfriamiento hipertermia hielo golpe de calor', decont: 'descontaminar ropa proteccion lavar', ictus: 'codigo ictus preaviso trombectomia', explore: 'explorar auscultar mirar', gas: 'gasometria analitica', bag: 'ambu bolsa ventilar', toO2: 'quitar soporte oxigenoterapia', toMask: 'vmni mascarilla cpap bipap', toNasal: 'alto flujo gafas nasales', apox: 'oxigenacion apneica gafas', vl: 'videolaringoscopio bougie',
  intubate: 'intubar tubo iot', sga: 'igel supraglotico mascarilla laringea', cric: 'cricotiroidotomia cico', mask: 'recolocar mascarilla fuga', reconnect: 'reconectar desconexion', reintub: 'reintubar', pull: 'retirar tubo selectiva', suction: 'aspirar secreciones tapon',
  cuff: 'inflar balon neumo fuga', clamp: 'pinzar tubo', opencirc: 'desconectar vaciar autopeep', recruit: 'reclutamiento', decomp: 'descompresion aguja neumotorax', drain: 'toracostomia drenaje toracico neumotorax', bottle: 'cambiar botella oxigeno',
  iv: 'via venosa periferica canalizar acceso', io: 'intraosea acceso', glu: 'glucemia capilar azucar dextrostix', temp: 'temperatura termometro', warm: 'manta calor hipotermia', ketA: 'ketamina analgesica analgesia dolor', midCr: 'midazolam crisis convulsion estatus benzodiacepina', lev: 'levetiracetam keppra estatus convulsion', vpa: 'valproato depakine estatus convulsion', ssh3: 'salino hipertonico 3 hiponatremia sodio', glucgIV: 'glucagon betabloqueante', insHD: 'insulina dosis altas calcioantagonista verapamilo', atr2: 'atropina organofosforado', atr4: 'atropina organofosforado', atr8: 'atropina organofosforado', atr16: 'atropina organofosforado', prali: 'pralidoxima oxima organofosforado', lipid: 'emulsion lipidica intralipid rescate', fentS: 'fentanilo analgesia dolor', morf: 'morfina analgesia dolor', cris: 'cristaloide bomba quemado parkland ringer', hemo: 'torniquete cinturon pelvico masaje uterino hemostasia sangrado',
  compManual: 'compresiones rcp masaje cardiaco', compMech: 'compresor mecanico lucas', compOff: 'parar compresiones', relevo: 'relevo compresor', check: 'analizar ritmo pulso' };
const QMON = [['#zPniBtn', 'PNI ahora', 'tension arterial medir'], ['#zAuto', 'PNI automática', 'tension intervalo'], ['#zJ', 'Energía de la descarga', 'julios joules'], ['#zCharge', 'Cargar el desfibrilador', 'cargar'],
  ['#zShock', 'Descarga', 'desfibrilar descargar shock'], ['#zSync', 'SINC (cardioversión)', 'sincronizada cardioversion'], ['#zMode', 'Manual o DEA', 'dea automatico'], ['#zPads', 'Cambiar parches a anteroposterior', 'vector parches'],
  ['#zPace', 'Marcapasos encendido', 'marcapasos transcutaneo'], ['#zRate', 'Frecuencia del marcapasos', 'marcapasos lpm'], ['#zmA', 'Intensidad del marcapasos', 'marcapasos ma captura'], ['#zSil', 'Silenciar el monitor', 'alarma'], ['#cprRatio', 'Compresión : ventilación', '30:2 15:2 continuas']];
function qItems() {
  const it = [];
  Object.values(DRUGITEMS).forEach(d => { const b = $(`[data-drug="${d.id}"]`); if (!b) return; const ds = d.act ? null : doseOf(d);
    it.push({ lab: d.lab + (ds != null && d.u ? ` ${fmt(ds, dd(ds))} ${d.u}` : d.note ? ` (${d.note})` : ''), where: 'Fármacos · ' + (b.closest('details') ? b.closest('details').querySelector('summary').textContent : ''), kw: QSYN[d.id] || '', el: b, run: () => b.click() }); });
  PERFS.forEach(p => { const s = $('#pf_' + p.id); if (s) it.push({ lab: 'Perfusión de ' + p.lab.toLowerCase(), where: 'Fármacos · Perfusiones', kw: QSYN[p.id] || p.id, el: s, run: null }); });
  $$('[data-act]').forEach(b => { if (b.hidden || !b.closest('.side')) return; it.push({ lab: b.textContent.trim(), where: 'Acciones', kw: QACT[b.dataset.act] || '', el: b, run: () => b.click() }); });
  keysFor(uMode(pend)).forEach(k => { const e = $('#k_' + k); if (e) it.push({ lab: `${labOf(k, pend)} (ahora ${showV(k, pend[k])})`, where: devOf().short + ' · mandos', kw: k + ' ' + (SPEC[k] ? SPEC[k].lab : ''), el: e, run: null }); });
  $$('#modes button[data-m]').forEach(b => it.push({ lab: 'Modo ' + b.textContent.trim(), where: devOf().short + ' · modos', kw: 'modo ' + b.dataset.m, el: b, run: () => b.click() }));
  $$('#vkeys .vbtn').forEach(b => it.push({ lab: b.textContent.trim(), where: devOf().short + ' · teclas', kw: '', el: b, run: () => b.click() }));
  if ($('#sbyGo')) it.push({ lab: 'Iniciar ventilación', where: devOf().short, kw: 'empezar arrancar standby espera', el: $('#sbyGo'), run: () => $('#sbyGo').click() });
  QMON.forEach(([sel, lab, kw]) => { const e = $(sel); if (e) it.push({ lab, where: 'Monitor', kw, el: e, run: e.tagName === 'BUTTON' ? () => e.click() : null }); });
  [['#libBtn', 'Biblioteca de casos', 'biblioteca casos lista filtros aleatorio elegir caso buscar caso'], ['#tutBtn', 'Guíame en este caso (tutorial)', 'tutorial guia paso a paso ayuda perdido'], ['#varBtn', 'Nueva variante de este caso', 'variante otro paciente distinto generar aleatorio cambiar caso'], ['#endBtn', 'Terminar caso', 'acabar debrief nota'], ['#pauseBtn', 'Pausa', 'parar'], ['#resetBtn', 'Reiniciar el caso', 'repetir'], ['#guideBtn', 'Guía de la pantalla', 'ayuda tutorial'], ['#histBtn', 'Historial', 'notas'], ['#edBtn', 'Mis casos', 'editor crear caso']]
    .forEach(([sel, lab, kw]) => { const e = $(sel); if (e) it.push({ lab, where: 'Barra superior', kw, el: e, run: () => e.click() }); });
  return it;
}
let qList = [], qSel = 0;
function qRender() {
  const q = norm($('#qIn').value.trim()), words = q.split(/\s+/).filter(Boolean);
  const all = qItems();
  qList = words.length ? all.map(x => { const h = norm(x.lab + ' ' + x.kw + ' ' + x.where); let sc = 0; for (const w of words) { if (!h.includes(w)) return null; sc += norm(x.lab).startsWith(w) ? 3 : norm(x.lab).includes(w) ? 2 : 1; } return [sc, x]; }).filter(Boolean).sort((a, b) => b[0] - a[0]).map(x => x[1]).slice(0, 12) : [];
  qSel = 0;
  $('#qRes').innerHTML = !words.length ? '<p class="small">Escribe lo que quieres hacer: «calcio», «PEEP», «intubar», «cardioversión», «vía»…</p>' : qList.length ? qList.map((x, i) => `<button class="qr${i === 0 ? ' on' : ''}" data-qi="${i}"${x.el.disabled ? ' aria-disabled="true"' : ''}><b>${x.lab}</b><span>${x.where}${x.el.disabled ? ' · ahora no disponible' : ''}</span><em>${x.run && !x.el.disabled ? 'Enter: hacerlo' : 'Enter: ir'}</em></button>`).join('') : '<p class="small">No encuentro nada con eso. Prueba con otra palabra.</p>';
}
function qClose() { $('#qModal').hidden = true; if (document.activeElement === $('#qIn')) $('#qIn').blur(); }
function qGo(i, onlyShow) {
  const x = qList[i]; if (!x) return;
  qClose();
  if (x.run && !x.el.disabled && !onlyShow) { x.run(); spot([x.el], true); toast('Hecho: ' + x.lab); }
  else spot([x.el]);
}
function qOpen() { if (INSTR) return; $('#qModal').hidden = false; $('#qIn').value = ''; qRender(); $('#qIn').focus(); }

/* ---------- guía paso a paso ---------- */
const TOUR = [
  ['#caseCard', 'case', 'El caso', 'Qué le pasa al paciente y tus objetivos, que se ponen en verde cuando los cumples. Si te atascas, abajo está «Ver una solución posible».'],
  ['#caseSel', null, 'Elegir caso', 'Aquí cambias de caso. Están por grupos: VMI, VMNI, vía aérea, pediatría, trauma, parada…'],
  ['#speedSeg', null, 'El reloj', '×1 es tiempo real; ×10 va diez veces más rápido para no esperar. En la parada se pone solo a ×1.'],
  ['#vent', 'vent', 'El respirador', 'Curvas arriba y valores medidos a la derecha. Debajo, los mandos. Cambias de equipo en «Ventilador», arriba.'],
  ['#knobs', 'vent', 'Cambiar un ajuste', 'Toca el parámetro, súbelo o bájalo con − y +, y pulsa «Confirmar». Si no confirmas en 20 s, el cambio se descarta, como en el equipo.'],
  ['#vkeys', 'vent', 'Teclas del equipo', 'O₂ al 100 %, pausas inspiratoria y espiratoria, silenciar, espera… Las mismas que tiene cada respirador.'],
  ['#zoll', 'mon', 'El monitor', 'ECG, SpO₂, EtCO₂ y PNI. Para desfibrilar: energía, «Cargar» y «Descarga». Para cardiovertir, activa SINC antes de cargar. El marcapasos está debajo.'],
  ['[aria-labelledby="actH"]', 'act', 'Acciones', 'Explorar, vía aérea, vía venosa, glucemia, temperatura, compresiones… Lo que harías con las manos.'],
  ['#drugPanel', 'act', 'Fármacos', 'Por grupos y con la dosis ya calculada para el peso del paciente. Las perfusiones están al final.'],
  ['.readc', 'case', 'Lectura', 'Te dice qué va mal y qué hacer. Pulsa «Dónde» y te señalo el botón. En modo examen desaparece.'],
  ['#coach', null, 'El ayudante', 'Siempre a mano: el problema más urgente y el botón para ir a resolverlo. Puedes plegarlo.'],
  ['#qBtn', null, 'Buscar', 'Si no encuentras algo, búscalo: escribe «calcio», «PEEP» o «intubar» y pulsa Enter. En el ordenador, la tecla / lo abre.'],
  ['#endBtn', null, 'Terminar', 'Al acabar: nota, gráfica de lo que ha pasado y la solución. Puedes volver a esta guía con el botón «Guía».']
];
let tourI = -1;
function tourShow() {
  const st = TOUR[tourI]; if (!st) return tourEnd();
  const tb = $('#tabbar'), mobile = tb && getComputedStyle(tb).display !== 'none';
  if (mobile && st[1]) setTab(st[1]);
  let el = $(st[0]); if (st[0] === '#knobs' && devOf().knob === 'three') el = $('#dials') || el;
  if (!el || !el.offsetParent) { tourI++; return tourShow(); }
  el.scrollIntoView({ behavior: 'instant', block: 'center' });
  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect(), hl = $('#tourHl'), card = $('#tourCard'), pad = 6;
    Object.assign(hl.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + 2 * pad + 'px', height: Math.min(r.height, innerHeight - 20) + 2 * pad + 'px' });
    $('#tourT').textContent = `${tourI + 1}/${TOUR.length} · ${st[2]}`; $('#tourX').textContent = st[3];
    $('#tourPrev').disabled = tourI === 0; $('#tourNext').textContent = tourI === TOUR.length - 1 ? 'Terminar' : 'Siguiente';
    const below = r.bottom + 12 + 190 < innerHeight, cw = Math.min(360, innerWidth - 24);
    Object.assign(card.style, { width: cw + 'px', left: Math.max(12, Math.min(innerWidth - cw - 12, r.left)) + 'px', top: (below ? Math.min(r.bottom + 12, innerHeight - 200) : Math.max(12, r.top - 12 - card.offsetHeight)) + 'px' });
    $('#tourNext').focus();
  });
}
function tourStart() { if (INSTR) return; tourI = 0; $('#tour').hidden = false; paused = true; setPauseBtn(); tourShow(); }
function tourEnd() { $('#tour').hidden = true; tourI = -1; LS.set('simvmi.tour', 1); paused = false; setPauseBtn(); }

function guideInit() {
  $('#guideBtn').addEventListener('click', tourStart);
  $('#tourNext').addEventListener('click', () => { tourI++; tourShow(); });
  $('#tourPrev').addEventListener('click', () => { tourI = Math.max(0, tourI - 1); tourShow(); });
  $('#tourEnd').addEventListener('click', tourEnd);
  window.addEventListener('resize', () => { if (tourI >= 0) tourShow(); });
  $('#qBtn').addEventListener('click', qOpen);
  $('#qIn').addEventListener('input', qRender);
  $('#qIn').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!qList.length) return; qSel = (qSel + (e.key === 'ArrowDown' ? 1 : -1) + qList.length) % qList.length; $$('#qRes .qr').forEach((b, i) => b.classList.toggle('on', i === qSel)); $$('#qRes .qr')[qSel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); qGo(qSel); }
  });
  $('#qRes').addEventListener('click', e => { const b = e.target.closest('[data-qi]'); if (b) qGo(+b.dataset.qi); });
  $('#qModal').addEventListener('click', e => { if (e.target.id === 'qModal') qClose(); });
  document.addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); qOpen(); }
    if (e.key === 'Escape') { if (!$('#qModal').hidden) qClose(); if (tourI >= 0) tourEnd(); }
  });
  $('#coach').addEventListener('click', e => {
    if (e.target.closest('#coachToggle')) { coachMin = !coachMin; LS.set('simvmi.coachMin', coachMin); coachKey = ''; coachUpdate(); }
    else if (e.target.closest('#coachAll')) spot([$('.readc')], true);
  });
  if (!LS.get('simvmi.tour', 0)) setTimeout(tourStart, 900);
}
