import { flag } from '../flags.js'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const fmtDate = (iso) => dateFmt.format(new Date(iso + 'T12:00:00'))

function StatCard({ label, pct, correct, total, highlight }) {
  return (
    <div className="surface surface-hover rounded-2xl p-4 text-center">
      <div className={`text-3xl font-extrabold tabular-nums ${highlight ? 'text-gradient' : 'text-[#1d1d1f]'}`}>
        {pct}%
      </div>
      <div className="mt-0.5 text-[11px] text-[#6e6e73]">{label}</div>
      <div className="text-[11px] text-[#86868b]">{correct}/{total} corrects</div>
    </div>
  )
}

function Verdict({ hit }) {
  return (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
        hit ? 'bg-edge-500/15 text-edge-600' : 'bg-rose-500/15 text-rose-600'
      }`}
    >
      {hit ? '✓' : '✗'}
    </span>
  )
}

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
      {/* Score global */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Résultat (1N2)" pct={s.result.pct} correct={s.result.correct} total={s.total} highlight />
        <StatCard label="Les deux marquent" pct={s.btts.pct} correct={s.btts.correct} total={s.total} />
        <StatCard label="+/−2,5 buts" pct={s.ou25.pct} correct={s.ou25.correct} total={s.total} />
      </div>

      <ModelQuality metrics={s.metrics} />

      {/* Méthodologie honnête */}
      <div className="surface rounded-2xl p-4 text-sm leading-relaxed text-[#6e6e73]">
        <b className="text-edge-600">Méthode (transparente).</b> Chaque match est repronostiqué
        en n'utilisant <b>que les données disponibles avant le coup d'envoi</b> — aucun résultat
        futur ne fuite dans le calcul. Le « prono » retenu est l'issue la plus probable du modèle.
        <span className="mt-1 block text-xs text-[#86868b]">
          Réserve : l'Elo utilisé est l'Elo mondial courant (il évolue lentement), ce qui peut
          très légèrement flatter le score. Sur {s.total} matchs, c'est un track record indicatif,
          pas une garantie.
        </span>
      </div>

      {/* Détail match par match */}
      <div className="space-y-2">
        {history.matches.map((r, i) => (
          <div key={i} className="surface flex items-center gap-3 rounded-xl px-3 py-2.5">
            <Verdict hit={r.hit} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="truncate text-[#1d1d1f]">
                  {flag(r.team1)} {r.team1}
                </span>
                <span className="rounded bg-pitch-800 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[#1d1d1f]">
                  {r.score}
                </span>
                <span className="truncate text-[#1d1d1f]">
                  {r.team2} {flag(r.team2)}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#86868b]">
                <span>{fmtDate(r.date)}</span>
                <span>·</span>
                <span>
                  Prono : <span className={r.hit ? 'text-edge-600' : 'text-[#6e6e73]'}>{r.predLabel}</span> ({r.prob}%)
                </span>
                <span className={r.btts.hit ? 'text-edge-600/80' : 'text-[#86868b]'}>
                  BTTS {r.btts.pred} {r.btts.hit ? '✓' : '✗'}
                </span>
                <span className={r.ou25.hit ? 'text-edge-600/80' : 'text-[#86868b]'}>
                  {r.ou25.pred} {r.ou25.hit ? '✓' : '✗'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
