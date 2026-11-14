/* Validador de casos (v1.2): un «bot» juega cada caso con su solución de referencia (src/solutions.js) y otra vez sin hacer nada.
   Un caso es válido si con la solución saca ≥ 7 y sin hacer nada ≤ 5, con la misma nota que el examen (objetivos, acciones clave y parada).
   Uso: node tests/validar.js [caso…] [--variantes N] [--detalle]   (sin casos: todos) */
const H = require('./harness');
const { CASES, load, run } = H;
require('../src/drugs.js'); require('../src/solutions.js'); require('../src/bot.js');
const DR = global.SIM_DRUGS, SOL = global.SIM_SOL;
const { make, runner, val, RND } = global.SIM_BOT;

/* una partida del bot (el mismo de src/bot.js que usa el debrief comparado del navegador) */
function play(key, { seed = 1, idle = false } = {}) {
  const c = CASES[key], sol = SOL[c.vbase || key] || { s: [] }, L = load(key, { scale: 10, seed }), T = c.duration || 20;
  const B = make({ sim: L.sim, S: L.S, sched: L.sched, c, key, sol, DR, peso: L.peso, idle });
  const dbg = process.env.VDBG === key && !idle && seed === 8, S = L.S;
  const run = runner(L, B, c.targets || {}, M => { if (dbg && Math.abs(S.clin % 1) < .13) console.log(`  ${S.clin.toFixed(1)} sp ${(S.spo2 * 100).toFixed(0)} et ${(M.et || 0).toFixed(0)} pa ${S.pco2.toFixed(0)} fr ${S.cfg.fr} vt ${S.cfg.vt} peep ${S.cfg.peep} fio2 ${S.cfg.fio2} tas ${S.tas.toFixed(0)} rr ${(M.effRR || 0).toFixed(0)} if ${S.iface}${S.standby ? '(espera)' : ''} o2 ${S.cfg.o2dev}`); });
  run.advance(T);
  return B.finish(run.SV, run.R, T);
}
/* valida una lista de casos: media de la solución en varias semillas y una partida sin hacer nada */
function validate(keys, { seeds = 3 } = {}) {
  return keys.map(k => {
    const ns = CASES[k].arrest ? seeds + 5 : seeds, sols = []; for (let s = 1; s <= ns; s++) sols.push(play(k, { seed: s * 7 + 1 }));
    const sol = sols.reduce((a, r) => a + r.score, 0) / sols.length, idle = play(k, { seed: 3, idle: true });
    /* en la parada la RCE es probabilística: basta con hacer lo que toca (≥ 80 % de las acciones clave) y recuperar en ≥ 40 % de las partidas */
    const rosc = sols.filter(r => r.rosc).length / sols.length, chk = sols.reduce((a, r) => a + r.chkFrac, 0) / sols.length;
    const solOk = sol >= 7 || (CASES[k].arrest && chk >= .8 && rosc >= .4);
    const tgt = {}; for (const r of sols) for (const [x, v] of Object.entries(r.tgt)) tgt[x] = (tgt[x] || 0) + v / sols.length;
    return { k, sol, idle: idle.score, ok: solOk && idle.score <= 5, rosc, tgt, idleTgt: idle.tgt, missing: [...new Set(sols.flatMap(r => r.missing))], parts: sols[0].parts, idleParts: idle.parts, notes: [...new Set(sols.flatMap(r => r.notes))], nan: sols.some(r => r.nan) || idle.nan };
  });
}
module.exports = { play, validate, val };

if (require.main === module) {
  const args = process.argv.slice(2), nv = args.includes('--variantes') ? +args[args.indexOf('--variantes') + 1] || 3 : 0, det = args.includes('--detalle');
  const keys = args.filter(a => CASES[a]).length ? args.filter(a => CASES[a]) : Object.keys(CASES).filter(k => k !== 'libre' && CASES[k].pheno);
  const res = validate(keys);
  const f = x => x == null ? '  – ' : x.toFixed(1).padStart(4);
  for (const r of res) console.log(`${r.ok ? 'ok   ' : 'FALLA'} ${r.k.padEnd(14)} solución ${f(r.sol)} · sin hacer nada ${f(r.idle)}${r.missing.length ? ' · falta: ' + r.missing.join(', ') : ''}${det ? ' · ' + Object.entries(r.tgt).map(([x, v]) => x + ' ' + Math.round(v * 100) + '%').join(' ') + (CASES[r.k].arrest ? ' RCE ' + Math.round(r.rosc * 100) + '%' : '') + ' | nada: ' + Object.entries(r.idleTgt).map(([x, v]) => x + ' ' + Math.round(v * 100) + '%').join(' ') : ''}${r.notes.length && det ? ' · ' + r.notes.join('; ') : ''}`);
  console.log(`\n${res.filter(r => r.ok).length} de ${res.length} casos válidos`);
  if (nv) { require('../src/variants.js'); const V = global.SIM_VARIANT; let ok = 0, n = 0; const bad = [];
    for (const k of keys) for (let s = 1; s <= nv; s++) { const v = V.make(k, s * 9973 + 5); CASES.v_val = v; const sc = play('v_val', { seed: s }).score; n++; if (sc >= 7) ok++; else bad.push(`${k}/${v.vcode} ${sc.toFixed(1)}${v.vev ? ' +' + v.vev : ''}${v.vcause ? ' causa ' + v.vcause : ''}${v.access === false && CASES[k].access !== false ? ' sin vía' : ''}`); }
    delete CASES.v_val; console.log(`Variantes resueltas con la solución del original: ${ok} de ${n}`); bad.slice(0, 40).forEach(x => console.log('   ', x)); }
}
