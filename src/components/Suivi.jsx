import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Check, X, Trophy, Clock, Trash2, Pencil } from 'lucide-react'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const KEY = 'oddsight_bets_v1'
const eur = (n) => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n * 100) / 100)} €`
const num = (v) => parseFloat(String(v).replace(',', '.'))
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

function pnl(b) {
  if (b.status === 'won') return b.stake * (b.odds - 1)
  if (b.status === 'lost') return -b.stake
  return 0
}

// --- Sélections dérivées d'une prédiction (football OU tennis) --------------
// Renvoie le libellé du match + les paris « value-vérifiables » avec proba du
// modèle et cote juste (100/proba), la sélection conseillée marquée `rec`.
function selectionsFor(p) {
  const a = p.team1 ?? p.player1
  const b = p.team2 ?? p.player2
  const o = p.odds || {}
  const sels = []
  const push = (label, prob, odds) => {
    if (prob == null || !(prob > 0)) return
    sels.push({ label, prob: Math.round(prob * 10) / 10, odds: odds ?? +(100 / prob).toFixed(2) })
  }
  push(`${a} gagne`, p.pWin1, o.win1)
  if (p.pDraw != null) push('Match nul', p.pDraw, o.draw)
  push(`${b} gagne`, p.pWin2, o.win2)
  const m = p.markets
  if (m?.doubleChance) {
    push(`${a} ou nul`, m.doubleChance['1X'])
    push(`Nul ou ${b}`, m.doubleChance.X2)
  }
  if (m?.btts) { push('Les deux marquent', m.btts.yes); push('Pas les deux', m.btts.no) }
  if (m?.over?.['2.5']) { push('+ de 2,5 buts', m.over['2.5'].over); push('− de 2,5 buts', m.over['2.5'].under) }
  const rec = p.pick
  sels.forEach((s) => { s.rec = s.label === `${rec} gagne` || (rec === 'Match nul' && s.label === 'Match nul') })
  return { label: `${a} – ${b}`, sels }
}

// --- Courbe d'équité (P&L cumulé sur les paris réglés) ----------------------
function EquityCurve({ points }) {
  if (points.length < 2) return null
  const w = 320, h = 60, pad = 3
  const min = Math.min(0, ...points), max = Math.max(0, ...points)
  const range = (max - min) || 1
  const x = (i) => pad + (i / (points.length - 1)) * (w - 2 * pad)
  const y = (v) => pad + (1 - (v - min) / range) * (h - 2 * pad)
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const col = last >= 0 ? '#12b577' : '#e5484d'
  const zeroY = y(0)
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${zeroY.toFixed(1)} L${pad} ${zeroY.toFixed(1)} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[60px] w-full" aria-hidden="true">
      <defs>
        <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={col} stopOpacity="0.16" />
          <stop offset="1" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="rgba(0,0,0,0.10)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <path d={area} fill="url(#eqfill)" />
      <path d={line} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const QUICK_STAKES = [5, 10, 20, 50]

// --- Le coupon : ajouter un pari, pré-rempli depuis le modèle ---------------
function AddBet({ predictions, onAdd }) {
  const hasModel = (predictions || []).length > 0
  const [manual, setManual] = useState(!hasModel)
  const [matchId, setMatchId] = useState('')
  const [picked, setPicked] = useState(null) // {label, prob, odds}
  const [stake, setStake] = useState('')
  const [odds, setOdds] = useState('')
  const [freeMatch, setFreeMatch] = useState('')
  const [freePick, setFreePick] = useState('')

  const pred = useMemo(() => predictions?.find((p) => p.id === matchId), [predictions, matchId])
  const model = useMemo(() => (pred ? selectionsFor(pred) : null), [pred])

  // Regroupe les matchs par journée/catégorie pour le menu
  const groups = useMemo(() => {
    const m = new Map()
    for (const p of predictions || []) {
      const g = p.round || p.category || 'Matchs'
      if (!m.has(g)) m.set(g, [])
      m.get(g).push(p)
    }
    return [...m.entries()]
  }, [predictions])

  const chooseSel = (s) => { setPicked(s); setOdds(String(s.odds)) }
  const reset = () => { setMatchId(''); setPicked(null); setStake(''); setOdds(''); setFreeMatch(''); setFreePick('') }

  const st = num(stake), od = num(odds)
  const matchLabel = manual ? freeMatch.trim() : model?.label
  const pickLabel = manual ? freePick.trim() : picked?.label
  const valid = matchLabel && pickLabel && st > 0 && od > 1
  const payout = valid ? st * od : 0

  const submit = () => {
    if (!valid) return
    onAdd({
      id: Date.now(),
      match: matchLabel,
      pick: pickLabel,
      stake: st,
      odds: od,
      status: 'pending',
      prob: manual ? null : picked?.prob ?? null,
      fair: manual ? null : picked?.odds ?? null,
    })
    reset()
  }

  return (
    <div className="surface rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#1d1d1f]">
          <Sparkles className="size-4 text-edge-500" /> Nouveau pari
        </h3>
        {hasModel && (
          <button
            onClick={() => { setManual((v) => !v); setPicked(null) }}
            className="text-[11px] font-medium text-edge-600 hover:text-edge-700"
          >
            {manual ? 'Choisir un match du modèle' : 'Pari libre (autre match)'}
          </button>
        )}
      </div>

      {/* Étape 1 — le match */}
      {manual ? (
        <input
          placeholder="Match (ex. Paris-SG – Rennes)"
          value={freeMatch} onChange={(e) => setFreeMatch(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-pitch-850 px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition-colors focus:border-edge-500/60 focus:bg-white"
        />
      ) : (
        <Select value={matchId} onValueChange={(v) => { setMatchId(v); setPicked(null) }}>
          <SelectTrigger className="w-full bg-pitch-850 py-5">
            <SelectValue placeholder="Choisis un match…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {groups.map(([g, preds]) => (
              <SelectGroup key={g}>
                <SelectLabel>{g}</SelectLabel>
                {preds.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {(p.team1 ?? p.player1)} – {(p.team2 ?? p.player2)}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Étape 2 — la sélection */}
      {manual ? (
        <input
          placeholder="Ton pari (ex. Paris-SG)"
          value={freePick} onChange={(e) => setFreePick(e.target.value)}
          className="mt-2 w-full rounded-xl border border-black/10 bg-pitch-850 px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition-colors focus:border-edge-500/60 focus:bg-white"
        />
      ) : model ? (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            Sélection · <span className="normal-case">cote juste du modèle</span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {model.sels.map((s) => {
              const active = picked?.label === s.label
              return (
                <button
                  key={s.label}
                  onClick={() => chooseSel(s)}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'bg-edge-500/12 ring-1 ring-edge-500/50'
                      : 'bg-pitch-850 ring-1 ring-transparent hover:bg-pitch-800'
                  }`}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-[#1d1d1f]">{s.label}</span>
                    {s.rec && <span className="ml-1.5 text-[10px] font-semibold text-edge-600">★</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11px] text-muted-foreground tabular-nums">{s.prob}%</span>
                    <span className="block text-xs font-semibold tabular-nums text-[#1d1d1f]">{s.odds}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-center text-xs text-muted-foreground">Choisis un match pour voir les paris suggérés.</p>
      )}

      {/* Étape 3 — mise + cote */}
      {(manual || picked) && (
        <div className="mt-3 space-y-2 border-t border-black/[0.06] pt-3 fade-up">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] uppercase tracking-wide text-muted-foreground">Mise</span>
            {QUICK_STAKES.map((v) => (
              <button
                key={v}
                onClick={() => setStake(String(v))}
                className={`rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
                  num(stake) === v ? 'bg-[#1d1d1f] text-white' : 'bg-pitch-800 text-[#1d1d1f] hover:bg-pitch-700'
                }`}
              >
                {v} €
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">Mise (€)</span>
              <input
                type="text" inputMode="decimal" placeholder="10" value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-pitch-850 px-3 py-2 text-sm tabular-nums text-[#1d1d1f] outline-none transition-colors focus:border-edge-500/60 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">Cote (ton opérateur)</span>
              <input
                type="text" inputMode="decimal" placeholder="1.90" value={odds}
                onChange={(e) => setOdds(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-pitch-850 px-3 py-2 text-sm tabular-nums text-[#1d1d1f] outline-none transition-colors focus:border-edge-500/60 focus:bg-white"
              />
            </label>
          </div>

          {/* Gain potentiel + repère value vs cote juste */}
          {valid && (
            <div className="flex items-center justify-between rounded-xl bg-edge-500/[0.06] px-3 py-2 text-sm">
              <span className="text-[#6e6e73]">Gain potentiel</span>
              <span className="font-semibold tabular-nums text-[#1d1d1f]">
                {eur(payout)} <span className="text-xs font-normal text-edge-600">(+{eur(payout - st)})</span>
              </span>
            </div>
          )}
          {!manual && picked && od > 0 && od < picked.odds && (
            <p className="text-center text-[11px] text-amber-600">
              Ta cote ({odds}) est sous la cote juste ({picked.odds}) — le modèle voit moins de valeur.
            </p>
          )}
          {!manual && picked && od >= picked.odds && (
            <p className="text-center text-[11px] text-edge-600">
              ✓ Ta cote ({odds}) dépasse la cote juste ({picked.odds}) — pari de valeur.
            </p>
          )}

          <button
            onClick={submit}
            disabled={!valid}
            className="w-full rounded-xl bg-edge-500 py-2.5 text-sm font-semibold text-pitch-950 transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-pitch-700 disabled:text-[#86868b] disabled:hover:bg-pitch-700"
          >
            Suivre ce pari
          </button>
          {!valid && (
            <p className="text-center text-[11px] text-muted-foreground">
              Choisis une sélection, une mise (&gt; 0&nbsp;€) et une cote (&gt; 1).
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// --- Ligne d'un pari suivi --------------------------------------------------
const OUTCOMES = [
  { k: 'won', label: 'Gagné', icon: Trophy },
  { k: 'lost', label: 'Perdu', icon: X },
]
function BetRow({ b, onStatus, onRemove }) {
  const p = pnl(b)
  const settled = b.status !== 'pending'
  const accent = b.status === 'won' ? 'before:bg-edge-500' : b.status === 'lost' ? 'before:bg-rose-500' : 'before:bg-black/10'
  return (
    <div className={`surface relative overflow-hidden rounded-xl py-3 pl-4 pr-3 before:absolute before:inset-y-0 before:left-0 before:w-1 ${accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[#1d1d1f]">{b.pick}</div>
          <div className="truncate text-[11px] text-muted-foreground">{b.match}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#6e6e73]">
            <span className="tabular-nums">{b.stake} € @ {b.odds}</span>
            {b.prob != null && <span className="text-muted-foreground">· modèle {b.prob}%</span>}
            {!settled && <span className="text-muted-foreground">· gain potentiel {eur(b.stake * b.odds)}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {settled ? (
            <div className={`text-sm font-bold tabular-nums ${p >= 0 ? 'text-edge-600' : 'text-rose-600'}`}>{eur(p)}</div>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-medium text-[#6e6e73]">
              <Clock className="size-3" /> en attente
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        {OUTCOMES.map(({ k, label, icon: Icon }) => {
          const on = b.status === k
          const tone = k === 'won'
            ? (on ? 'bg-edge-500 text-pitch-950' : 'text-edge-600 hover:bg-edge-500/10')
            : (on ? 'bg-rose-500 text-white' : 'text-rose-500 hover:bg-rose-500/10')
          return (
            <button
              key={k}
              onClick={() => onStatus(b.id, on ? 'pending' : k)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${tone}`}
            >
              <Icon className="size-3" /> {label}
            </button>
          )
        })}
        <button
          onClick={() => onRemove(b.id)}
          className="ml-auto rounded-full p-1.5 text-[#b0b0b6] transition-colors hover:bg-rose-500/10 hover:text-rose-600"
          aria-label="Supprimer ce pari"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function Suivi({ predictions }) {
  const [bets, setBets] = useState(load)
  const [filter, setFilter] = useState('all')

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(bets)) }, [bets])

  const addBet = (bet) => setBets((b) => [bet, ...b])
  const setStatus = (id, status) => setBets((b) => b.map((x) => (x.id === id ? { ...x, status } : x)))
  const remove = (id) => setBets((b) => b.filter((x) => x.id !== id))

  const stats = useMemo(() => {
    const settled = bets.filter((b) => b.status !== 'pending')
    const won = settled.filter((b) => b.status === 'won').length
    const staked = settled.reduce((s, b) => s + b.stake, 0)
    const net = bets.reduce((s, b) => s + pnl(b), 0)
    const pending = bets.filter((b) => b.status === 'pending')
    const atStake = pending.reduce((s, b) => s + b.stake, 0)
    // Courbe : P&L cumulé sur les paris réglés, du plus ancien au plus récent
    const chrono = [...settled].sort((a, b) => a.id - b.id)
    let acc = 0
    const points = [0, ...chrono.map((b) => (acc += pnl(b)))]
    return {
      settled: settled.length,
      winRate: settled.length ? Math.round((won / settled.length) * 100) : 0,
      net, staked,
      roi: staked ? Math.round((net / staked) * 1000) / 10 : 0,
      pendingCount: pending.length, atStake, points,
    }
  }, [bets])

  const FILTERS = [
    { id: 'all', label: 'Tous', test: () => true },
    { id: 'pending', label: 'En attente', test: (b) => b.status === 'pending' },
    { id: 'won', label: 'Gagnés', test: (b) => b.status === 'won' },
    { id: 'lost', label: 'Perdus', test: (b) => b.status === 'lost' },
  ]
  const shown = bets.filter(FILTERS.find((f) => f.id === filter).test)
  const hasBets = bets.length > 0

  return (
    <div className="space-y-5">
      {/* Bilan + courbe d'équité */}
      <div className="surface fade-up rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Gain net</div>
            <div className={`text-4xl font-extrabold tracking-tight tabular-nums ${stats.net >= 0 ? 'text-edge-600' : 'text-rose-600'}`}>
              {stats.net > 0 ? '+' : ''}{eur(stats.net)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {stats.settled} pari{stats.settled > 1 ? 's' : ''} réglé{stats.settled > 1 ? 's' : ''} · {eur(stats.staked)} misés
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Yield</div>
            <div className={`text-2xl font-bold tabular-nums ${stats.roi >= 0 ? 'text-edge-600' : 'text-rose-600'}`}>
              {stats.roi > 0 ? '+' : ''}{stats.roi}%
            </div>
          </div>
        </div>

        {stats.points.length >= 2 ? (
          <div className="mt-3"><EquityCurve points={stats.points} /></div>
        ) : (
          <div className="mt-3 flex h-[60px] items-center justify-center rounded-xl bg-pitch-850 text-[11px] text-muted-foreground">
            Ta courbe de gains apparaîtra après quelques paris réglés.
          </div>
        )}

        {/* Mini-stats */}
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-black/[0.06] pt-3 text-center">
          <div>
            <div className="text-base font-bold tabular-nums text-[#1d1d1f]">{stats.winRate}%</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">réussite</div>
          </div>
          <div>
            <div className="text-base font-bold tabular-nums text-[#1d1d1f]">
              {stats.pendingCount} <span className="text-xs font-normal text-muted-foreground">({eur(stats.atStake)})</span>
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">en attente</div>
          </div>
        </div>
      </div>

      {/* Coupon */}
      <AddBet predictions={predictions} onAdd={addBet} />

      {/* Liste + filtres */}
      {!hasBets ? (
        <div className="surface flex flex-col items-center rounded-2xl px-6 py-10 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-edge-500/10 ring-1 ring-edge-500/25">
            <Pencil className="size-5 text-edge-600" />
          </div>
          <p className="text-sm font-semibold text-[#1d1d1f]">Aucun pari suivi pour l'instant</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Ajoute un pari ci-dessus : choisis un match, une sélection conseillée, ta mise.
            Ton gain net et ta courbe se construisent au fil des résultats.
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const n = bets.filter(f.test).length
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === f.id ? 'bg-[#1d1d1f] text-white' : 'bg-pitch-800 text-[#1d1d1f] hover:bg-pitch-700'
                  }`}
                >
                  {f.label} <span className="opacity-60 tabular-nums">{n}</span>
                </button>
              )
            })}
          </div>
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucun pari dans ce filtre.</p>
          ) : (
            <div className="space-y-2">
              {shown.map((b) => (
                <BetRow key={b.id} b={b} onStatus={setStatus} onRemove={remove} />
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Tes paris sont enregistrés sur cet appareil uniquement. 18+ · jouer comporte des risques —
        Joueurs Info Service 09 74 75 13 13.
      </p>
    </div>
  )
}
