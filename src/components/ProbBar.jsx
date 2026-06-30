// Barre de probabilité 1 / nul / 2 — monochrome (le favori en noir, le reste en gris)
export default function ProbBar({ p1, draw, p2, knockout }) {
  const fav1 = p1 >= p2
  const c1 = fav1 ? 'bg-[#1d1d1f]' : 'bg-[#c7c7cc]'
  const c2 = fav1 ? 'bg-[#c7c7cc]' : 'bg-[#1d1d1f]'
  const t1 = fav1 ? 'text-[#1d1d1f] font-semibold' : 'text-[#86868b]'
  const t2 = fav1 ? 'text-[#86868b]' : 'text-[#1d1d1f] font-semibold'
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full gap-0.5">
        <div className={`bar-grow rounded-full ${c1}`} style={{ width: `${p1}%` }} />
        {!knockout && (
          <div className="bar-grow rounded-full bg-[#e3e3e8]" style={{ width: `${draw}%` }} />
        )}
        <div className={`bar-grow rounded-full ${c2}`} style={{ width: `${p2}%` }} />
      </div>
      <div className="flex justify-between text-[11px]">
        <span className={t1}>{p1}%</span>
        {!knockout && <span className="text-[#86868b]">nul {draw}%</span>}
        <span className={t2}>{p2}%</span>
      </div>
    </div>
  )
}
