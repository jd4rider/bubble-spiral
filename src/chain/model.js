// Deterministic chain model. Marbles are an ordered list (index 0 is the head,
// closest to the hole) and only ever store one number, `s`: their distance along
// the path. Spacing is enforced by the model, never by physics.

import { nearestDistance, pointAt } from './path.js'

export const MARBLE_RADIUS = 14
export const SPACING = 31
export const COLORS = ['jade', 'coral', 'sky', 'amber', 'violet', 'rose']

let idCounter = 0
const nextId = () => {
  idCounter += 1
  return idCounter
}

function makeMarble(def, s) {
  const color = typeof def === 'string' ? def : def.color
  const special = typeof def === 'string' ? null : def.special ?? null
  return {
    id: nextId(),
    color,
    special,
    thawed: special !== 'frozen',
    s,
  }
}

/**
 * `defs` runs head-first: index 0 is the marble nearest the hole.
 * With the default startS the head begins at the far end of the chain and the
 * tail sits at the path's spawn point.
 */
export function createChain(defs, { spacing = SPACING, startS = 0 } = {}) {
  return {
    spacing,
    marbles: defs.map((def, i) => makeMarble(def, startS - i * spacing)),
  }
}

export function chainHeadS(chain) {
  return chain.marbles.length > 0 ? chain.marbles[0].s : 0
}

export function advance(chain, delta) {
  for (const marble of chain.marbles) marble.s += delta
  return chain
}

/** Marble positions on the track; marbles before the spawn point are hidden. */
export function marbleViews(chain, path) {
  return chain.marbles.map((marble, index) => {
    const onPath = marble.s >= 0
    const point = pointAt(path, onPath ? marble.s : 0)
    return { index, marble, x: point.x, y: point.y, angle: point.angle, visible: onPath }
  })
}

/** Insert a marble at `index`; everything behind it slides back one slot. */
export function insertMarble(chain, index, def) {
  const list = chain.marbles.map((marble) => ({ ...marble }))
  const spacing = chain.spacing
  const at = Math.max(0, Math.min(index, list.length))

  if (list.length === 0) {
    return { chain: { ...chain, marbles: [makeMarble(def, 0)] }, index: 0 }
  }
  if (at === 0) {
    list.unshift(makeMarble(def, list[0].s + spacing))
    return { chain: { ...chain, marbles: list }, index: 0 }
  }

  const anchor = list[at - 1]
  for (let i = at; i < list.length; i += 1) list[i].s -= spacing
  list.splice(at, 0, makeMarble(def, anchor.s - spacing))
  return { chain: { ...chain, marbles: list }, index: at }
}

/**
 * Where a shot lands. The nearest marble decides, and the shot's own position
 * along the path decides the side — same hit, same index, every time.
 */
export function findInsertion(chain, path, point) {
  let best = null
  chain.marbles.forEach((marble, index) => {
    if (marble.s < -chain.spacing) return
    const p = pointAt(path, Math.max(0, marble.s))
    const gap = Math.hypot(p.x - point.x, p.y - point.y)
    if (!best || gap < best.gap) best = { index, gap, s: marble.s, marble }
  })
  if (!best) return null

  const near = nearestDistance(path, point, Math.max(0, best.s), chain.spacing * 2)
  const index = near.distance > best.s ? best.index : best.index + 1
  return { index, marbleIndex: best.index, gap: best.gap, pathDistance: near.distance }
}

/** A shot that hits a frozen marble thaws it instead of inserting. */
export function thawMarble(chain, index) {
  const marbles = chain.marbles.map((marble, i) => (i === index ? { ...marble, thawed: true } : { ...marble }))
  return { ...chain, marbles }
}

export function findRuns(chain) {
  const list = chain.marbles
  const runs = []
  let i = 0

  while (i < list.length) {
    if (list[i].special === 'frozen' && !list[i].thawed) {
      i += 1
      continue
    }
    let color = null
    let end = i
    while (end < list.length) {
      const marble = list[end]
      if (marble.special === 'frozen' && !marble.thawed) break
      if (marble.color !== 'rainbow') {
        if (color === null) color = marble.color
        else if (marble.color !== color) break
      }
      end += 1
    }
    const length = end - i
    if (length >= 3) runs.push({ start: i, end: end - 1, length, color: color ?? 'rainbow' })
    i = end > i ? end : i + 1
  }
  return runs
}

/**
 * Remove a set of indices and close the gap behind each block by pulling the
 * tail forward, so the seam is exactly one spacing wide again.
 */
export function removeIndices(chain, indices) {
  const removedSet = new Set(indices)
  const kept = []
  const removed = []
  let seam = null

  chain.marbles.forEach((marble, i) => {
    if (removedSet.has(i)) {
      removed.push(marble)
      if (seam === null) seam = kept.length
    } else {
      kept.push({ ...marble })
    }
  })

  if (seam !== null && seam > 0 && seam < kept.length) {
    const target = kept[seam - 1].s - chain.spacing
    const delta = target - kept[seam].s
    for (let i = seam; i < kept.length; i += 1) kept[i].s += delta
  }

  return { chain: { ...chain, marbles: kept }, removed, removedCount: removed.length, seam }
}

/**
 * Resolve every match, including the ones created by the gap closing, with a
 * hard reaction cap so a pathological board cannot loop forever.
 */
export function resolveMatches(chain, { maxReactions = 10 } = {}) {
  let current = chain
  const steps = []
  let score = 0
  let combo = 0
  let popped = 0

  for (let iteration = 0; iteration < maxReactions; iteration += 1) {
    const runs = findRuns(current)
    if (runs.length === 0) break

    const indices = new Set()
    for (const run of runs) {
      for (let i = run.start; i <= run.end; i += 1) {
        indices.add(i)
        if (current.marbles[i].special === 'bomb') {
          for (let k = i - 2; k <= i + 2; k += 1) {
            if (k >= 0 && k < current.marbles.length) indices.add(k)
          }
        }
      }
    }

    combo += 1
    const count = indices.size
    const points = count * 10 + Math.max(0, count - 3) * 15
    const awarded = points * combo
    score += awarded

    const opened = removeIndices(current, [...indices].sort((a, b) => a - b))
    if (opened.removedCount === 0) break
    steps.push({ combo, count, points: awarded, seam: opened.seam, runs, removed: opened.removed })
    current = opened.chain
    popped += count
  }

  return { chain: current, steps, score, combo, popped }
}

export function isCleared(chain) {
  return chain.marbles.length === 0
}

/** True when the head has reached the hole. */
export function hasReachedEnd(chain, path) {
  return chain.marbles.length > 0 && chain.marbles[0].s >= path.length
}

export function chainProgress(chain, path) {
  if (chain.marbles.length === 0) return 0
  return Math.max(0, Math.min(1, chain.marbles[0].s / path.length))
}
