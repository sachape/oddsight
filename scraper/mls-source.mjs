// OddSight — source MLS partagée (builder + tuner).
// Récupère la saison MLS en cours depuis l'API scoreboard ESPN (usa.1), gratuite
// et sans clé : résultats terminés (avec score) ET calendrier à venir, d'une seule
// source, donc noms d'équipes et appariements calendrier/résultats cohérents.

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates='
const ymd = (iso) => iso.replaceAll('-', '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Le All-Star Game (exhibition) apparaît dans le flux : on l'exclut, ce ne sont
// pas des clubs MLS et ça fausserait forces d'équipe et classement.
const NOT_CLUBS = new Set(['MLS All-Stars', 'Liga MX All-Stars'])

// Noms ESPN -> noms d'affichage plus courts (appliqués uniformément après fetch,
// donc calendrier et résultats restent appariés). On ne renomme que pour la lisibilité.
const NAME = {
  'Atlanta United FC': 'Atlanta United', 'Chicago Fire FC': 'Chicago Fire',
  'Houston Dynamo FC': 'Houston Dynamo', 'Minnesota United FC': 'Minnesota United',
  'Seattle Sounders FC': 'Seattle Sounders', 'St. Louis CITY SC': 'St. Louis City',
  'Red Bull New York': 'New York Red Bulls', 'Vancouver Whitecaps FC': 'Vancouver Whitecaps',
}
const clean = (n) => NAME[n] || n

// Découpe [from, to] en tranches acceptées par l'API (plage YYYYMMDD-YYYYMMDD).
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

async function scoreboard(dates, tries = 3) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + dates)
      if (res.ok) return res.json()
      if (res.status < 500) throw new Error(`HTTP ${res.status}`)
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) { lastErr = e }
    if (i < tries - 1) await sleep(400 * (i + 1))
  }
  throw new Error(`ESPN usa.1 ${dates} → ${lastErr.message}`)
}

// Lundi (UTC) de la semaine d'une date ISO — clé de regroupement "journée".
function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7 // 0 = lundi
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
function weekLabel(mondayIso) {
  const d = new Date(mondayIso + 'T00:00:00Z')
  return `Sem. du ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`
}

// Récupère toute la saison civile de la MLS englobant `asOf` (fév.→déc.).
// Renvoie les matchs triés par date, avec { date, team1(dom.), team2(ext.), score?,
// round(semaine), journee(index semaine à venir) }.
export async function fetchMlsSeason({ asOf }) {
  const year = asOf.slice(0, 4)
  const from = `${year}-02-01`, to = `${year}-12-15`
  const out = []
  const seen = new Set()
  for (const seg of segments(from, to)) {
    let data
    try { data = await scoreboard(seg) } catch (e) { console.warn(`  ⚠ ${e.message} — tranche ignorée`); continue }
    for (const e of data.events || []) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      const state = e.status?.type?.state // 'pre' | 'in' | 'post'
      const comp = e.competitions?.[0]
      const home = comp?.competitors?.find((c) => c.homeAway === 'home')
      const away = comp?.competitors?.find((c) => c.homeAway === 'away')
      if (!home || !away) continue
      const h = clean(home.team.displayName), a = clean(away.team.displayName)
      if (NOT_CLUBS.has(h) || NOT_CLUBS.has(a)) continue
      const m = { date: (e.date || '').slice(0, 10), team1: h, team2: a } // team1 = domicile
      if (state === 'post') {
        const hg = Number(home.score), ag = Number(away.score)
        if (Number.isFinite(hg) && Number.isFinite(ag)) m.score = { ft: [hg, ag] }
      }
      out.push(m)
    }
  }
  out.sort((x, y) => x.date.localeCompare(y.date))

  // Regroupement "journée" par semaine calendaire, indexé sur les matchs à venir.
  const weeks = [...new Set(out.filter((m) => !m.score).map((m) => mondayOf(m.date)))].sort()
  const weekIdx = new Map(weeks.map((w, i) => [w, i + 1]))
  for (const m of out) {
    const mon = mondayOf(m.date)
    m.round = weekLabel(mon)
    m.journee = weekIdx.get(mon) ?? 0
  }
  return { matches: out, weeks: weeks.length, year }
}
