# OddSight ⚽📊

Pronostics Coupe du Monde 2026 calculés à partir des **stats réelles** des équipes —
pas de l'intuition. Probabilités transparentes et expliquées.

**En ligne : https://oddsight.fly.dev** (Fly.io, région Paris, scale-to-zero).

## Déploiement

```bash
npm run scrape   # rafraîchir les données
fly deploy       # redéployer (build Docker + nginx)
```
Config : `Dockerfile` (build Vite → nginx), `nginx.conf` (SPA fallback), `fly.toml`.

## Comment ça marche

1. **Scraping** (2 sources réelles) — résultats CM 2026 (scores, buteurs, minutes) via
   `openfootball`, et Elo mondial actuel de chaque nation via `eloratings.net`.
2. **Modèle multi-facteurs** — chaque pronostic combine :
   - **Elo réel** (niveau de base / historique complet)
   - **Attaque / défense ajustées à l'adversaire** (solveur itératif régularisé)
   - **Pondération de récence** (demi-vie 14 j + bonus matchs à élimination directe)
   - **Momentum** (sur/sous-performance récente vs attente Elo)
   - **Repos / fatigue** (jours de récupération avant le match)
   - **Avantage hôte** (USA / Canada / Mexique)
   - **Finition** (part des buts marqués en fin de match)
   - **Disponibilité de l'effectif** — blessures + suspensions, pondérées par poste
     (GK/DEF/MID/FWD) et importance du joueur. Flux éditable `scraper/availability.json`
     (à brancher sur une API live type API-Football `/injuries`).
3. **Poisson + Dixon-Coles** — les buts attendus (mélange stats ↔ Elo selon le volume
   de données) alimentent une loi de Poisson corrigée pour les petits scores → proba de
   chaque résultat, qualification aux tirs au but incluse.
4. **Plusieurs marchés** — au-delà du 1N2 : les deux marquent (BTTS), plus/moins de buts
   (1,5 / 2,5 / 3,5), double chance, clean sheet, scores exacts, total de buts attendu.
   Tout est dérivé de la matrice des scores.
5. **Sortie transparente** — probabilités, poids de chaque facteur, absents, mélange du
   modèle et cotes justes (sans marge de bookmaker).
6. **Combinés** (onglet dédié) — pour une mise de 10 à 50 €, le combiné le plus *probable*
   atteignant ×2 (sûr) et ×3 (audacieux). Cotes avec marge bookmaker (~6 %). La
   probabilité réelle est affichée, sans enjoliver.
7. **Historique / track record** (onglet dédié) — backtest honnête : chaque match joué est
   repronostiqué avec uniquement les données antérieures (pas de lookahead), puis comparé
   au résultat réel. Affiche le % de réussite (1N2 ~63 %, BTTS, +/−2,5 buts) + détail
   match par match. Voir `backtest()` dans `scraper/engine.mjs`.

Voir `scraper/sources.mjs` (récupération + mapping Elo + flux dispo),
`scraper/engine.mjs` (modèle + marchés), `scraper/availability.json` (blessures/suspensions).

### Blessures/suspensions — données LIVE (API-Football)

Source live : **API-Football v3** (`v3.football.api-sports.io`).

1. Récupère ta clé sur https://dashboard.api-football.com
2. `cp scraper/.env.local.example scraper/.env.local` puis renseigne `APIFOOTBALL_KEY=...`
3. `npm run scrape:live`

Le pipeline interroge `/injuries?league=1&season=2026`, ne garde que les absences des
matchs à venir, mappe les noms d'équipes et déduit blessure vs suspension. Sans clé,
`npm run scrape` retombe sur le fichier `scraper/availability.json`.

> Limite : l'API ne fournit pas l'« importance » d'un joueur → impact modéré uniforme
> par absent. Le poste est utilisé s'il est renvoyé, sinon milieu par défaut.

### Mettre à jour à la main (sans API)

Édite `scraper/availability.json` puis `npm run scrape`. Format :
`{ "Équipe": [ { "name", "status": "injury|suspension", "pos": "GK|DEF|MID|FWD", "importance": 0..1 } ] }`.
Ne jamais inventer d'absents : laisser vide plutôt que mettre du faux.

## Commandes

```bash
npm install
npm run scrape   # récupère les données réelles -> src/data/dataset.json
npm run dev      # serveur de dev (Vite)
npm run build    # build de production
npm run preview  # prévisualise le build
```

Rejouez `npm run scrape` après chaque journée de matchs pour rafraîchir les pronos.
La date de référence est configurable : `ODDSIGHT_TODAY=2026-07-05 npm run scrape`.

## Stack

React 19 · Vite 6 · Tailwind CSS 4 · moteur de prédiction Node (multi-facteurs, Poisson + Dixon-Coles)

## Limites & prochaines étapes

- Sources actuelles : openfootball + eloratings.net. FBref / API-Football (xG réels,
  possession, tirs cadrés, blessures) sont bloqués sans clé/anti-bot depuis cet
  environnement — à brancher via une clé API pour enrichir encore le modèle.
- Pistes : calibration des poids sur l'historique des CM passées, gestion
  cartons/suspensions/blessures, composition d'équipe, contexte météo/stade.

> ⚠️ Outil informatif. Jouer comporte des risques (endettement, dépendance). 18+.
> Joueurs Info Service : 09 74 75 13 13.
