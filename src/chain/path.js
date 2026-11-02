// Paths are sampled once into an arc-length table; everything else (chain
// positions, collision, drawing) reads from that table, so a marble's position
// is a function of one number rather than of frame timing.

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

export const lerp = (a, b, t) => a + (b - a) * t

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t
  const t3 = t2 * t
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  }
}

/** Smooth a control polygon into uniformly spaced samples with cumulative length. */
export function buildPath(points, { step = 4 } = {}) {
  if (!Array.isArray(points) || points.length < 2) throw new Error('a path needs at least two points')

  const dense = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    for (let k = 0; k < 20; k += 1) dense.push(catmullRom(p0, p1, p2, p3, k / 20))
  }
  dense.push(points[points.length - 1])

  const cumulative = [0]
  let total = 0
  for (let i = 1; i < dense.length; i += 1) {
    total += dist(dense[i - 1], dense[i])
    cumulative.push(total)
  }

  const samples = []
  let j = 0
  for (let d = 0; d < total; d += step) {
    while (j < cumulative.length - 2 && cumulative[j + 1] < d) j += 1
    const span = cumulative[j + 1] - cumulative[j] || 1
    const t = (d - cumulative[j]) / span
    samples.push({
      x: lerp(dense[j].x, dense[j + 1].x, t),
      y: lerp(dense[j].y, dense[j + 1].y, t),
      d,
    })
  }
  samples.push({ x: dense[dense.length - 1].x, y: dense[dense.length - 1].y, d: total })

  return { samples, length: total, step }
}

/** Position and tangent angle at an arc-length distance. */
export function pointAt(path, distance) {
  const clamped = Math.max(0, Math.min(path.length, distance))
  const samples = path.samples
  let lo = 0
  let hi = samples.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].d <= clamped) lo = mid
    else hi = mid
  }
  const a = samples[lo]
  const b = samples[Math.min(samples.length - 1, lo + 1)]
  const span = b.d - a.d || 1
  const t = (clamped - a.d) / span
  const prev = samples[Math.max(0, lo - 1)]
  const next = samples[Math.min(samples.length - 1, lo + 2)]
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    angle: Math.atan2(next.y - prev.y, next.x - prev.x),
  }
}

/** Closest point on the path near a known distance — used for shot insertion. */
export function nearestDistance(path, point, near, window = 90) {
  let best = Math.max(0, Math.min(path.length, near))
  let bestSq = Infinity
  const from = Math.max(0, near - window)
  const to = Math.min(path.length, near + window)
  for (let d = from; d <= to; d += 2) {
    const p = pointAt(path, d)
    const sq = (p.x - point.x) ** 2 + (p.y - point.y) ** 2
    if (sq < bestSq) {
      bestSq = sq
      best = d
    }
  }
  return { distance: best, gap: Math.sqrt(bestSq) }
}

/** Polyline points for drawing the track, thinned to keep the graphics light. */
export function trackPolyline(path, every = 3) {
  const out = []
  for (let i = 0; i < path.samples.length; i += every) out.push(path.samples[i])
  const last = path.samples[path.samples.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}
