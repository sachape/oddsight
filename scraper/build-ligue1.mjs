// OddSight — pipeline Ligue 1 (nouvelle saison, calendrier complet)
// Entraîne sur la saison passée (2025-26, openfootball) et prédit TOUTES les affiches
// 2026-27 récupérées depuis L'Équipe (une page par journée, slug = domicile-extérieur).
//
//   npm run scrape:ligue1

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildModel } from './engine.mjs'
import { fetchEspnResults } from './espn.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../src/data/ligue1.json')
// Date de référence = aujourd'hui (avance seule) ; surchargée par ODDSIGHT_TODAY.
const ASOF = process.env.ODDSIGHT_TODAY || new Date().toISOString().slice(0, 10)
// Source de résultats live : ESPN (fra.1). Noms ESPN -> noms courts du dataset.
const ESPN_LEAGUE = 'fra.1'
const SEASON_START = '2026-08-01'
const ESPN_MAP = {
  'AJ Auxerre': 'Auxerre', 'AS Monaco': 'Monaco', 'Angers': 'Angers', 'Brest': 'Brest',
  'Le Havre AC': 'Le Havre', 'Le Mans': 'Le Mans', 'Lens': 'Lens', 'Lille': 'Lille',
  'Lorient': 'Lorient', 'Lyon': 'Lyon', 'Marseille': 'Marseille', 'Nice': 'Nice',
  'Paris FC': 'Paris FC', 'Paris Saint-Germain': 'Paris-SG', 'Stade Rennais': 'Rennes',
  'Strasbourg': 'Strasbourg', 'Toulouse': 'Toulouse', 'Troyes': 'Troyes',
}
const espnShort = (n) => ESPN_MAP[n] || n

// Attache les scores ESPN terminés aux affiches correspondantes (par paire dom-ext).
// Le moteur bascule alors ces matchs de « à venir » vers « joué » automatiquement.
async function injectEspnResults(fixtures, asOf) {
  let results
  try {
    results = await fetchEspnResults({ league: ESPN_LEAGUE, from: SEASON_START, to: asOf })
  } catch (e) {
    console.warn(`  ⚠ ESPN indisponible (${e.message}) — résultats live ignorés`)
    return 0
  }
  const byPair = new Map()
  for (const r of results) byPair.set(`${espnShort(r.home)}|${espnShort(r.away)}`, r)
  let injected = 0
  let unmatched = 0
  for (const f of fixtures) {
    const r = byPair.get(`${f.team1}|${f.team2}`)
    if (r) { f.score = { ft: r.ft }; injected++; byPair.delete(`${f.team1}|${f.team2}`) }
  }
  unmatched = byPair.size
  if (unmatched) console.warn(`  ⚠ ${unmatched} résultats ESPN sans affiche correspondante (noms à mapper ?)`)
  return injected
}
const TRAIN = 'https://raw.githubusercontent.com/openfootball/football.json/master/2025-26/fr.1.json'
const BASE = 'https://www.lequipe.fr/Football/ligue-1/page-calendrier-resultats'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36'

// Noms openfootball (entraînement) -> noms courts
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

// Slug L'Équipe -> nom court (avec alias OM, PSG, etc.)
const SLUG = {
  angers: 'Angers', sco: 'Angers', auxerre: 'Auxerre', aja: 'Auxerre',
  brest: 'Brest', sb29: 'Brest', 'le-havre': 'Le Havre', hac: 'Le Havre',
  'le-mans': 'Le Mans', lens: 'Lens', rcl: 'Lens', lille: 'Lille', losc: 'Lille',
  lorient: 'Lorient', fcl: 'Lorient', lyon: 'Lyon', ol: 'Lyon',
  marseille: 'Marseille', om: 'Marseille', monaco: 'Monaco', asm: 'Monaco',
  nice: 'Nice', ogcn: 'Nice', 'paris-fc': 'Paris FC', 'paris-sg': 'Paris-SG', psg: 'Paris-SG',
  rennes: 'Rennes', srfc: 'Rennes', strasbourg: 'Strasbourg', rcsa: 'Strasbourg',
  toulouse: 'Toulouse', tfc: 'Toulouse', troyes: 'Troyes', estac: 'Troyes',
}
const MONTHS = { janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12 }
const MONTH_ABBR = { janv: 1, 'févr': 2, fév: 2, mars: 3, avr: 4, mai: 5, juin: 6, juil: 7, août: 8, sept: 9, oct: 10, nov: 11, 'déc': 12 }
const J1_DATE = '2026-08-22'

// Date de repli monotone (1 journée ≈ 1 semaine) pour garantir l'ordre
function approxDate(n) {
  const d = new Date(J1_DATE + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + (n - 1) * 7)
  return d.toISOString().slice(0, 10)
}

function splitSlug(slug) {
  for (const home of Object.keys(SLUG)) {
    if (slug.startsWith(home + '-')) {
      const away = slug.slice(home.length + 1)
      if (SLUG[away]) return [SLUG[home], SLUG[away]]
    }
  }
  return null
}

function parseJournee(html, n) {
  const slugs = [...html.matchAll(/match-direct\/ligue-1\/2026-2027\/([a-z0-9-]+)-preview/g)].map((m) => m[1])
  const seen = new Set()
  const matchups = []
  for (const s of slugs) {
    if (seen.has(s)) continue
    seen.add(s)
    const r = splitSlug(s)
    if (r) matchups.push(r)
  }
  // Date de la journée : 1er en-tête de date (mois complet ou abrégé)
  const text = html.replace(/<[^>]+>/g, ' ')
  const dm = text.match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|janv|févr|fév|avr|juil|sept|oct|nov|déc)/i)
  let date = null
  if (dm) {
    const tok = dm[2].toLowerCase()
    const mo = MONTHS[tok] || MONTH_ABBR[tok]
    if (mo) {
      const day = +dm[1], year = mo >= 7 ? 2026 : 2027
      date = `${year}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return { matchups, date }
}

async function fetchJournee(n) {
  const url = n === 1 ? BASE : `${BASE}/${n}e-journee`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  return parseJournee(await res.text(), n)
}

async function main() {
  console.log('→ Entraînement', TRAIN)
  const tr = await (await fetch(TRAIN, { headers: { 'User-Agent': UA } })).json()
  const trainMatches = (tr.matches || []).map((m) => ({ ...m, team1: short(m.team1), team2: short(m.team2) }))
  console.log(`✓ ${trainMatches.length} matchs d'entraînement`)

  console.log('→ Calendrier L\'Équipe (34 journées)…')
  const fixtures = []
  let ok = 0
  for (let n = 1; n <= 34; n++) {
    const j = await fetchJournee(n)
    if (j && j.matchups.length === 9) {
      ok++
      for (const [team1, team2] of j.matchups) {
        fixtures.push({ round: `Journée ${n}`, journee: n, date: j.date || approxDate(n), team1, team2 })
      }
    } else {
      console.warn(`  ⚠ J${n} : ${j ? j.matchups.length : 'KO'} matchs (ignorée)`)
    }
  }
  console.log(`✓ ${ok} journées complètes · ${fixtures.length} affiches`)

  console.log(`→ Résultats live ESPN (${ESPN_LEAGUE}) depuis ${SEASON_START}…`)
  const injected = await injectEspnResults(fixtures, ASOF)
  console.log(`✓ ${injected} résultats réels injectés (matchs joués)`)

  const model = buildModel({
    matches: fixtures, trainMatches, elo: {}, asOf: ASOF, format: 'league', maxUpcoming: Infinity,
  })
  console.log(`✓ ${model.counts.upcoming} pronos · track record ${model.history.summary.result.pct}% (1N2)`)

  const dataset = {
    tournament: 'Ligue 1 2026-27',
    generatedAt: new Date().toISOString(),
    asOf: ASOF,
    sources: ['openfootball fr.1 2025-26 (entraînement)', "L'Équipe (calendrier 2026-27)", 'ESPN (résultats live)', 'Elo interne'],
    ...model,
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(dataset, null, 2))
  console.log(`✓ Écrit ${OUT}`)
}

main().catch((e) => { console.error('✗ Échec :', e.message); process.exit(1) })
