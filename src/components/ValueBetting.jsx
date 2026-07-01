import { useMemo, useState } from 'react'
import { flag } from '../flags.js'
import JourneeSelect from './JourneeSelect.jsx'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const fmtDate = (iso) => dateFmt.format(new Date(iso + 'T12:00:00'))

// Les issues "value-vérifiables" d'un match, avec la proba du modèle (en %)
function selectionsFor(p) {
  const rows = []
  if (p.isKnockout) {
    rows.push({ key: 'q1', label: `${p.team1} qualifié`, prob: p.pQual1 })
    rows.push({ key: 'q2', label: `${p.team2} qualifié`, prob: p.pQual2 })
  }
  rows.push({ key: '1', label: `${p.team1} gagne (90 min)`, prob: p.pWin1 })
  rows.push({ key: 'X', label: 'Match nul (90 min)', prob: p.pDraw })
  rows.push({ key: '2', label: `${p.team2} gagne (90 min)`, prob: p.pWin2 })
  rows.push({ key: 'btts_y', label: 'Les deux marquent — Oui', prob: p.markets.btts.yes })
  rows.push({ key: 'btts_n', label: 'Les deux marquent — Non', prob: p.markets.btts.no })
  rows.push({ key: 'o15', label: '+1,5 but', prob: p.markets.over['1.5'].over })
  rows.push({ key: 'u15', label: '−1,5 but', prob: p.markets.over['1.5'].under })
  rows.push({ key: 'o25', label: '+2,5 buts', prob: p.markets.over['2.5'].over })
  rows.push({ key: 'u25', label: '−2,5 buts', prob: p.markets.over['2.5'].under })
  rows.push({ key: 'o35', label: '+3,5 buts', prob: p.markets.over['3.5'].over })
  rows.push({ key: 'u35', label: '−3,5 buts', prob: p.markets.over['3.5'].under })
  return rows
}

function Verdict({ prob, input }) {
  const raw = (input || '').replace(',', '.')
  const B = parseFloat(raw)
  if (!raw || !Number.isFinite(B) || B <= 1) {
    return <span className="text-xs text-[#86868b]">saisis une cote</span>
  }
  const p = prob / 100
  const ev = p * B - 1 // espérance par euro misé
  const edge = Math.round(ev * 1000) / 10
  if (ev > 0.005) {
    return (
      <span className="rounded-full bg-edge-500/15 px-2.5 py-1 text-xs font-semibold text-edge-600 ring-1 ring-edge-500/30">
        ✓ Value +{edge}%
      </span>
    )
  }
  if (ev > -0.03) {
    return <span className="rounded-full bg-slate-400/10 px-2.5 py-1 text-xs font-medium text-[#1d1d1f]">≈ neutre ({edge}%)</span>
  }
  return <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-600">✗ {edge}%</span>
}

const PHASE_FR = {
  'Round of 32': '16es de finale',
  'Round of 16': '8es de finale',
  'Quarter-final': 'Quarts de finale',
  'Semi-final': 'Demi-finales',
  'Match for third place': 'Match pour la 3e place',
  Final: 'Finale',
}

function PickRow({ pick, rank, accent }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-black/[0.03] px-3 py-2">
      <span className={`grid size-5 shrink-0 place-items-center rounded-md bg-white/5 text-[11px] font-bold ${accent}`}>
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[#1d1d1f]">{pick.sel}</div>
        <div className="truncate text-[11px] text-[#86868b]">{pick.match} · {fmtDate(pick.date)}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-bold tabular-nums text-[#1d1d1f]">{pick.prob}%</div>
        <div className={`text-[11px] font-medium tabular-nums ${accent}`}>≥ {pick.fairOdds}</div>
      </div>
    </div>
  )
}

function PickColumn({ picks, role, accent, ring, note }) {
  if (!picks?.length) return null
  return (
    <div className={`surface rounded-2xl p-4 ${ring}`}>
      <div className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${accent}`}>{role}</div>
      <p className="mb-3 text-[11px] leading-relaxed text-[#86868b]">{note}</p>
      <div className="space-y-1.5">
        {picks.map((p, i) => (
          <PickRow key={i} pick={p} rank={i + 1} accent={accent} />
        ))}
      </div>
    </div>
  )
}

function Recommendations({ picks }) {
  if (!picks) return null
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-[#1d1d1f]">Top 3 par profil</h3>
      <div className="grid gap-3 lg:grid-cols-3">
        <PickColumn
          picks={picks.safest}
          role="🛡️ Top 3 — Le plus sûr"
          accent="text-sky-600"
          ring="ring-1 ring-sky-500/20"
          note="Probabilité maximale, gain modeste. Pour viser surtout « que ça passe »."
        />
        <PickColumn
          picks={picks.balanced}
          role="🎯 Top 3 — Meilleur compromis"
          accent="text-edge-600"
          ring="ring-1 ring-edge-500/25"
          note="Le bon équilibre sûreté × gain. Souvent des marchés de buts."
        />
        <PickColumn
          picks={picks.value}
          role="💰 Top 3 — Vraie value (+ risque)"
          accent="text-amber-600"
          ring="ring-1 ring-amber-400/20"
          note="Cote plus élevée, moins probable — là où le marché offre le plus de valeur."
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-[#86868b]">
        « ≥ » = cote juste : si ton opérateur propose une cote au-dessus, c'est un pari de valeur.
      </p>
    </div>
  )
}

export default function ValueBetting({ predictions, valuePicks }) {
  const [ri, setRi] = useState(0)
  const [odds, setOdds] = useState({})
  const [openId, setOpenId] = useState(null)

  const roundsPreds = useMemo(() => {
    const m = new Map()
    predictions.forEach((p) => {
      if (!m.has(p.round)) m.set(p.round, [])
      m.get(p.round).push(p)
    })
    return [...m.entries()]
  }, [predictions])

  if (!predictions.length) {
    return <p className="py-12 text-center text-[#86868b]">Aucun match à analyser.</p>
  }

  const perRound = valuePicks?.perRound
  const idx = perRound ? Math.min(ri, roundsPreds.length - 1) : 0
  const curPreds = perRound ? roundsPreds[idx]?.[1] || [] : predictions
  const curPicks = perRound ? valuePicks.rounds[idx] : valuePicks
  const fair = (prob) => (prob > 0 ? (100 / prob).toFixed(2) : '—')

  return (
    <div className="space-y-5">
      {perRound && <JourneeSelect labels={roundsPreds.map(([l]) => l)} idx={idx} setIdx={setRi} />}

      <Recommendations picks={curPicks} />

      <div className="surface rounded-2xl p-4 text-sm leading-relaxed text-[#1d1d1f]">
        <b>Scanner de value.</b> Saisis les cotes de ton opérateur : dès qu'une cote dépasse
        notre <b>cote juste</b>, c'est un <span className="font-semibold text-[#15803d]">pari de valeur</span>.
        Clique un match pour voir tous les marchés.
      </div>

      <div className="surface overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span className="flex-1">Match · notre pari</span>
          <span className="w-16 text-right">Cote</span>
          <span className="w-20 text-right">Verdict</span>
          <span className="w-5" />
        </div>
        {curPreds.map((p) => {
          const k = `${p.id}-main`
          const open = openId === p.id
          return (
            <div key={p.id} className="border-b border-black/[0.06] last:border-0">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-[#1d1d1f]">{p.team1} – {p.team2}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {p.pick} · {p.pickProb}% · juste {fair(p.pickProb)}
                  </div>
                </div>
                <input
                  type="text" inputMode="decimal" placeholder="cote"
                  value={odds[k] || ''}
                  onChange={(e) => setOdds((o) => ({ ...o, [k]: e.target.value }))}
                  className="w-16 rounded-lg border border-black/10 bg-pitch-800 px-2 py-1 text-right text-sm text-[#1d1d1f] outline-none focus:border-edge-500/50"
                />
                <span className="w-20 text-right"><Verdict prob={p.pickProb} input={odds[k]} /></span>
                <button
                  onClick={() => setOpenId(open ? null : p.id)}
                  className="w-5 text-[#86868b] transition-colors hover:text-edge-600"
                  aria-label="Tous les marchés"
                >
                  <span className={`inline-block transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
                </button>
              </div>
              {open && (
                <div className="border-t border-black/[0.06] bg-black/[0.02] px-4 py-2">
                  {selectionsFor(p).map((r) => {
                    const kk = `${p.id}-${r.key}`
                    return (
                      <div key={r.key} className="flex items-center gap-2 py-1 text-xs">
                        <span className="flex-1 truncate text-[#1d1d1f]">{r.label}</span>
                        <span className="w-9 text-right tabular-nums text-[#86868b]">{r.prob}%</span>
                        <span className="w-11 text-right tabular-nums text-[#6e6e73]">{fair(r.prob)}</span>
                        <input
                          type="text" inputMode="decimal" placeholder="cote"
                          value={odds[kk] || ''}
                          onChange={(e) => setOdds((o) => ({ ...o, [kk]: e.target.value }))}
                          className="w-14 rounded-lg border border-black/10 bg-pitch-800 px-2 py-1 text-right text-[#1d1d1f] outline-none focus:border-edge-500/50"
                        />
                        <span className="w-20 text-right"><Verdict prob={r.prob} input={odds[kk]} /></span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs leading-relaxed text-[#86868b]">
        Une value n'est pas une garantie de gain. Jouer comporte des risques. 18+ ·
        Joueurs Info Service 09 74 75 13 13.
      </p>
    </div>
  )
}
