import { useMemo, useState } from 'react'
import JourneeSelect from './JourneeSelect.jsx'

const RISKS = [
  { id: 'prudent', label: 'Prudent', base: 0.015, tone: 'text-sky-600' },
  { id: 'equilibre', label: 'Équilibré', base: 0.03, tone: 'text-edge-600' },
  { id: 'agressif', label: 'Agressif', base: 0.05, tone: 'text-amber-600' },
]
const eur = (n) => `${Math.round(n * 100) / 100} €`

export default function Bankroll({ valuePicks }) {
  const [bankroll, setBankroll] = useState(100)
  const [risk, setRisk] = useState('equilibre')
  const [ri, setRi] = useState(0)

  if (!valuePicks) {
    return <p className="py-12 text-center text-muted-foreground">Aucune donnée disponible.</p>
  }
  const rounds = valuePicks.perRound ? valuePicks.rounds : null
  const idx = rounds ? Math.min(ri, rounds.length - 1) : 0
  const cur = rounds ? rounds[idx] : valuePicks
  const base = RISKS.find((r) => r.id === risk).base

  // Sélections candidates : les plus sûres + équilibrées, dédupliquées par match
  const plan = useMemo(() => {
    const seen = new Set()
    const picks = [...(cur.safest || []), ...(cur.balanced || [])]
      .filter((p) => (seen.has(p.match) ? false : seen.add(p.match)))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 5)
    return picks.map((p) => {
      const factor = Math.max(0.5, Math.min(1.6, (p.prob - 50) / 25))
      const stake = Math.max(1, Math.round(bankroll * base * factor))
      return { ...p, stake }
    })
  }, [cur, bankroll, base])

  const total = plan.reduce((s, p) => s + p.stake, 0)
  const exposurePct = bankroll ? Math.round((total / bankroll) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="surface rounded-2xl p-4 text-sm leading-relaxed text-[#1d1d1f]">
        <b className="text-edge-600">Combien miser ?</b> Indique ta bankroll (ton budget total)
        et ton profil de risque. On répartit la mise sur les meilleurs paris de la journée,
        proportionnellement à la confiance du modèle — jamais tout sur un seul.
      </div>

      {rounds && <JourneeSelect labels={rounds.map((r) => r.round)} idx={idx} setIdx={setRi} />}

      {/* Réglages */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="surface rounded-2xl p-4">
          <label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Ta bankroll</label>
          <div className="flex items-center gap-2">
            <input
              type="number" min="1" value={bankroll}
              onChange={(e) => setBankroll(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-xl border border-black/10 bg-pitch-800 px-3 py-2 text-lg font-bold text-[#1d1d1f] outline-none focus:border-edge-500/50"
            />
            <span className="text-lg text-muted-foreground">€</span>
          </div>
        </div>
        <div className="surface rounded-2xl p-4">
          <label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Profil de risque</label>
          <div className="flex gap-2">
            {RISKS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRisk(r.id)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                  risk === r.id ? 'bg-[#1d1d1f] text-white' : 'bg-pitch-800 text-[#1d1d1f] hover:bg-pitch-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plan de mise */}
      <div className="surface overflow-hidden rounded-2xl">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-black/[0.06] px-4 py-2.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Pari conseillé</span>
          <span className="text-right">Confiance</span>
          <span className="text-right">Mise</span>
        </div>
        {plan.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-black/[0.06] px-4 py-2.5 text-sm last:border-0">
            <div className="min-w-0">
              <div className="truncate font-semibold text-[#1d1d1f]">{p.sel}</div>
              <div className="truncate text-[11px] text-muted-foreground">{p.match}</div>
            </div>
            <span className="text-right tabular-nums text-[#6e6e73]">{p.prob}%</span>
            <span className="text-right font-bold tabular-nums text-edge-600">{eur(p.stake)}</span>
          </div>
        ))}
      </div>

      {/* Résumé */}
      <div className="flex items-center justify-between rounded-2xl border border-edge-500/25 bg-edge-500/[0.04] px-4 py-3">
        <span className="text-sm text-[#1d1d1f]">Mise totale conseillée</span>
        <span className="text-right">
          <b className="text-lg text-edge-600">{eur(total)}</b>
          <span className="ml-2 text-xs text-muted-foreground">{exposurePct}% de ta bankroll</span>
        </span>
      </div>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Mises calculées sur la confiance du modèle (pas une garantie de gain). Ne mise jamais
        plus que ce que tu peux perdre. 18+ · Joueurs Info Service 09 74 75 13 13.
      </p>
    </div>
  )
}
