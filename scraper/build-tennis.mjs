// OddSight — pipeline Tennis (ATP/WTA, tournoi en cours via ESPN)
// Probabilité de victoire estimée à partir des points de classement (modèle puissance).
// Pas de nul ; format joueur vs joueur. Surface non modélisée (v1).
//
//   npm run scrape:tennis

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../src/data/tennis.json')
const EXP = 0.8 // exposant du modèle puissance (force vs points)
const DEFAULT_PTS = 250 // joueur hors top 150 (qualifié, wildcard)
const MARGIN = 1.06

const round2 = (x) => Math.round(x * 100) / 100
const pct = (x) => Math.round(x * 1000) / 10

// Proba de gagner le match selon la proba de gagner UN set (sets i.i.d.)
function matchWinFromSet(s, bestOf) {
  const q = 1 - s
  if (bestOf === 3) return s * s * (1 + 2 * q) // gagner 2 sets avant l'adversaire
  return s ** 3 * (1 + 3 * q + 6 * q * q) // best-of-5 : gagner 3 sets
}
// Inverse : proba d'un set à partir de la proba de match (recherche binaire)
function setProbFromMatch(P, bestOf) {
  let lo = 0, hi = 1
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2
    if (matchWinFromSet(m, bestOf) < P) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}
// Distribution des scores en sets (du point de vue joueur 1)
function setScores(s, bestOf) {
  const q = 1 - s
  const out = bestOf === 3
    ? [
        { score: '2-0', p: s * s, w: 1 },
        { score: '2-1', p: 2 * s * s * q, w: 1 },
        { score: '1-2', p: 2 * q * q * s, w: 2 },
        { score: '0-2', p: q * q, w: 2 },
      ]
    : [
        { score: '3-0', p: s ** 3, w: 1 },
        { score: '3-1', p: 3 * s ** 3 * q, w: 1 },
        { score: '3-2', p: 6 * s ** 3 * q * q, w: 1 },
        { score: '2-3', p: 6 * q ** 3 * s * s, w: 2 },
        { score: '1-3', p: 3 * q ** 3 * s, w: 2 },
        { score: '0-3', p: q ** 3, w: 2 },
      ]
  return out.sort((a, b) => b.p - a.p).map((x) => ({ ...x, p: pct(x.p) }))
}

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

// Elo par surface (tennisabstract) — on récupère le gElo (gazon) par nom de joueur
async function surfaceElo(tour, map) {
  try {
    const h = await (await fetch(`https://tennisabstract.com/reports/${tour}_elo_ratings.html`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text()
    for (const row of h.match(/<tr[\s\S]*?<\/tr>/g) || []) {
      const nameM = row.match(/<a[^>]*>([^<]+)<\/a>/)
      if (!nameM) continue
      const name = nameM[1].replace(/&nbsp;/g, ' ').trim()
      const text = row.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
      const nums = (text.match(/\d+\.\d+|\d+/g) || []).map(Number)
      // [rank, age, Elo, eloRank, hElo, hRank, cElo, cRank, gElo, ...]
      if (nums.length < 3) continue
      const elo = nums[2]
      const gElo = nums.length > 8 ? nums[8] : elo
      map[norm(name)] = { elo, gElo }
    }
  } catch (e) {
    console.warn(`  ⚠ Elo ${tour} indisponible (${e.message})`)
  }
}

async function rankings(tour, map) {
  const d = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/rankings`)).json()
  for (const r of d.rankings?.[0]?.ranks || []) {
    const a = r.athlete || {}
    const entry = { points: r.points || 0, rank: r.current }
    // On indexe par guid ET par nom normalisé (le scoreboard ne fiabilise pas le guid)
    if (a.guid) map[a.guid] = entry
    if (a.displayName) map['n:' + norm(a.displayName)] = entry
  }
}
const lookup = (pts, ath) => pts[ath?.guid] || pts['n:' + norm(ath?.displayName)] || null

async function main() {
  console.log('→ Classements ATP + WTA…')
  const pts = {}
  await rankings('atp', pts)
  await rankings('wta', pts)
  console.log(`✓ ${Object.keys(pts).length / 2} joueurs classés`)

  console.log('→ Elo par surface (gazon)…')
  const elo = {}
  await surfaceElo('atp', elo)
  await surfaceElo('wta', elo)
  console.log(`✓ ${Object.keys(elo).length} joueurs avec Elo`)

  console.log('→ Scoreboard tennis (tournoi en cours)…')
  const sb = await (await fetch('https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard')).json()
  const event = sb.events?.[0]
  if (!event) throw new Error('Aucun tournoi en cours')

  const today = new Date().toISOString().slice(0, 10)
  const predictions = []
  for (const grp of event.groupings || []) {
    const cat = grp.grouping?.displayName || ''
    if (!/Singles/.test(cat)) continue // simples uniquement (pas de double)
    for (const comp of grp.competitions || []) {
      const state = comp.status?.type?.state
      if (state === 'post') continue // déjà joué
      const day = comp.date?.slice(0, 10)
      if (day && day < today) continue // match passé (état périmé)
      const cs = comp.competitors || []
      if (cs.length !== 2) continue
      const A = cs[0].athlete, B = cs[1].athlete
      if (!A?.displayName || !B?.displayName) continue
      const la = lookup(pts, A), lb = lookup(pts, B)
      const pa = la?.points || DEFAULT_PTS
      const pb = lb?.points || DEFAULT_PTS
      // Modèle principal : Elo gazon (Wimbledon). Repli : points de classement.
      const ga = elo[norm(A.displayName)]?.gElo
      const gb = elo[norm(B.displayName)]?.gElo
      let p1, basis
      if (ga && gb) {
        p1 = 1 / (1 + Math.pow(10, (gb - ga) / 400))
        basis = 'elo'
      } else {
        const ea = Math.pow(pa, EXP), eb = Math.pow(pb, EXP)
        p1 = ea / (ea + eb)
        basis = 'points'
      }
      const round = comp.round?.displayName || comp.notes?.[0]?.headline || cat
      const fav1 = p1 >= 0.5
      const pickProb = Math.max(p1, 1 - p1)
      // Score en sets : Grand Chelem hommes = best-of-5, femmes = best-of-3
      const bestOf = /women/i.test(cat) ? 3 : 5
      const setS = setProbFromMatch(p1, bestOf)
      const sets = setScores(setS, bestOf)
      let confidence = 'Serré'
      if (pickProb >= 0.75) confidence = 'Élevée'
      else if (pickProb >= 0.62) confidence = 'Modérée'
      else if (pickProb >= 0.53) confidence = 'Faible'
      predictions.push({
        id: comp.id,
        category: cat,
        round,
        date: comp.date?.slice(0, 10) || event.date?.slice(0, 10),
        player1: A.displayName, player2: B.displayName,
        rank1: la?.rank || null, rank2: lb?.rank || null,
        pts1: pa, pts2: pb,
        pWin1: pct(p1), pWin2: pct(1 - p1),
        pick: fav1 ? A.displayName : B.displayName,
        pickProb: pct(pickProb),
        confidence,
        odds: { win1: round2(1 / p1 / MARGIN), win2: round2(1 / (1 - p1) / MARGIN) },
        fair: { win1: round2(1 / p1), win2: round2(1 / (1 - p1)) },
        bestOf,
        sets,
        basis,
      })
    }
  }
  predictions.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  console.log(`✓ ${predictions.length} matchs à venir (simples)`)

  const dataset = {
    sport: 'tennis',
    tournament: event.name,
    generatedAt: new Date().toISOString(),
    asOf: new Date().toISOString().slice(0, 10),
    sources: ['ESPN (scoreboard + classements ATP/WTA)'],
    counts: { upcoming: predictions.length },
    predictions,
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(dataset, null, 2))
  console.log(`✓ Écrit ${OUT}`)
}

main().catch((e) => { console.error('✗ Échec :', e.message); process.exit(1) })
