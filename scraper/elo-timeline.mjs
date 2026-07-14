// OddSight — Elo POINT-IN-TIME pour le backtest.
//
// Le backtest rejoue les matchs passés pour mesurer le modèle. Il doit donc leur
// appliquer l'Elo tel qu'il était AVANT le match. Or eloratings.net ne publie que
// l'Elo courant, qui intègre déjà le résultat de ces matchs : s'en servir pour
// « prédire » le passé, c'est du lookahead (le Maroc a pris +103 pts pendant la CM,
// le backtest « devinait » donc son parcours avec un Elo qui le connaissait déjà).
//
// On reconstruit l'historique : on déroule à l'envers les mises à jour Elo des
// matchs joués pour retrouver l'Elo d'avant tournoi, puis on rejoue en avant pour
// obtenir un instantané à chaque date. Formule d'eloratings.net :
//
//   R' = R + K · mult(|diff de buts|) · (W − We)
//   We = 1 / (10^(−dr/400) + 1)   avec dr = écart d'Elo (+100 pour l'hôte)
//
// La mise à jour est à somme nulle : ce que l'un gagne, l'autre le perd.

const K = 60 // phase finale de Coupe du Monde
const gdMult = (gd) => (gd < 2 ? 1 : gd === 2 ? 1.5 : gd === 3 ? 1.75 : 1.75 + (gd - 3) / 8)
const we = (dr) => 1 / (Math.pow(10, -dr / 400) + 1)

// Variation d'Elo de l'équipe 1 (l'équipe 2 reçoit l'opposé).
function delta(diff, g1, g2, host1, host2) {
  const dr = diff + (host1 ? 100 : 0) - (host2 ? 100 : 0)
  const w = g1 > g2 ? 1 : g1 < g2 ? 0 : 0.5
  return K * gdMult(Math.abs(g1 - g2)) * (w - we(dr))
}

// Inverse : on connaît l'écart d'Elo APRÈS le match, on retrouve celui d'AVANT.
// diffAprès = diffAvant + 2·delta(diffAvant) est strictement croissant → bissection.
function diffBefore(diffAfter, g1, g2, host1, host2) {
  let lo = diffAfter - 400, hi = diffAfter + 400
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (mid + 2 * delta(mid, g1, g2, host1, host2) < diffAfter) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

const hasScore = (m) => m.score && Array.isArray(m.score.ft)

// Renvoie eloAt(date) -> { équipe: Elo } : l'Elo tel qu'il était à l'ouverture de
// cette date. Renvoie null si l'Elo externe est absent (les championnats utilisent
// l'Elo interne, déjà calculé point-in-time — pas de lookahead à corriger).
export function buildEloTimeline(matches, eloNow, hosts = new Set()) {
  if (!eloNow || !Object.keys(eloNow).length) return null
  const played = matches.filter(hasScore).sort((a, b) => a.date.localeCompare(b.date))
  if (!played.length) return null

  // 1. Rollback : de l'Elo d'aujourd'hui jusqu'à l'Elo d'avant le premier match.
  const R = { ...eloNow }
  for (const m of [...played].reverse()) {
    if (R[m.team1] == null || R[m.team2] == null) continue
    const [g1, g2] = m.score.ft
    const sum = R[m.team1] + R[m.team2]
    const before = diffBefore(R[m.team1] - R[m.team2], g1, g2, hosts.has(m.team1), hosts.has(m.team2))
    R[m.team1] = (sum + before) / 2
    R[m.team2] = (sum - before) / 2
  }

  // 2. Replay : un instantané avant chaque journée de matchs.
  const snapshots = new Map() // date -> Elo à l'ouverture de la date
  const cur = { ...R }
  for (const m of played) {
    if (!snapshots.has(m.date)) snapshots.set(m.date, { ...cur })
    if (cur[m.team1] == null || cur[m.team2] == null) continue
    const [g1, g2] = m.score.ft
    const d = delta(cur[m.team1] - cur[m.team2], g1, g2, hosts.has(m.team1), hosts.has(m.team2))
    cur[m.team1] += d
    cur[m.team2] -= d
  }

  const dates = [...snapshots.keys()].sort()
  const preTournament = { ...R }

  return (date) => {
    if (snapshots.has(date)) return snapshots.get(date)
    // Date hors des jours joués : le dernier instantané antérieur (ou l'avant-tournoi).
    let snap = preTournament
    for (const d of dates) {
      if (d > date) break
      snap = snapshots.get(d)
    }
    return snap
  }
}
