// OddSight — builder MLS (Major League Soccer)
// La MLS est une ligue en SAISON CALENDAIRE (fév.→déc.), donc résultats passés
// ET matchs à venir appartiennent à la MÊME saison. Contrairement aux ligues
// européennes (build-league.mjs : saison passée = entraînement, nouvelle saison
// = calendrier), on ne sépare pas train/à-venir : on passe toute la saison au
// moteur, qui bascule chaque match « à venir » → « joué » dès qu'un score existe.
//
// Source unique : l'API scoreboard ESPN (usa.1), via mls-source.mjs.
//
//   node scraper/build-mls.mjs
//   ODDSIGHT_TODAY=2026-07-16 node scraper/build-mls.mjs

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildModel } from './engine.mjs'
import { fetchMlsSeason } from './mls-source.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../src/data/mls.json')
const ASOF = process.env.ODDSIGHT_TODAY || new Date().toISOString().slice(0, 10)

async function main() {
  console.log(`→ Scraping ESPN usa.1 (saison MLS) …`)
  const { matches, weeks, year } = await fetchMlsSeason({ asOf: ASOF })
  if (!matches.length) throw new Error('aucun match récupéré (ESPN vide)')

  const played = matches.filter((m) => m.score).length
  console.log(`✓ ${matches.length} matchs (${played} joués · ${matches.length - played} à venir) · ${weeks} journées à venir`)

  // Saison unique : pas de trainMatches. Le moteur utilise les matchs joués de la
  // saison pour les forces, et prédit les matchs sans score. profil 'mls' (calé par
  // le tuner sur la MLS) ; format 'league' = avantage du terrain (team1 = domicile).
  const model = buildModel({ matches, elo: {}, asOf: ASOF, format: 'league', profile: 'mls', maxUpcoming: Infinity })
  console.log(`✓ ${model.counts.upcoming} pronos · track record ${model.history.summary.result.pct}% (1N2)`)

  const dataset = {
    tournament: `MLS ${year}`,
    generatedAt: new Date().toISOString(),
    asOf: ASOF,
    sources: ['ESPN scoreboard usa.1 (résultats + calendrier)', 'Elo interne'],
    ...model,
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(dataset, null, 2))
  console.log(`✓ Écrit ${OUT}`)
}

main().catch((e) => { console.error('✗ Échec :', e.message); process.exit(1) })
