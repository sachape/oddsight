// Sources de données réelles pour OddSight
//  - openfootball : résultats de la Coupe du Monde 2026 (scores, buts, minutes)
//  - eloratings.net : Elo mondial actuel de chaque nation (force de base / historique)
//  - availability.json : flux blessures/suspensions (éditable / API live)

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const OPENFOOTBALL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
const ELO_TSV = 'https://www.eloratings.net/World.tsv'

// Équipe -> code pays utilisé par eloratings.net (≈ ISO2, avec quelques exceptions)
export const ELO_CODE = {
  Algeria: 'DZ', Argentina: 'AR', Australia: 'AU', Austria: 'AT', Belgium: 'BE',
  'Bosnia & Herzegovina': 'BA', Brazil: 'BR', Canada: 'CA', 'Cape Verde': 'CV',
  Colombia: 'CO', Croatia: 'HR', 'Curaçao': 'CW', 'Czech Republic': 'CZ',
  'DR Congo': 'CD', Ecuador: 'EC', Egypt: 'EG', England: 'EN', France: 'FR',
  Germany: 'DE', Ghana: 'GH', Haiti: 'HT', Iran: 'IR', Iraq: 'IQ',
  'Ivory Coast': 'CI', Japan: 'JP', Jordan: 'JO', Mexico: 'MX', Morocco: 'MA',
  Netherlands: 'NL', 'New Zealand': 'NZ', Norway: 'NO', Panama: 'PA',
  Paraguay: 'PY', Portugal: 'PT', Qatar: 'QA', 'Saudi Arabia': 'SA',
  Scotland: 'SQ', Senegal: 'SN', 'South Africa': 'ZA', 'South Korea': 'KR',
  Spain: 'ES', Sweden: 'SE', Switzerland: 'CH', Tunisia: 'TN', Turkey: 'TR',
  USA: 'US', Uruguay: 'UY', Uzbekistan: 'UZ',
}

export async function fetchMatches() {
  const res = await fetch(OPENFOOTBALL, { headers: { 'User-Agent': 'OddSight/0.2' } })
  if (!res.ok) throw new Error(`openfootball injoignable (HTTP ${res.status})`)
  const data = await res.json()
  return { name: data.name, matches: data.matches || [] }
}

// Dernier Elo connu, versionné dans le repo. eloratings tombe régulièrement (≈1 run
// sur 4 en CI). Sans ce cache, `fetchElo` renvoyait {} et le moteur basculait EN
// SILENCE sur l'Elo interne : un modèle totalement différent (tout le monde à 1500,
// seuls les matchs du tournoi comptent). Le profil coupe s'appuyant à ~90 % sur l'Elo,
// le favori pouvait s'inverser d'une heure à l'autre selon qu'eloratings répondait.
// Un Elo vieux de quelques heures est incomparablement meilleur que pas d'Elo du tout.
const ELO_CACHE = resolve(__dirname, 'elo-cache.json')
const MIN_TEAMS = 40 // en dessous, la réponse est tronquée : on ne s'en sert pas

// Renvoie { elo: { "France": 2163, ... }, source, fetchedAt }.
export async function fetchElo() {
  try {
    const res = await fetch(ELO_TSV, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/tab-separated-values,text/plain,*/*' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const byCode = {}
    for (const line of text.split('\n')) {
      const c = line.split('\t')
      if (c.length > 3) {
        const code = c[2]
        const elo = parseInt(c[3], 10)
        if (code && Number.isFinite(elo)) byCode[code] = elo
      }
    }
    const byTeam = {}
    for (const [team, code] of Object.entries(ELO_CODE)) {
      if (byCode[code] != null) byTeam[team] = byCode[code]
    }
    if (Object.keys(byTeam).length < MIN_TEAMS) throw new Error(`${Object.keys(byTeam).length} équipes seulement`)
    const fetchedAt = new Date().toISOString()
    try {
      writeFileSync(ELO_CACHE, JSON.stringify({ fetchedAt, elo: byTeam }, null, 2))
    } catch { /* cache non écrivable (CI) : sans conséquence */ }
    return { elo: byTeam, source: 'eloratings.net', fetchedAt }
  } catch (e) {
    console.warn(`⚠ eloratings indisponible (${e.message})`)
    try {
      const cached = JSON.parse(readFileSync(ELO_CACHE, 'utf-8'))
      const n = Object.keys(cached.elo || {}).length
      if (n >= MIN_TEAMS) {
        console.warn(`  → repli sur le cache Elo du ${cached.fetchedAt} (${n} équipes)`)
        return { elo: cached.elo, source: `cache eloratings (${cached.fetchedAt})`, fetchedAt: cached.fetchedAt }
      }
    } catch { /* pas de cache */ }
    console.warn('  → aucun cache : repli sur l\'Elo interne (modèle dégradé)')
    return { elo: {}, source: 'Elo interne (eloratings ET cache indisponibles)', fetchedAt: null }
  }
}

// Charge le flux de disponibilité (blessures/suspensions). Renvoie { team: [players] }.
// Pour brancher une API live, remplacer la lecture du fichier par un fetch ici.
export function loadAvailability() {
  try {
    const raw = JSON.parse(readFileSync(resolve(__dirname, 'availability.json'), 'utf-8'))
    const out = {}
    for (const [team, players] of Object.entries(raw)) {
      if (team.startsWith('_')) continue
      out[team] = players
    }
    return out
  } catch {
    return {}
  }
}
