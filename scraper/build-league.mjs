// OddSight — builder générique de championnat (nouvelle saison)
// Entraîne sur openfootball (saison passée) + calendrier L'Équipe (saison à venir).
// Correspondances de noms EXPLICITES et vérifiées par ligue (openfootball ↔ slugs L'Équipe).
//
//   node scraper/build-league.mjs pl     (premier-league)
//   node scraper/build-league.mjs sa     (serie-a)

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildModel } from './engine.mjs'
import { fetchMarketOdds } from './market.mjs'

const MARKET_BASE = 'https://www.football-data.co.uk/mmz4281/2526/'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36'
const ASOF = '2026-07-01'
const MONTHS = { janvier: 1, 'février': 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, 'août': 8, septembre: 9, octobre: 10, novembre: 11, 'décembre': 12, janv: 1, 'févr': 2, 'fév': 2, avr: 4, juil: 7, sept: 9, oct: 10, nov: 11, 'déc': 12 }

const LEAGUES = {
  pl: {
    out: 'premier-league.json', tournament: 'Premier League 2026-27',
    of: 'en.1', path: 'championnat-d-angleterre', journees: 38, j1: '2026-08-15',
    mkt: 'E0', mktName: { "Nott'm Forest": 'Nottingham Forest' },
    name: {
      'AFC Bournemouth': 'Bournemouth', 'Arsenal FC': 'Arsenal', 'Aston Villa FC': 'Aston Villa',
      'Brentford FC': 'Brentford', 'Brighton & Hove Albion FC': 'Brighton', 'Burnley FC': 'Burnley',
      'Chelsea FC': 'Chelsea', 'Crystal Palace FC': 'Crystal Palace', 'Everton FC': 'Everton',
      'Fulham FC': 'Fulham', 'Leeds United FC': 'Leeds', 'Liverpool FC': 'Liverpool',
      'Manchester City FC': 'Man City', 'Manchester United FC': 'Man United',
      'Newcastle United FC': 'Newcastle', 'Nottingham Forest FC': 'Nottingham Forest',
      'Sunderland AFC': 'Sunderland', 'Tottenham Hotspur FC': 'Tottenham',
      'West Ham United FC': 'West Ham', 'Wolverhampton Wanderers FC': 'Wolves',
    },
    slug: {
      arsenal: 'Arsenal', coventry: 'Coventry', hull: 'Hull', 'manchester-united': 'Man United',
      everton: 'Everton', 'crystal-palace': 'Crystal Palace', ipswich: 'Ipswich',
      sunderland: 'Sunderland', 'nottingham-forest': 'Nottingham Forest', leeds: 'Leeds',
      brentford: 'Brentford', tottenham: 'Tottenham', brighton: 'Brighton', 'aston-villa': 'Aston Villa',
      'manchester-city': 'Man City', bournemouth: 'Bournemouth', newcastle: 'Newcastle',
      liverpool: 'Liverpool', fulham: 'Fulham', chelsea: 'Chelsea',
    },
  },
  sa: {
    out: 'serie-a.json', tournament: 'Serie A 2026-27',
    of: 'it.1', path: 'championnat-d-italie', journees: 38, j1: '2026-08-22',
    mkt: 'I1', mktName: {},
    name: {
      'AC Milan': 'Milan', 'AC Pisa 1909': 'Pisa', 'ACF Fiorentina': 'Fiorentina', 'AS Roma': 'Roma',
      'Atalanta BC': 'Atalanta', 'Bologna FC 1909': 'Bologna', 'Cagliari Calcio': 'Cagliari',
      'Como 1907': 'Como', 'FC Internazionale Milano': 'Inter', 'Genoa CFC': 'Genoa',
      'Hellas Verona FC': 'Verona', 'Juventus FC': 'Juventus', 'Parma Calcio 1913': 'Parma',
      'SS Lazio': 'Lazio', 'SSC Napoli': 'Napoli', 'Torino FC': 'Torino', 'US Cremonese': 'Cremonese',
      'US Lecce': 'Lecce', 'US Sassuolo Calcio': 'Sassuolo', 'Udinese Calcio': 'Udinese',
    },
    slug: {
      'as-rome': 'Roma', fiorentina: 'Fiorentina', 'atalanta-bergame': 'Atalanta', sassuolo: 'Sassuolo',
      bologne: 'Bologna', 'lazio-rome': 'Lazio', frosinone: 'Frosinone', 'juventus-turin': 'Juventus',
      genoa: 'Genoa', naples: 'Napoli', 'inter-milan': 'Inter', monza: 'Monza', parme: 'Parma',
      cagliari: 'Cagliari', torino: 'Torino', 'ac-milan': 'Milan', udinese: 'Udinese', come: 'Como',
      venise: 'Venezia', lecce: 'Lecce',
    },
  },
}

const key = process.argv[2]
const cfg = LEAGUES[key]
if (!cfg) { console.error('Usage: node build-league.mjs <pl|sa>'); process.exit(1) }
const perJournee = Object.keys(cfg.slug).length / 2
const BASE = `https://www.lequipe.fr/Football/${cfg.path}/page-calendrier-resultats`

// Découpe un slug "domicile-extérieur" via les tokens connus (préfixe le plus long valide)
function splitSlug(s) {
  const tokens = Object.keys(cfg.slug).sort((a, b) => b.length - a.length)
  for (const home of tokens) {
    if (s === home || !s.startsWith(home + '-')) continue
    const away = s.slice(home.length + 1)
    if (cfg.slug[away]) return [cfg.slug[home], cfg.slug[away]]
  }
  return null
}

function approxDate(n) {
  const d = new Date(cfg.j1 + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + (n - 1) * 7)
  return d.toISOString().slice(0, 10)
}

function parseJournee(html) {
  const re = new RegExp(`match-direct/${cfg.path}/2026-2027/([a-z0-9-]+)-preview`, 'g')
  const seen = new Set(), pairs = []
  let m
  while ((m = re.exec(html))) {
    if (seen.has(m[1])) continue
    seen.add(m[1])
    const r = splitSlug(m[1])
    if (r) pairs.push(r)
  }
  const text = html.replace(/<[^>]+>/g, ' ')
  const dm = text.match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|janv|févr|fév|avr|juil|sept|oct|nov|déc)/i)
  let date = null
  if (dm) {
    const mo = MONTHS[dm[2].toLowerCase()]
    if (mo) date = `${mo >= 7 ? 2026 : 2027}-${String(mo).padStart(2, '0')}-${String(+dm[1]).padStart(2, '0')}`
  }
  return { pairs, date }
}

async function main() {
  const trData = await (await fetch(`https://raw.githubusercontent.com/openfootball/football.json/master/2025-26/${cfg.of}.json`, { headers: { 'User-Agent': UA } })).json()
  const trainMatches = (trData.matches || []).map((m) => ({ ...m, team1: cfg.name[m.team1] || m.team1, team2: cfg.name[m.team2] || m.team2 }))
  console.log(`✓ ${trainMatches.length} matchs d'entraînement (${trData.name})`)

  const fixtures = []
  let ok = 0
  for (let n = 1; n <= cfg.journees; n++) {
    const url = n === 1 ? BASE : `${BASE}/${n}e-journee`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) { console.warn(`  ⚠ J${n} HTTP ${res.status}`); continue }
    const { pairs, date } = parseJournee(await res.text())
    if (pairs.length === perJournee) {
      ok++
      for (const [t1, t2] of pairs) fixtures.push({ round: `Journée ${n}`, journee: n, date: date || approxDate(n), team1: t1, team2: t2 })
    } else {
      console.warn(`  ⚠ J${n}: ${pairs.length}/${perJournee} (ignorée)`)
    }
  }
  console.log(`✓ ${ok} journées complètes · ${fixtures.length} affiches`)

  const market = cfg.mkt ? await fetchMarketOdds(MARKET_BASE + cfg.mkt + '.csv', cfg.mktName || {}) : null
  console.log(`✓ ${market?.size || 0} matchs avec cote marché`)

  const model = buildModel({ matches: fixtures, trainMatches, elo: {}, asOf: ASOF, format: 'league', maxUpcoming: Infinity, market })
  console.log(`✓ ${model.counts.upcoming} pronos · track record ${model.history.summary.result.pct}% (1N2)`)

  const OUT = resolve(__dirname, `../src/data/${cfg.out}`)
  const dataset = {
    tournament: cfg.tournament, generatedAt: new Date().toISOString(), asOf: ASOF,
    sources: [`openfootball ${cfg.of} (entraînement)`, "L'Équipe (calendrier 2026-27)", 'Elo interne'],
    ...model,
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(dataset, null, 2))
  console.log(`✓ Écrit ${OUT}`)
}

main().catch((e) => { console.error('✗ Échec :', e.message); process.exit(1) })
