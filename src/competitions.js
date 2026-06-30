// Registre des compétitions. Ajouter une compète = générer son dataset puis
// l'enregistrer ici. La CM 2026 a servi de premier test du moteur.
//
// Les datasets sont chargés à la demande (`load: () => import(...)`) : chacun
// devient un chunk séparé, le bundle initial reste léger et la donnée d'une
// compète n'est téléchargée que lorsqu'on l'ouvre. Voir useCompetitionData (App).

export const COMPETITIONS = [
  { id: 'ligue1', sport: 'football', name: 'Ligue 1', short: 'Ligue 1', status: 'live', load: () => import('./data/ligue1.json') },
  { id: 'premier-league', sport: 'football', name: 'Premier League', short: 'Premier League', status: 'live', load: () => import('./data/premier-league.json') },
  { id: 'serie-a', sport: 'football', name: 'Serie A', short: 'Serie A', status: 'live', load: () => import('./data/serie-a.json') },
  {
    id: 'liga', sport: 'football', name: 'Liga', short: 'Liga', status: 'soon',
    note: 'Calendrier 2026-27 pas encore publié — s\'activera automatiquement dès sa sortie.', load: null,
  },
  {
    id: 'bundesliga', sport: 'football', name: 'Bundesliga', short: 'Bundesliga', status: 'soon',
    note: 'Calendrier 2026-27 pas encore publié — s\'activera automatiquement dès sa sortie.', load: null,
  },
  {
    id: 'ligue2', sport: 'football', name: 'Ligue 2', short: 'Ligue 2', status: 'soon',
    note: 'Même moteur que la Ligue 1 — à brancher.', load: null,
  },
  { id: 'wc2026', sport: 'football', name: 'Coupe du Monde 2026', short: 'CM 2026', status: 'live', load: () => import('./data/dataset.json') },
  {
    id: 'nba', sport: 'basket', name: 'NBA', short: 'NBA', status: 'soon',
    note: 'Modèle dédié au basket (spread, total de points) — à développer séparément.', load: null,
  },
  { id: 'tennis', sport: 'tennis', name: 'Tennis', short: 'Tennis', status: 'live', load: () => import('./data/tennis.json') },
]

export const SPORT_LABEL = { football: 'Football', basket: 'Basket', tennis: 'Tennis' }

export const getCompetition = (id) =>
  COMPETITIONS.find((c) => c.id === id) || COMPETITIONS[0]
