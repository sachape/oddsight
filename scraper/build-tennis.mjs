// OddSight — pipeline Tennis (ATP/WTA, tournois en cours via ESPN)
// Probabilité de victoire = Elo général corrigé à 25 % par l'Elo de la surface du tournoi
// (poids MESURÉ, cf. `npm run backtest:tennis` et le commentaire sur SURFACE_W).
// Repli : Elo général, puis points de classement. Pas de nul ; joueur vs joueur.
//
//   npm run scrape:tennis

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
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

// ESPN ne renvoie AUCUNE information de surface. On la déduit du nom du tournoi.
// Un tournoi inconnu ne se voit PAS attribuer une surface au hasard : on retombe sur
// l'Elo général. Prédire un match sur terre battue avec l'Elo gazon (ce que faisait
// la v1, figée sur Wimbledon) fausse le favori dès qu'un spécialiste est impliqué.
const SURFACES = [
  [/wimbledon|queen|halle|terra wortmann|eastbourne|hertogenbosch|libema|mallorca|newport|stuttgart open|boss open/i, 'grass'],
  [/roland.?garros|french open|monte.?carlo|madrid|internazionali|italian open|rome|barcelona|godo|hamburg|bastad|b.?stad|nordea|gstaad|swiss open|umag|croatia open|kitzb|estoril|munich|bavarian|geneva|gonet|lyon|buenos aires|rio open|santiago|c.?rdoba|marrakech|houston|hungarian|bucharest/i, 'clay'],
  [/australian open|us open|indian wells|bnp paribas open|miami open|cincinnati|canadian|national bank|rogers cup|shanghai|rolex paris|dubai|qatar|doha|acapulco|rotterdam|marseille|basel|swiss indoors|vienna|erste bank|tokyo|beijing|china open|metz|antwerp|stockholm|winston.?salem|atlanta|washington|citi open|los cabos|chengdu|hangzhou|zhuhai|adelaide|brisbane|auckland|montpellier|delray beach|dallas|almaty|astana|nitto atp finals|united cup|hong kong|guadalajara|monterrey|san diego|tokyo|osaka|seoul|ningbo|wuhan/i, 'hard'],
]
const surfaceOf = (name) => SURFACES.find(([re]) => re.test(name || ''))?.[1] || null

// Emplacements de tableau non encore attribués (tours suivants, qualifications).
const PLACEHOLDER = /^(tbd|bye|qualifier|q\d*|winner of|loser of)\b/i

// Elo par surface (tennisabstract). Colonnes de la table :
// [eloRank, age, Elo, hEloRank, hElo, cEloRank, cElo, gEloRank, gElo, peakElo, peakMonth]
// Renvoie le nombre de joueurs lus (0 = source inutilisable, voir le cache plus bas).
async function surfaceElo(tour, map) {
  let n = 0
  try {
    const h = await (await fetch(`https://tennisabstract.com/reports/${tour}_elo_ratings.html`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text()
    for (const row of h.match(/<tr[\s\S]*?<\/tr>/g) || []) {
      const nameM = row.match(/<a[^>]*>([^<]+)<\/a>/)
      if (!nameM) continue
      const name = nameM[1].replace(/&nbsp;/g, ' ').trim()
      const text = row.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
      const nums = (text.match(/\d+\.\d+|\d+/g) || []).map(Number)
      if (nums.length < 9) continue
      const elo = nums[2]
      map[norm(name)] = { elo, hard: nums[4] || elo, clay: nums[6] || elo, grass: nums[8] || elo }
      n++
    }
  } catch (e) {
    console.warn(`  ⚠ Elo ${tour} indisponible (${e.message})`)
  }
  return n
}

// tennisabstract est bloqué depuis les runners GitHub : la page revient sans tableau,
// SANS lever d'erreur → on se retrouvait avec 0 joueur et tous les pronos calculés au
// repli « points de classement », bien plus faible, sans que rien ne le signale.
// Même parade que pour l'Elo foot : dernier Elo connu versionné dans le repo.
const ELO_CACHE = resolve(__dirname, 'tennis-elo-cache.json')
const MIN_PLAYERS = 200

async function loadElo() {
  const map = {}
  const n = (await surfaceElo('atp', map)) + (await surfaceElo('wta', map))
  if (n >= MIN_PLAYERS) {
    try {
      writeFileSync(ELO_CACHE, JSON.stringify({ fetchedAt: new Date().toISOString(), elo: map }))
    } catch { /* cache non écrivable (CI) : sans conséquence */ }
    return { elo: map, source: 'tennisabstract', n }
  }
  console.warn(`  ⚠ tennisabstract inexploitable (${n} joueurs)`)
  try {
    const c = JSON.parse(readFileSync(ELO_CACHE, 'utf-8'))
    const cn = Object.keys(c.elo || {}).length
    if (cn >= MIN_PLAYERS) {
      console.warn(`  → repli sur le cache Elo du ${c.fetchedAt} (${cn} joueurs)`)
      return { elo: c.elo, source: `cache tennisabstract (${c.fetchedAt})`, n: cn }
    }
  } catch { /* pas de cache */ }
  console.warn('  → aucun cache : repli sur les points de classement (modèle dégradé)')
  return { elo: {}, source: 'points de classement (Elo indisponible)', n: 0 }
}

// Elo à utiliser pour CE tournoi. MESURÉ (`npm run backtest:tennis`, 7 883 matchs
// ATP+WTA 2025-26, ratings point-in-time, bootstrap apparié) :
//
//   Elo général            0.626
//   Elo surface PUR        0.638   → significativement PIRE (+0.011, IC [0.005, 0.018])
//   Mixte 25 % surface     0.622   → significativement MIEUX (−0.005, IC [−0.006, −0.003])
//
// L'Elo d'une surface seule est trop bruité (chaque joueur n'a qu'une fraction de ses
// matchs dessus). La surface porte un vrai signal, mais faible : elle CORRIGE l'Elo
// général, elle ne le remplace pas. D'où un poids de 25 %, et non 100 %.
const SURFACE_W = 0.25

// Résultat du même backtest, face aux cotes de clôture. Le marché est LOIN devant : une
// « value » détectée en tennis est donc, encore plus qu'au foot, notre propre erreur.
// C'est une mesure, pas une opinion — on l'embarque dans le dataset pour que l'UI le dise.
// À rafraîchir avec `npm run backtest:tennis`.
const BENCHMARK = {
  model: 0.622, market: 0.586, n: 7883,
  source: 'ATP+WTA 2025-26, cotes de clôture (npm run backtest:tennis)',
}

const eloFor = (rec, surface) => {
  if (!rec) return null
  if (!surface || !rec[surface]) return rec.elo // surface inconnue → Elo général, pas de supposition
  return SURFACE_W * rec[surface] + (1 - SURFACE_W) * rec.elo
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

  console.log('→ Elo par surface (dur / terre / gazon)…')
  const { elo, source: eloSource } = await loadElo()
  console.log(`✓ ${Object.keys(elo).length} joueurs avec Elo [${eloSource}]`)

  console.log('→ Scoreboards ATP + WTA (tournois en cours)…')
  const events = []
  for (const tour of ['atp', 'wta']) {
    try {
      const sb = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/scoreboard`)).json()
      for (const e of sb.events || []) if (!events.some((x) => x.id === e.id)) events.push(e)
    } catch (e) {
      console.warn(`  ⚠ scoreboard ${tour} indisponible (${e.message})`)
    }
  }
  if (!events.length) throw new Error('Aucun tournoi en cours')

  const today = new Date().toISOString().slice(0, 10)
  const predictions = []
  const seen = new Set()

  for (const event of events) {
    // Surface réelle du tournoi (sinon : Elo général, pas de surface inventée)
    const surface = surfaceOf(event.name)
    // Best-of-5 UNIQUEMENT en Grand Chelem masculin (`major`). Ailleurs, 2 sets gagnants.
    const isMajor = Boolean(event.major)
    console.log(`  · ${event.name} — surface ${surface || 'inconnue (Elo général)'}${isMajor ? ' · Grand Chelem' : ''}`)

    for (const grp of event.groupings || []) {
      const cat = grp.grouping?.displayName || ''
      if (!/Singles/.test(cat)) continue // simples uniquement (pas de double)
      const women = /women/i.test(cat)
      const bestOf = isMajor && !women ? 5 : 3

      for (const comp of grp.competitions || []) {
        const state = comp.status?.type?.state
        if (state === 'post') continue // déjà joué
        const day = comp.date?.slice(0, 10)
        if (day && day < today) continue // match passé (état périmé)
        if (seen.has(comp.id)) continue
        const cs = comp.competitors || []
        if (cs.length !== 2) continue
        const A = cs[0].athlete, B = cs[1].athlete
        if (!A?.displayName || !B?.displayName) continue
        // Les tours suivants (quarts, demies, finale) existent déjà dans le tableau
        // ESPN avec des emplacements vides. Prédire contre un « TBD » n'a aucun sens :
        // on n'affiche un match que quand les DEUX joueurs sont connus.
        if (PLACEHOLDER.test(A.displayName) || PLACEHOLDER.test(B.displayName)) continue
        seen.add(comp.id)

        const la = lookup(pts, A), lb = lookup(pts, B)
        const pa = la?.points || DEFAULT_PTS
        const pb = lb?.points || DEFAULT_PTS
        // Modèle principal : Elo de la surface du tournoi. Repli : points de classement.
        const ea = eloFor(elo[norm(A.displayName)], surface)
        const eb = eloFor(elo[norm(B.displayName)], surface)
        let p1, basis
        if (ea && eb) {
          p1 = 1 / (1 + Math.pow(10, (eb - ea) / 400))
          basis = surface ? `elo-${surface}` : 'elo'  // Elo général corrigé à 25 % par la surface
        } else {
          const qa = Math.pow(pa, EXP), qb = Math.pow(pb, EXP)
          p1 = qa / (qa + qb)
          basis = 'points'
        }
        const round = comp.round?.displayName || comp.notes?.[0]?.headline || cat
        const fav1 = p1 >= 0.5
        const pickProb = Math.max(p1, 1 - p1)
        const setS = setProbFromMatch(p1, bestOf)
        const sets = setScores(setS, bestOf)
        let confidence = 'Serré'
        if (pickProb >= 0.75) confidence = 'Élevée'
        else if (pickProb >= 0.62) confidence = 'Modérée'
        else if (pickProb >= 0.53) confidence = 'Faible'
        predictions.push({
          id: comp.id,
          tournament: event.name,
          surface,
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
  }
  predictions.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const counts = {}
  for (const p of predictions) counts[p.tournament] = (counts[p.tournament] || 0) + 1
  const tournaments = Object.keys(counts).sort((a, b) => counts[b] - counts[a])

  // ESPN n'expose la surface nulle part (ni event, ni tournament, ni venue : vérifié).
  // La table SURFACES est donc la seule source. On NE DEVINE PAS les tournois absents —
  // ils tournent à l'Elo général, et l'UI le dit. Ce log sert à étendre la table
  // sciemment, tournoi par tournoi, plutôt qu'au jugé.
  const unknown = tournaments.filter((t) => !surfaceOf(t))
  if (unknown.length) {
    console.log(`\n  ℹ surface inconnue (Elo général) pour ${unknown.length} tournoi(s) :`)
    for (const t of unknown) console.log(`      « ${t} » — à ajouter à SURFACES si la surface est vérifiée`)
  }
  console.log(`✓ ${predictions.length} matchs à venir (simples) sur ${tournaments.length} tournoi(s)`)

  const dataset = {
    sport: 'tennis',
    // Le tournoi « principal » = celui qui a le plus d'affiches (en-tête de la page) ;
    // chaque prono porte le sien, la liste complète est dans `tournaments`.
    tournament: tournaments[0] || events[0].name,
    tournaments,
    generatedAt: new Date().toISOString(),
    asOf: new Date().toISOString().slice(0, 10),
    sources: ['ESPN (scoreboard + classements ATP/WTA)', eloSource],
    eloSource,
    benchmark: BENCHMARK,
    counts: { upcoming: predictions.length },
    predictions,
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(dataset, null, 2))
  console.log(`✓ Écrit ${OUT}`)
}

main().catch((e) => { console.error('✗ Échec :', e.message); process.exit(1) })
