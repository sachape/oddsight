// OddSight — backtest TENNIS : l'Elo par surface vaut-il mieux que l'Elo général ?
//
//   npm run backtest:tennis
//
// Contexte : le pipeline tennis utilise l'Elo de la SURFACE du tournoi. Ce choix n'avait
// jamais été mesuré (il corrigeait surtout un bug : l'Elo gazon était appliqué à tous les
// tournois, y compris sur terre battue). Et une mesure antérieure suggérait l'inverse.
// Ce script tranche.
//
// Données : tennis-data.co.uk (ATP + WTA, résultats + surface + cotes de clôture).
// Elo reconstruit CHRONOLOGIQUEMENT, donc point-in-time : chaque match est prédit avec les
// ratings d'avant le match, jamais avec l'état final. C'est la même exigence que côté foot
// (cf. elo-timeline.mjs) — sans elle, tout ce qui s'appuie sur l'Elo paraît meilleur qu'il ne l'est.
//
// Modèles comparés (log-loss, plus bas = mieux) :
//   · Elo général            · Elo de la surface (pur)
//   · Elo mixte (w·surface + (1−w)·général, w calé sur le TRAIN)
//   · Points de classement   (le repli actuel du pipeline : p = pts^0.8 normalisé)
//   · Marché                 (cotes de clôture moyennes, dé-marginées) — le juge de paix

import { readXlsx } from './xlsx.mjs'
import { pairedBootstrap } from './metrics.mjs'

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026]
const EVAL_FROM = '2025-01-01' // les années antérieures servent à chauffer les ratings
const EXP = 0.8 // exposant du modèle « points de classement » (celui du pipeline)
const SURFACES = ['Hard', 'Clay', 'Grass']

const url = (y, tour) => `http://www.tennis-data.co.uk/${y}${tour === 'wta' ? 'w' : ''}/${y}.xlsx`

async function load() {
  const all = []
  for (const tour of ['atp', 'wta']) {
    for (const y of YEARS) {
      try {
        const res = await fetch(url(y, tour))
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const rows = readXlsx(Buffer.from(await res.arrayBuffer()), { dateCols: ['Date'] })
        for (const r of rows) {
          // On écarte abandons et forfaits : le résultat ne reflète pas le rapport de force.
          if (r.Comment !== 'Completed') continue
          if (!SURFACES.includes(r.Surface)) continue
          if (!r.Winner || !r.Loser || !r.Date) continue
          all.push({
            tour, date: r.Date, surface: r.Surface,
            w: `${tour}:${r.Winner}`, l: `${tour}:${r.Loser}`,
            wPts: +r.WPts || null, lPts: +r.LPts || null,
            oddsW: +r.AvgW || +r.PSW || +r.B365W || null,
            oddsL: +r.AvgL || +r.PSL || +r.B365L || null,
          })
        }
        console.log(`  ✓ ${tour.toUpperCase()} ${y} : ${rows.length} lignes`)
      } catch (e) {
        console.warn(`  ⚠ ${tour.toUpperCase()} ${y} indisponible (${e.message})`)
      }
    }
  }
  all.sort((a, b) => a.date.localeCompare(b.date))
  return all
}

// --- Elo tennis --------------------------------------------------------------
// K décroissant avec l'expérience (formule de Sackmann/538) : un joueur nouveau bouge
// vite, un joueur établi lentement. Sans ça, les ratings oscillent sur les habitués.
const kOf = (n) => 250 / Math.pow(n + 5, 0.4)
const expected = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400))

function newState() {
  return {
    g: new Map(), gN: new Map(),                    // Elo général + nb de matchs
    s: Object.fromEntries(SURFACES.map((x) => [x, new Map()])), // Elo par surface
    sN: Object.fromEntries(SURFACES.map((x) => [x, new Map()])),
  }
}
const get = (m, k) => m.get(k) ?? 1500
const cnt = (m, k) => m.get(k) ?? 0

function update(st, m) {
  // Général
  const ra = get(st.g, m.w), rb = get(st.g, m.l)
  const ea = expected(ra, rb)
  st.g.set(m.w, ra + kOf(cnt(st.gN, m.w)) * (1 - ea))
  st.g.set(m.l, rb - kOf(cnt(st.gN, m.l)) * (1 - ea))
  st.gN.set(m.w, cnt(st.gN, m.w) + 1)
  st.gN.set(m.l, cnt(st.gN, m.l) + 1)
  // Surface
  const S = st.s[m.surface], N = st.sN[m.surface]
  const sa = get(S, m.w), sb = get(S, m.l)
  const es = expected(sa, sb)
  S.set(m.w, sa + kOf(cnt(N, m.w)) * (1 - es))
  S.set(m.l, sb - kOf(cnt(N, m.l)) * (1 - es))
  N.set(m.w, cnt(N, m.w) + 1)
  N.set(m.l, cnt(N, m.l) + 1)
}

// --- Modèles ------------------------------------------------------------------
const clip = (p) => Math.max(0.001, Math.min(0.999, p))

// p(le vainqueur réel gagne) selon chaque modèle, AVANT le match
function predictors(st, m) {
  const gw = get(st.g, m.w), gl = get(st.g, m.l)
  const S = st.s[m.surface]
  const sw = get(S, m.w), sl = get(S, m.l)

  const out = {
    general: expected(gw, gl),
    surface: expected(sw, sl),
  }
  // Mixte : on mélange les RATINGS (pas les probas) — c'est le rating qui est bruité.
  for (const w of [0.25, 0.5, 0.75]) {
    out[`mix${w * 100}`] = expected(w * sw + (1 - w) * gw, w * sl + (1 - w) * gl)
  }
  // Points de classement : le repli actuel du pipeline
  if (m.wPts > 0 && m.lPts > 0) {
    const a = Math.pow(m.wPts, EXP), b = Math.pow(m.lPts, EXP)
    out.points = a / (a + b)
  }
  // Marché : cotes dé-marginées
  if (m.oddsW > 1 && m.oddsL > 1) {
    const s = 1 / m.oddsW + 1 / m.oddsL
    out.market = 1 / m.oddsW / s
  }
  return out
}

async function main() {
  console.log('→ Chargement tennis-data.co.uk (ATP + WTA)…')
  const matches = await load()
  console.log(`\n✓ ${matches.length} matchs complets, ${matches[0].date} → ${matches.at(-1).date}\n`)

  const st = newState()
  const rows = {} // modèle -> [{ probs:[p, 1-p], actualIdx:0 }]  (idx 0 = le vainqueur réel)
  const push = (k, p) => (rows[k] ??= []).push({ probs: [clip(p), 1 - clip(p)], actualIdx: 0 })

  let evaluated = 0
  for (const m of matches) {
    if (m.date >= EVAL_FROM) {
      const p = predictors(st, m)
      // On n'évalue que les matchs où TOUS les modèles peuvent se prononcer :
      // comparer sur des sous-ensembles différents ne voudrait rien dire.
      if (p.points != null && p.market != null) {
        for (const [k, v] of Object.entries(p)) push(k, v)
        evaluated++
      }
    }
    update(st, m) // le rating n'intègre le match qu'APRÈS la prédiction
  }

  const ll = (rs) => rs.reduce((s, r) => s - Math.log(r.probs[0]), 0) / rs.length
  const acc = (rs) => (rs.filter((r) => r.probs[0] > 0.5).length / rs.length) * 100
  const r3 = (x) => Math.round(x * 1000) / 1000

  const LABEL = {
    market: 'Marché (cotes de clôture)', general: 'Elo général',
    surface: 'Elo de la surface (pur)', mix25: 'Mixte 25 % surface',
    mix50: 'Mixte 50 % surface', mix75: 'Mixte 75 % surface',
    points: 'Points de classement (repli actuel)',
  }
  const order = Object.keys(rows).sort((a, b) => ll(rows[a]) - ll(rows[b]))

  console.log(`── Résultats sur ${evaluated} matchs (${EVAL_FROM} →), ratings point-in-time ──\n`)
  console.log('  ' + 'modèle'.padEnd(36) + 'log-loss   % justes')
  for (const k of order) {
    console.log('  ' + (LABEL[k] || k).padEnd(36) + String(r3(ll(rows[k]))).padEnd(11) + acc(rows[k]).toFixed(1) + ' %')
  }

  console.log('\n── La surface apporte-t-elle quelque chose ? (bootstrap apparié, IC 95 %) ──\n')
  const VERDICT = { better: 'MIEUX que l\'Elo général', worse: 'MOINS BIEN que l\'Elo général', tie: 'indistinguable de l\'Elo général' }
  for (const k of ['surface', 'mix25', 'mix50', 'mix75']) {
    if (!rows[k]) continue
    const b = pairedBootstrap(rows[k], rows.general)
    console.log(`  ${(LABEL[k] || k).padEnd(28)} écart ${String(r3(b.diff)).padStart(7)}  IC [${r3(b.lo)}, ${r3(b.hi)}]  → ${VERDICT[b.verdict]}`)
  }
  // Le marché est le juge de paix : on lui oppose notre MEILLEUR modèle (lui exclu).
  const bestOwn = order.find((k) => k !== 'market')
  const vm = pairedBootstrap(rows[bestOwn], rows.market)
  console.log(`\n  meilleur modèle à nous (${LABEL[bestOwn]}) vs MARCHÉ : écart ${r3(vm.diff)}  IC [${r3(vm.lo)}, ${r3(vm.hi)}]  → ${
    vm.verdict === 'worse' ? 'le marché reste devant' : vm.verdict === 'better' ? 'on bat le marché' : 'jeu égal avec le marché'}`)
}

main().catch((e) => { console.error('✗ Échec :', e.message); process.exit(1) })
