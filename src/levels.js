// Seeded level construction.
//
// A marble chain cannot be proven solvable the way a puzzle can — aiming and
// timing are continuous. So levels are built from curated path templates and a
// deterministic colour sequence, then checked against a shot-budget heuristic:
// the chain must give the player comfortably more time than the minimum number
// of shots needed to clear it. Speeds are derived from that budget rather than
// guessed, so every shipped level passes the check by construction.

import { buildPath, pointAt } from './chain/path.js'
import { COLORS, SPACING, createChain, findRuns } from './chain/model.js'

export function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0
  let h = 2166136261
  const str = String(seed)
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function createRng(seed) {
  let a = hashSeed(seed)
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const randInt = (rng, n) => Math.floor(rng() * n)
const pick = (rng, list) => list[randInt(rng, list.length)]
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// ---------- path templates -------------------------------------------------

function spiralPoints(rng) {
  const cx = 318 + (rng() - 0.5) * 20
  const cy = 424
  const turns = 2.35 + rng() * 0.25
  const rOuter = 238 + rng() * 12
  const rInner = 54
  const rotate = -Math.PI / 2 + (rng() - 0.5) * 0.4
  const count = Math.round(turns * 36)
  const points = []
  for (let i = 0; i <= count; i += 1) {
    const t = i / count
    const radius = rOuter + (rInner - rOuter) * t
    const angle = rotate + t * turns * Math.PI * 2
    points.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.72,
    })
  }
  return points
}

function serpentinePoints(rng) {
  const x = 96
  const width = 448
  const y0 = 176
  const rows = 3 + randInt(rng, 2)
  const rowHeight = (520 - y0) / (rows - 1)
  const points = []
  for (let row = 0; row < rows; row += 1) {
    const y = y0 + row * rowHeight
    const leftToRight = row % 2 === 0
    const x0 = leftToRight ? x : x + width
    const x1 = leftToRight ? x + width : x
    points.push({ x: x0, y })
    points.push({ x: x1, y })
    if (row < rows - 1) points.push({ x: x1, y: y + rowHeight })
  }
  return points
}

function zigzagPoints(rng) {
  const x = 92
  const width = 456
  const y0 = 168
  const rows = 5 + randInt(rng, 2)
  const rowHeight = (540 - y0) / (rows - 1)
  const points = []
  for (let row = 0; row < rows; row += 1) {
    points.push({ x: row % 2 === 0 ? x : x + width, y: y0 + row * rowHeight })
  }
  return points
}

function loopPoints(rng) {
  const cx = 320
  const cy = 372
  const radius = 176 + rng() * 16
  const points = []
  for (let i = 0; i <= 44; i += 1) {
    const angle = -Math.PI / 2 + (i / 44) * Math.PI * 2
    points.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.94,
    })
  }
  points.push({ x: cx + 34, y: cy + radius * 0.7 })
  points.push({ x: cx + 4, y: cy + radius * 0.98 })
  return points
}

export const PATH_KINDS = ['spiral', 'serpentine', 'zigzag', 'loop']

export function pathPoints(kind, rng) {
  if (kind === 'serpentine') return serpentinePoints(rng)
  if (kind === 'zigzag') return zigzagPoints(rng)
  if (kind === 'loop') return loopPoints(rng)
  return spiralPoints(rng)
}

// ---------- colour sequence ------------------------------------------------

/**
 * Build the colour sequence from a counted pool: every colour gets at least
 * three marbles, and the greedy pick never allows three in a row. That makes
 * the minimum-count guarantee structural instead of probabilistic.
 */
function baseColours(rng, count, palettes) {
  const counts = new Map(palettes.map((color) => [color, Math.floor(count / palettes.length)]))
  let assigned = palettes.length * Math.floor(count / palettes.length)
  let cursor = 0
  while (assigned < count) {
    const color = palettes[cursor % palettes.length]
    counts.set(color, counts.get(color) + 1)
    assigned += 1
    cursor += 1
  }
  for (const color of palettes) {
    while (counts.get(color) < 3) {
      const donor = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
      if (!donor || donor[1] <= 3) break
      counts.set(donor[0], donor[1] - 1)
      counts.set(color, counts.get(color) + 1)
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const out = []
    const remaining = new Map(counts)
    let dead = false
    for (let i = 0; i < count; i += 1) {
      const options = [...remaining.entries()].filter(
        ([color, left]) => left > 0 && !(i >= 2 && out[i - 1] === color && out[i - 2] === color),
      )
      if (options.length === 0) {
        dead = true
        break
      }
      const weight = options.reduce((sum, [, left]) => sum + left, 0)
      let roll = rng() * weight
      let chosen = options[options.length - 1][0]
      for (const [color, left] of options) {
        roll -= left
        if (roll <= 0) {
          chosen = color
          break
        }
      }
      out.push(chosen)
      remaining.set(chosen, remaining.get(chosen) - 1)
    }
    if (!dead && out.length === count) return out.map((color) => ({ color }))
  }

  // Deterministic fallback: a repeating wiped pattern that can never triple.
  return Array.from({ length: count }, (_, i) => ({ color: palettes[i % palettes.length] }))
}

function sprinkleSpecials(rng, defs, { rainbow = 0, bomb = 0, frozen = 0 }) {
  const out = defs.map((def) => ({ ...def }))
  const assign = (special, wanted) => {
    let placed = 0
    let guard = 0
    while (placed < wanted && guard < defs.length * 4) {
      guard += 1
      const index = 2 + randInt(rng, Math.max(1, out.length - 4))
      if (out[index].special) continue
      out[index] = { ...out[index], special }
      placed += 1
    }
  }
  assign('rainbow', rainbow)
  assign('bomb', bomb)
  assign('frozen', frozen)
  return out
}

function hasOpeningMatch(defs) {
  return findRuns(createChain(defs, { startS: (defs.length - 1) * SPACING })).length > 0
}

// ---------- level construction --------------------------------------------

export function makeLevel({
  id = 'level',
  mode = 'journey',
  seed,
  kind = 'spiral',
  colorCount = 4,
  speed = 26,
  specials = {},
  powerups = 2,
  title = 'Spiral',
  chapter = 1,
  chapterName = 'First Spiral',
} = {}) {
  const rng = createRng(seed ?? id)
  const path = buildPath(pathPoints(kind, rng))
  const spacing = SPACING
  const palettes = COLORS.slice(0, clamp(colorCount, 3, COLORS.length))
  // Enough marbles for three of every colour, and never so many that the head
  // starts inside the hole.
  const roomFor = Math.max(12, Math.floor((path.length - 160) / spacing))
  const count = clamp(Math.round((path.length * 0.5) / spacing), Math.max(16, palettes.length * 3), Math.min(54, roomFor))
  const startS = (count - 1) * spacing
  const remaining = Math.max(120, path.length - startS)

  let defs = baseColours(rng, count, palettes)
  defs = sprinkleSpecials(rng, defs, specials)

  // A board must never open with a free match. Rainbows are wildcards and are
  // the only special that can create one, so retry and finally drop them.
  let guard = 0
  while (hasOpeningMatch(defs) && guard < 30) {
    guard += 1
    defs = sprinkleSpecials(rng, baseColours(createRng(`${seed}:${guard}`), count, palettes), specials)
  }
  if (hasOpeningMatch(defs)) {
    // Frost and bombs cannot create a run; only rainbows can.
    defs = sprinkleSpecials(createRng(`${seed}:safe`), baseColours(createRng(`${seed}:safe-colours`), count, palettes), {
      bomb: specials.bomb ?? 0,
      frozen: specials.frozen ?? 0,
    })
  }

  // Shot budget: ~0.9s per shot is a comfortable human pace; a level is fair
  // when the chain gives 70% more time than that minimum.
  const shotsNeeded = count / 3
  const fairSpeed = remaining / (shotsNeeded * 0.9 * 1.7)
  const finalSpeed = Math.max(8, Math.min(speed, fairSpeed))

  const timeToReach = remaining / finalSpeed
  const slack = timeToReach / (shotsNeeded * 0.9)

  const specialCount = defs.filter((def) => def.special).length
  const raw =
    (finalSpeed / 9) * 0.9 +
    (palettes.length - 3) * 1.1 +
    (specialCount / Math.max(1, count)) * 9 +
    count / 26
  // Calibrated against the shipped catalogue: chapter 1 lands at 1 and the
  // sixtieth-tile finale at 5. Relative within this game, not absolute.
  const rating = raw < 4.3 ? 1 : raw < 5.3 ? 2 : raw < 6.5 ? 3 : raw < 8.2 ? 4 : 5

  return {
    id,
    mode,
    seed: String(seed ?? id),
    chapter,
    chapterName,
    title,
    kind,
    path,
    spacing,
    colors: palettes,
    marbles: defs,
    count,
    startS,
    speed: finalSpeed,
    baseSpeed: finalSpeed,
    powerups,
    metrics: {
      count,
      speed: Math.round(finalSpeed * 10) / 10,
      timeToReach: Math.round(timeToReach),
      shotsNeeded: Math.ceil(shotsNeeded),
      slack: Math.round(slack * 100) / 100,
      rating,
      length: Math.round(path.length),
      specials: specialCount,
    },
  }
}

export function validateLevel(level) {
  const problems = []
  if (level.path.length <= 0) problems.push('path has no length')
  if (level.marbles.length < 12) problems.push('chain is too short')
  if (level.startS >= level.path.length) problems.push('chain starts past the hole')
  if (hasOpeningMatch(level.marbles)) problems.push('chain opens with a free match')
  if (level.metrics.slack < 1.2) problems.push('not enough time for the required shots')
  const counts = new Map()
  for (const def of level.marbles) counts.set(def.color, (counts.get(def.color) ?? 0) + 1)
  for (const color of level.colors) {
    if ((counts.get(color) ?? 0) < 3) problems.push(`${color} appears fewer than three times`)
  }
  return { ok: problems.length === 0, problems }
}

// ---------- chapters and modes --------------------------------------------

export const CHAPTERS = [
  { id: 1, name: 'First Spiral', tagline: 'One track, one launcher.', count: 12, kind: 'spiral', colorCount: 4, speed: 20, specials: {}, powerups: 1 },
  { id: 2, name: 'Color Connections', tagline: 'Longer chains, wider palette.', count: 12, kind: 'serpentine', colorCount: 4, speed: 24, specials: { rainbow: 1 }, powerups: 2 },
  { id: 3, name: 'Chain Reactions', tagline: 'A pop can pull the track together.', count: 12, kind: 'zigzag', colorCount: 5, speed: 26, specials: { rainbow: 1, bomb: 2 }, powerups: 2 },
  { id: 4, name: 'Twisting Tracks', tagline: 'The loop comes back around.', count: 12, kind: 'loop', colorCount: 5, speed: 28, specials: { rainbow: 2, bomb: 2 }, powerups: 3 },
  { id: 5, name: 'Frozen Marbles', tagline: 'Hit the frost before it can pop.', count: 12, kind: 'spiral', colorCount: 5, speed: 30, specials: { frozen: 3, rainbow: 1 }, powerups: 3 },
  { id: 6, name: 'Double Trouble', tagline: 'Serpentine with every trick.', count: 12, kind: 'serpentine', colorCount: 5, speed: 32, specials: { frozen: 2, bomb: 3, rainbow: 2 }, powerups: 3 },
  { id: 7, name: 'Speed Rush', tagline: 'Faster chain, tighter aim.', count: 12, kind: 'zigzag', colorCount: 6, speed: 38, specials: { rainbow: 2, bomb: 2, frozen: 2 }, powerups: 3 },
  { id: 8, name: 'Spiral Master', tagline: 'The full palette, the full spiral.', count: 16, kind: 'spiral', colorCount: 6, speed: 42, specials: { rainbow: 3, bomb: 3, frozen: 3 }, powerups: 3 },
]

export const TOTAL_LEVELS = CHAPTERS.reduce((sum, chapter) => sum + chapter.count, 0)

export function chapterStart(chapterId) {
  let start = 1
  for (const chapter of CHAPTERS) {
    if (chapter.id === chapterId) return start
    start += chapter.count
  }
  return start
}

export function chapterOf(level) {
  const n = clamp(Math.round(level), 1, TOTAL_LEVELS)
  let end = 0
  for (const chapter of CHAPTERS) {
    end += chapter.count
    if (n <= end) return chapter
  }
  return CHAPTERS[CHAPTERS.length - 1]
}

const journeyCache = new Map()

export function journeyLevel(level) {
  const id = clamp(Math.round(level), 1, TOTAL_LEVELS)
  if (journeyCache.has(id)) return journeyCache.get(id)
  const chapter = chapterOf(id)
  const within = id - chapterStart(chapter.id)
  const extra = within % 4 === 3 ? 1 : 0
  const built = makeLevel({
    id,
    mode: 'journey',
    seed: `spiral-j${id}`,
    kind: chapter.kind,
    colorCount: Math.min(6, chapter.colorCount + extra),
    speed: chapter.speed + within * 0.35,
    specials: chapter.specials,
    powerups: chapter.powerups,
    title: `${chapter.id}–${within + 1}`,
    chapter: chapter.id,
    chapterName: chapter.name,
  })
  journeyCache.set(id, built)
  return built
}

export function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function dailyLevel(date = todayKey()) {
  const seed = `spiral-daily-${date}`
  const rng = createRng(seed)
  return makeLevel({
    id: `daily-${date}`,
    mode: 'daily',
    seed,
    kind: pick(rng, PATH_KINDS),
    colorCount: 5,
    speed: 28,
    specials: { rainbow: 1, bomb: 1 },
    powerups: 2,
    title: 'Daily Challenge',
  })
}

export function zenLevel(seed = Date.now()) {
  return makeLevel({
    id: `zen-${seed}`,
    mode: 'zen',
    seed: `spiral-zen-${seed}`,
    kind: pick(createRng(seed), PATH_KINDS),
    colorCount: 4,
    speed: 16,
    specials: {},
    powerups: 3,
    title: 'Zen',
  })
}

export function endlessLevel(wave = 1) {
  const n = Math.max(1, Math.round(wave))
  return makeLevel({
    id: `endless-${n}`,
    mode: 'endless',
    seed: `spiral-endless-${n}`,
    kind: PATH_KINDS[n % PATH_KINDS.length],
    colorCount: clamp(4 + Math.floor(n / 4), 4, 6),
    speed: 22 + n * 1.6,
    specials: { rainbow: n >= 3 ? 1 : 0, bomb: n >= 5 ? 1 : 0, frozen: n >= 7 ? 1 : 0 },
    powerups: 2,
    title: `Wave ${n}`,
    chapter: 0,
    chapterName: 'Endless',
  })
}

export function classicLevel(stage = 1) {
  const n = Math.max(1, Math.round(stage))
  return makeLevel({
    id: `classic-${n}`,
    mode: 'classic',
    seed: `spiral-classic-${n}`,
    kind: PATH_KINDS[(n - 1) % PATH_KINDS.length],
    colorCount: clamp(4 + Math.floor((n - 1) / 3), 4, 6),
    speed: 20 + n * 1.2,
    specials: { rainbow: n >= 2 ? 1 : 0, bomb: n >= 4 ? 1 : 0, frozen: n >= 6 ? 1 : 0 },
    powerups: 2,
    title: `Stage ${n}`,
    chapter: 0,
    chapterName: 'Classic',
  })
}

export function holePosition(level) {
  return pointAt(level.path, level.path.length)
}

export { SPACING }
