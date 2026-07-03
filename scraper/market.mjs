// OddSight — cotes de CLÔTURE réelles (football-data.co.uk, gratuit) pour
// benchmarker le modèle contre le marché (l'estimation agrégée la plus efficace).
// Renvoie une Map `date|home|away` -> { probs:[pH,pD,pA] dé-marginées, odds }.

// Cotes de clôture préférées : Pinnacle (sharp) > Bet365 > moyenne du marché.
const CLOSING = [
  ['PSCH', 'PSCD', 'PSCA'],
  ['B365CH', 'B365CD', 'B365CA'],
  ['AvgCH', 'AvgCD', 'AvgCA'],
]

// DD/MM/YYYY (ou YY) -> YYYY-MM-DD
function toISO(d) {
  const m = (d || '').split('/')
  if (m.length !== 3) return null
  const [dd, mm, yy] = m
  const y = yy.length === 2 ? `20${yy}` : yy
  return `${y}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

export async function fetchMarketOdds(url, nameMap = {}) {
  const map = new Map()
  let text
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    text = await res.text()
  } catch (e) {
    console.warn(`  ⚠ cotes marché indisponibles (${e.message})`)
    return map
  }
  const rows = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (rows.length < 2) return map
  const H = rows[0].split(',')
  const idx = (n) => H.indexOf(n)
  const iDate = idx('Date'), iH = idx('HomeTeam'), iA = idx('AwayTeam')
  if (iDate < 0 || iH < 0 || iA < 0) return map
  const iHST = idx('HST'), iAST = idx('AST') // tirs cadrés (proxy xG)
  const name = (n) => nameMap[n] || n

  const pickOdds = (r) => {
    for (const [h, d, a] of CLOSING) {
      const oH = +r[idx(h)], oD = +r[idx(d)], oA = +r[idx(a)]
      if (oH > 1 && oD > 1 && oA > 1) return [oH, oD, oA]
    }
    return null
  }

  for (const line of rows.slice(1)) {
    const r = line.split(',')
    const o = pickOdds(r)
    if (!o) continue
    const date = toISO(r[iDate])
    if (!date || date.includes('NaN')) continue
    const home = name(r[iH]), away = name(r[iA])
    // Dé-marginage proportionnel : probabilités qui somment à 1.
    const s = 1 / o[0] + 1 / o[1] + 1 / o[2]
    const hst = +r[iHST], ast = +r[iAST]
    const sot = iHST >= 0 && Number.isFinite(hst) && Number.isFinite(ast) ? [hst, ast] : null
    map.set(`${date}|${home}|${away}`, { probs: [1 / o[0] / s, 1 / o[1] / s, 1 / o[2] / s], odds: o, sot })
  }
  return map
}

// Attache un proxy xG (tirs cadrés mis à l'échelle des buts) aux matchs joués,
// via la Map marché (qui contient `sot`). Modifie en place (m.xg). Le facteur de
// conversion cale la moyenne des tirs cadrés sur celle des buts (échelle λ correcte).
export function attachXgProxy(matches, market) {
  if (!market?.size) return 0
  let sumG = 0, sumS = 0, matched = 0
  const key = (m) => `${m.date}|${m.team1}|${m.team2}`
  for (const m of matches) {
    const mk = market.get(key(m))
    if (mk?.sot && m.score?.ft) { sumG += m.score.ft[0] + m.score.ft[1]; sumS += mk.sot[0] + mk.sot[1]; matched++ }
  }
  const conv = sumS ? sumG / sumS : 0
  if (!conv) return 0
  for (const m of matches) {
    const mk = market.get(key(m))
    if (mk?.sot) m.xg = [mk.sot[0] * conv, mk.sot[1] * conv]
  }
  console.log(`✓ proxy xG (tirs cadrés) sur ${matched} matchs · conv=${conv.toFixed(3)}`)
  return matched
}
