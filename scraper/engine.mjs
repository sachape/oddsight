// Moteur de prédiction OddSight — modèle multi-facteurs
//
// Pour chaque match à venir, on combine :
//   1. Elo réel (eloratings) ......... niveau de base / historique complet
//   2. Attaque/défense ajustées ...... force offensive/défensive vs qualité adverse
//   3. Pondération de récence ........ les matchs récents pèsent plus
//   4. Momentum ...................... sur/sous-performance récente vs Elo
//   5. Repos / fatigue ............... jours de récupération avant le match
//   6. Avantage hôte ................. pays organisateurs
//   7. Finition (timing des buts) .... équipes qui marquent tard
// puis loi de Poisson + correction Dixon-Coles -> probabilités de chaque score.

import { scoreSet, reliability, fitIsotonic, applyIsotonic } from './metrics.mjs'

const HOSTS = new Set(['United States', 'USA', 'Canada', 'Mexico'])

// Marge bookmaker appliquée aux cotes (overround ~6%) pour des cotes réalistes,
// proches de celles des opérateurs (Parions Sport, etc.) plutôt que des cotes "justes".
const MARGIN = 1.06
const bookOdds = (p) => (p > 0 ? Math.round((1 / p / MARGIN) * 100) / 100 : null)

// Poids de l'impact d'un absent selon son poste, sur l'attaque et la défense de son équipe
const POS_ATT = { FWD: 1.0, MID: 0.6, DEF: 0.15, GK: 0 }
const POS_DEF = { GK: 1.0, DEF: 1.0, MID: 0.4, FWD: 0.1 }

// Hyperparamètres du modèle, PAR FORMAT (coupe vs championnat : régimes différents).
// `cup` = réglage historique (Coupe du Monde inchangée). `league` = optimisé sur
// le log-loss walk-forward (`npm run tune`, validé OOS sur la Ligue 1 2025-26).
// buildModel sélectionne le profil ; le tuner mute TUNABLE directement.
const PROFILES = {
  cup:    { halfLife: 14, koBonus: 1.3, rho: -0.04, supCoef: 0.45, blendK: 3, homeF: 1.12, awayF: 0.9,  momentumW: 0.05, clutchW: 0.04 },
  league: { halfLife: 60, koBonus: 1.3, rho: 0.0,   supCoef: 0.30, blendK: 3, homeF: 1.05, awayF: 0.95, momentumW: 0.08, clutchW: 0.04 },
}
export const TUNABLE = { ...PROFILES.cup } // profil actif (lu par predict/recency)

const round2 = (x) => Math.round(x * 100) / 100
const pct = (x) => Math.round(x * 1000) / 10
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)

function factorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r }
function poisson(k, l) { return (Math.exp(-l) * Math.pow(l, k)) / factorial(k) }

// --- 1. Extraction des matchs joués -----------------------------------------

const hasScore = (m) => m.score && Array.isArray(m.score.ft)

// Construit la chronologie (buts marqués/encaissés + timing) depuis une liste de matchs joués
function gamesFrom(played) {
  const games = []
  for (const m of played) {
    const [g1, g2] = m.score.ft
    const lateOf = (arr) =>
      (arr || []).filter((x) => parseInt(x.minute, 10) >= 75).length
    games.push({
      date: m.date,
      t1: m.team1, t2: m.team2,
      g1, g2,
      group: m.group || null,
      knockout: !m.group,
      late1: lateOf(m.goals1), late2: lateOf(m.goals2),
    })
  }
  return games
}

// Matchs joués AVANT une date (pour le backtest point-in-time, sans lookahead)
function parseGames(matches, asOf) {
  const played = matches.filter((m) => m.date < asOf && hasScore(m))
  return { played, games: gamesFrom(played) }
}

// Poids de récence : demi-vie de 14 jours + bonus pour les matchs à élimination directe
function recencyWeight(date, asOf, knockout) {
  const age = Math.max(0, daysBetween(date, asOf))
  let w = Math.pow(0.5, age / TUNABLE.halfLife)
  if (knockout) w *= TUNABLE.koBonus
  return w
}

// --- 2. Statistiques par équipe ---------------------------------------------

function buildTeams(games, elo, asOf) {
  const teams = {}
  const T = (name) =>
    (teams[name] ??= {
      name, group: null, elo: elo[name] ?? 1500,
      played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0,
      wsum: 0, // somme des poids de récence (nb de matchs "effectif")
      lateFor: 0, lateAgainst: 0,
      form: [], lastDate: null,
      log: [], // { date, opp, gf, ga, w(eight), knockout, res }
    })

  let wGoals = 0
  let wTeamGames = 0

  for (const g of games) {
    const a = T(g.t1)
    const b = T(g.t2)
    if (g.group) { a.group ??= g.group; b.group ??= g.group }
    const w = recencyWeight(g.date, asOf, g.knockout)

    const reg = (t, gf, ga, lateF, lateA, opp) => {
      t.played++; t.gf += gf; t.ga += ga
      t.wsum += w
      t.lateFor += lateF; t.lateAgainst += lateA
      t.lastDate = !t.lastDate || g.date > t.lastDate ? g.date : t.lastDate
      const res = gf > ga ? 'W' : gf < ga ? 'L' : 'D'
      if (res === 'W') t.w++; else if (res === 'L') t.l++; else t.d++
      t.form.push({ date: g.date, res })
      t.log.push({ date: g.date, opp, gf, ga, w, knockout: g.knockout, res })
    }
    reg(a, g.g1, g.g2, g.late1, g.late2, g.t2)
    reg(b, g.g2, g.g1, g.late2, g.late1, g.t1)

    wGoals += w * (g.g1 + g.g2)
    wTeamGames += w * 2
  }

  const leagueAvg = wTeamGames ? wGoals / wTeamGames : 1.35

  for (const t of Object.values(teams)) {
    const gp = t.played || 1
    t.points = t.w * 3 + t.d
    t.gfpg = round2(t.gf / gp)
    t.gapg = round2(t.ga / gp)
    t.form.sort((x, y) => x.date.localeCompare(y.date))
    t.formStr = t.form.slice(-3).map((f) => f.res).join(' ')
    // Part des buts marqués dans les 15 dernières minutes -> "finisseur"
    t.clutch = t.gf ? round2(t.lateFor / t.gf) : 0
  }

  return { teams, leagueAvg }
}

// --- 3. Attaque/défense ajustées à l'adversaire (itératif, pondéré récence) ---

function solveStrengths(teams, leagueAvg) {
  const names = Object.keys(teams)
  const att = {}, def = {}
  names.forEach((n) => { att[n] = 1; def[n] = 1 })

  // Régularisation : K "pseudo-matchs" de force moyenne (=1) ajoutés à chaque
  // équipe. Indispensable avec ~3 matchs/équipe, sinon le solveur diverge.
  const K = 2.5
  const DAMP = 0.6 // amortissement entre itérations (évite les oscillations)

  for (let iter = 0; iter < 15; iter++) {
    const nextAtt = {}, nextDef = {}
    for (const n of names) {
      const t = teams[n]
      let aNum = 0, aDen = 0, dNum = 0, dDen = 0
      for (const g of t.log) {
        const oppDef = clamp(def[g.opp] ?? 1, 0.5, 1.8)
        const oppAtt = clamp(att[g.opp] ?? 1, 0.5, 1.8)
        aNum += g.w * (g.gf / (oppDef * leagueAvg))
        aDen += g.w
        dNum += g.w * (g.ga / (oppAtt * leagueAvg))
        dDen += g.w
      }
      // (somme + K×1) / (poids + K) -> tire vers 1 quand peu de matchs
      nextAtt[n] = (aNum + K) / (aDen + K)
      nextDef[n] = (dNum + K) / (dDen + K)
    }
    // Normalisation pour garder une moyenne de 1, puis amortissement
    const mean = (o) => names.reduce((s, n) => s + o[n], 0) / names.length
    const ma = mean(nextAtt), md = mean(nextDef)
    names.forEach((n) => {
      att[n] = DAMP * att[n] + (1 - DAMP) * (nextAtt[n] / ma)
      def[n] = DAMP * def[n] + (1 - DAMP) * (nextDef[n] / md)
    })
  }

  for (const n of names) {
    teams[n].attAdj = round2(clamp(att[n], 0.4, 2.1))
    teams[n].defAdj = round2(clamp(def[n], 0.45, 2.0)) // <1 = défense solide
  }
  return { att, def }
}

// --- 4. Momentum : sur/sous-performance récente vs attente Elo ----------------

function computeMomentum(teams, elo) {
  for (const t of Object.values(teams)) {
    const recent = t.log.slice(-3)
    if (!recent.length) { t.momentum = 0; continue }
    let s = 0, wsum = 0
    for (const g of recent) {
      const eOpp = elo[g.opp] ?? 1500
      const exp = 1 / (1 + Math.pow(10, -(t.elo - eOpp) / 400)) // proba attendue
      const got = g.res === 'W' ? 1 : g.res === 'D' ? 0.5 : 0
      s += g.w * (got - exp) // > 0 = mieux que prévu
      wsum += g.w
    }
    t.momentum = round2(clamp(wsum ? s / wsum : 0, -0.5, 0.5) * 2) // -1..1
  }
}

// --- 4b. Disponibilité de l'effectif (blessures / suspensions) ---------------

function applyAvailability(teams, availability) {
  for (const t of Object.values(teams)) {
    const players = availability[t.name] || []
    let attackLoss = 0, defLoss = 0
    for (const p of players) {
      const imp = clamp(p.importance ?? 0.5, 0, 1)
      attackLoss += imp * (POS_ATT[p.pos] ?? 0.4)
      defLoss += imp * (POS_DEF[p.pos] ?? 0.4)
    }
    t.absents = players.map((p) => ({
      name: p.name, status: p.status, pos: p.pos, importance: p.importance ?? 0.5,
    }))
    // Multiplicateurs : attaque réduite si attaquants absents ; défense plus
    // perméable (l'adversaire marque plus) si défenseurs/gardien absents.
    t.availAtt = round2(1 - Math.min(0.25, attackLoss * 0.11))
    t.availDef = round2(1 + Math.min(0.25, defLoss * 0.11))
  }
}

// --- 5. Prédiction d'un match ------------------------------------------------

function eloWinProb(eloA, eloB) {
  return 1 / (1 + Math.pow(10, -(eloA - eloB) / 400))
}

function predict(m, teams, leagueAvg, asOf, format = 'cup', cal = null) {
  const A = teams[m.team1]
  const B = teams[m.team2]
  if (!A || !B) return null

  const isLeague = format === 'league'
  const isKnockout = isLeague ? false : !m.group
  const hostA = HOSTS.has(m.team1)
  const hostB = HOSTS.has(m.team2)
  const homeAdj = (hostA ? 60 : 0) - (hostB ? 60 : 0) // bonus Elo "à domicile"

  // -- (a) Estimation par les stats du tournoi (ajustées adversaire) --
  const TG = leagueAvg * 2 // total de buts attendu
  let lam1_S = A.attAdj * B.defAdj * leagueAvg
  let lam2_S = B.attAdj * A.defAdj * leagueAvg

  // -- (b) Estimation par l'Elo réel --
  const eloDiff = A.elo - B.elo + homeAdj
  const sup = clamp((eloDiff / 100) * TUNABLE.supCoef, -2.4, 2.4) // suprématie de buts
  let lam1_E = clamp(TG / 2 + sup / 2, 0.15, 5)
  let lam2_E = clamp(TG / 2 - sup / 2, 0.15, 5)

  // -- (c) Mélange : plus d'historique tournoi = plus de poids aux stats --
  const nEff = Math.min(A.wsum, B.wsum)
  const wData = clamp(nEff / (nEff + TUNABLE.blendK), 0, 0.75)
  let lam1 = wData * lam1_S + (1 - wData) * lam1_E
  let lam2 = wData * lam2_S + (1 - wData) * lam2_E

  // -- (d) Ajustements de contexte (multiplicatifs) --
  // Repos / fatigue : jours entre le dernier match joué et celui-ci
  const restA = A.lastDate ? clamp(daysBetween(A.lastDate, m.date), 1, 14) : 7
  const restB = B.lastDate ? clamp(daysBetween(B.lastDate, m.date), 1, 14) : 7
  const restFactor = (r, other) => {
    let f = 1
    if (r < 3) f *= 0.96 // très peu de repos
    f *= 1 + clamp((r - other) * 0.008, -0.04, 0.04) // repos relatif
    return f
  }
  const fA = restFactor(restA, restB)
  const fB = restFactor(restB, restA)

  // Momentum
  const mA = 1 + TUNABLE.momentumW * A.momentum
  const mB = 1 + TUNABLE.momentumW * B.momentum

  // Finition (marqueur tardif) : légère hausse de la capacité à marquer
  const cA = 1 + TUNABLE.clutchW * A.clutch
  const cB = 1 + TUNABLE.clutchW * B.clutch

  // Disponibilité : attaque réduite par ses propres absents (availAtt),
  // hausse face aux absents défensifs adverses (availDef de l'adversaire)
  const availA = (A.availAtt ?? 1) * (B.availDef ?? 1)
  const availB = (B.availAtt ?? 1) * (A.availDef ?? 1)

  // Avantage du terrain (championnat) : team1 = domicile
  const homeF = isLeague ? TUNABLE.homeF : 1
  const awayF = isLeague ? TUNABLE.awayF : 1

  lam1 = clamp(lam1 * fA * mA * cA * availA * homeF, 0.12, 5.5)
  lam2 = clamp(lam2 * fB * mB * cB * availB * awayF, 0.12, 5.5)

  // -- (e) Matrice des scores + correction Dixon-Coles (petits scores/nuls) --
  const RHO = TUNABLE.rho
  const MAX = 9
  const tau = (i, j) => {
    if (i === 0 && j === 0) return 1 - lam1 * lam2 * RHO
    if (i === 0 && j === 1) return 1 + lam1 * RHO
    if (i === 1 && j === 0) return 1 + lam2 * RHO
    if (i === 1 && j === 1) return 1 - RHO
    return 1
  }
  let total = 0
  const grid = []
  for (let i = 0; i <= MAX; i++) {
    const pi = poisson(i, lam1)
    for (let j = 0; j <= MAX; j++) {
      const p = pi * poisson(j, lam2) * tau(i, j)
      grid.push({ i, j, p })
      total += p
    }
  }

  // Dérivation de tous les marchés depuis la matrice des scores
  let pW1 = 0, pD = 0, pW2 = 0
  let bttsYes = 0, cs1 = 0, cs2 = 0
  const over = { 1.5: 0, 2.5: 0, 3.5: 0 }
  for (const c of grid) {
    c.p /= total
    if (c.i > c.j) pW1 += c.p
    else if (c.i < c.j) pW2 += c.p
    else pD += c.p
    if (c.i >= 1 && c.j >= 1) bttsYes += c.p
    if (c.j === 0) cs1 += c.p // équipe 1 garde sa cage inviolée
    if (c.i === 0) cs2 += c.p
    const tot = c.i + c.j
    if (tot > 1.5) over[1.5] += c.p
    if (tot > 2.5) over[2.5] += c.p
    if (tot > 3.5) over[3.5] += c.p
  }

  // Calibration isotonique du 1N2 (ajustée sur l'historique) : redresse la sur/
  // sous-confiance. Appliquée AVANT les marchés dérivés (double chance, qualif,
  // pronostic) pour rester cohérent. BTTS/over/scores restent issus de la grille.
  if (cal) {
    const c1 = applyIsotonic(cal, pW1), cX = applyIsotonic(cal, pD), c2 = applyIsotonic(cal, pW2)
    const s = c1 + cX + c2 || 1
    pW1 = c1 / s; pD = cX / s; pW2 = c2 / s
  }

  const markets = {
    btts: { yes: pct(bttsYes), no: pct(1 - bttsYes) },
    over: {
      1.5: { over: pct(over[1.5]), under: pct(1 - over[1.5]) },
      2.5: { over: pct(over[2.5]), under: pct(1 - over[2.5]) },
      3.5: { over: pct(over[3.5]), under: pct(1 - over[3.5]) },
    },
    doubleChance: {
      '1X': pct(pW1 + pD), 12: pct(pW1 + pW2), X2: pct(pD + pW2),
    },
    cleanSheet: { team1: pct(cs1), team2: pct(cs2) },
    totalGoals: round2(lam1 + lam2),
  }

  const topScores = grid.sort((a, b) => b.p - a.p).slice(0, 3)
    .map((s) => ({ score: `${s.i}-${s.j}`, p: pct(s.p) }))

  // Qualification (élimination directe) : tirs au but avec léger edge au favori
  const penEdge = clamp((A.elo - B.elo) / 4000, -0.08, 0.08)
  const pPen1 = 0.5 + penEdge
  const pQual1 = isKnockout ? pW1 + pD * pPen1 : pW1
  const pQual2 = isKnockout ? pW2 + pD * (1 - pPen1) : pW2

  // Pronostic recommandé
  let pick, pickProb, favA, tight = false
  if (isKnockout) {
    favA = pQual1 >= pQual2
    pick = favA ? m.team1 : m.team2
    pickProb = Math.max(pQual1, pQual2)
  } else {
    favA = pW1 >= pW2
    const top = Math.max(pW1, pW2)
    if (top < 0.4) {
      // Match serré : aucun camp ne se détache -> double chance (favori ou nul)
      tight = true
      pick = favA ? `${m.team1} ou nul` : `nul ou ${m.team2}`
      pickProb = (favA ? pW1 : pW2) + pD
    } else {
      pick = favA ? m.team1 : m.team2
      pickProb = top
    }
  }
  let confidence = 'Serré'
  if (tight) confidence = 'Serré'
  else if (pickProb >= 0.66) confidence = 'Élevée'
  else if (pickProb >= 0.56) confidence = 'Modérée'
  else if (pickProb >= 0.49) confidence = 'Faible'

  // -- (f) Explication : facteurs qui penchent en faveur du pronostic --
  const drivers = []
  const add = (label, v1, v2, betterHigh = true) => {
    const edge =
      betterHigh ? (v1 > v2 ? 1 : v1 < v2 ? -1 : 0) : (v1 < v2 ? 1 : v1 > v2 ? -1 : 0)
    drivers.push({ label, v1, v2, betterHigh, favorsPick: favA ? edge > 0 : edge < 0 })
  }
  add('Elo mondial', A.elo, B.elo)
  add('Attaque ajustée', A.attAdj, B.attAdj)
  add('Défense ajustée', A.defAdj, B.defAdj, false)
  add('Repos (jours)', restA, restB)
  add('Momentum', A.momentum, B.momentum)
  add('Finition tardive', A.clutch, B.clutch)

  // Raisons textuelles (top facteurs en faveur du prono)
  const reasons = []
  const fav = favA ? A : B
  const und = favA ? B : A
  // Absences marquantes (priorité haute)
  const statusFr = (s) => (s === 'suspension' ? 'suspendu' : 'blessé')
  for (const t of [A, B]) {
    const k = (t.absents || []).filter((a) => a.importance >= 0.7)
    if (k.length) reasons.push(`${t.name} privé de ${k[0].name} (${statusFr(k[0].status)})`)
  }
  if (Math.abs(A.elo - B.elo) >= 40)
    reasons.push(`${fav.name} a un meilleur Elo (${fav.elo} vs ${und.elo})`)
  if ((favA ? A.momentum : B.momentum) >= 0.25)
    reasons.push(`${fav.name} est en pleine dynamique (${fav.formStr})`)
  if ((favA ? restA - restB : restB - restA) >= 2)
    reasons.push(`${fav.name} est mieux reposé (${favA ? restA : restB}j vs ${favA ? restB : restA}j)`)
  const favAtt = favA ? A.attAdj : B.attAdj
  const undDef = favA ? B.defAdj : A.defAdj
  if (favAtt >= 1.2 && undDef >= 1.05)
    reasons.push(`L'attaque de ${fav.name} cible une défense friable`)
  if (!reasons.length)
    reasons.push(`Match serré : léger avantage ${fav.name} au modèle global`)

  return {
    id: `${m.date}-${m.team1}-${m.team2}`.replace(/\s+/g, '_'),
    date: m.date, round: m.round, ground: m.ground || null, isKnockout,
    team1: m.team1, team2: m.team2,
    xg1: round2(lam1), xg2: round2(lam2),
    pWin1: pct(pW1), pDraw: pct(pD), pWin2: pct(pW2),
    pQual1: pct(pQual1), pQual2: pct(pQual2),
    topScores,
    odds: {
      win1: bookOdds(pW1),
      draw: bookOdds(pD),
      win2: bookOdds(pW2),
    },
    pick, pickProb: pct(pickProb), confidence, tight,
    blend: { data: pct(wData), elo: pct(1 - wData) },
    drivers, reasons: reasons.slice(0, 3),
    markets,
    absents: { team1: A.absents || [], team2: B.absents || [] },
    factors: {
      form: [A.formStr || '—', B.formStr || '—'],
      attack: [A.gfpg, B.gfpg],
      defense: [A.gapg, B.gapg],
      elo: [A.elo, B.elo],
      rest: [restA, restB],
    },
  }
}

// --- 6. Combinés : doubler/tripler la mise avec un max de probabilité --------
//
// Nos cotes sont "justes" (1/proba). À cotes justes, cote combinée = 1/(produit des
// probas), donc atteindre ×N revient à viser une proba combinée ≈ 1/N. On cherche
// donc le combiné dont la cote dépasse N le moins possible -> proba maximale.

function selectionsFor(p) {
  const list = []
  if (p.isKnockout) {
    const fav1 = p.pQual1 >= p.pQual2
    list.push({
      market: 'Qualification',
      sel: `${fav1 ? p.team1 : p.team2} se qualifie`,
      prob: Math.max(p.pQual1, p.pQual2) / 100,
    })
  } else {
    const opts = [
      { sel: `${p.team1} gagne`, prob: p.pWin1 / 100 },
      { sel: 'Match nul', prob: p.pDraw / 100 },
      { sel: `${p.team2} gagne`, prob: p.pWin2 / 100 },
    ].sort((a, b) => b.prob - a.prob)
    list.push({ market: 'Résultat', ...opts[0] })
    const dc = [
      { sel: `${p.team1} ou nul`, prob: p.markets.doubleChance['1X'] / 100 },
      { sel: `${p.team1} ou ${p.team2}`, prob: p.markets.doubleChance['12'] / 100 },
      { sel: `nul ou ${p.team2}`, prob: p.markets.doubleChance.X2 / 100 },
    ].sort((a, b) => b.prob - a.prob)
    list.push({ market: 'Double chance', ...dc[0] })
  }
  const ou = [
    { sel: '+1,5 but', prob: p.markets.over['1.5'].over / 100 },
    { sel: '−3,5 buts', prob: p.markets.over['3.5'].under / 100 },
    { sel: '−2,5 buts', prob: p.markets.over['2.5'].under / 100 },
    { sel: '+2,5 buts', prob: p.markets.over['2.5'].over / 100 },
  ].sort((a, b) => b.prob - a.prob)
  list.push({ market: 'Total buts', ...ou[0] })
  const b = p.markets.btts
  list.push({
    market: 'Les deux marquent',
    sel: b.yes >= b.no ? 'Oui' : 'Non',
    prob: Math.max(b.yes, b.no) / 100,
  })
  return list.map((s) => ({
    ...s, match: `${p.team1} – ${p.team2}`, date: p.date, odds: bookOdds(s.prob),
  }))
}

function buildCombo(predictions, targetOdds, mode) {
  // Un seul pari par match (légs indépendantes). mode 'safe' = sélection la plus
  // probable du match ; mode 'bold' = le résultat/qualification (plus de cote).
  const perMatch = predictions.map((p) => {
    const sels = selectionsFor(p)
    if (mode === 'bold') {
      const r = sels.find((s) => s.market === 'Qualification' || s.market === 'Résultat')
      return r || sels[0]
    }
    return sels.slice().sort((a, b) => b.prob - a.prob)[0]
  })

  // On part des plus sûrs et on accumule jusqu'à dépasser la cote cible
  perMatch.sort((a, b) => b.prob - a.prob)
  const legs = []
  let odds = 1, prob = 1
  for (const s of perMatch) {
    if (odds >= targetOdds || legs.length >= 8) break
    legs.push(s)
    odds *= s.odds // cote avec marge bookmaker
    prob *= s.prob
  }
  if (legs.length < 2) return null
  return {
    legs: legs.map((l) => ({
      match: l.match, date: l.date, market: l.market, sel: l.sel,
      prob: pct(l.prob), odds: l.odds,
    })),
    odds: round2(odds),
    prob: pct(prob),
  }
}

// Candidats "value" d'un match (issue + proba + cote juste)
function valueCandidates(p) {
  const c = []
  const add = (sel, prob, kind) => {
    if (prob > 0) c.push({
      sel, prob, kind,
      fairOdds: Math.round((100 / prob) * 100) / 100,
      match: `${p.team1} – ${p.team2}`, date: p.date, round: p.round,
    })
  }
  if (p.isKnockout) {
    const f1 = p.pQual1 >= p.pQual2
    add(`${f1 ? p.team1 : p.team2} qualifié`, Math.max(p.pQual1, p.pQual2), 'result')
    add(`${f1 ? p.team2 : p.team1} qualifié`, Math.min(p.pQual1, p.pQual2), 'underdog')
  } else {
    const o = [
      { s: `${p.team1} gagne`, v: p.pWin1 }, { s: 'Match nul', v: p.pDraw },
      { s: `${p.team2} gagne`, v: p.pWin2 },
    ].sort((a, b) => b.v - a.v)
    add(o[0].s, o[0].v, 'result')
  }
  const dc = p.markets.doubleChance
  add(`${p.team1} ou nul`, dc['1X'], 'dc')
  add(`nul ou ${p.team2}`, dc.X2, 'dc')
  add('+1,5 but', p.markets.over['1.5'].over, 'goals')
  add('+2,5 buts', p.markets.over['2.5'].over, 'goals')
  add('−3,5 buts', p.markets.over['3.5'].under, 'goals')
  add('Les deux marquent — Oui', p.markets.btts.yes, 'goals')
  return c
}

// Regroupe les prédictions par journée (ordre conservé)
function groupRounds(predictions) {
  const m = new Map()
  for (const p of predictions) {
    if (!m.has(p.round)) m.set(p.round, [])
    m.get(p.round).push(p)
  }
  return [...m.entries()]
}

// Top 3 par catégorie (sûr / compromis / value) sur un ensemble de matchs
function valuePicksFor(preds) {
  const all = []
  preds.forEach((p) => all.push(...valueCandidates(p)))
  const clean = (x) => ({
    sel: x.sel, prob: x.prob, fairOdds: x.fairOdds, match: x.match, date: x.date, round: x.round,
  })
  const topByMatch = (list, n) => {
    const seen = new Set(), out = []
    for (const x of list) {
      if (seen.has(x.match)) continue
      seen.add(x.match)
      out.push(clean(x))
      if (out.length >= n) break
    }
    return out
  }
  return {
    safest: topByMatch([...all].sort((a, b) => b.prob - a.prob), 3),
    balanced: topByMatch(all.filter((x) => x.prob >= 72 && x.prob <= 86).sort((a, b) => b.prob - a.prob), 3),
    value: topByMatch(all.filter((x) => x.fairOdds >= 1.55 && x.fairOdds <= 2.5).sort((a, b) => b.prob - a.prob), 3),
  }
}

function buildValuePicks(predictions, format) {
  if (!predictions.length) return null
  if (format === 'league') {
    return {
      perRound: true,
      rounds: groupRounds(predictions).map(([round, preds]) => ({ round, ...valuePicksFor(preds) })),
    }
  }
  return { perRound: false, phase: predictions[0]?.round || '', ...valuePicksFor(predictions) }
}

function combosFor(preds) {
  return {
    secure: buildCombo(preds, 1.18, 'safe'),
    safe: buildCombo(preds, 2.0, 'bold'),
    bold: buildCombo(preds, 3.0, 'bold'),
  }
}

function buildBets(predictions, format) {
  if (!predictions.length) return null
  const stakes = [10, 20, 30, 40, 50]
  if (format === 'league') {
    return {
      perRound: true, stakes,
      rounds: groupRounds(predictions).map(([round, preds]) => ({ round, ...combosFor(preds) })),
    }
  }
  return { perRound: false, stakes, ...combosFor(predictions) }
}

// --- 7. Backtest : track record du modèle vs résultats réels ------------------
//
// Pour chaque match joué, on reconstruit l'état du modèle avec UNIQUEMENT les
// matchs antérieurs (date < date du match) puis on prédit, et on compare au
// résultat réel. Pas de lookahead sur les résultats. (L'Elo utilisé est l'Elo
// courant d'eloratings — léger biais, signalé dans l'UI.)

function ensureTeam(teams, name, elo) {
  if (teams[name]) return teams[name]
  teams[name] = {
    name, group: null, elo: elo[name] ?? 1500,
    played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, wsum: 0,
    lateFor: 0, lateAgainst: 0, form: [], lastDate: null, log: [],
    gfpg: 0, gapg: 0, formStr: '', clutch: 0, points: 0,
    attAdj: 1, defAdj: 1, momentum: 0, availAtt: 1, availDef: 1,
    isHost: HOSTS.has(name),
  }
  return teams[name]
}

// Elo interne calculé depuis les résultats (compétitions sans Elo externe, ex. clubs).
// `played` doit être trié par date croissante. Écrit teams[n].elo.
function computeInternalElo(played, teams, format) {
  const R = {}
  const get = (n) => (R[n] ??= 1500)
  const K = 28
  const home = format === 'league' ? 60 : 0
  for (const m of played) {
    if (!m.score || !Array.isArray(m.score.ft)) continue
    const [g1, g2] = m.score.ft
    const ra = get(m.team1), rb = get(m.team2)
    const ea = 1 / (1 + Math.pow(10, -(ra - rb + home) / 400))
    const sa = g1 > g2 ? 1 : g1 < g2 ? 0 : 0.5
    const mult = Math.log(Math.abs(g1 - g2) + 1) + 1 // poids de la marge
    R[m.team1] = ra + K * mult * (sa - ea)
    R[m.team2] = rb + K * mult * (1 - sa - (1 - ea))
  }
  for (const n in R) if (teams[n]) teams[n].elo = Math.round(R[n])
}

export function backtest({ matches, elo, format = 'cup' }) {
  // Tous les matchs avec score (chaque prono est rejoué avec uniquement les matchs antérieurs)
  const played = matches
    .filter(hasScore)
    .sort((a, b) => a.date.localeCompare(b.date))

  const records = []
  let cR = 0, cB = 0, cO = 0

  const noExternalElo = !elo || !Object.keys(elo).length
  const isLeague = format === 'league'

  // Collectes pour les métriques probabilistes (log-loss / Brier) et la calibration.
  const modelRows = [] // { probs:[p1,pX,p2], actualIdx }  (modèle, ordre chronologique)
  const eloRows = []   // baseline Elo seul
  const baseRows = []  // baseline taux historiques (naïf)
  const relPairs = []  // { x: proba du pick, y: réussite 0/1 }
  let n1 = 0, nX = 0, n2 = 0 // compteurs d'issues DÉJÀ vues (base-rate point-in-time)

  const idxOf = (a) => (a === '1' ? 0 : a === 'X' ? 1 : 2)

  for (const m of played) {
    const prior = parseGames(matches, m.date) // matchs strictement antérieurs
    const { teams, leagueAvg } = buildTeams(prior.games, elo, m.date)
    solveStrengths(teams, leagueAvg)
    if (noExternalElo) computeInternalElo(prior.played, teams, format)
    computeMomentum(teams, elo)
    applyAvailability(teams, {})
    ensureTeam(teams, m.team1, elo)
    ensureTeam(teams, m.team2, elo)

    const pred = predict(m, teams, leagueAvg, m.date, format)
    if (!pred) continue

    const [g1, g2] = m.score.ft
    const actual = g1 > g2 ? '1' : g1 < g2 ? '2' : 'X'
    const ai = idxOf(actual)

    // -- Probabilités normalisées du modèle (fractions) --
    let mp = [pred.pWin1 / 100, pred.pDraw / 100, pred.pWin2 / 100]
    const ms = mp[0] + mp[1] + mp[2] || 1
    mp = mp.map((x) => x / ms)
    modelRows.push({ probs: mp, actualIdx: ai })

    // -- Baseline « taux historiques » (avant CE match) --
    const N = n1 + nX + n2
    const bp = N
      ? [(n1 + 1) / (N + 3), (nX + 1) / (N + 3), (n2 + 1) / (N + 3)]
      : [0.4, 0.28, 0.32]
    const bs = bp[0] + bp[1] + bp[2]
    baseRows.push({ probs: bp.map((x) => x / bs), actualIdx: ai })

    // -- Baseline « Elo seul » : proba victoire Elo + taux de nul empirique --
    const eA = teams[m.team1]?.elo ?? 1500
    const eB = teams[m.team2]?.elo ?? 1500
    const homeElo = isLeague ? 65 : (HOSTS.has(m.team1) ? 60 : 0) - (HOSTS.has(m.team2) ? 60 : 0)
    const pElo1 = eloWinProb(eA + homeElo, eB)
    const pXbase = N ? clamp((nX + 1) / (N + 3), 0.15, 0.35) : 0.27
    const ep = [(1 - pXbase) * pElo1, pXbase, (1 - pXbase) * (1 - pElo1)]
    const es = ep[0] + ep[1] + ep[2]
    eloRows.push({ probs: ep.map((x) => x / es), actualIdx: ai })

    if (actual === '1') n1++; else if (actual === 'X') nX++; else n2++

    const probs = [
      { k: '1', p: pred.pWin1 }, { k: 'X', p: pred.pDraw }, { k: '2', p: pred.pWin2 },
    ].sort((a, b) => b.p - a.p)
    const predicted = probs[0].k
    const hitR = predicted === actual
    relPairs.push({ x: probs[0].p / 100, y: hitR ? 1 : 0 })

    const bttsPred = pred.markets.btts.yes >= 50
    const bttsActual = g1 >= 1 && g2 >= 1
    const hitB = bttsPred === bttsActual

    const ouPred = pred.markets.over['2.5'].over >= 50
    const ouActual = g1 + g2 > 2.5
    const hitO = ouPred === ouActual

    if (hitR) cR++
    if (hitB) cB++
    if (hitO) cO++

    records.push({
      date: m.date, group: m.group || null,
      team1: m.team1, team2: m.team2, score: `${g1} - ${g2}`,
      predicted,
      predLabel: predicted === '1' ? m.team1 : predicted === '2' ? m.team2 : 'Match nul',
      prob: probs[0].p,
      actual, hit: hitR,
      btts: { pred: bttsPred ? 'Oui' : 'Non', hit: hitB },
      ou25: { pred: ouPred ? '+2,5' : '−2,5', hit: hitO },
    })
  }

  const n = records.length || 1
  const p1 = (x) => Math.round((x / n) * 1000) / 10
  records.reverse() // plus récent d'abord

  // Paires (proba d'issue, réalisée) poolées sur 1/N/2 pour la calibration isotonique.
  const calPairsFrom = (rows) =>
    rows.flatMap((r) => r.probs.map((p, i) => ({ x: p, y: i === r.actualIdx ? 1 : 0 })))
  const applyCal = (cal, row) => {
    const c = row.probs.map((p) => applyIsotonic(cal, p))
    const s = c[0] + c[1] + c[2] || 1
    return { probs: c.map((x) => x / s), actualIdx: row.actualIdx }
  }

  // Carte finale (tout l'historique) — utilisée pour redresser les prédictions à venir.
  const calibrationMap = fitIsotonic(calPairsFrom(modelRows))

  // Vérif HONNÊTE : on ajuste la calibration sur 70 % (chrono) et on mesure sur les 30 % suivants.
  let modelOOS = null, calibratedOOS = null
  if (modelRows.length >= 30) {
    const split = Math.floor(modelRows.length * 0.7)
    const train = modelRows.slice(0, split)
    const test = modelRows.slice(split)
    const calT = fitIsotonic(calPairsFrom(train))
    modelOOS = scoreSet(test)
    calibratedOOS = scoreSet(test.map((r) => applyCal(calT, r)))
  }

  // Métriques probabilistes (1N2) : le modèle vs deux baselines. Plus bas = mieux.
  const metrics = {
    model: scoreSet(modelRows),
    baselineElo: scoreSet(eloRows),
    baselineRate: scoreSet(baseRows),
    calibration: reliability(relPairs),
    holdout: { raw: modelOOS, calibrated: calibratedOOS }, // out-of-sample (30 % final)
  }

  return {
    summary: {
      total: records.length,
      result: { correct: cR, pct: p1(cR) },
      btts: { correct: cB, pct: p1(cB) },
      ou25: { correct: cO, pct: p1(cO) },
      metrics,
    },
    calibrationMap,
    matches: records,
  }
}

// --- Orchestration -----------------------------------------------------------

export function buildModel({
  matches, trainMatches = [], elo, availability = {}, asOf,
  format = 'cup', maxUpcoming = Infinity,
}) {
  // Profil d'hyperparamètres selon le format (coupe vs championnat).
  Object.assign(TUNABLE, format === 'league' ? PROFILES.league : PROFILES.cup)

  const hasTrain = trainMatches.length > 0
  // Joué vs à venir = présence d'un SCORE (pas la date) -> bascule auto dès qu'un
  // résultat est publié par la source.
  const strengthInput = hasTrain ? [...trainMatches, ...matches] : matches
  const strengthPlayed = strengthInput.filter(hasScore).sort((a, b) => a.date.localeCompare(b.date))
  const games = gamesFrom(strengthPlayed)
  const { teams, leagueAvg } = buildTeams(games, elo, asOf)
  solveStrengths(teams, leagueAvg)
  if (!elo || !Object.keys(elo).length) computeInternalElo(strengthPlayed, teams, format)
  computeMomentum(teams, elo)
  applyAvailability(teams, availability)

  // Saison à AFFICHER (résultats/classement) = matchs joués de la compétition courante
  const displayPlayed = matches.filter(hasScore)

  // Participants de la saison courante : prior "promu" pour ceux sans historique
  const participants = [...new Set(matches.flatMap((m) => [m.team1, m.team2]))]
  if (hasTrain) {
    const knownElos = Object.values(teams).map((t) => t.elo)
    const promotedElo = (knownElos.length ? Math.min(...knownElos) : 1450) - 25
    for (const name of participants) {
      if (!teams[name]) {
        ensureTeam(teams, name, elo)
        teams[name].elo = promotedElo
        teams[name].attAdj = 0.9
        teams[name].defAdj = 1.12
        teams[name].promoted = true
      }
    }
  }

  // Rang Elo
  Object.values(teams).sort((a, b) => b.elo - a.elo).forEach((t, i) => { t.eloRank = i + 1 })

  // Classement
  let groups = {}
  if (format === 'cup') {
    for (const t of Object.values(teams)) {
      if (!t.group) continue
      ;(groups[t.group] ??= []).push(t)
    }
  }
  if (!Object.keys(groups).length) {
    // Championnat : table de la saison courante (vide avant le coup d'envoi)
    const base = hasTrain
      ? participants.map((n) => ({
          name: n, group: null, elo: teams[n]?.elo ?? 1500, eloRank: teams[n]?.eloRank,
          attAdj: teams[n]?.attAdj, defAdj: teams[n]?.defAdj, promoted: teams[n]?.promoted || false,
          played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, points: 0,
        }))
      : Object.values(teams)
    if (hasTrain) {
      const rec = Object.fromEntries(base.map((t) => [t.name, t]))
      for (const m of displayPlayed) {
        const [g1, g2] = m.score.ft
        const a = rec[m.team1], b = rec[m.team2]
        if (!a || !b) continue
        a.played++; b.played++; a.gf += g1; a.ga += g2; b.gf += g2; b.ga += g1
        if (g1 > g2) { a.w++; a.points += 3; b.l++ }
        else if (g1 < g2) { b.w++; b.points += 3; a.l++ }
        else { a.d++; b.d++; a.points++; b.points++ }
      }
    }
    groups['Classement'] = base
  }
  for (const g of Object.keys(groups)) {
    groups[g].sort(
      (x, y) => y.points - x.points || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || y.elo - x.elo,
    )
  }

  // Track record + métriques + carte de calibration (rejoué point-in-time).
  const history = backtest({ matches: hasTrain ? trainMatches : matches, elo, format })

  // On n'active la calibration QUE si elle améliore (ou n'aggrave pas) le log-loss
  // out-of-sample (30 % final). Garantie « pas de régression » de qualité.
  const ho = history.summary.metrics.holdout
  const calibrationOn =
    ho?.raw && ho?.calibrated && ho.calibrated.logLoss <= ho.raw.logLoss + 1e-9
      ? history.calibrationMap
      : null
  history.summary.metrics.calibrationApplied = Boolean(calibrationOn)

  // Prédictions = matchs SANS score (à venir), 1N2 calibré si ça aide
  const upcoming = matches
    .filter((m) => !hasScore(m))
    .sort((a, b) => (a.journee ?? 0) - (b.journee ?? 0) || a.date.localeCompare(b.date))
  const predictions = upcoming
    .map((m) => predict(m, teams, leagueAvg, asOf, format, calibrationOn))
    .filter(Boolean)
    .slice(0, maxUpcoming)
  const bets = buildBets(predictions, format)
  const valuePicks = buildValuePicks(predictions, format)

  const results = displayPlayed
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((m) => ({
      date: m.date, round: m.round, group: m.group || null,
      team1: m.team1, team2: m.team2, score: m.score.ft.join(' - '),
    }))

  // Nettoyage des champs internes lourds avant export
  const teamsOut = {}
  for (const [n, t] of Object.entries(teams)) {
    const { log, form, ...rest } = t
    teamsOut[n] = rest
  }
  const groupsOut = {}
  for (const [g, arr] of Object.entries(groups)) {
    groupsOut[g] = arr.map((t) => {
      const { log, form, ...rest } = t
      return rest
    })
  }

  return {
    leagueAvg: round2(leagueAvg), format,
    teams: teamsOut, groups: groupsOut, predictions, results, bets, valuePicks, history,
    counts: {
      teams: hasTrain ? participants.length : Object.keys(teams).length,
      played: strengthPlayed.length,
      upcoming: predictions.length,
    },
  }
}
