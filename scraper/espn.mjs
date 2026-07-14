// OddSight — source de résultats LIVE via l'API scoreboard ESPN.
// Gratuite, sans clé, accessible sans anti-bot. Renvoie les scores des matchs
// TERMINÉS (et, si demandé, en cours) d'une compétition entre deux dates.
//
// Non officielle : le schéma peut changer sans préavis. À cadence raisonnable
// c'est stable. Le moteur bascule un match « à venir » → « joué » dès qu'on lui
// attache un `score.ft` (voir engine.mjs : « joué = présence d'un SCORE »).

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
const ymd = (iso) => iso.replaceAll('-', '')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Récupère une tranche, avec retries sur erreurs transitoires (5xx / réseau).
async function scoreboard(league, dates, tries = 3) {
  const url = `${BASE}/${league}/scoreboard?dates=${dates}`
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return res.json()
      // 4xx = erreur définitive (mauvaise requête) ; 5xx = on retente
      if (res.status < 500) throw new Error(`HTTP ${res.status}`)
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
    if (i < tries - 1) await sleep(400 * (i + 1))
  }
  throw new Error(`ESPN ${league} ${dates} → ${lastErr.message}`)
}

// Découpe [from, to] (YYYY-MM-DD) en tranches que l'API accepte (plage YYYYMMDD-YYYYMMDD).
function* segments(from, to, days = 60) {
  let cur = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  while (cur <= end) {
    const next = new Date(cur)
    next.setUTCDate(next.getUTCDate() + days)
    const segEnd = next > end ? end : next
    yield `${ymd(cur.toISOString().slice(0, 10))}-${ymd(segEnd.toISOString().slice(0, 10))}`
    cur = new Date(segEnd)
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
}

// Récupère les matchs d'une compète ESPN sur une période.
// Renvoie [{ date, home, away, ft:[hg,ag], live }] — noms d'équipes ESPN bruts.
// Par défaut, seulement les matchs terminés (state === 'post'). includeLive=true
// ajoute les matchs en cours (state === 'in') avec le score courant.
// Noms ESPN -> noms du dataset CM ; le reste est identique.
const ESPN_MAP = {
  'Congo DR': 'DR Congo', 'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
  'Czechia': 'Czech Republic', 'Türkiye': 'Turkey', 'United States': 'USA',
}
const espnName = (n) => ESPN_MAP[n] || n
const hasScore = (m) => m.score && Array.isArray(m.score.ft)

// Injecte les scores ESPN sur les matchs encore sans score (openfootball est souvent
// en retard). Terrain neutre -> appariement par PAIRE non ordonnée + réorientation du
// score. Modifie `matches` en place, renvoie le nombre de résultats injectés.
// Partagé entre le pipeline (build.mjs) et le tuner, pour qu'ils voient la même chose.
export async function injectEspnResults(matches, asOf, league = 'fifa.world') {
  let results
  try {
    results = await fetchEspnResults({ league, from: '2026-06-01', to: asOf })
  } catch (e) {
    console.warn(`  ⚠ ESPN indisponible (${e.message}) — résultats live ignorés`)
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

export async function fetchEspnResults({ league, from, to, includeLive = false }) {
  const out = []
  const seen = new Set()
  for (const seg of segments(from, to)) {
    let data
    try {
      data = await scoreboard(league, seg)
    } catch (e) {
      // Une tranche en échec ne doit pas faire perdre les autres résultats.
      console.warn(`  ⚠ ${e.message} — tranche ignorée`)
      continue
    }
    for (const e of data.events || []) {
      const state = e.status?.type?.state // 'pre' | 'in' | 'post'
      const live = state === 'in'
      if (state !== 'post' && !(includeLive && live)) continue
      if (seen.has(e.id)) continue
      seen.add(e.id)
      const comp = e.competitions?.[0]
      const home = comp?.competitors?.find((c) => c.homeAway === 'home')
      const away = comp?.competitors?.find((c) => c.homeAway === 'away')
      if (!home || !away) continue
      const hg = Number(home.score)
      const ag = Number(away.score)
      if (!Number.isFinite(hg) || !Number.isFinite(ag)) continue
      out.push({
        date: (e.date || '').slice(0, 10),
        home: home.team.displayName,
        away: away.team.displayName,
        ft: [hg, ag],
        live,
      })
    }
  }
  return out
}
