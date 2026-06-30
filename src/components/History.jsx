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
