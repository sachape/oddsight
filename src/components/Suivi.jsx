import { useEffect, useMemo, useState } from 'react'

const KEY = 'oddsight_bets_v1'
const eur = (n) => `${n >= 0 ? '' : '−'}${Math.abs(Math.round(n * 100) / 100)} €`
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

const STATUS = {
  pending: { label: 'En attente', cls: 'bg-slate-400/10 text-[#1d1d1f]' },
  won: { label: 'Gagné', cls: 'bg-edge-500/15 text-edge-600' },
  lost: { label: 'Perdu', cls: 'bg-rose-500/15 text-rose-600' },
}

function pnl(b) {
  if (b.status === 'won') return b.stake * (b.odds - 1)
  if (b.status === 'lost') return -b.stake
  return 0
}

export default function Suivi({ predictions }) {
  const [bets, setBets] = useState(load)
  const [form, setForm] = useState({ match: '', pick: '', stake: '', odds: '' })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(bets))
  }, [bets])

  const stake = parseFloat(String(form.stake).replace(',', '.'))
  const odds = parseFloat(String(form.odds).replace(',', '.'))
  const valid = form.match.trim() && form.pick.trim() && stake > 0 && odds > 1

  const add = () => {
    if (!valid) return
    setBets((b) => [
      { id: Date.now(), match: form.match.trim(), pick: form.pick.trim(), stake, odds, status: 'pending' },
      ...b,
    ])
    setForm({ match: '', pick: '', stake: '', odds: '' })
  }
  const setStatus = (id, status) => setBets((b) => b.map((x) => (x.id === id ? { ...x, status } : x)))
  const remove = (id) => setBets((b) => b.filter((x) => x.id !== id))

  const stats = useMemo(() => {
    const settled = bets.filter((b) => b.status !== 'pending')
    const won = settled.filter((b) => b.status === 'won').length
    const staked = settled.reduce((s, b) => s + b.stake, 0)
    const net = bets.reduce((s, b) => s + pnl(b), 0)
    return {
      settled: settled.length,
      winRate: settled.length ? Math.round((won / settled.length) * 100) : 0,
      net,
      roi: staked ? Math.round((net / staked) * 1000) / 10 : 0,
    }
  }, [bets])

  return (
    <div className="space-y-5">
      {/* Bilan */}
      <div className="grid grid-cols-3 gap-3">
        <div className="surface rounded-2xl p-4 text-center">
          <div className={`text-2xl font-extrabold tabular-nums sm:text-3xl ${stats.net >= 0 ? 'text-edge-600' : 'text-rose-600'}`}>
            {eur(stats.net)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">gain net</div>
        </div>
        <div className="surface rounded-2xl p-4 text-center">
          <div className="text-2xl font-extrabold tabular-nums text-[#1d1d1f] sm:text-3xl">{stats.winRate}%</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">réussite ({stats.settled})</div>
        </div>
        <div className="surface rounded-2xl p-4 text-center">
          <div className={`text-2xl font-extrabold tabular-nums sm:text-3xl ${stats.roi >= 0 ? 'text-edge-600' : 'text-rose-600'}`}>
            {stats.roi > 0 ? '+' : ''}{stats.roi}%
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">ROI</div>
        </div>
      </div>

      {/* Ajouter un pari */}
      <div className="surface rounded-2xl p-4">
        <p className="mb-3 text-sm font-semibold text-[#1d1d1f]">Ajouter un pari</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            list="oddsight-matches" placeholder="Match (ex. Paris-SG – Rennes)"
            value={form.match} onChange={(e) => setForm({ ...form, match: e.target.value })}
            className="rounded-xl border border-black/10 bg-pitch-800 px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-edge-500/50 sm:col-span-2"
          />
          <datalist id="oddsight-matches">
            {(predictions || []).map((p) => (
              <option key={p.id} value={`${p.team1} – ${p.team2}`} />
            ))}
          </datalist>
          <input
            placeholder="Ton pari (ex. Paris-SG)" value={form.pick}
            onChange={(e) => setForm({ ...form, pick: e.target.value })}
            className="rounded-xl border border-black/10 bg-pitch-800 px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-edge-500/50"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text" inputMode="decimal" placeholder="Mise €" value={form.stake}
              onChange={(e) => setForm({ ...form, stake: e.target.value })}
              className="rounded-xl border border-black/10 bg-pitch-800 px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-edge-500/50"
            />
            <input
              type="text" inputMode="decimal" placeholder="Cote" value={form.odds}
              onChange={(e) => setForm({ ...form, odds: e.target.value })}
              className="rounded-xl border border-black/10 bg-pitch-800 px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-edge-500/50"
            />
          </div>
        </div>
        <button
          onClick={add}
          disabled={!valid}
          className="mt-3 w-full rounded-xl bg-edge-500 py-2.5 text-sm font-semibold text-pitch-950 transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-pitch-700 disabled:text-[#86868b] disabled:hover:bg-pitch-700"
        >
          Ajouter
        </button>
        {!valid && (
          <p className="mt-2 text-center text-[11px] text-[#86868b]">
            Renseigne le match, ton pari, une mise (&gt; 0&nbsp;€) et une cote (&gt; 1).
          </p>
        )}
      </div>

      {/* Liste */}
      {bets.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Aucun pari suivi pour l'instant. Ajoute ton premier pari ci-dessus 👆
        </p>
      ) : (
        <div className="space-y-2">
          {bets.map((b) => {
            const p = pnl(b)
            return (
              <div key={b.id} className="surface rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#1d1d1f]">{b.pick}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{b.match}</div>
                    <div className="mt-0.5 text-[11px] text-[#6e6e73]">
                      {b.stake} € @ {b.odds}
                      {b.status !== 'pending' && (
                        <span className={p >= 0 ? 'text-edge-600' : 'text-rose-600'}> · {eur(p)}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => remove(b.id)} className="shrink-0 text-xs text-[#86868b] hover:text-rose-600">✕</button>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {Object.entries(STATUS).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setStatus(b.id, k)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        b.status === k ? v.cls : 'text-[#86868b] hover:text-[#1d1d1f]'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Tes paris sont enregistrés sur cet appareil uniquement. 18+ · jouer comporte des risques.
      </p>
    </div>
  )
}
