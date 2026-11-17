/* Resumen del debrief (v1.33): de los datos del intento a «lo que has hecho bien» y «lo que puedes mejorar», sin DOM.
   Lo usa la interfaz (teach.js) y lo prueban las pruebas del motor. Máximo 3 cosas en cada lista, por orden de importancia:
   seguridad, acciones clave que faltaron, calidad de la RCP, objetivos fuera de rango (diciendo si por encima o por debajo)
   y, cuando el equipo de referencia termina, retrasos frente a él. */
(function (root) {
'use strict';
const f = (x, d) => (Math.round(x * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toFixed(d || 0).replace('.', ',');
const mmss = m => { const s = Math.round(m * 60); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const minTxt = t => 'min ' + f(t, 1);
/* qué hacer cuando un objetivo queda por encima (hi) o por debajo (lo) del rango */
const HINT = {
  spo2: { lo: 'sube la FiO₂ o la PEEP y revisa vía aérea y ventilación', hi: 'baja la FiO₂: la hiperoxia también perjudica' },
  et: { lo: 'estás hiperventilando: baja la FR o el Vt', hi: 'estás hipoventilando: sube la FR o el Vt (vigila la auto-PEEP)' },
  pco2: { lo: 'estás hiperventilando: baja la FR o el Vt', hi: 'estás hipoventilando: sube la FR o el Vt (vigila la auto-PEEP)' },
  tas: { lo: 'volumen, vasopresor o trata la causa' },
  pam: { lo: 'volumen, vasopresor o trata la causa' },
  vtkg: { hi: 'baja el Vt: se calcula con el peso ideal (talla y sexo)', lo: 'sube el Vt' },
  pplat: { hi: 'baja el Vt' },
  dp: { hi: 'baja el Vt o revisa la PEEP' },
  peepi: { hi: 'alarga la espiración: baja la FR o acorta el Ti' },
  fio2: { hi: 'baja la FiO₂ en cuanto la SpO₂ lo permita' },
  temp: { lo: 'calor activo', hi: 'enfriamiento activo' },
  glu: { lo: 'glucosa' },
  cuff: { lo: 'ajusta el balón con el manómetro', hi: 'ajusta el balón con el manómetro' },
  leak: { hi: 'recoloca o ajusta la mascarilla' }
};
const VERDICT = s => s >= 9 ? { t: 'Excelente', k: 'ok' } : s >= 7 ? { t: 'Bien', k: 'ok' } : s >= 5 ? { t: 'Mejorable', k: 'mid' } : { t: 'Hay que repasarlo', k: 'low' };

/* d: { min, score, targets: [{ k, lab, pct, hi, lo, fmt }], checks: [{ lab, done, at }], arrest: null | { ccf, rosc, roscMin, firstShock, vf },
        safety: { arrestCaused, minSpo2, standbyApnea, unresolved: [] }, events: [{ lab, fixedIn }],
        ref: null | { score, targets: { k: pct }, checks: [{ done, at }] (mismo orden que checks) } } */
function dbTips(d) {
  const good = [], bad = [], ref = d.ref || null, verdict = VERDICT(d.score);
  if (!(d.min >= 1)) return { verdict, short: true, good: [], bad: ['Has simulado menos de 1 minuto: no hay bastante para valorarlo. Repite el caso y llega al final.'], more: 0 };
  const sf = d.safety || {}, B = (p, t) => bad.push({ p, t }), G = (p, t) => good.push({ p, t });
  /* 0 · seguridad */
  if (sf.arrestCaused) B(0, 'El paciente entró en parada durante el caso: revisa en el informe completo qué pasó justo antes.');
  if (sf.minSpo2 != null && sf.minSpo2 < 85) B(0, `SpO₂ mínima ${f(sf.minSpo2)} %: desaturación ${sf.minSpo2 < 75 ? 'grave' : 'importante'}. Oxigena antes y durante cada maniobra.`);
  if (sf.standbyApnea > .5) B(0, `Intubado sin ventilar ${f(sf.standbyApnea * 60)} s: tras intubar, revisa los ajustes y pulsa «Iniciar ventilación».`);
  if (sf.unresolved && sf.unresolved.length) B(0, 'Sin resolver: ' + sf.unresolved.map(x => '«' + x + '»').join(', ') + '.');
  /* 1 · acciones clave */
  const ch = d.checks || [], rc = ref && ref.checks || [];
  ch.forEach((c, i) => { if (!c.done) B(1, `Te faltó «${c.lab}»` + (rc[i] && rc[i].done && rc[i].at != null ? `: la referencia lo hizo en el ${minTxt(rc[i].at)}.` : '.')); });
  const done = ch.filter(c => c.done);
  if (ch.length && done.length === ch.length) G(1, ch.length === 1 ? `Hiciste la acción clave: «${ch[0].lab}».` : `Hiciste las ${ch.length} acciones clave.`);
  else done.slice(0, 2).forEach(c => G(1, `«${c.lab}»${c.at != null ? ' en el ' + minTxt(c.at) : ''}.`));
  /* 2 · parada */
  const A = d.arrest;
  if (A) {
    if (A.ccf >= .8) G(2, `RCP de calidad: fracción de compresión ${f(A.ccf * 100)} %.`); else B(2, `Fracción de compresión ${f(A.ccf * 100)} %: reduce las pausas (objetivo > 80 %).`);
    if (A.vf) { if (A.firstShock == null) B(2, 'Sin descargas en un ritmo desfibrilable: desfibrila cuanto antes.'); else if (A.firstShock <= 2) G(2, `Primera descarga a los ${mmss(A.firstShock)} min de la parada.`); else B(2, `Primera descarga a los ${mmss(A.firstShock)} min: en FV/TVSP, descarga en menos de 2 min.`); }
    if (A.rosc) G(2, `RCE a los ${f(A.roscMin, 1)} min de parada.`);
  }
  /* 3 · objetivos */
  const tg = (d.targets || []).filter(t => t.pct != null);
  tg.filter(t => t.pct < 80).sort((a, b) => a.pct - b.pct).forEach(t => {
    const dir = t.fmt ? null : t.hi > t.lo ? 'hi' : t.lo > 0 ? 'lo' : null, h = dir && HINT[t.k] && HINT[t.k][dir];
    const r = ref && ref.targets && ref.targets[t.k] != null && ref.targets[t.k] - t.pct >= 20 ? `; la referencia, en objetivo el ${f(ref.targets[t.k])} %` : '';
    const side = dir === 'hi' ? 'por encima' : 'por debajo', share = dir === 'hi' ? t.hi : t.lo;
    const what = dir && t.pct < 5 ? `${side} del objetivo ${share >= 95 ? 'todo el tiempo' : `el ${f(share)} % del tiempo`}` : `en objetivo solo el ${f(t.pct)} % del tiempo${dir ? ` (${side} el ${f(share)} %)` : ''}`;
    B(3, `${t.lab}: ${what}${r}.` + (h ? ' → ' + h.charAt(0).toUpperCase() + h.slice(1) + '.' : ''));
  });
  const ok = tg.filter(t => t.pct >= 80).sort((a, b) => b.pct - a.pct);
  if (ok.length && ok.length === tg.length && tg.length > 1) G(3, `Todos los objetivos en rango casi todo el tiempo (${tg.map(t => t.lab.split(' ')[0]).join(', ')}).`);
  else ok.slice(0, 2).forEach(t => G(3, `${t.lab}: en objetivo el ${f(t.pct)} % del tiempo.`));
  /* 4 · retrasos frente a la referencia */
  ch.forEach((c, i) => { const r = rc[i]; if (c.done && r && r.done && c.at != null && r.at != null && c.at - r.at >= 2) B(4, `«${c.lab}» llegó tarde: tú en el ${minTxt(c.at)}, la referencia en el ${minTxt(r.at)}.`); });
  /* lo que salió bien sin más */
  const fixed = (d.events || []).filter(e => e.fixedIn != null).sort((a, b) => a.fixedIn - b.fixedIn);
  if (fixed.length) G(4, `Resolviste «${fixed[0].lab}» en ${f(fixed[0].fixedIn, 1)} min.`);
  if (!bad.some(b => b.p === 0)) G(5, 'Sin desaturaciones, paradas provocadas ni eventos sin resolver.');
  const sort = xs => xs.sort((a, b) => a.p - b.p).map(x => x.t.replace(/(\d) (%|s\b|min\b)/g, '$1\u00a0$2').replace(/\bmin (\d)/g, 'min\u00a0$1')); // sin cortar «70 %» ni «min 3,2» al final de línea
  const bs = sort(bad), gs = sort(good);
  if (!bs.length) bs.push(d.score >= 7 ? 'Nada importante que corregir. Ponte a prueba: repite con otro paciente o en modo examen.' : `Sin un fallo concreto, pero la nota se queda en ${f(d.score, 1)}: en «Ver el informe completo» verás dónde se pierden los puntos.`);
  return { verdict, short: false, good: gs.slice(0, 3), bad: bs.slice(0, 3), more: Math.max(0, bs.length - 3) };
}
root.SIM_DBTIPS = dbTips;
})(typeof window !== 'undefined' ? window : globalThis);
