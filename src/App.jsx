import { useEffect, useMemo, useState } from 'react'
import {
  Target, Layers, TrendingUp, History as HistoryIcon, Trophy, ListChecks, BookOpen, Clock,
  Wallet, ClipboardList,
} from 'lucide-react'
import { flag } from './flags.js'
import { COMPETITIONS, SPORT_LABEL, getCompetition } from './competitions.js'
import PredictionCard from './components/PredictionCard.jsx'
import Standings from './components/Standings.jsx'
import HowItWorks from './components/HowItWorks.jsx'
import BetBuilder from './components/BetBuilder.jsx'
import History from './components/History.jsx'
import ValueBetting from './components/ValueBetting.jsx'
import Bankroll from './components/Bankroll.jsx'
import Suivi from './components/Suivi.jsx'
import JourneeSelect from './components/JourneeSelect.jsx'
import Tennis from './components/Tennis.jsx'
import TennisValue from './components/TennisValue.jsx'
import MatchTicker from './components/MatchTicker.jsx'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

// Datasets déjà chargés (le module Vite est lui-même mis en cache, mais on garde
// la donnée parsée ici pour éviter tout flash de skeleton en revenant sur une compète).
const dataCache = new Map()

function useCompetitionData(comp) {
  const [, setTick] = useState(0)
  // Donnée dérivée directement du cache de la compète COURANTE : on ne sert
  // jamais la donnée d'une autre compète pendant une transition (sinon un
  // composant sport-spécifique, ex. Tennis, reçoit des données football → crash).
  const cached = comp.load ? dataCache.get(comp.id) ?? null : null

  useEffect(() => {
    if (!comp.load || dataCache.has(comp.id)) return
    let cancelled = false
    comp.load().then((mod) => {
      dataCache.set(comp.id, mod.default)
      if (!cancelled) setTick((t) => t + 1) // re-render quand la donnée est prête
    })
    return () => { cancelled = true }
  }, [comp.id, comp.load])

  return { data: cached, loading: Boolean(comp.load) && !cached }
}

const ALL = ['football', 'tennis', 'basket']
const NAV = [
  { id: 'pronos', group: 'Analyser', label: 'Pronostics', icon: Target, title: 'Pronostics', sub: 'Les matchs à venir, analysés par le modèle', sports: ALL },
  { id: 'standings', group: 'Analyser', label: 'Classements', icon: Trophy, title: 'Classements', sub: 'Le classement, avec l’Elo de chaque équipe', sports: ['football'] },
  { id: 'results', group: 'Analyser', label: 'Résultats', icon: ListChecks, title: 'Résultats', sub: 'Tous les matchs déjà joués', sports: ['football'] },
  { id: 'track', group: 'Analyser', label: 'Track record', icon: HistoryIcon, title: 'Track record', sub: 'La fiabilité du modèle, match par match', sports: ['football'] },
  { id: 'value', group: 'Parier', label: 'Value & cotes', icon: TrendingUp, title: 'Value & cotes', sub: 'Repère les cotes où le marché te sous-estime', sports: ['football', 'tennis'] },
  { id: 'bets', group: 'Parier', label: 'Combinés', icon: Layers, title: 'Combinés', sub: 'Doubler / tripler sa mise, en toute transparence', sports: ['football'] },
  { id: 'bankroll', group: 'Parier', label: 'Bankroll', icon: Wallet, title: 'Bankroll', sub: 'Combien miser selon ton budget', sports: ['football'] },
  { id: 'suivi', group: 'Parier', label: 'Mon suivi', icon: ClipboardList, title: 'Mon suivi', sub: 'Tes paris suivis, tes gains réels', sports: ALL },
  { id: 'how', group: 'Aide', label: 'Guide du parieur', icon: BookOpen, title: 'Guide du parieur', sub: 'Comprendre les paris et garder le contrôle', sports: ALL },
]
const NAV_GROUPS = ['Analyser', 'Parier', 'Aide']

const groupDateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14" stroke="#34e29b" strokeWidth="2.5" />
      <path d="M16 8.5 L22 13 L19.7 20 L12.3 20 L10 13 Z" fill="#34e29b" />
    </svg>
  )
}

function CompetitionSelect({ compId, setCompId }) {
  const sports = [...new Set(COMPETITIONS.map((c) => c.sport))]
  return (
    <Select value={compId} onValueChange={setCompId}>
      <SelectTrigger className="w-full bg-sidebar-accent/40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sports.map((sport) => (
          <SelectGroup key={sport}>
            <SelectLabel>{SPORT_LABEL[sport]}</SelectLabel>
            {COMPETITIONS.filter((c) => c.sport === sport).map((c) => (
              <SelectItem key={c.id} value={c.id} disabled={c.status !== 'live'}>
                {c.name}{c.status !== 'live' ? ' · bientôt' : ''}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

function AppSidebar({ tab, setTab, compId, setCompId, data, loading, sport }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-edge-500/10 ring-1 ring-edge-500/25">
            <Logo size={18} />
          </div>
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-[#1d1d1f]">Odd<span className="text-edge-600">Sight</span></span>
            <span className="text-[11px] text-muted-foreground">Pronostics par la data</span>
          </div>
        </div>
        <div className="px-1 pb-1 group-data-[collapsible=icon]:hidden">
          <CompetitionSelect compId={compId} setCompId={setCompId} />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((g) => {
          const items = NAV.filter((n) => n.group === g && n.sports.includes(sport))
          if (!items.length) return null
          return (
          <SidebarGroup key={g}>
            <SidebarGroupLabel>{g}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={tab === item.id}
                      tooltip={item.label}
                      onClick={() => setTab(item.id)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground group-data-[collapsible=icon]:hidden">
          {loading ? (
            <span>Chargement des données…</span>
          ) : data ? (
            <>
              <div className="mb-1 flex items-center gap-1.5 font-medium text-[#1d1d1f]">
                <span className="pulse-dot size-1.5 rounded-full bg-edge-400" />
                {data.counts.upcoming} matchs à venir
              </div>
              Mis à jour le {new Date(data.asOf + 'T12:00:00').toLocaleDateString('fr-FR')} · 18+
            </>
          ) : (
            <span>Compétition à venir · 18+</span>
          )}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function PronosSkeleton() {
  return (
    <div className="fade-up">
      <Skeleton className="mb-6 h-32 rounded-2xl" />
      <div className="mb-8 grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <Skeleton className="mx-auto mb-4 h-9 w-56 rounded-full" />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

function ComingSoon({ comp }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-edge-500/10 ring-1 ring-edge-500/25">
        <Clock className="size-6 text-edge-600" />
      </div>
      <h2 className="text-xl font-bold text-[#1d1d1f]">{comp.name} — bientôt</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{comp.note}</p>
      <p className="mt-4 text-xs text-[#86868b]">
        Choisis une autre compétition dans le menu en haut de la barre latérale.
      </p>
    </div>
  )
}

export default function App() {
  const [compId, setCompId] = useState('ligue1')
  const [tab, setTab] = useState('pronos')
  const comp = getCompetition(compId)
  const { data, loading } = useCompetitionData(comp)
  // Onglet effectif : si l'onglet courant n'existe pas pour ce sport, on retombe sur Pronostics
  const tabItem = NAV.find((n) => n.id === tab)
  const tab2 = tabItem && tabItem.sports.includes(comp.sport) ? tab : 'pronos'
  const current = NAV.find((n) => n.id === tab2)

  const byDate = useMemo(() => {
    if (!data) return []
    const map = new Map()
    data.predictions.forEach((p) => {
      if (!map.has(p.date)) map.set(p.date, [])
      map.get(p.date).push(p)
    })
    return [...map.entries()]
  }, [data])

  return (
    <SidebarProvider>
      <AppSidebar tab={tab2} setTab={setTab} compId={compId} setCompId={setCompId} data={data} loading={loading} sport={comp.sport} />

      <SidebarInset className="min-w-0 bg-transparent">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-black/[0.06] bg-white/75 px-4 backdrop-blur-xl">
          <SidebarTrigger className="-ml-1 text-[#1d1d1f]" />
          <div className="flex flex-1 flex-col">
            <h1 className="text-sm font-semibold text-[#1d1d1f] sm:text-base">{current?.title}</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">{current?.sub}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-[#1d1d1f]">
            <span className="pulse-dot size-1.5 rounded-full bg-edge-400" />
            {comp.short}
          </span>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">
          {loading ? (
            <PronosSkeleton />
          ) : !data ? (
            <ComingSoon comp={comp} />
          ) : (
            <>
              {tab2 === 'pronos' && comp.sport === 'tennis' && <Tennis data={data} />}
              {tab2 === 'pronos' && comp.sport !== 'tennis' && (
                <>
                  <Coupon data={data} />
                  <StatStrip data={data} />
                  {data.predictions.length === 0 ? (
                    <p className="py-12 text-center text-muted-foreground">
                      Aucun match à prédire pour le moment.
                    </p>
                  ) : data.format === 'league' ? (
                    <LeaguePronos key={compId} predictions={data.predictions} />
                  ) : (
                    <div className="space-y-8">
                      {byDate.map(([date, preds]) => (
                        <section key={date}>
                          <h2 className="mb-3 text-sm font-semibold capitalize text-muted-foreground">
                            {groupDateFmt.format(new Date(date + 'T12:00:00'))}
                          </h2>
                          <div className="grid gap-3 lg:grid-cols-2">
                            {preds.map((p, i) => (
                              <PredictionCard key={p.id} p={p} index={i} />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </>
              )}

              {tab2 === 'bets' && <BetBuilder bets={data.bets} />}
              {tab2 === 'value' && comp.sport === 'tennis' && (
                <TennisValue predictions={data.predictions} />
              )}
              {tab2 === 'value' && comp.sport !== 'tennis' && (
                <ValueBetting predictions={data.predictions} valuePicks={data.valuePicks} />
              )}
              {tab2 === 'bankroll' && <Bankroll valuePicks={data.valuePicks} />}
              {tab2 === 'suivi' && <Suivi compId={compId} predictions={data.predictions} />}
              {tab2 === 'standings' && <Standings groups={data.groups} />}
              {tab2 === 'results' && <Results results={data.results} />}
              {tab2 === 'track' && <History history={data.history} />}
              {tab2 === 'how' && <HowItWorks dataset={data} />}
            </>
          )}
        </main>

        <MatchTicker predictions={data?.predictions} />
      </SidebarInset>
    </SidebarProvider>
  )
}

function Coupon({ data }) {
  const vp = data.valuePicks
  const bets = data.bets
  if (!vp || !bets) return null
  const picks = vp.perRound ? vp.rounds[0] : vp
  const combo = bets.perRound ? bets.rounds[0] : bets
  const roundLabel = vp.perRound ? vp.rounds[0].round : null
  const sure = picks.safest?.[0]
  const value = picks.value?.[0]
  const c = combo.safe || combo.secure
  if (!sure && !value && !c) return null

  const Card = ({ icon, label, children }) => (
    <div className="flex flex-col rounded-xl bg-[#f5f5f7] p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">
        <span className="text-sm">{icon}</span>{label}
      </div>
      {children}
    </div>
  )

  return (
    <div className="surface fade-up mb-6 rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#1d1d1f]">
          🎟️ Le coupon {roundLabel ? `de la ${roundLabel.toLowerCase()}` : 'du moment'}
        </h2>
        <span className="hidden text-[11px] text-[#86868b] sm:inline">Quoi parier, en 3 actions</span>
      </div>
      <div className="grid items-start gap-2 sm:grid-cols-3">
        {sure && (
          <Card icon="🔒" label="Le plus sûr">
            <div className="text-sm font-semibold text-[#1d1d1f]">{sure.sel}</div>
            <div className="truncate text-xs text-[#86868b]">{sure.match}</div>
            <div className="mt-1 text-sm font-bold tabular-nums text-[#1d1d1f]">{sure.prob}%</div>
          </Card>
        )}
        {c && (
          <Card icon="🎯" label="Combiné conseillé">
            <div className="text-sm font-semibold text-[#1d1d1f]">
              ×{c.odds} <span className="text-xs font-normal text-[#86868b]">· {c.prob}%</span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {c.legs.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-[#6e6e73]">{l.match}</span>
                  <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-[#1d1d1f] ring-1 ring-black/[0.06]">
                    {l.sel}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {value && (
          <Card icon="💎" label="Meilleure value">
            <div className="text-sm font-semibold text-[#1d1d1f]">{value.sel}</div>
            <div className="truncate text-xs text-[#86868b]">{value.match}</div>
            <div className="mt-1 text-sm font-bold tabular-nums text-[#1d1d1f]">cote ≥ {value.fairOdds}</div>
          </Card>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-[#86868b]">
        Détails dans les onglets Combinés et Value · jouer comporte des risques (18+)
      </p>
    </div>
  )
}

const FILTERS = [
  { id: 'all', label: 'Tous', test: () => true },
  { id: 'confident', label: 'Confiants', test: (p) => p.confidence === 'Élevée' || p.confidence === 'Modérée' },
  { id: 'tight', label: 'Serrés', test: (p) => p.tight },
  { id: 'goals', label: 'Buts +', test: (p) => p.markets?.over?.['2.5']?.over >= 55 },
]

function LeaguePronos({ predictions }) {
  const rounds = useMemo(() => {
    const m = new Map()
    predictions.forEach((p) => {
      if (!m.has(p.round)) m.set(p.round, [])
      m.get(p.round).push(p)
    })
    return [...m.entries()]
  }, [predictions])
  const [i, setI] = useState(0)
  const [filter, setFilter] = useState('all')
  const idx = Math.min(i, rounds.length - 1)
  const all = rounds[idx]?.[1] || []
  const test = FILTERS.find((f) => f.id === filter).test
  const preds = all.filter(test)

  return (
    <div>
      <JourneeSelect labels={rounds.map(([l]) => l)} idx={idx} setIdx={setI} />

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {FILTERS.map((f) => {
          const n = all.filter(f.test).length
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.id ? 'bg-[#1d1d1f] text-white' : 'bg-pitch-800 text-[#1d1d1f] hover:bg-pitch-700'
              }`}
            >
              {f.label} <span className="opacity-60">{n}</span>
            </button>
          )
        })}
      </div>

      {preds.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucun match pour ce filtre.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {preds.map((p, k) => (
            <PredictionCard key={p.id} p={p} index={k} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatStrip({ data }) {
  const items = [
    { v: data.counts.upcoming, label: 'matchs à venir' },
    { v: data.counts.teams, label: 'équipes suivies' },
  ]
  return (
    <div className="mb-8 grid grid-cols-2 gap-3">
      {items.map((it, i) => (
        <div
          key={it.label}
          className="fade-up surface surface-hover rounded-2xl p-4 text-center"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="text-3xl font-extrabold tabular-nums text-gradient">{it.v}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{it.label}</div>
        </div>
      ))}
    </div>
  )
}

function Results({ results }) {
  if (!results.length) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Aucun match joué cette saison pour le moment — rendez-vous au coup d'envoi. 🏁
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {results.map((r, i) => (
        <div key={i} className="surface flex items-center justify-between rounded-xl px-4 py-2.5 text-sm">
          <span className="flex flex-1 items-center justify-end gap-2 text-right">
            <span className="truncate text-[#1d1d1f]">{r.team1}</span>
            <span className="text-lg">{flag(r.team1)}</span>
          </span>
          <span className="mx-3 rounded-md bg-pitch-800 px-2.5 py-1 font-semibold tabular-nums text-[#1d1d1f]">
            {r.score}
          </span>
          <span className="flex flex-1 items-center gap-2">
            <span className="text-lg">{flag(r.team2)}</span>
            <span className="truncate text-[#1d1d1f]">{r.team2}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
