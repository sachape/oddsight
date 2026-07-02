// Guide du parieur — définitions, formules, exemples, glossaire.
// Contenu éducatif (pas d'explication de notre méthode interne).
import { useEffect, useState } from 'react'

// Surligne dans le sommaire la section actuellement à l'écran.
function useScrollSpy(ids) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting)
        if (vis.length) setActive(vis[0].target.id)
      },
      { rootMargin: '-15% 0px -75% 0px' },
    )
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return active
}

function P({ children }) {
  return <p className="text-sm leading-relaxed text-[#6e6e73]">{children}</p>
}
function Formula({ children }) {
  return (
    <div className="my-1 rounded-lg bg-pitch-850 px-3 py-2 text-sm font-semibold tabular-nums text-[#1d1d1f]">
      {children}
    </div>
  )
}
function Example({ children }) {
  return (
    <div className="my-1 rounded-lg border-l-2 border-edge-500/50 bg-edge-500/[0.06] px-3 py-2 text-sm leading-relaxed text-[#1d1d1f]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-edge-600">Exemple</span>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}
function Note({ children }) {
  return (
    <div className="my-1 rounded-lg border-l-2 border-amber-400/50 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
      {children}
    </div>
  )
}
function Sub({ children }) {
  return <h3 className="mt-4 mb-1 text-sm font-semibold text-[#1d1d1f]">{children}</h3>
}
function Section({ id, icon, title, children }) {
  return (
    <section id={id} className="surface scroll-mt-24 rounded-2xl p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#1d1d1f]">
        <span className="text-lg">{icon}</span>{title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

// Petit tableau générique (aligné, monospace)
function Table({ head, rows }) {
  return (
    <div className="my-2 overflow-hidden rounded-lg ring-1 ring-black/[0.06]">
      <div className="flex bg-pitch-850 px-3 py-1.5 text-[10px] uppercase tracking-wide text-[#86868b]">
        {head.map((h, i) => (
          <span key={i} className={i === 0 ? 'flex-1' : 'w-24 text-right'}>{h}</span>
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex border-t border-black/[0.05] px-3 py-1.5 text-sm">
          {r.map((c, j) => (
            <span
              key={j}
              className={j === 0 ? 'flex-1 text-[#1d1d1f]' : 'w-24 text-right tabular-nums text-[#6e6e73]'}
            >
              {c}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function Market({ name, desc, ex }) {
  return (
    <div className="border-t border-black/[0.06] py-2 first:border-t-0">
      <div className="text-sm font-semibold text-[#1d1d1f]">{name}</div>
      <div className="text-sm leading-relaxed text-[#6e6e73]">{desc}</div>
      {ex && <div className="mt-0.5 text-[13px] text-[#86868b]">↳ {ex}</div>}
    </div>
  )
}

const TOC = [
  { id: 'bases', label: 'Les bases' },
  { id: 'formats', label: 'Formats de cotes' },
  { id: 'marge', label: 'Marge & cote juste' },
  { id: 'marches', label: 'Types de paris' },
  { id: 'handicap', label: 'Handicap asiatique' },
  { id: 'value', label: 'La value' },
  { id: 'tennis', label: 'Value au tennis' },
  { id: 'bankroll', label: 'Bankroll' },
  { id: 'kelly', label: 'Kelly & staking' },
  { id: 'combines', label: 'Combinés' },
  { id: 'live', label: 'Live & cash out' },
  { id: 'erreurs', label: 'Erreurs' },
  { id: 'oddsight', label: 'Lire OddSight' },
  { id: 'responsable', label: 'Jeu responsable' },
  { id: 'glossaire', label: 'Glossaire' },
]

const GLOSSARY = [
  ['Cote (décimale)', 'Multiplicateur de la mise. Gain total = mise × cote.'],
  ['Mise', 'Somme engagée sur un pari.'],
  ['Gain net', 'Bénéfice réel : mise × (cote − 1).'],
  ['Probabilité implicite', 'Chance suggérée par une cote : 1 ÷ cote.'],
  ['Cote juste', 'Cote sans marge, reflétant la vraie probabilité : 100 ÷ proba(%).'],
  ['Value', 'Pari où la cote proposée dépasse la cote juste.'],
  ['Espérance (EV)', 'Gain moyen attendu par euro : proba × cote − 1.'],
  ['Bankroll', 'Budget total dédié au jeu, que l’on peut se permettre de perdre.'],
  ['Unité', 'Fraction fixe de la bankroll misée par pari (1 à 5 %).'],
  ['Mise à plat (flat)', 'Miser toujours la même unité, quel que soit le pari.'],
  ['ROI / Yield', 'Rentabilité : bénéfice ÷ total misé (en %).'],
  ['Marge (overround)', 'Commission du bookmaker : somme des probas implicites au-dessus de 100 %.'],
  ['1N2', 'Résultat du match sur 90 min : 1 = domicile, N = nul, 2 = extérieur.'],
  ['Double chance', 'On couvre 2 des 3 issues (1X, 12, X2). Cote plus basse.'],
  ['Draw no bet (DNB)', 'Nul = mise remboursée.'],
  ['BTTS', '« Les deux équipes marquent » : Oui / Non.'],
  ['Over / Under', 'Plus / moins de X buts (1,5 · 2,5 · 3,5…).'],
  ['Handicap', 'Avance ou retard fictif de buts donné à une équipe.'],
  ['Handicap asiatique', 'Handicap en quarts de but qui élimine ou fractionne le nul ; marge plus faible.'],
  ['Push', 'Égalité avec la ligne de pari : la mise est remboursée.'],
  ['Cote fractionnelle', 'Format UK (ex. 3/2) : gain net rapporté à la mise.'],
  ['Moneyline (américaine)', 'Format US : +150 (gain pour 100 misés) ou −200 (mise pour gagner 100).'],
  ['Combiné (parlay)', 'Plusieurs paris en un : les cotes se multiplient, les chances aussi.'],
  ['Système', 'Combiné partiel (2/3, 3/4…) qui tolère une sélection perdante.'],
  ['Critère de Kelly', 'Mise proportionnelle à l’avantage : f = (b·p − q) ÷ b.'],
  ['Cash out', 'Clôturer un pari avant la fin pour sécuriser un gain / limiter la perte.'],
  ['Live (in-play)', 'Pari pendant le match, cotes qui bougent en temps réel.'],
  ['Variance', 'Fluctuations dues au hasard sur le court terme.'],
]

export default function HowItWorks() {
  const active = useScrollSpy(TOC.map((t) => t.id))
  return (
    <div className="mx-auto max-w-4xl lg:grid lg:grid-cols-[190px_1fr] lg:items-start lg:gap-8">
      {/* Sommaire — chips en haut sur mobile, colonne fixe sur desktop */}
      <aside className="mb-4 lg:mb-0 lg:sticky lg:top-20">
        <div className="mb-2 hidden text-[11px] font-semibold uppercase tracking-wide text-[#86868b] lg:block">
          Sommaire
        </div>
        <nav className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
          {TOC.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors lg:rounded-lg lg:px-3 lg:py-1.5 ${
                active === t.id
                  ? 'bg-edge-500/12 text-edge-700 lg:bg-edge-500/10'
                  : 'bg-pitch-800 text-[#1d1d1f] hover:bg-pitch-700 lg:bg-transparent lg:text-[#6e6e73] lg:hover:bg-pitch-800 lg:hover:text-[#1d1d1f]'
              }`}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Contenu qui défile */}
      <div className="min-w-0 space-y-3">
        <div className="surface rounded-2xl p-5">
          <h1 className="text-lg font-bold text-[#1d1d1f]">Le guide du parieur</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#6e6e73]">
            Tout ce qu’il faut comprendre pour parier plus intelligemment et garder le contrôle :
            les cotes, les marchés, la value, la bankroll, et comment lire OddSight.
          </p>
        </div>

        <Section id="bases" icon="🎯" title="Les bases : lire une cote">
        <P>
          Une cote (format décimal, celui utilisé en France) est un <b>multiplicateur</b> et une
          <b> probabilité déguisée</b>. Deux formules suffisent :
        </P>
        <Formula>Gain total = mise × cote &nbsp;·&nbsp; Gain net = mise × (cote − 1)</Formula>
        <Formula>Probabilité implicite = 1 ÷ cote</Formula>
        <Example>
          Tu mises <b>10 €</b> sur la victoire de <b>Lille</b> à la cote <b>2,50</b>. Lille gagne :
          tu récupères 10 × 2,50 = <b>25 €</b>, soit <b>+15 €</b> de bénéfice. Cette cote suppose
          1 ÷ 2,50 = <b>40 %</b> de chances.
        </Example>
        <P>
          Cote basse = issue jugée probable, petit gain (le PSG à domicile à 1,30). Cote haute = peu
          probable, gros gain (un promu qui va gagner au Parc à 9,00).
        </P>
        <Table
          head={['Cote', 'Proba', 'Gain net /10 €']}
          rows={[
            ['1,20', '83 %', '+2 €'],
            ['1,50', '67 %', '+5 €'],
            ['2,00', '50 %', '+10 €'],
            ['3,00', '33 %', '+20 €'],
            ['5,00', '20 %', '+40 €'],
            ['10,0', '10 %', '+90 €'],
          ]}
        />
      </Section>

      <Section id="formats" icon="🔢" title="Les 3 formats de cotes">
        <P>
          La même cote s’écrit de trois façons selon les pays. En France, c’est la
          <b> décimale</b>.
        </P>
        <div>
          <Market name="Décimale (Europe)" desc="Multiplicateur direct. 2,50 = tu récupères 2,5× ta mise." />
          <Market name="Fractionnelle (UK)" desc="Gain net / mise. 3/2 = tu gagnes 3 pour 2 misés → décimale 2,50." />
          <Market name="Américaine (moneyline)" desc="+150 = gain pour 100 € misés. −200 = mise à poser pour gagner 100 €." ex="Positif = outsider, négatif = favori." />
        </div>
        <Table
          head={['Décimale', 'Fraction.', 'Améric.', 'Proba']}
          rows={[
            ['1,50', '1/2', '−200', '67 %'],
            ['2,00', '1/1', '+100', '50 %'],
            ['2,50', '3/2', '+150', '40 %'],
            ['3,00', '2/1', '+200', '33 %'],
          ]}
        />
        <Example>
          Le PSG favori à <b>1,50</b> chez ton opérateur français s’écrirait <b>1/2</b> sur un site
          anglais et <b>−200</b> sur un site américain. Trois écritures, exactement le même pari.
        </Example>
      </Section>

      <Section id="marge" icon="🏦" title="La marge du bookmaker & la « cote juste »">
        <P>
          Si tu additionnes les probabilités implicites des issues d’un match, tu dépasses 100 %.
          Ce surplus, c’est la <b>marge</b> (overround) : la commission du bookmaker.
        </P>
        <Example>
          Sur <b>Marseille – Lyon</b>, ton opérateur affiche <b>2,10 / 3,40 / 3,60</b> (1/N/2).
          Probabilités implicites : 47,6 % + 29,4 % + 27,8 % = <b>104,8 %</b>. Le surplus de
          <b> 4,8 %</b>, c’est la marge : sur 100 € joués sur ce match, le book garde ~5 € en moyenne,
          quel que soit le résultat.
        </Example>
        <P>
          La <b>cote juste</b> retire cette marge : c’est la cote qui reflète la vraie probabilité,
          sans commission. OddSight affiche des cotes justes pour que tu puisses les comparer aux
          cotes de ton opérateur.
        </P>
        <Formula>Cote juste = 100 ÷ probabilité réelle (%)</Formula>
        <Example>
          Le modèle donne Marseille vainqueur à <b>50 %</b> → cote juste <b>2,00</b>. Si ton
          opérateur affiche <b>2,10</b>, il te paie <i>au-dessus</i> du prix réel : c’est bon signe.
        </Example>
      </Section>

      <Section id="marches" icon="🧩" title="Les types de paris (marchés)">
        <P>Au-delà du simple résultat, il existe de nombreux marchés :</P>
        <div>
          <Market name="Résultat 1N2" desc="Qui gagne sur 90 min : 1 (domicile), N (nul), 2 (extérieur)." ex="La prolongation et les tirs au but ne comptent pas." />
          <Market name="Double chance" desc="On couvre 2 issues sur 3 : 1X (dom. ou nul), 12 (pas de nul), X2 (nul ou ext.). Plus sûr, mais cote plus basse." />
          <Market name="Draw no bet (DNB)" desc="On mise sur une équipe ; si match nul, la mise est remboursée." />
          <Market name="Les deux marquent (BTTS)" desc="Les deux équipes marquent au moins un but : Oui / Non." ex="Un 2-0 = Non ; un 1-1 ou 2-1 = Oui." />
          <Market name="Plus / Moins de buts (Over/Under)" desc="Nombre total de buts au-dessus / en-dessous d’une ligne (1,5 · 2,5 · 3,5)." ex="+2,5 buts = il faut 3 buts ou plus. Un 2-1 (3 buts) gagne, un 1-1 (2 buts) perd." />
          <Market name="Handicap" desc="On donne une avance/un retard fictif de buts à une équipe pour équilibrer les cotes." ex="Handicap −1 sur le favori : il doit gagner par 2 buts d’écart minimum." />
          <Market name="Score exact" desc="Le score final précis. Marché très ouvert : même le score le plus probable dépasse rarement ~12 %." />
          <Market name="Mi-temps / fin de match" desc="Résultat à la pause combiné au résultat final." />
          <Market name="Buteur" desc="Un joueur marque (à tout moment, premier, dernier…)." />
        </div>
        <Example>
          Prenons un <b>Real Madrid 2 – 1 Barcelone</b>. Sur ce seul score, qui gagne quoi ?<br />
          • 1N2 « 1 » (Real gagne) → <b>gagné</b><br />
          • Double chance « 1X » → <b>gagné</b><br />
          • Les deux marquent (Oui) → <b>gagné</b> (2 et 1)<br />
          • +2,5 buts → <b>gagné</b> (3 buts au total)<br />
          • Score exact 2-1 → <b>gagné</b> · Handicap Real −1 → <b>remboursé</b> (gagne d’1 seul but)
        </Example>
      </Section>

      <Section id="handicap" icon="⚖️" title="Le handicap asiatique (en détail)">
        <P>
          Le handicap asiatique élimine (ou fractionne) le nul en donnant une avance/un retard de
          buts, avec des lignes en quarts. Résultat : des cotes proches de 2,00 et une marge plus
          faible — d’où sa popularité chez les parieurs aguerris.
        </P>
        <Sub>Les types de lignes</Sub>
        <div>
          <Market name="Ligne entière (−1, +1)" desc="Si l’écart est exactement égal au handicap, la mise est remboursée (push)." ex="−1 sur le favori : gagne par 2+ → gagné ; par 1 → remboursé ; sinon perdu." />
          <Market name="Demi-ligne (−0,5, +0,5)" desc="Pas de remboursement possible : c’est gagné ou perdu." ex="−0,5 = le favori doit simplement gagner." />
          <Market name="Quart de ligne (−0,25, −0,75)" desc="La mise est coupée en deux demi-lignes." ex="−0,75 : gagne par 2+ → plein ; par 1 → demi-gain ; sinon perdu. −0,25 : gagne → plein ; nul → demi-perte ; défaite → perdu." />
        </div>
        <Example>
          Tu mises <b>10 €</b> sur <b>PSG (−1,5)</b> contre Le Havre à la cote 1,85 :<br />
          • PSG gagne <b>3-0</b> → écart 3 &gt; 1,5 → <b>gagné</b> (+7,50 €)<br />
          • PSG gagne <b>2-1</b> → écart 1 &lt; 1,5 → <b>perdu</b> (le score ne suffit pas)<br />
          C’est plus exigeant qu’un simple « PSG vainqueur », mais mieux payé.
        </Example>
        <Note>
          Le handicap asiatique est plus « juste » (marge basse) mais plus technique. Débute par
          les demi-lignes, plus simples à comprendre.
        </Note>
      </Section>

      <Section id="value" icon="📈" title="La value & l’espérance de gain">
        <P>
          Parier sur le favori ne suffit pas : tout le monde le fait et les cotes sont basses.
          Gagner sur la durée, c’est trouver de la <b>value</b> : une cote proposée
          <b> supérieure</b> à la cote juste.
        </P>
        <Formula>Espérance (EV) par euro = probabilité × cote − 1</Formula>
        <P>Si l’EV est positive, le pari est rentable sur le long terme.</P>
        <Example>
          OddSight estime <b>Lens vainqueur à 55 %</b> → cote juste 1,82. Ton opérateur affiche
          <b> 2,00</b>. EV = 0,55 × 2,00 − 1 = <b>+0,10</b> → <b>+10 % de value</b> : à jouer.<br />
          À l’inverse, s’il affichait <b>1,70</b> (en dessous de 1,82), tu passes : pas de value.
        </Example>
        <Note>
          La value ne garantit pas de gagner <i>ce</i> pari : Lens peut très bien perdre. C’est la
          <b> somme</b> de paris de valeur, sur des centaines de matchs, qui paie. Sur 5 paris, le
          hasard (variance) domine encore.
        </Note>
      </Section>

      <Section id="tennis" icon="🎾" title="La value au tennis">
        <P>
          Le tennis n’a <b>que deux issues</b> (pas de nul) : les cotes sont plus lisibles, mais la
          value se cache dans les détails.
        </P>
        <Sub>Ce qui compte vraiment</Sub>
        <div>
          <Market name="La surface" desc="Terre, dur, gazon : un même joueur n’a pas le même niveau selon la surface. Un top mondial peut être vulnérable sur terre." />
          <Market name="Le format" desc="Best-of-3 (tournois normaux) vs best-of-5 (Grand Chelem masculin) : le favori est plus fiable en 5 sets, la surprise plus dure à créer." />
          <Market name="Fatigue & calendrier" desc="Matchs enchaînés, long match la veille, décalage horaire : le physique pèse énormément." />
          <Market name="Historique (H2H)" desc="Certains joueurs en dominent d’autres quel que soit le classement." />
        </div>
        <Note>
          <b>Risque d’abandon :</b> un joueur blessé peut abandonner en cours de match. Les règles
          de remboursement varient selon l’opérateur (souvent : pari annulé si abandon avant la fin
          du 1er set). À vérifier avant de miser.
        </Note>
        <Example>
          Un top 5 mondial est donné favori à <b>1,20</b> au 1er tour de Roland-Garros… face à un
          spécialiste de la terre battue classé 45e. Sur cette surface, l’écart réel est plus faible
          que ce que dit le classement : la cote de <b>4,50</b> sur l’outsider peut cacher de la
          value. (Et en 3 sets gagnants d’un ATP normal, la surprise serait encore plus probable
          qu’en 5 sets à Roland.)
        </Example>
        <P>
          Dans OddSight, les probabilités tennis s’appuient sur le classement, les points et un Elo
          interne, ajustés au format. La value se niche souvent sur l’<b>outsider</b> quand la cote
          du favori est gonflée par sa notoriété.
        </P>
      </Section>

      <Section id="bankroll" icon="💰" title="Gérer sa bankroll">
        <P>
          Ta <b>bankroll</b> est le budget que tu dédies au jeu — jamais l’argent du loyer ou des
          courses. On la gère par <b>unités</b>.
        </P>
        <Sub>La mise en unités</Sub>
        <P>
          1 unité = un pourcentage fixe de ta bankroll. Prudent : 1 %. Équilibré : 2-3 %.
          Agressif : 5 % max. Tu mises en unités, pas au feeling.
        </P>
        <Example>
          Bankroll de 200 € · profil équilibré (3 %) → 1 unité = <b>6 €</b>. Tu mises 6 € par pari,
          quelle que soit ton envie du moment.
        </Example>
        <Example>
          Deux parieurs, 200 € chacun, enchaînent <b>5 défaites</b> (ça arrive) :<br />
          • Anna mise en unités (6 €/pari) → il lui reste <b>170 €</b>, elle continue sereinement.<br />
          • Théo a tout mis sur « un coup sûr » à 100 € puis doublé pour se refaire → <b>0 €</b>.<br />
          Même malchance, issue opposée : c’est la gestion, pas les pronos.
        </Example>
        <Sub>Suivre sa rentabilité</Sub>
        <Formula>ROI (yield) = bénéfice net ÷ total misé × 100</Formula>
        <P>
          Sur 100 paris de 6 €, si tu es à +36 € de bénéfice, ton yield = 36 ÷ 600 = <b>+6 %</b>.
          Tenu sur la durée, c’est déjà excellent chez les pros.
        </P>
        <Note>
          <b>Ne cours jamais après tes pertes.</b> Doubler la mise pour « se refaire » (martingale)
          mène à la ruine : une série de pertes arrive toujours.
        </Note>
      </Section>

      <Section id="kelly" icon="🧮" title="Staking avancé : le critère de Kelly">
        <P>
          Au-delà de la mise à plat, on peut miser <b>proportionnellement à son avantage</b>. La
          méthode de référence est le critère de Kelly, qui maximise la croissance de la bankroll
          sur le long terme.
        </P>
        <Formula>fraction = (b × p − q) ÷ b</Formula>
        <P>
          avec <b>b</b> = cote − 1, <b>p</b> = probabilité réelle, <b>q</b> = 1 − p.
        </P>
        <Example>
          Tu estimes <b>Monaco vainqueur à 55 %</b>, cote proposée <b>2,00</b> (b = 1, q = 0,45).
          f = (1 × 0,55 − 0,45) ÷ 1 = <b>0,10</b> → Kelly plein = miser <b>10 %</b> de ta bankroll.
          En Kelly ½, tu mises <b>5 %</b> — bien plus prudent si ton estimation de 55 % est incertaine.
        </Example>
        <Sub>En pratique : Kelly fractionné</Sub>
        <P>
          Kelly « plein » est très volatil et suppose des probabilités parfaites. Comme nos
          estimations sont incertaines, les pros misent <b>½ ou ¼ de Kelly</b> : presque la même
          croissance, beaucoup moins de risque.
        </P>
        <Note>
          Kelly n’a de sens que si tu as un <b>vrai edge</b> (de la value). Sans avantage réel, il
          accélère la ruine. En cas de doute, reste à la mise à plat.
        </Note>
      </Section>

      <Section id="combines" icon="🧱" title="Les combinés (parlays)">
        <P>
          Un combiné regroupe plusieurs paris : <b>toutes</b> les sélections doivent gagner. Les
          cotes se multiplient — mais les probabilités aussi.
        </P>
        <Formula>Cote combinée = cote₁ × cote₂ × … &nbsp;·&nbsp; Proba = proba₁ × proba₂ × …</Formula>
        <Example>
          Tu combines 3 favoris « sûrs » — <b>PSG, Real, Bayern</b> vainqueurs — à <b>1,80</b>
          chacun. Cote combinée = 1,80 × 1,80 × 1,80 = <b>×5,83</b> (10 € → 58 €). Alléchant, mais la
          probabilité réelle est 0,556³ ≈ <b>17 %</b> : il suffit d’<i>un</i> nul surprise pour tout
          perdre. Ça « passe » environ 1 fois sur 6.
        </Example>
        <P>
          Chaque match ajouté multiplie le gain <i>et</i> divise les chances. C’est pour ça que les
          bookmakers adorent les combinés : la marge se cumule à chaque sélection.
        </P>
        <P>
          Les <b>paris systèmes</b> (2/3, 3/4…) permettent de gagner même avec une sélection
          perdante, en échange d’une mise plus élevée.
        </P>
      </Section>

      <Section id="live" icon="⏱️" title="Le pari live & le cash out">
        <P>
          Le <b>live (in-play)</b> consiste à parier pendant le match : les cotes sont recalculées
          en continu selon le score, le temps qui passe et le momentum.
        </P>
        <Sub>Opportunités & pièges</Sub>
        <P>
          Bien joué, le live permet de réagir à un match qui ne suit pas le scénario (un favori mené
          tôt voit sa cote grimper). Mal joué, c’est le royaume des décisions impulsives : cotes qui
          bougent vite, momentum trompeur, et l’envie de « se refaire » en direct.
        </P>
        <Sub>Le cash out</Sub>
        <P>
          L’opérateur te propose de <b>clôturer ton pari avant la fin</b> pour un montant calculé
          sur les cotes du moment — pour sécuriser un gain ou limiter une perte.
        </P>
        <Example>
          Pré-match, tu mises <b>10 € sur Lille vainqueur @ 3,00</b>. À la 60ᵉ, Lille mène <b>1-0</b>
          → le cash out proposé monte à <b>~18 €</b>. Deux choix : sécuriser <b>18 €</b> maintenant
          (+8 € garantis), ou laisser courir pour les <b>30 €</b> pleins… au risque d’une égalisation
          en fin de match qui te ferait tout perdre.
        </Example>
        <Note>
          Le cash out intègre une <b>marge</b> : encaisser systématiquement rogne ton rendement sur
          la durée. Utilise-le pour gérer un risque ponctuel, pas par réflexe à chaque pari.
        </Note>
      </Section>

      <Section id="erreurs" icon="⚠️" title="Les erreurs classiques">
        <div>
          <Market name="Trop de sélections dans un combiné" desc="8 matchs « sûrs » = très peu de chances que tout passe. Vise court." />
          <Market name="Ignorer la marge" desc="Parier sans comparer à la cote juste, c’est jouer perdant d’avance." />
          <Market name="Le biais du favori" desc="Miser systématiquement les petites cotes rapporte peu et ne couvre pas les surprises." />
          <Market name="Parier sous émotion" desc="Sur son équipe de cœur, ou énervé après une perte. Décide à froid, avec des chiffres." />
          <Market name="Chercher le pari sûr" desc="Il n’existe pas. Même à 90 %, on perd 1 fois sur 10." />
          <Market name="Sur-miser" desc="Mettre 30 % de sa bankroll sur un « coup sûr » : une seule perte et tout s’effondre." />
        </div>
        <Example>
          Le piège classique : le PSG « ne peut pas perdre » à 1,25. Tu mets 100 € dessus « pour une
          fois ». Le PSG fait 1-1 contre un promu (ça arrive 1 fois sur 6-7). Tu as perdu 100 € pour
          en gagner 25 : le rapport risque/gain n’avait aucun sens.
        </Example>
      </Section>

      <Section id="oddsight" icon="🧭" title="Comment lire OddSight">
        <div>
          <Market name="« Plus probable » + confiance" desc="L’issue 1N2 la plus probable selon le modèle, avec un niveau : Élevée, Modérée, Faible, ou Serré (match indécis)." />
          <Market name="Cote juste" desc="Notre probabilité convertie en cote, sans marge. Si la cote de ton opérateur est au-dessus → c’est une value." />
          <Market name="Onglet Value & cotes" desc="Saisis les cotes de ton book : on te dit en direct si c’est une value (✓), neutre, ou à éviter." />
          <Market name="Fourchette de scores" desc="Le score exact est un marché très ouvert : on montre les scores plausibles et leur faible probabilité, sans en survendre un." />
          <Market name="Combinés & Bankroll" desc="Le combiné le plus probable pour viser ×2 / ×3, et une répartition de mise selon ta bankroll et ton profil de risque." />
          <Market name="Mon suivi" desc="Enregistre tes paris pour voir ta courbe de gains, ton taux de réussite et ton ROI réels." />
        </div>
        <Example>
          <b>En pratique, de bout en bout :</b> sur la carte Lille – Nice, tu lis « Plus probable
          <b> Lille · 53 % · Modérée</b> », cote juste <b>1,89</b>. Ton opérateur affiche <b>2,10</b>.
          Tu vas dans <b>Value & cotes</b>, tu saisis 2,10 → l’appli affiche <b>✓ value +11 %</b>.
          Tu enregistres le pari dans <b>Mon suivi</b> pour suivre ton ROI réel au fil des semaines.
        </Example>
        <Note>
          OddSight calcule ses probabilités à partir de stats réelles (Poisson + Dixon-Coles), pas
          d’intuition. Mais aucun modèle ne prédit l’avenir : ce sont des probabilités, pas des
          garanties.
        </Note>
      </Section>

      <Section id="responsable" icon="🛡️" title="Jouer responsable">
        <P>
          Le jeu doit rester un <b>plaisir</b>, jamais une source de revenus ni un moyen de se
          refaire.
        </P>
        <Sub>Les bons réflexes</Sub>
        <P>
          Fixe un budget <i>et</i> un temps de jeu AVANT de commencer, et tiens-t’y. Ne joue que ce
          que tu peux perdre sans conséquence.
        </P>
        <Sub>Les signaux d’alerte</Sub>
        <P>
          Tu mises plus que prévu · tu joues pour récupérer des pertes · tu caches ton jeu à tes
          proches · tu y penses sans arrêt · tu empruntes pour parier.
        </P>
        <Note>
          Besoin d’aide ? <b>Joueurs Info Service : 09 74 75 13 13</b> (non surtaxé, 7j/7, anonyme).
          Les opérateurs agréés (ANJ) proposent aussi limites de dépôt, modération et auto-exclusion.
          Réservé aux <b>18 ans et plus</b>.
        </Note>
      </Section>

      <Section id="glossaire" icon="📖" title="Glossaire express">
        <dl className="divide-y divide-black/[0.06]">
          {GLOSSARY.map(([term, def]) => (
            <div key={term} className="py-2">
              <dt className="text-sm font-semibold text-[#1d1d1f]">{term}</dt>
              <dd className="text-sm leading-relaxed text-[#6e6e73]">{def}</dd>
            </div>
          ))}
        </dl>
      </Section>

        <div className="rounded-2xl border border-amber-400/30 bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
          ⚠️ Jouer comporte des risques : endettement, isolement, dépendance. OddSight est un outil
          d’information, pas un conseil en investissement. 18+. Joueurs Info Service : 09 74 75 13 13.
        </div>
      </div>
    </div>
  )
}
