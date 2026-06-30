import { useState } from 'react'
import JourneeSelect from './JourneeSelect.jsx'

const fmt = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

function ComboCard({ combo, title, subtitle, accent, stake }) {
  if (!combo) return null
  const ret = stake * combo.odds
  const profit = ret - stake
  return (
    <div className="fade-up surface surface-hover rounded-2xl p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className={`font-semibold ${accent}`}>{title}</h3>
          <p className="text-xs text-[#86868b]">{subtitle}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums text-[#1d1d1f]">×{fmt(combo.odds)}</div>
          <div className="text-[11px] text-[#86868b]">cote combinée</div>
        </div>
      </div>

      {/* Gain pour la mise sélectionnée */}
      <div className="mb-3 flex items-center justify-between rounded-xl bg-pitch-850 px-3 py-2.5">
        <span className="text-sm text-[#6e6e73]">Avec <b className="text-[#1d1d1f]">{stake}€</b></span>
        <span className="text-sm">
          <b className="text-edge-600">{fmt(ret)}€</b>{' '}
          <span className="text-[#86868b]">(+{fmt(profit)}€)</span>
        </span>
      </div>

      {/* Probabilité honnête */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[11px] text-[#86868b]">
          <span>Probabilité que TOUT passe</span>
          <span className="font-semibold text-[#1d1d1f]">{combo.prob}%</span>
        </div>
        <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-pitch-800">
          <span className="bg-[#1d1d1f]" style={{ width: `${combo.prob}%` }} />
        </span>
      </div>

      {/* Sélections */}
      <ul className="space-y-1.5">
        {combo.legs.map((l, i) => (
          <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-pitch-850/60 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="truncate text-[#1d1d1f]">{l.match}</div>
              <div className="text-[11px] text-[#86868b]">{l.market}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-medium text-[#1d1d1f]">{l.sel}</div>
              <div className="text-[11px] text-[#86868b]">{l.prob}% · cote {fmt(l.odds)}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function BetBuilder({ bets }) {
  const [stake, setStake] = useState(10)
  const [ri, setRi] = useState(0)
  if (!bets) {
    return <p className="py-12 text-center text-[#86868b]">Aucun combiné disponible pour le moment.</p>
  }
  const rounds = bets.perRound ? bets.rounds : null
  const idx = rounds ? Math.min(ri, rounds.length - 1) : 0
  const cur = rounds ? rounds[idx] : bets

  return (
    <div className="space-y-5">
      {rounds && (
        <JourneeSelect labels={rounds.map((r) => r.round)} idx={idx} setIdx={setRi} />
      )}

      {/* Sélecteur de mise */}
      <div>
        <p className="mb-2 text-sm text-[#6e6e73]">Choisis ta mise</p>
        <div className="flex gap-2">
          {bets.stakes.map((s) => (
            <button
              key={s}
              onClick={() => setStake(s)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                stake === s
                  ? 'bg-[#1d1d1f] text-white'
                  : 'bg-pitch-800 text-[#1d1d1f] hover:bg-pitch-700'
              }`}
            >
              {s}€
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ComboCard
          combo={cur.secure}
          stake={stake}
          title="Sécurité — que ça passe"
          subtitle="Probabilité maximale, petit gain"
          accent="text-sky-600"
        />
        <ComboCard
          combo={cur.safe}
          stake={stake}
          title="Équilibré — pour doubler"
          subtitle="Le plus probable atteignant ×2"
          accent="text-edge-600"
        />
        <ComboCard
          combo={cur.bold}
          stake={stake}
          title="Audacieux — pour tripler"
          subtitle="Plus de gain, moins de probabilité"
          accent="text-amber-600"
        />
      </div>

      <p className="text-center text-xs leading-relaxed text-[#86868b]">
        Aucun combiné n'est garanti. Jouer comporte des risques. 18+ ·
        Joueurs Info Service 09 74 75 13 13.
      </p>
    </div>
  )
}
