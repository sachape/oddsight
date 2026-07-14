// OddSight — métriques de qualité probabiliste et calibration.
// Purement mathématique, sans dépendance au moteur. Sert au backtest, au
// benchmark (vs baselines) et à la couche de calibration isotonique.

const clip = (p, lo = 1e-15, hi = 1 - 1e-15) => Math.max(lo, Math.min(hi, p))

// Log-loss d'un échantillon = −log(proba assignée à l'issue réelle). Plus bas = mieux.
export const logLossSample = (pActual) => -Math.log(clip(pActual))

// Score de Brier multiclasse : somme (p_i − y_i)² sur les classes (y = one-hot). Plus bas = mieux.
export function brierSample(probs, actualIdx) {
  let s = 0
  for (let i = 0; i < probs.length; i++) {
    const y = i === actualIdx ? 1 : 0
    s += (probs[i] - y) ** 2
  }
  return s
}

// Agrège une liste de prédictions {probs:[...], actualIdx} en log-loss + Brier moyens.
export function scoreSet(rows) {
  if (!rows.length) return { logLoss: null, brier: null, n: 0 }
  let ll = 0, br = 0
  for (const r of rows) {
    ll += logLossSample(r.probs[r.actualIdx])
    br += brierSample(r.probs, r.actualIdx)
  }
  const n = rows.length
  return { logLoss: Math.round((ll / n) * 1000) / 1000, brier: Math.round((br / n) * 1000) / 1000, n }
}

// --- Régression isotonique (Pool Adjacent Violators) -------------------------
// Ajuste une fonction monotone croissante x(prédit)->y(observé) sur des paires
// {x, y in [0,1]}. Renvoie des points de rupture pour interpolation linéaire.
// Les paliers extrêmes de la PAVA valent exactement 0 ou 1 (bloc de y tous nuls /
// tous à 1). Appliqués tels quels, ils annulent une issue : si elle se produit, le
// log-loss part à l'infini. On borne donc la sortie — une calibration ne doit jamais
// affirmer l'impossible sur un échantillon fini.
const CAL_FLOOR = 0.02
const CAL_CEIL = 0.98

export function fitIsotonic(points) {
  const pts = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x)
  if (pts.length < 2) return { xs: [], ys: [] }
  const blocks = []
  for (const p of pts) {
    const b = { sy: p.y, w: 1, xmin: p.x, xmax: p.x, val: p.y }
    blocks.push(b)
    while (blocks.length > 1 && blocks[blocks.length - 2].val >= blocks[blocks.length - 1].val) {
      const b2 = blocks.pop(), b1 = blocks.pop()
      const merged = { sy: b1.sy + b2.sy, w: b1.w + b2.w, xmin: b1.xmin, xmax: b2.xmax }
      merged.val = merged.sy / merged.w
      blocks.push(merged)
    }
  }
  const xs = [], ys = []
  const bound = (v) => Math.max(CAL_FLOOR, Math.min(CAL_CEIL, v))
  for (const b of blocks) {
    xs.push(b.xmin); ys.push(bound(b.val))
    if (b.xmax !== b.xmin) { xs.push(b.xmax); ys.push(bound(b.val)) }
  }
  return { xs, ys }
}

// Applique la calibration (interpolation linéaire entre points de rupture).
export function applyIsotonic(cal, x) {
  const { xs, ys } = cal
  if (!xs || xs.length < 2) return x
  if (x <= xs[0]) return ys[0]
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1]
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const span = xs[i] - xs[i - 1]
      const t = span > 0 ? (x - xs[i - 1]) / span : 0
      return ys[i - 1] + t * (ys[i] - ys[i - 1])
    }
  }
  return ys[ys.length - 1]
}

// --- Calibration d'un marché BINAIRE (gated out-of-sample) -------------------
// pairs chronologiques { x: proba prédite du "oui", y: 0/1 réalisé }.
const clipp = (p) => Math.max(1e-15, Math.min(1 - 1e-15, p))
export function binLogLoss(pairs, cal = null) {
  if (!pairs.length) return null
  let s = 0
  for (const p of pairs) {
    const q = cal ? applyIsotonic(cal, p.x) : p.x
    s += -Math.log(clipp(p.y ? q : 1 - q))
  }
  return s / pairs.length
}
// Renvoie la carte de calibration (tout l'historique) SEULEMENT si elle améliore
// le log-loss out-of-sample (30 % final), sinon null → garantie zéro régression.
export function gatedIsotonic(pairs, minN = 40) {
  if (pairs.length < minN) return null
  const split = Math.floor(pairs.length * 0.7)
  const calT = fitIsotonic(pairs.slice(0, split))
  const test = pairs.slice(split)
  if (binLogLoss(test, calT) > binLogLoss(test, null) + 1e-9) return null
  return fitIsotonic(pairs)
}

// --- Courbe de fiabilité (reliability diagram) sur le pari conseillé ----------
// Regroupe (proba du pick, réussite 0/1) par tranche et compare prévu vs observé.
export function reliability(pairs, edges = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0001]) {
  const bins = []
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i], hi = edges[i + 1]
    const inBin = pairs.filter((p) => p.x >= lo && p.x < hi)
    if (!inBin.length) continue
    const predicted = inBin.reduce((s, p) => s + p.x, 0) / inBin.length
    const observed = inBin.reduce((s, p) => s + p.y, 0) / inBin.length
    bins.push({
      range: `${Math.round(lo * 100)}-${Math.round(Math.min(hi, 1) * 100)}%`,
      predicted: Math.round(predicted * 1000) / 10,
      observed: Math.round(observed * 1000) / 10,
      n: inBin.length,
    })
  }
  return bins
}
