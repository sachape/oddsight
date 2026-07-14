// OddSight — optimisation des hyperparamètres (log-loss walk-forward, out-of-sample).
// Descente par coordonnées sur le holdout OOS (30 % final). N'écrit RIEN : imprime les
// meilleurs réglages, à recopier dans PROFILES (engine.mjs) après vérification.
//
//   npm run tune        → profil `league` (Ligue 1 2025-26)
//   npm run tune:cup    → profil `cup`    (Coupe du Monde 2026)
//
// IMPORTANT — le backtest utilisé ici est celui d'engine.mjs, désormais SANS lookahead
// (Elo point-in-time). Les réglages « validés » avant ce correctif l'avaient été sur un
// backtest qui connaissait déjà les résultats : ils ne valaient rien.
//
// Le tuner affiche aussi un intervalle de confiance (bootstrap apparié) sur l'écart
// avec la baseline Elo. Avec ~100 matchs, un gain de 0,01 de log-loss n'est pas
// distinguable du bruit — mieux vaut le savoir avant de « valider » un réglage.

import { backtest, TUNABLE, PROFILES } from './engine.mjs'
import { buildEloTimeline } from './elo-timeline.mjs'
import { fetchMatches, fetchElo } from './sources.mjs'
import { injectEspnResults } from './espn.mjs'

const UA = 'Mozilla/5.0'
const L1 = 'https://raw.githubusercontent.com/openfootball/football.json/master/2025-26/fr.1.json'
const NAME_MAP = {
  'AJ Auxerre': 'Auxerre', 'AS Monaco FC': 'Monaco', 'Angers SCO': 'Angers',
  'FC Lorient': 'Lorient', 'FC Metz': 'Metz', 'FC Nantes': 'Nantes',
  'Le Havre AC': 'Le Havre', 'Lille OSC': 'Lille', 'OGC Nice': 'Nice',
  'Olympique Lyonnais': 'Lyon', 'Olympique de Marseille': 'Marseille',
  'Paris FC': 'Paris FC', 'Paris Saint-Germain FC': 'Paris-SG',
  'RC Strasbourg Alsace': 'Strasbourg', 'Racing Club de Lens': 'Lens',
  'Stade Brestois 29': 'Brest', 'Stade Rennais FC 1901': 'Rennes', 'Toulouse FC': 'Toulouse',
}
const HOSTS = new Set(['United States', 'USA', 'Canada', 'Mexico'])

// blendK monte jusqu'à 30 : c'est la valeur en place, il faut que la grille puisse
// la remettre en cause (et la conserver si elle gagne honnêtement).
const GRID = {
  halfLife: [10, 14, 21, 30, 45, 60],
  koBonus: [1.0, 1.15, 1.3],
  rho: [-0.12, -0.08, -0.05, -0.04, -0.02, 0],
  supCoef: [0.3, 0.4, 0.45, 0.55, 0.65, 0.75],
  blendK: [1.5, 3, 5, 8, 12, 20, 30, 50],
  homeF: [1.05, 1.1, 1.12, 1.16, 1.2],
  awayF: [0.85, 0.9, 0.95, 1.0],
  momentumW: [0, 0.03, 0.05, 0.08],
  clutchW: [0, 0.04, 0.08],
}

// --- Chargement des deux cibles ---------------------------------------------

async function loadLeague() {
  const tr = await (await fetch(L1, { headers: { 'User-Agent': UA } })).json()
  const short = (n) => NAME_MAP[n] || n
  const matches = (tr.matches || []).map((m) => ({ ...m, team1: short(m.team1), team2: short(m.team2) }))
  return { matches, elo: {}, eloAt: null, format: 'league', label: 'Ligue 1 2025-26' }
}

async function loadCup() {
  const [{ matches }, { elo }] = await Promise.all([fetchMatches(), fetchElo()])
  await injectEspnResults(matches, new Date().toISOString().slice(0, 10))
  // Elo point-in-time : sans ça, le tuner « validerait » les réglages qui s'appuient
  // le plus sur un Elo qui connaît déjà les résultats — c'est exactement le piège
  // dans lequel le profil cup précédent était tombé.
  const eloAt = buildEloTimeline(matches, elo, HOSTS)
  return { matches, elo, eloAt, format: 'cup', label: 'Coupe du Monde 2026' }
}

// --- Scoring ------------------------------------------------------------------

const run = (t, params) => {
  Object.assign(TUNABLE, params)
  return backtest({ matches: t.matches, elo: t.elo, eloAt: t.eloAt, format: t.format })
}
// Objectif : log-loss OUT-OF-SAMPLE (30 % final), pas l'in-sample.
const score = (t, params) => {
  const h = run(t, params)
  return h.summary.metrics.holdout?.raw?.logLoss ?? h.summary.metrics.model.logLoss
}

// Bootstrap apparié : l'écart de log-loss modèle − Elo est-il réel, ou du bruit ?
// On rééchantillonne les MÊMES matchs pour les deux (apparié) : ça isole l'écart.
function bootstrapDiff(modelLL, eloLL, iters = 4000) {
  const n = modelLL.length
  const diffs = []
  for (let b = 0; b < iters; b++) {
    let s = 0
    for (let i = 0; i < n; i++) {
      const j = (Math.random() * n) | 0
      s += modelLL[j] - eloLL[j]
    }
    diffs.push(s / n)
  }
  diffs.sort((a, b) => a - b)
  return { lo: diffs[Math.floor(iters * 0.025)], hi: diffs[Math.floor(iters * 0.975)] }
}

const r3 = (x) => Math.round(x * 1000) / 1000

async function main() {
  const target = process.argv[2] === 'cup' ? 'cup' : 'league'
  console.log(`→ Cible : profil ${target}\n`)
  const t = target === 'cup' ? await loadCup() : await loadLeague()
  const played = t.matches.filter((m) => m.score?.ft).length
  console.log(`✓ ${t.label} — ${played} matchs joués\n`)

  const DEFAULTS = { ...PROFILES[target] }
  const base = run(t, DEFAULTS)
  const baseLL = score(t, DEFAULTS)
  const m = base.summary.metrics

  console.log('── Réglage ACTUEL ──')
  console.log(`  log-loss walk-forward : ${m.model.logLoss}   (baseline Elo : ${m.baselineElo.logLoss})`)
  console.log(`  log-loss OOS (30 % final) : ${baseLL}`)

  // Le modèle bat-il vraiment l'Elo, ou est-ce du bruit ?
  const ll = (rows) => rows.map((r) => -Math.log(Math.max(1e-15, r.probs[r.actualIdx])))
  const mLL = ll(base.rows?.model ?? []), eLL = ll(base.rows?.elo ?? [])
  if (mLL.length) {
    const d = (mLL.reduce((a, b) => a + b, 0) - eLL.reduce((a, b) => a + b, 0)) / mLL.length
    const ci = bootstrapDiff(mLL, eLL)
    const verdict = ci.hi < 0 ? 'le modèle bat l\'Elo' : ci.lo > 0 ? 'le modèle est PIRE que l\'Elo' : 'INDISTINGUABLE du bruit'
    console.log(`\n  écart modèle − Elo : ${r3(d)}  (IC 95 % : ${r3(ci.lo)} … ${r3(ci.hi)})`)
    console.log(`  → ${verdict}`)
  }

  console.log('\n── Recherche (descente par coordonnées, 3 passes) ──')
  const best = { ...DEFAULTS }
  let bestLL = baseLL
  for (let pass = 0; pass < 3; pass++) {
    let improved = false
    for (const [k, vals] of Object.entries(GRID)) {
      let bv = best[k], bl = bestLL
      for (const v of vals) {
        const s = score(t, { ...best, [k]: v })
        if (s < bl - 1e-6) { bl = s; bv = v; improved = true }
      }
      best[k] = bv; bestLL = bl
    }
    if (!improved) break
  }

  const gain = ((baseLL - bestLL) / baseLL) * 100
  console.log(`\n  meilleur log-loss OOS : ${r3(bestLL)}  (${gain >= 0 ? '−' : '+'}${Math.abs(gain).toFixed(1)} % vs actuel)`)
  const changed = Object.keys(best).filter((k) => best[k] !== DEFAULTS[k])
  if (!changed.length) {
    console.log('  → aucun réglage ne fait mieux : le profil actuel est déjà le meilleur de la grille.')
    return
  }
  console.log('\n  Changements proposés :')
  for (const k of changed) console.log(`    ${k}: ${DEFAULTS[k]} → ${best[k]}`)

  // Contre-épreuve : le gain OOS tient-il sur le walk-forward complet ?
  const after = run(t, best)
  console.log(`\n  contrôle walk-forward complet : ${after.summary.metrics.model.logLoss} (avant : ${m.model.logLoss})`)
  console.log(`\n  ⚠ ${played} matchs seulement : un gain < 0,02 de log-loss n'est pas distinguable du bruit.`)
  console.log('    Ne recopier dans PROFILES que si le gain est net ET cohérent avec le contrôle ci-dessus.')
}

main().catch((e) => { console.error('✗ Échec :', e.message); process.exit(1) })
