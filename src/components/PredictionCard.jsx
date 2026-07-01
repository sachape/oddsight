import { useState } from 'react'
import { flag } from '../flags.js'
import ProbBar from './ProbBar.jsx'
import Badge, { CONF_VARIANT } from './Badge.jsx'

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: 'numeric', month: 'short',
})
const fmtDate = (iso) => dateFmt.format(new Date(iso + 'T12:00:00'))

// Une ligne de comparaison d'un facteur entre les deux équipes
function Driver({ label, v1, v2, betterHigh }) {
  const n1 = parseFloat(v1)
  const n2 = parseFloat(v2)
  const better1 = betterHigh ? n1 > n2 : n1 < n2
  const better2 = betterHigh ? n2 > n1 : n2 < n1
  const cls = (b) => (b ? 'text-[#1d1d1f] font-semibold' : 'text-[#86868b]')
  // Mini-jauge : on convertit en "qualité" (haut = mieux), gère les négatifs
  const g1 = betterHigh ? n1 : -n1
  const g2 = betterHigh ? n2 : -n2
  const shift = -Math.min(g1, g2, 0)
  const a1 = g1 + shift + 0.05
  const a2 = g2 + shift + 0.05
  const p1 = a1 / (a1 + a2)
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1 text-sm">
      <span className={`text-right tabular-nums ${cls(better1)}`}>{v1}</span>
      <div className="flex flex-col items-center">
        <span className="text-[10px] uppercase tracking-wide text-[#86868b]">{label}</span>
        <span className="mt-0.5 flex h-1 w-16 overflow-hidden rounded-full bg-[#e3e3e8]">
          <span className="bg-[#1d1d1f]" style={{ width: `${p1 * 100}%` }} />
          <span className="bg-[#c7c7cc]" style={{ width: `${(1 - p1) * 100}%` }} />
        </span>
      </div>
      <span className={`text-left tabular-nums ${cls(better2)}`}>{v2}</span>
    </div>
  )
}

// Barre de répartition 2 issues (le favori en noir, l'autre en gris)
function SplitBar({ label, a, b }) {
  const aStrong = a.p >= b.p
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wide text-[#86868b]">{label}</div>
      <div className="flex h-2 gap-0.5">
        <div className="rounded-full" style={{ width: `${a.p}%`, background: aStrong ? '#1d1d1f' : '#c7c7cc' }} />
        <div className="rounded-full" style={{ width: `${b.p}%`, background: aStrong ? '#c7c7cc' : '#1d1d1f' }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums">
        <span className={aStrong ? 'font-semibold text-[#1d1d1f]' : 'text-[#86868b]'}>{a.name} {a.p}%</span>
        <span className={!aStrong ? 'font-semibold text-[#1d1d1f]' : 'text-[#86868b]'}>{b.name} {b.p}%</span>
      </div>
    </div>
  )
}

// Jauge simple (label · barre · %)
function Gauge({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 truncate text-[11px] text-[#6e6e73]">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e3e3e8]">
        <span className="block h-full rounded-full bg-[#1d1d1f]" style={{ width: `${value}%` }} />
      </span>
      <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[#1d1d1f]">{value}%</span>
    </div>
  )
}

// Total de buts sur les 3 lignes (1,5 / 2,5 / 3,5) : colonnes Plus / Moins
function GoalLines({ over }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-[#86868b]">
        <span>Total de buts</span>
        <span className="flex gap-2.5 normal-case text-[10px] text-[#a1a1a6]">
          <span className="w-10 text-right">Plus</span>
          <span className="w-10 text-right">Moins</span>
        </span>
      </div>
      <div className="space-y-1">
        {['1.5', '2.5', '3.5'].map((l) => {
          const o = over[l]
          const strong = o.over >= o.under
          return (
            <div key={l} className="flex items-center justify-between text-xs tabular-nums">
              <span className="text-[#6e6e73]">{l.replace('.', ',')} but{l === '1.5' ? '' : 's'}</span>
              <span className="flex gap-2.5">
                <span className={`w-10 text-right ${strong ? 'font-semibold text-[#1d1d1f]' : 'text-[#86868b]'}`}>{o.over}%</span>
                <span className={`w-10 text-right ${!strong ? 'font-semibold text-[#1d1d1f]' : 'text-[#86868b]'}`}>{o.under}%</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Absents({ list }) {
  if (!list?.length) return <span className="text-[11px] text-[#86868b]">Effectif complet</span>
  return (
    <span className="flex flex-wrap gap-1">
      {list.map((a) => (
        <span
          key={a.name}
          className="inline-flex items-center gap-1 rounded-full bg-pitch-800 px-2 py-0.5 text-[10px] text-[#1d1d1f]"
          title={a.status === 'suspension' ? 'Suspendu' : 'Blessé'}
        >
          {a.status === 'suspension' ? '🟥' : '🤕'} {a.name}
        </span>
      ))}
    </span>
  )
}

function FormPips({ value }) {
  const map = { W: 'bg-edge-500', D: 'bg-slate-600', L: 'bg-rose-500/80' }
  const parts = (value || '').split(' ').filter(Boolean)
  if (!parts.length) return <span className="text-[#86868b]">—</span>
  return (
    <span className="inline-flex gap-1">
      {parts.map((r, i) => (
        <span
          key={i}
          className={`grid h-4 w-4 place-items-center rounded-[4px] text-[9px] font-bold text-pitch-950 ${map[r] || 'bg-slate-600'}`}
          title={r === 'W' ? 'Gagné' : r === 'D' ? 'Nul' : 'Perdu'}
        >
          {r === 'W' ? 'V' : r === 'D' ? 'N' : 'D'}
        </span>
      ))}
    </span>
  )
}

export default function PredictionCard({ p, index }) {
  const [open, setOpen] = useState(false)

  return (
    <article
      className="fade-up surface surface-hover rounded-2xl p-4"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      {/* En-tête : phase + date */}
      <div className="mb-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-[#86868b]">
        <span>{p.round}</span>
        <span>{fmtDate(p.date)}</span>
      </div>

      {/* Équipes */}
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Team name={p.team1} qual={p.isKnockout ? p.pQual1 : null} side="left" />
        <span className="text-xs font-semibold text-[#86868b]">VS</span>
        <Team name={p.team2} qual={p.isKnockout ? p.pQual2 : null} side="right" />
      </div>

      {/* Barre de probabilités */}
      <ProbBar p1={p.pWin1} draw={p.pDraw} p2={p.pWin2} knockout={p.isKnockout} />

      {/* Issue la plus probable (objectif, basé stats) */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-pitch-850 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#6e6e73]">Plus probable</span>
          <span className="font-semibold text-[#1d1d1f]">
            {flag(p.pick) ? `${flag(p.pick)} ` : ''}{p.pick}
          </span>
        </div>
        <Badge variant={CONF_VARIANT[p.confidence] || 'default'}>
          {p.pickProb}% · {p.confidence}
        </Badge>
      </div>

      {/* Marchés — visibles directement (jauges, pas besoin de cliquer) */}
      {p.markets && (
        <div className="mt-3 space-y-3 rounded-xl bg-pitch-850 p-3">
          <p className="flex items-center justify-between text-[11px] uppercase tracking-wide text-[#86868b]">
            <span>Marchés</span>
            <span className="normal-case text-[#6e6e73]">{p.markets.totalGoals} buts attendus</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SplitBar
              label="Les deux marquent"
              a={{ name: 'Oui', p: p.markets.btts.yes }}
              b={{ name: 'Non', p: p.markets.btts.no }}
            />
            <GoalLines over={p.markets.over} />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wide text-[#86868b]">Double chance</div>
            <div className="space-y-1.5">
              <Gauge label={`${p.team1} ou nul`} value={p.markets.doubleChance['1X']} />
              <Gauge label="Sans nul" value={p.markets.doubleChance['12']} />
              <Gauge label={`Nul ou ${p.team2}`} value={p.markets.doubleChance.X2} />
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wide text-[#86868b]">Clean sheet</div>
            <div className="space-y-1.5">
              <Gauge label={`${flag(p.team1)} ${p.team1}`} value={p.markets.cleanSheet.team1} />
              <Gauge label={`${flag(p.team2)} ${p.team2}`} value={p.markets.cleanSheet.team2} />
            </div>
          </div>
        </div>
      )}

      {/* Détails : scores probables, absents, cotes (sorties, pas de méthode) */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[#6e6e73] transition-colors hover:text-[#1d1d1f]"
      >
        {open ? 'Masquer' : 'Scores probables & cotes'}
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="fade-up mt-1 space-y-3 border-t border-black/[0.06] pt-3">
          {/* Absents (blessures / suspensions) */}
          {(p.absents?.team1?.length > 0 || p.absents?.team2?.length > 0) && (
            <div className="rounded-xl bg-pitch-850 p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-[#86868b]">
                Absents · 🤕 blessé · 🟥 suspendu
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Absents list={p.absents?.team1} />
                <div className="flex justify-end"><Absents list={p.absents?.team2} /></div>
              </div>
            </div>
          )}

          {/* Scores probables */}
          <div className="rounded-xl bg-pitch-850 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-[#86868b]">Scores les plus probables</p>
            <div className="flex gap-2">
              {p.topScores.map((s) => (
                <div key={s.score} className="flex-1 rounded-lg bg-white px-2 py-1.5 text-center ring-1 ring-black/[0.05]">
                  <div className="font-semibold tabular-nums text-[#1d1d1f]">{s.score}</div>
                  <div className="text-[11px] text-[#6e6e73]">{s.p}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cotes estimées */}
          <p className="text-center text-[11px] leading-relaxed text-[#86868b]">
            Cotes estimées — {p.team1} : <b className="text-[#1d1d1f]">{p.odds.win1 ?? '—'}</b>
            {!p.isKnockout && <> · Nul : <b className="text-[#1d1d1f]">{p.odds.draw ?? '—'}</b></>}
            {' '}· {p.team2} : <b className="text-[#1d1d1f]">{p.odds.win2 ?? '—'}</b>
          </p>
        </div>
      )}
    </article>
  )
}

function Team({ name, qual, side }) {
  return (
    <div className={`flex items-center gap-2 ${side === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <span className="text-2xl leading-none">{flag(name)}</span>
      <div className={side === 'right' ? 'text-right' : ''}>
        <div className="text-sm font-semibold leading-tight text-[#1d1d1f]">{name}</div>
        {qual != null && (
          <div className="text-[11px] text-[#86868b]">{qual}% qualif.</div>
        )}
      </div>
    </div>
  )
}
