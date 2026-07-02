import { flag } from '../flags.js'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const fmtDate = (iso) => dateFmt.format(new Date(iso + 'T12:00:00'))

function QCell({ label, v, strong }) {
  return (
    <div className={`rounded-xl p-2.5 ${strong ? 'bg-edge-500/10 ring-1 ring-edge-500/25' : 'bg-pitch-850'}`}>
      <div className={`text-lg font-bold tabular-nums ${strong ? 'text-edge-700' : 'text-[#1d1d1f]'}`}>
        {v ?? '—'}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-[#86868b]">{label}</div>
    </div>
  )
}

// Qualité probabiliste : log-loss vs baselines + courbe de calibration.
function ModelQuality({ metrics: m }) {
  if (!m?.model) return null
  const beatsElo = m.baselineElo?.logLoss != null && m.model.logLoss <= m.baselineElo.logLoss
  return (
    <div className="surface rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1d1d1f]">Qualité des probabilités</h3>
        <span className="text-[11px] text-[#86868b]">log-loss · plus bas = mieux</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <QCell label="Modèle" v={m.model.logLoss} strong />
        <QCell label="Elo seul" v={m.baselineElo?.logLoss} />
        <QCell label="Naïf" v={m.baselineRate?.logLoss} />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[#6e6e73]">
        {beatsElo
          ? '✓ Le modèle fait aussi bien ou mieux que le simple Elo (le benchmark à battre).'
          : 'Le modèle est proche du simple Elo — marge de progression identifiée.'}
        {m.calibrationApplied && ' Probabilités recalibrées sur l’historique.'}
      </p>

      {m.calibration?.length > 0 && (
        <div className="mt-3 border-t border-black/[0.06] pt-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-[#86868b]">
            Calibration — quand le modèle annonce X %, ça arrive…
          </div>
          <div className="space-y-1">
            {m.calibration.map((b) => (
              <div key={b.range} className="flex items-center gap-2 text-[11px] tabular-nums">
                <span className="w-14 shrink-0 text-[#6e6e73]">{b.range}</span>
                <span className="w-24 shrink-0 text-[#86868b]">annoncé {b.predicted}%</span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#e3e3e8]">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-[#c7c7cc]" style={{ width: `${b.predicted}%` }} />
                  <span className="absolute inset-y-0 w-0.5 bg-edge-600" style={{ left: `${b.observed}%` }} />
                </span>
                <span className="w-16 shrink-0 text-right font-semibold text-[#1d1d1f]">réel {b.observed}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function History({ history }) {
  if (!history || !history.summary.total) {
    return <p className="py-12 text-center text-[#86868b]">Pas encore d'historique disponible.</p>
  }
  const s = history.summary

  return (
    <div className="space-y-5">
      <ModelQuality metrics={s.metrics} />

      {/* Méthodologie honnête */}
      <div className="surface rounded-2xl p-4 text-sm leading-relaxed text-[#6e6e73]">
        <b className="text-edge-600">Méthode (transparente).</b> Chaque match passé est
        repronostiqué en n'utilisant <b>que les données disponibles avant le coup d'envoi</b> —
        aucun résultat futur ne fuite dans le calcul. On mesure la <b>qualité des probabilités</b>
        (calibration, log-loss), pas un « taux de réussite » qui serait trompeur.
        <span className="mt-1 block text-xs text-[#86868b]">
          Ces mesures portent sur {s.total} matchs déjà joués. Aucune prédiction n'est une garantie.
        </span>
      </div>

      {/* Matchs analysés — transparence (prono vs résultat), sans notion de « réussite » */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-[#86868b]">
          Matchs analysés · notre prono vs le résultat
        </div>
        {history.matches.map((r, i) => (
          <div key={i} className="surface flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[#1d1d1f]">{flag(r.team1)} {r.team1}</span>
                <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[#1d1d1f]">
                  {r.score}
                </span>
                <span className="truncate text-[#1d1d1f]">{r.team2} {flag(r.team2)}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-[#86868b]">
                {fmtDate(r.date)} · notre prono : <span className="text-[#6e6e73]">{r.predLabel}</span> ({r.prob}%)
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
