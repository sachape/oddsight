import { useState } from 'react'

// Articles d'éducation au pari (pas d'explication de notre méthode)
const ARTICLES = [
  {
    icon: '🎯',
    title: 'Comprendre les cotes',
    body: [
      'Une cote, c’est une probabilité déguisée. Une cote de 2,00 = ~50% de chances selon le bookmaker. Pour convertir : probabilité ≈ 1 ÷ cote.',
      'Plus la cote est basse, plus l’issue est jugée probable (et moins elle rapporte). Une cote de 1,30 paie peu mais « passe » souvent ; une cote de 4,00 paie gros mais rarement.',
      'Astuce : compare toujours la cote proposée à ta propre estimation. Si tu penses qu’une équipe a plus de chances que ce que la cote suggère, c’est peut-être un bon pari.',
    ],
  },
  {
    icon: '💰',
    title: 'Gérer sa bankroll',
    body: [
      'Ta bankroll, c’est l’argent que tu peux te permettre de perdre — jamais l’argent du loyer.',
      'Règle d’or : ne mise que 1 à 5% de ta bankroll par pari. Ça t’évite de tout perdre sur une mauvaise série.',
      'Ne « cours pas après tes pertes » : après une défaite, on ne double pas la mise pour se refaire. C’est le piège n°1.',
      'Garde des mises régulières (en « unités ») plutôt que de miser au feeling selon ton humeur.',
    ],
  },
  {
    icon: '📈',
    title: 'C’est quoi la « value » ?',
    body: [
      'Parier sur le favori ne suffit pas à gagner sur le long terme : tout le monde le fait, et les cotes sont basses.',
      'La value, c’est parier quand la cote proposée est plus haute que la probabilité réelle de l’issue. C’est le seul moyen d’être gagnant sur la durée.',
      'Exemple : tu estimes une victoire à 50% (cote juste 2,00) et le bookmaker propose 2,30 → c’est une value.',
      'Sur un pari isolé tu peux perdre ; c’est la somme de paris de valeur, sur des centaines de matchs, qui paie.',
    ],
  },
  {
    icon: '⚠️',
    title: 'Les erreurs classiques',
    body: [
      'Trop de matchs dans un combiné : chaque match ajoute du risque. Un combiné de 8 matchs « sûrs » a en réalité peu de chances de passer.',
      'Le biais du favori : miser systématiquement sur les gros clubs à petite cote rapporte peu et ne compense pas les surprises.',
      'Parier sous émotion (sur son équipe de cœur, énervé après une perte) : décide à froid, avec des chiffres.',
      'Chercher le « pari sûr » : il n’existe pas. Même à 90%, on perd 1 fois sur 10.',
    ],
  },
  {
    icon: '🛡️',
    title: 'Jouer responsable',
    body: [
      'Fixe-toi un budget et un temps de jeu AVANT de commencer, et tiens-t’y.',
      'Le jeu doit rester un plaisir, pas une source de revenus ni un moyen de se refaire.',
      'Signaux d’alerte : tu mises plus que prévu, tu joues pour récupérer des pertes, tu caches ton jeu.',
      'Besoin d’aide ? Joueurs Info Service : 09 74 75 13 13 (appel non surtaxé, 7j/7).',
    ],
  },
]

function Article({ a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="surface surface-hover rounded-2xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="text-xl">{a.icon}</span>
        <span className="flex-1 font-semibold text-[#1d1d1f]">{a.title}</span>
        <span className={`text-[#86868b] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="fade-up space-y-2 border-t border-black/[0.06] px-4 pb-4 pt-3">
          {a.body.map((para, i) => (
            <p key={i} className="text-sm leading-relaxed text-[#6e6e73]">{para}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="surface rounded-2xl p-4 text-sm leading-relaxed text-[#1d1d1f]">
        <b>Mieux parier, c’est d’abord comprendre.</b> Quelques bases pour parier plus
        intelligemment et garder le contrôle.
      </div>

      {ARTICLES.map((a) => (
        <Article key={a.title} a={a} />
      ))}

      <div className="rounded-2xl border border-amber-400/30 bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
        ⚠️ Jouer comporte des risques : endettement, isolement, dépendance. OddSight est un
        outil d’information, pas un conseil en investissement. 18+. Joueurs Info Service :
        09 74 75 13 13.
      </div>
    </div>
  )
}
