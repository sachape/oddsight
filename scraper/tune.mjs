// OddSight — optimisation des hyperparamètres du modèle (log-loss walk-forward).
// Descente par coordonnées sur le holdout out-of-sample (30 % final), sur la
// saison la plus fournie (Ligue 1 2025-26). N'écrit RIEN : imprime les meilleurs
// réglages, à recopier dans TUNABLE (engine.mjs) après vérification.
//
//   npm run tune

import { backtest, TUNABLE } from './engine.mjs'

const TRAIN = 'https://raw.githubusercontent.com/openfootball/football.json/master/2025-26/fr.1.json'
const UA = 'Mozilla/5.0'
const NAME_MAP = {
  'AJ Auxerre': 'Auxerre', 'AS Monaco FC': 'Monaco', 'Angers SCO': 'Angers',
  'FC Lorient': 'Lorient', 'FC Metz': 'Metz', 'FC Nantes': 'Nantes',
  'Le Havre AC': 'Le Havre', 'Lille OSC': 'Lille', 'OGC Nice': 'Nice',
  'Olympique Lyonnais': 'Lyon', 'Olympique de Marseille': 'Marseille',
  'Paris FC': 'Paris FC', 'Paris Saint-Germain FC': 'Paris-SG',
  'RC Strasbourg Alsace': 'Strasbourg', 'Racing Club de Lens': 'Lens',
  'Stade Brestois 29': 'Brest', 'Stade Rennais FC 1901': 'Rennes', 'Toulouse FC': 'Toulouse',
}
const short = (n) => NAME_MAP[n] || n

const GRID = {
  halfLife: [10, 14, 21, 30, 45, 60],
  koBonus: [1.0, 1.15, 1.3],
  rho: [-0.12, -0.08, -0.04, -0.02, 0],
  supCoef: [0.3, 0.4, 0.45, 0.55, 0.65, 0.75],
  blendK: [1.5, 3, 5, 8, 12],
  homeF: [1.05, 1.1, 1.12, 1.16, 1.2],
  awayF: [0.85, 0.9, 0.95, 1.0],
  momentumW: [0, 0.03, 0.05, 0.08],
  clutchW: [0, 0.04, 0.08],
}

// On optimise le log-loss OUT-OF-SAMPLE (30 % final) — pas l'in-sample (sur-appr.).
function score(matches, params) {
  Object.assign(TUNABLE, params)
  const h = backtest({ matches, elo: {}, format: 'league' })
  return h.summary.metrics.holdout?.raw?.logLoss ?? h.summary.metrics.model.logLoss
}

async function main() {
  console.log('→ Chargement Ligue 1 2025-26 (openfootball)…')
  const tr = await (await fetch(TRAIN, { headers: { 'User-Agent': UA } })).json()
  const matches = (tr.matches || []).map((m) => ({ ...m, team1: short(m.team1), team2: short(m.team2) }))
  const played = matches.filter((m) => m.score?.ft)
  console.log(`✓ ${played.length} matchs joués`)

  const DEFAULTS = { ...TUNABLE }
  const baseLL = score(matches, DEFAULTS)
  console.log(`\nlog-loss OOS de départ (réglage actuel) : ${baseLL}`)

  const best = { ...DEFAULTS }
  let bestLL = baseLL
  // Descente par coordonnées, 3 passes
  for (let pass = 0; pass < 3; pass++) {
    let improved = false
    for (const [k, vals] of Object.entries(GRID)) {
      let bv = best[k], bl = bestLL
      for (const v of vals) {
        const ll = score(matches, { ...best, [k]: v })
        if (ll < bl - 1e-6) { bl = ll; bv = v; improved = true }
      }
      best[k] = bv; bestLL = bl
    }
    if (!improved) break
  }

  const gain = ((baseLL - bestLL) / baseLL) * 100
  console.log(`\nmeilleur log-loss OOS : ${bestLL}  (amélioration ${gain.toFixed(1)} %)`)
  console.log('\nRéglages proposés (à recopier dans TUNABLE si validé) :')
  console.log(JSON.stringify(best, null, 2))
  console.log('\n(Changements vs actuel)')
  for (const k of Object.keys(best)) {
    if (best[k] !== DEFAULTS[k]) console.log(`  ${k}: ${DEFAULTS[k]} -> ${best[k]}`)
  }
}

main().catch((e) => { console.error('✗ Échec :', e.message); process.exit(1) })
