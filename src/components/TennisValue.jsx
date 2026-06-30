import { useState } from 'react'
import Badge from './Badge.jsx'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

function Verdict({ prob, input }) {
  const B = parseFloat(String(input || '').replace(',', '.'))
  if (!input || !Number.isFinite(B) || B <= 1) return <span className="text-[11px] text-[#86868b]">cote ?</span>
  const ev = (prob / 100) * B - 1
  const edge = Math.round(ev * 1000) / 10
  if (ev > 0.005) return <Badge variant="success">✓ +{edge}%</Badge>
  if (ev > -0.03) return <Badge variant="default">≈ {edge}%</Badge>
  return <Badge variant="error">{edge}%</Badge>
}

function PlayerRow({ name, prob, oddKey, odds, setOdds }) {
  const fair = prob > 0 ? (100 / prob).toFixed(2) : '—'
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      <span className="min-w-0 flex-1 truncate text-[#1d1d1f]">{name}</span>
      <span className="w-10 text-right tabular-nums text-[#86868b]">{prob}%</span>
      <span className="w-12 text-right tabular-nums text-[#6e6e73]">{fair}</span>
      <input
        type="text" inputMode="decimal" placeholder="cote"
        value={odds[oddKey] || ''}
        onChange={(e) => setOdds((o) => ({ ...o, [oddKey]: e.target.value }))}
        className="w-16 rounded-lg border border-black/10 bg-[#f5f5f7] px-2 py-1 text-right text-sm text-[#1d1d1f] outline-none focus:border-[#1d1d1f]/40"
      />
      <span className="w-20 text-right"><Verdict prob={prob} input={odds[oddKey]} /></span>
    </div>
  )
}

export default function TennisValue({ predictions }) {
  const [cat, setCat] = useState('Men')
  const [odds, setOdds] = useState({})
  const list = predictions.filter((p) => p.category.includes(cat))

  return (
    <div className="space-y-5">
      <div className="surface rounded-2xl p-4 text-sm leading-relaxed text-[#1d1d1f]">
        <b>Trouve la valeur.</b> Saisis la cote de ton opérateur pour un joueur. Si elle dépasse
        notre <b>cote juste</b>, c'est un <span className="font-semibold text-[#15803d]">pari de valeur</span>.
      </div>

      <div className="flex justify-center gap-2">
        {[{ id: 'Men', label: 'Hommes' }, { id: 'Women', label: 'Femmes' }].map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              cat === c.id ? 'bg-[#1d1d1f] text-white' : 'bg-pitch-800 text-[#1d1d1f] hover:bg-pitch-700'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.id} className="surface rounded-xl p-3">
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-[#86868b]">
              <span>{p.round}</span>
              <span>{p.date ? dateFmt.format(new Date(p.date + 'T12:00:00')) : ''}</span>
            </div>
            <PlayerRow name={p.player1} prob={p.pWin1} oddKey={`${p.id}-1`} odds={odds} setOdds={setOdds} />
            <PlayerRow name={p.player2} prob={p.pWin2} oddKey={`${p.id}-2`} odds={odds} setOdds={setOdds} />
          </div>
        ))}
      </div>

      <p className="text-center text-xs leading-relaxed text-[#86868b]">
        Cote juste = sans marge. Jouer comporte des risques. 18+ · Joueurs Info Service 09 74 75 13 13.
      </p>
    </div>
  )
}
