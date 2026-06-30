import { flag } from '../flags.js'

export default function Standings({ groups }) {
  const names = Object.keys(groups).sort()
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {names.map((g) => (
        <div key={g} className="fade-up surface rounded-2xl p-4">
          <h3 className="mb-2 text-sm font-semibold text-edge-600">{g}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-[#86868b]">
                <th className="pb-1 text-left font-medium">Équipe</th>
                <th className="pb-1 text-center font-medium" title="Elo mondial">Elo</th>
                <th className="pb-1 text-center font-medium" title="Différence de buts">Diff</th>
                <th className="pb-1 text-right font-medium" title="Points">Pts</th>
              </tr>
            </thead>
            <tbody>
              {groups[g].map((t, i) => (
                <tr
                  key={t.name}
                  className={`border-t border-pitch-800 ${i < 2 ? 'text-[#1d1d1f]' : 'text-[#6e6e73]'}`}
                >
                  <td className="py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-3.5 w-0.5 rounded ${i < 2 ? 'bg-edge-500' : 'bg-transparent'}`} />
                      <span>{flag(t.name)}</span>
                      <span className="truncate">{t.name}</span>
                    </span>
                  </td>
                  <td className="text-center tabular-nums text-[#86868b]">{t.elo}</td>
                  <td className="text-center tabular-nums">{t.gf - t.ga > 0 ? '+' : ''}{t.gf - t.ga}</td>
                  <td className="text-right font-semibold tabular-nums">{t.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
