// Lecteur XLSX minimal, SANS dépendance (un .xlsx = un ZIP de XML).
// Utilisé par le backtest tennis (tennis-data.co.uk ne publie qu'en xlsx).
// On n'a besoin que de ça : lire la 1re feuille en tableau d'objets { colonne: valeur }.

import { inflateRawSync } from 'node:zlib'

// --- ZIP : on passe par le central directory (tailles toujours correctes) -----
function unzip(buf) {
  // End Of Central Directory : signature 0x06054b50, cherchée depuis la fin
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('xlsx : archive ZIP illisible')
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)

  const files = {}
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)

    // En-tête local : les longueurs peuvent différer de celles du central directory
    const lNameLen = buf.readUInt16LE(localOff + 26)
    const lExtraLen = buf.readUInt16LE(localOff + 28)
    const start = localOff + 30 + lNameLen + lExtraLen
    const raw = buf.subarray(start, start + compSize)
    files[name] = method === 8 ? inflateRawSync(raw) : raw

    off += 46 + nameLen + extraLen + commentLen
  }
  return files
}

// --- XML : extraction sans parseur générique (structure connue et stable) -----
const unescape = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&')

function sharedStrings(xml) {
  if (!xml) return []
  const out = []
  for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) || []) {
    // Un <si> peut être découpé en plusieurs <t> (texte enrichi) : on concatène.
    const parts = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1]))
    out.push(parts.join(''))
  }
  return out
}

const colOf = (ref) => ref.replace(/\d+/g, '') // "BC12" -> "BC"

// Date Excel (nombre de jours depuis 1900, avec le bug du 29/02/1900) -> YYYY-MM-DD
function excelDate(n) {
  const ms = (n - 25569) * 86400000
  return new Date(ms).toISOString().slice(0, 10)
}

// Lit la 1re feuille et renvoie [{ Header: valeur }]. `dateCols` : colonnes à
// convertir depuis le format date d'Excel (elles arrivent en nombre de jours).
export function readXlsx(buffer, { dateCols = [] } = {}) {
  const files = unzip(buffer)
  const sheetName = Object.keys(files).find((f) => /^xl\/worksheets\/sheet1\.xml$/.test(f))
  if (!sheetName) throw new Error('xlsx : feuille introuvable')
  const strings = sharedStrings(files['xl/sharedStrings.xml']?.toString('utf8'))
  const xml = files[sheetName].toString('utf8')

  const rows = []
  for (const rowXml of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []) {
    const cells = {}
    for (const m of rowXml.matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const [, ref, attrs, body] = m
      const type = /t="([^"]+)"/.exec(attrs)?.[1]
      let v
      if (type === 'inlineStr') v = unescape(/<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? '')
      else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
        if (raw == null) continue
        v = type === 's' ? strings[+raw] : raw
      }
      cells[ref] = v
    }
    rows.push(cells)
  }
  if (!rows.length) return []

  const header = {}
  for (const [ref, v] of Object.entries(rows[0])) header[colOf(ref)] = String(v).trim()

  const out = []
  for (const r of rows.slice(1)) {
    const o = {}
    for (const [ref, v] of Object.entries(r)) {
      const key = header[colOf(ref)]
      if (!key) continue
      o[key] = dateCols.includes(key) && /^\d+(\.\d+)?$/.test(v) ? excelDate(+v) : v
    }
    if (Object.keys(o).length) out.push(o)
  }
  return out
}
