// Badge sémantique façon Apple : neutre par défaut, couleur réservée au sens
const VARIANTS = {
  default: 'bg-[#f0f0f2] text-[#1d1d1f]',
  success: 'bg-[#e7f6ee] text-[#15803d]',
  warning: 'bg-[#fbf0e1] text-[#a8590a]',
  error: 'bg-[#fdeaea] text-[#c81e1e]',
  solid: 'bg-[#1d1d1f] text-white',
}

export default function Badge({ variant = 'default', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${VARIANTS[variant] || VARIANTS.default} ${className}`}
    >
      {children}
    </span>
  )
}

// Mappe un niveau de confiance vers une variante sémantique
export const CONF_VARIANT = {
  Élevée: 'success',
  Modérée: 'default',
  Faible: 'warning',
  Serré: 'default',
}
