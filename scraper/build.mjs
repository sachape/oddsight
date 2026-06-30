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
import { buildModel } from './engine.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../src/data/dataset.json')
// Date de référence = aujourd'hui par défaut (avance toute seule à chaque scrape)
const ASOF = process.env.ODDSIGHT_TODAY || new Date().toISOString().slice(0, 10)

async function main() {
  console.log('→ Scraping openfootball + eloratings.net …')
  const [{ name, matches }, elo] = await Promise.all([fetchMatches(), fetchElo()])

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
  console.log(`✓ ${matches.length} matchs · Elo ${Object.keys(elo).length} équipes · ${nAbsents} absents [${availSource}]`)

  const model = buildModel({ matches, elo, availability, asOf: ASOF })
  console.log(
    `✓ Stats sur ${model.counts.played} matchs joués — moyenne ${model.leagueAvg} but/équipe/match`,
  )
  console.log(`✓ ${model.counts.upcoming} pronostics multi-facteurs générés`)

  const dataset = {
    tournament: name || 'World Cup 2026',
    generatedAt: new Date().toISOString(),
    asOf: ASOF,
    sources: ['openfootball/worldcup.json', 'eloratings.net'],
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
