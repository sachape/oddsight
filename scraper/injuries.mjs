// Récupération LIVE des blessures/suspensions via API-Football v3
// (https://v3.football.api-sports.io). Clé lue dans la variable d'env APIFOOTBALL_KEY.
//
//   node --env-file=scraper/.env.local scraper/build.mjs
//   (avec APIFOOTBALL_KEY=xxx dans scraper/.env.local)
//
// Sans clé, la fonction renvoie null et le pipeline retombe sur availability.json.

const BASE = 'https://v3.football.api-sports.io'
const WC_LEAGUE = Number(process.env.APIFOOTBALL_WC_LEAGUE || 1) // 1 = Coupe du Monde
const SEASON = Number(process.env.APIFOOTBALL_SEASON || 2026)

// Nom d'équipe API-Football -> notre nom (openfootball)
const TEAM_ALIAS = {
  'Korea Republic': 'South Korea',
  Czechia: 'Czech Republic',
  "Côte d'Ivoire": 'Ivory Coast',
  'Congo DR': 'DR Congo',
  'DR Congo': 'DR Congo',
  Türkiye: 'Turkey',
  USA: 'USA',
  'United States': 'USA',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'Cape Verde Islands': 'Cape Verde',
  'Cabo Verde': 'Cape Verde',
  'Curacao': 'Curaçao',
}

// Poste API-Football -> notre catégorie
function mapPos(pos) {
  const p = (pos || '').toLowerCase()
  if (p.startsWith('goal')) return 'GK'
  if (p.startsWith('def')) return 'DEF'
  if (p.startsWith('mid')) return 'MID'
  if (p.startsWith('att') || p.startsWith('for')) return 'FWD'
  return 'MID' // défaut si l'API ne renvoie pas le poste
}

// Suspension vs blessure d'après le motif renvoyé par l'API
function mapStatus(reason, type) {
  const s = `${reason || ''} ${type || ''}`.toLowerCase()
  return /suspend|red card|cards|banned/.test(s) ? 'suspension' : 'injury'
}

export async function fetchInjuries({ asOf } = {}) {
  const key = process.env.APIFOOTBALL_KEY
  if (!key) return null

  const url = `${BASE}/injuries?league=${WC_LEAGUE}&season=${SEASON}`
  const res = await fetch(url, { headers: { 'x-apisports-key': key } })
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`)
  const json = await res.json()
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error('API-Football: ' + JSON.stringify(json.errors))
  }

  // On ne garde que les absences liées à des matchs à venir (>= asOf),
  // et le dernier statut connu par joueur.
  const latest = new Map() // playerId -> { team, name, status, pos, date }
  for (const row of json.response || []) {
    const fixtureDate = row.fixture?.date?.slice(0, 10)
    if (asOf && fixtureDate && fixtureDate < asOf) continue
    const apiTeam = row.team?.name
    const team = TEAM_ALIAS[apiTeam] || apiTeam
    const pid = row.player?.id ?? `${team}-${row.player?.name}`
    const prev = latest.get(pid)
    if (prev && prev.date >= (fixtureDate || '')) continue
    // type "Questionable" = incertain (pas forcément absent) -> impact réduit
    const questionable = (row.player?.type || '').toLowerCase().includes('question')
    latest.set(pid, {
      team,
      name: row.player?.name || 'Inconnu',
      status: mapStatus(row.player?.reason, row.player?.type),
      pos: mapPos(row.player?.position), // l'API /injuries ne renvoie pas le poste -> MID
      importance: questionable ? 0.3 : 0.55, // l'API ne fournit pas l'importance réelle
      date: fixtureDate || '',
    })
  }

  const out = {}
  for (const p of latest.values()) {
    ;(out[p.team] ??= []).push({
      name: p.name, status: p.status, pos: p.pos, importance: p.importance,
    })
  }
  return out
}
