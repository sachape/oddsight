import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { flag } from '../flags.js'
import PredictionCard from './PredictionCard.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const dFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

// Matchs à afficher : ceux du jour, sinon les prochains à venir (toujours non vide).
function pickMatches(predictions) {
  const t = today()
  const sorted = [...predictions].sort((a, b) => a.date.localeCompare(b.date))
  const todays = sorted.filter((p) => p.date === t)
  if (todays.length) return { label: 'Matchs du jour', items: todays.slice(0, 20) }
  const next = sorted.filter((p) => p.date >= t)
  const pool = next.length ? next : sorted
  return { label: 'Prochains matchs', items: pool.slice(0, 20) }
}

const name1 = (p) => p.team1 ?? p.player1
const name2 = (p) => p.team2 ?? p.player2

function TickerItem({ p, onClick }) {
  const a = name1(p), b = name2(p)
  return (
    <button
      onClick={onClick}
      className="group flex h-10 shrink-0 items-center gap-2 px-4 text-xs leading-none transition-colors hover:bg-black/[0.03]"
    >
      <span className="text-[#86868b]">{flag(a)}</span>
      <span className="font-medium text-[#1d1d1f]">{a}</span>
      <span className="text-[#c7c7cc]">–</span>
      <span className="font-medium text-[#1d1d1f]">{b}</span>
      <span className="text-[#86868b]">{flag(b)}</span>
      {p.pick && (
        <span className="ml-1 rounded-md bg-edge-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-edge-600">
          {p.pick} {p.pickProb}%
        </span>
      )}
      <span className="ml-1 text-[#d2d2d7]">|</span>
    </button>
  )
}

// Panneau de stats tennis (la PredictionCard est pensée pour le foot)
function TennisPanel({ p }) {
  const Row = ({ k, v }) => (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-[#6e6e73]">{k}</span>
      <span className="font-medium tabular-nums text-[#1d1d1f]">{v}</span>
    </div>
  )
  return (
    <div className="p-4">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-[#86868b]">{p.category} · {p.round}</div>
      <div className="mb-3 text-lg font-bold text-[#1d1d1f]">{p.player1} <span className="text-[#c7c7cc]">vs</span> {p.player2}</div>
      <Row k={`${p.player1} (n°${p.rank1})`} v={`${p.pWin1}%`} />
      <Row k={`${p.player2} (n°${p.rank2})`} v={`${p.pWin2}%`} />
      <div className="my-2 border-t border-black/[0.06]" />
      <Row k="Pari conseillé" v={`${p.pick} · ${p.pickProb}% (${p.confidence})`} />
      {p.odds && <Row k="Cotes estimées" v={`${p.odds.win1 ?? '—'} / ${p.odds.win2 ?? '—'}`} />}
    </div>
  )
}

function MatchModal({ p, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  const isFootball = !!p.markets
  // Portal vers <body> : sinon le backdrop-blur du footer piège ce `fixed`.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="fade-up max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[0.06] bg-white/85 px-4 py-3 backdrop-blur-xl">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#1d1d1f]">{name1(p)} – {name2(p)}</span>
            <span className="text-[11px] text-[#86868b]">{p.round} · {dFmt.format(new Date(p.date + 'T12:00:00'))}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[#86868b] transition-colors hover:bg-black/[0.05] hover:text-[#1d1d1f]"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>
        {isFootball ? <div className="p-3"><PredictionCard p={p} index={0} /></div> : <TennisPanel p={p} />}
      </div>
    </div>,
    document.body,
  )
}

export default function MatchTicker({ predictions }) {
  const [sel, setSel] = useState(null)
  const data = useMemo(() => (predictions?.length ? pickMatches(predictions) : null), [predictions])

  return (
    <footer className="sticky bottom-0 z-20 mt-8 border-t border-black/[0.06] bg-white/80 backdrop-blur-xl">
      {data ? (
        <div className="flex items-stretch">
          <div className="hidden shrink-0 items-center gap-1.5 border-r border-black/[0.06] px-3 text-[10px] font-semibold uppercase tracking-wide text-[#86868b] sm:flex">
            <span className="pulse-dot size-1.5 rounded-full bg-edge-400" />
            {data.label}
          </div>
          <div className="relative min-w-0 flex-1 overflow-x-clip">
            {/* dégradés de bord pour un défilé propre */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent" />
            <div className="ticker-track flex w-max">
              {[...data.items, ...data.items].map((p, i) => (
                <TickerItem key={`${p.id}-${i}`} p={p} onClick={() => setSel(p)} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <p className="px-4 py-1.5 text-center text-[10px] leading-tight text-[#a1a1a6]">
        Outil informatif · les pronostics ne sont pas des garanties · jouer comporte des risques (endettement, dépendance) · 18+ · Joueurs Info Service 09 74 75 13 13
      </p>

      {sel && <MatchModal p={sel} onClose={() => setSel(null)} />}
    </footer>
  )
}
