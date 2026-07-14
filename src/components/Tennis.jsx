import { useMemo, useState } from 'react'
import Badge, { CONF_VARIANT } from './Badge.jsx'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtDate = (iso) => (iso ? dateFmt.format(new Date(iso + 'T12:00:00')) : 'À venir')

function Gauge({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 truncate text-[11px] text-[#6e6e73]">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e3e3e8]">
        <span className="block h-full rounded-full bg-[#1d1d1f]" style={{ width: `${value}%` }} />
      </span>
      <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[#1d1d1f]">{value}%</span>
    </div>
  )
}

function Player({ name, rank, side }) {
  return (
    <div className={side === 'right' ? 'text-right' : ''}>
      <div className="text-sm font-semibold leading-tight text-[#1d1d1f]">{name}</div>
      <div className="text-[11px] text-muted-foreground">{rank ? `#${rank} ATP/WTA` : 'non classé'}</div>
    </div>
  )
}

function TennisCard({ p, index }) {
  const w1 = p.pick === p.player1
  // Marchés dérivés de la distribution des scores en sets
  const setTotals = []
  let favStraight = 0 // proba que le favori gagne sans perdre de set
  {
    const m = new Map()
    for (const s of p.sets || []) {
      const [a, b] = s.score.split('-').map(Number)
      m.set(a + b, (m.get(a + b) || 0) + s.p)
      if (Math.min(a, b) === 0 && (s.w === 1) === w1) favStraight += s.p
    }
    setTotals.push(...[...m.entries()].sort((x, y) => x[0] - y[0]))
  }
  const underdog = w1 ? p.player2 : p.player1
  const underdogSet = Math.round((100 - favStraight) * 10) / 10
  return (
    <article
      className="fade-up surface surface-hover rounded-2xl p-4"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <div className="mb-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>{p.tournament ? `${p.tournament} · ${p.round}` : p.round}</span>
        <span>{p.date ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(p.date + 'T12:00:00')) : ''}</span>
      </div>

      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Player name={p.player1} rank={p.rank1} side="left" />
        <span className="text-xs font-semibold text-[#86868b]">VS</span>
        <Player name={p.player2} rank={p.rank2} side="right" />
      </div>

      <div className="flex h-2 w-full gap-0.5">
        <div className={`bar-grow rounded-full ${w1 ? 'bg-[#1d1d1f]' : 'bg-[#c7c7cc]'}`} style={{ width: `${p.pWin1}%` }} />
        <div className={`bar-grow rounded-full ${w1 ? 'bg-[#c7c7cc]' : 'bg-[#1d1d1f]'}`} style={{ width: `${p.pWin2}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px]">
        <span className={w1 ? 'font-semibold text-[#1d1d1f]' : 'text-[#86868b]'}>{p.pWin1}%</span>
        <span className={w1 ? 'text-[#86868b]' : 'font-semibold text-[#1d1d1f]'}>{p.pWin2}%</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-pitch-850 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#6e6e73]">Plus probable</span>
          <span className="font-semibold text-[#1d1d1f]">{p.pick}</span>
        </div>
        <Badge variant={CONF_VARIANT[p.confidence] || 'default'}>
          {p.pickProb}% · {p.confidence}
        </Badge>
      </div>

      {/* Score en sets probable */}
      {p.sets?.length > 0 && (
        <div className="mt-3 rounded-xl bg-pitch-850 p-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wide text-[#86868b]">
            <span>Score en sets</span>
            <span className="normal-case text-[#6e6e73]">best of {p.bestOf}</span>
          </div>
          <div className="space-y-1.5">
            {p.sets.slice(0, 4).map((s) => {
              const who = s.w === 1 ? p.player1 : p.player2
              const score = s.w === 1 ? s.score : s.score.split('-').reverse().join('-')
              return <Gauge key={s.score} label={`${who} ${score}`} value={s.p} />
            })}
          </div>
        </div>
      )}

      {/* Nombre de sets + l'outsider prend un set */}
      {setTotals.length > 0 && (
        <div className="mt-3 rounded-xl bg-pitch-850 p-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-[#86868b]">Nombre de sets</div>
          <div className="space-y-1.5">
            {setTotals.map(([n, prob]) => (
              <Gauge key={n} label={`Match en ${n} sets`} value={Math.round(prob * 10) / 10} />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-black/[0.06] pt-2 text-[11px]">
            <span className="truncate text-[#6e6e73]">{underdog} prend au moins un set</span>
            <span className="ml-2 shrink-0 font-semibold tabular-nums text-[#1d1d1f]">{underdogSet}%</span>
          </div>
        </div>
      )}

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Cotes estimées — {p.pick} : <b className="text-[#1d1d1f]">{w1 ? p.odds.win1 : p.odds.win2}</b>
        {' · '}adversaire : <b className="text-[#1d1d1f]">{w1 ? p.odds.win2 : p.odds.win1}</b>
      </p>
    </article>
  )
}

export default function Tennis({ data }) {
  const [cat, setCat] = useState('Men')
  const cats = [
    { id: 'Men', label: 'Hommes' },
    { id: 'Women', label: 'Femmes' },
  ]
  const list = data.predictions.filter((p) => p.category.includes(cat))

  const byDate = useMemo(() => {
    const m = new Map()
    list.forEach((p) => {
      const k = p.date || 'À venir'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(p)
    })
    return [...m.entries()]
  }, [list])

  return (
    <div>
      <div className="surface mb-6 rounded-2xl p-4 text-sm leading-relaxed text-[#1d1d1f]">
        🎾 <b>{data.tournament}</b> — probabilité de victoire, score en sets, nombre de sets et
        chance pour l’outsider de prendre un set. Pas de nul : un seul vainqueur.
      </div>

      <div className="mb-5 flex justify-center gap-2">
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              cat === c.id ? 'bg-[#1d1d1f] text-white' : 'bg-pitch-800 text-[#1d1d1f] hover:bg-pitch-700'
            }`}
          >
            {c.label} <span className="opacity-60">{data.predictions.filter((p) => p.category.includes(c.id)).length}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">Aucun match à venir dans cette catégorie.</p>
      ) : (
        <div className="space-y-8">
          {byDate.map(([date, preds]) => (
            <section key={date}>
              <h2 className="mb-3 text-sm font-semibold capitalize text-muted-foreground">{fmtDate(date)}</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {preds.map((p, i) => (
                  <TennisCard key={p.id} p={p} index={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
