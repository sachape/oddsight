import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// Navigation par journée : flèches + dropdown cliquable
export default function JourneeSelect({ labels, idx, setIdx }) {
  return (
    <div className="mb-5 flex items-center justify-center gap-2">
      <button
        onClick={() => setIdx(idx - 1)}
        disabled={idx === 0}
        className="grid size-9 place-items-center rounded-full border border-black/10 bg-black/[0.03] text-[#1d1d1f] transition-colors hover:bg-black/[0.05] disabled:opacity-30"
        aria-label="Journée précédente"
      >
        <ChevronLeft className="size-4" />
      </button>
      <Select value={String(idx)} onValueChange={(v) => setIdx(Number(v))}>
        <SelectTrigger className="w-52 justify-center gap-2 rounded-full border-black/10 bg-black/[0.03] font-semibold text-[#1d1d1f]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {labels.map((l, k) => (
            <SelectItem key={k} value={String(k)}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
        {idx + 1}/{labels.length}
      </span>
      <button
        onClick={() => setIdx(idx + 1)}
        disabled={idx === labels.length - 1}
        className="grid size-9 place-items-center rounded-full border border-black/10 bg-black/[0.03] text-[#1d1d1f] transition-colors hover:bg-black/[0.05] disabled:opacity-30"
        aria-label="Journée suivante"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
