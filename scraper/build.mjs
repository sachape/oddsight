// OddSight — pipeline de données (multi-facteurs)
// Récupère openfootball (résultats CM 2026) + eloratings (Elo mondial réel),
// fait tourner le moteur de prédiction, écrit src/data/dataset.json.
//
// Lancer :  npm run scrape
//           ODDSIGHT_TODAY=2026-07-05 npm run scrape   (changer la date de référence)

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchMatches, fetchElo, loadAvailability } from './sources.mjs'
import { fetchInjuries } from './injuries.mjs'
import { fetchEspnResults } from './espn.mjs'
import { buildModel } from './engine.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../src/data/dataset.json')
// Date de référence = aujourd'hui par défaut (avance toute seule à chaque scrape)
const ASOF = process.env.ODDSIGHT_TODAY || new Date().toISOString().slice(0, 10)

// Résultats live ESPN (fifa.world) en complément d'openfootball (souvent en retard).
// Noms ESPN -> noms du dataset CM ; le reste est identique.
const ESPN_MAP = {
  'Congo DR': 'DR Congo', 'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
  'Czechia': 'Czech Republic', 'Türkiye': 'Turkey', 'United States': 'USA',
}
const espnName = (n) => ESPN_MAP[n] || n
const hasScore = (m) => m.score && Array.isArray(m.score.ft)

// Injecte les scores ESPN sur les matchs encore sans score. Matchs à terrain
// neutre -> appariement par PAIRE non ordonnée + réorientation du score.
async function injectEspnResults(matches, asOf) {
  let results
  try {
    results = await fetchEspnResults({ league: 'fifa.world', from: '2026-06-01', to: asOf })
  } catch (e) {
    console.warn(`  ⚠ ESPN indisponible (${e.message}) — résultats live CM ignorés`)
    return 0
  }
  const idx = new Map()
  for (const r of results) {
    const h = espnName(r.home), a = espnName(r.away)
    const key = [h, a].sort().join('|')
    if (!idx.has(key)) idx.set(key, [])
    idx.get(key).push({ h, ft: r.ft, date: r.date })
  }
  let injected = 0
  for (const m of matches) {
    if (hasScore(m)) continue
    const cands = idx.get([m.team1, m.team2].sort().join('|'))
    if (!cands?.length) continue
    const r = cands.find((c) => c.date === m.date) || cands[0]
    m.score = { ft: r.h === m.team1 ? r.ft : [r.ft[1], r.ft[0]] }
    injected++
  }
  return injected
}

async function main() {
  console.log('→ Scraping openfootball + eloratings.net …')
  const [{ name, matches }, eloRes] = await Promise.all([fetchMatches(), fetchElo()])
  const { elo, source: eloSource } = eloRes

  // Blessures/suspensions : API-Football si clé présente, sinon fichier local
  let availability
  let availSource
  try {
    const live = await fetchInjuries({ asOf: ASOF })
    if (live) { availability = live; availSource = 'API-Football (live)' }
  } catch (e) {
    console.warn(`⚠ API-Football indisponible (${e.message}) — repli sur availability.json`)
  }
  if (!availability) { availability = loadAvailability(); availSource = 'availability.json' }
  const nAbsents = Object.values(availability).reduce((s, a) => s + a.length, 0)
  console.log(`✓ ${matches.length} matchs · Elo ${Object.keys(elo).length} équipes [${eloSource}] · ${nAbsents} absents [${availSource}]`)

  const injected = await injectEspnResults(matches, ASOF)
  console.log(`✓ ${injected} résultats ESPN injectés (en complément d'openfootball)`)

  const model = buildModel({ matches, elo, availability, asOf: ASOF })
  console.log(
    `✓ Stats sur ${model.counts.played} matchs joués — moyenne ${model.leagueAvg} but/équipe/match`,
  )
  console.log(`✓ ${model.counts.upcoming} pronostics multi-facteurs générés`)

  const dataset = {
    tournament: name || 'World Cup 2026',
    generatedAt: new Date().toISOString(),
    asOf: ASOF,
    sources: ['openfootball/worldcup.json', 'ESPN (résultats live)', eloSource],
    eloSource,
    ...model,
  }

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(dataset, null, 2))
  console.log(`✓ Écrit ${OUT}`)
}

main().catch((e) => {
  console.error('✗ Échec du pipeline :', e.message)
  process.exit(1)
})
