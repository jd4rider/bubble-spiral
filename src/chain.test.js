import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPath, nearestDistance, pointAt } from './chain/path.js'
import {
  SPACING,
  advance,
  chainProgress,
  createChain,
  findInsertion,
  findRuns,
  hasReachedEnd,
  insertMarble,
  isCleared,
  removeIndices,
  resolveMatches,
  thawMarble,
} from './chain/model.js'
import {
  CHAPTERS,
  TOTAL_LEVELS,
  classicLevel,
  dailyLevel,
  endlessLevel,
  journeyLevel,
  makeLevel,
  validateLevel,
  zenLevel,
} from './levels.js'
import {
  ACHIEVEMENTS,
  defaultSave,
  normalizeSave,
  recordResult,
  starsFor,
  totalStars,
} from './progress.js'

const straight = () => buildPath([{ x: 0, y: 0 }, { x: 300, y: 0 }])
const lineDefs = (colors) => colors.map((color) => ({ color }))

test('arc-length paths interpolate accurately and monotonically', () => {
  const path = straight()
  assert.ok(path.length > 0)
  assert.equal(pointAt(path, 0).x, 0)
  assert.ok(Math.abs(pointAt(path, path.length).x - 300) < 1)
  let last = -1
  for (let d = 0; d <= path.length; d += 25) {
    const p = pointAt(path, d)
    assert.ok(p.x >= last - 1e-9, 'distance never goes backwards')
    last = p.x
  }
  const mid = pointAt(path, path.length / 2)
  assert.ok(Math.abs(mid.x - 150) < 6)
  assert.ok(Math.abs(mid.y) < 1e-6)
})

test('nearest point on a path is local and accurate', () => {
  const path = straight()
  const near = nearestDistance(path, { x: 150, y: 8 }, 140, 60)
  assert.ok(Math.abs(near.distance - 150) < 6)
  assert.ok(near.gap <= 8.01)
})

test('a chain keeps exact spacing and moves as one', () => {
  const chain = createChain(lineDefs(['jade', 'coral', 'sky', 'amber']), { startS: 3 * SPACING })
  assert.deepEqual(chain.marbles.map((m) => m.s), [93, 62, 31, 0])
  advance(chain, 10)
  assert.deepEqual(chain.marbles.map((m) => m.s), [103, 72, 41, 10])
  for (let i = 1; i < chain.marbles.length; i += 1) {
    assert.equal(chain.marbles[i - 1].s - chain.marbles[i].s, SPACING)
  }
})

test('insertion pushes the tail back and preserves spacing', () => {
  const chain = createChain(lineDefs(['jade', 'coral', 'sky', 'amber']), { startS: 3 * SPACING })
  const { chain: next, index } = insertMarble(chain, 2, { color: 'rose' })
  assert.equal(index, 2)
  assert.equal(next.marbles[2].color, 'rose')
  for (let i = 1; i < next.marbles.length; i += 1) {
    assert.equal(next.marbles[i - 1].s - next.marbles[i].s, SPACING, `spacing at ${i}`)
  }
  assert.equal(next.marbles[0].s, 93, 'the head does not move')

  const front = insertMarble(chain, 0, { color: 'rose' })
  assert.equal(front.chain.marbles[0].s, 93 + SPACING, 'a front insert extends past the head')
})

test('three connected marbles match, two do not', () => {
  const three = createChain(lineDefs(['jade', 'jade', 'jade', 'coral']), { startS: 3 * SPACING })
  const runs = findRuns(three)
  assert.equal(runs.length, 1)
  assert.equal(runs[0].length, 3)
  assert.equal(runs[0].start, 0)

  const two = createChain(lineDefs(['jade', 'jade', 'coral']), { startS: 2 * SPACING })
  assert.equal(findRuns(two).length, 0)
})

test('rainbows bridge colours and frozen marbles block a run', () => {
  const bridged = createChain(lineDefs(['jade', 'rainbow', 'jade', 'coral']), { startS: 3 * SPACING })
  assert.equal(findRuns(bridged).length, 1)
  assert.equal(findRuns(bridged)[0].length, 3)

  const frozen = createChain(
    [{ color: 'jade' }, { color: 'jade' }, { color: 'jade', special: 'frozen' }, { color: 'jade' }],
    { startS: 3 * SPACING },
  )
  assert.equal(findRuns(frozen).length, 0, 'an unthawed marble splits the group')
  const thawed = thawMarble(frozen, 2)
  assert.equal(findRuns(thawed).length, 1, 'a thawed marble rejoins it')
})

test('removal closes the gap to exactly one spacing', () => {
  const chain = createChain(lineDefs(['jade', 'jade', 'jade', 'coral', 'sky']), { startS: 4 * SPACING })
  const opened = removeIndices(chain, [0, 1, 2])
  assert.equal(opened.removedCount, 3)
  assert.deepEqual(opened.chain.marbles.map((m) => m.color), ['coral', 'sky'])
  assert.equal(opened.chain.marbles[1].s, opened.chain.marbles[0].s - SPACING)
})

test('closing the gap can trigger a second, automatic match', () => {
  const chain = createChain(lineDefs(['coral', 'coral', 'jade', 'jade', 'jade', 'coral']), {
    startS: 5 * SPACING,
  })
  assert.equal(findRuns(chain).length, 1, 'only the jades match at first')
  const resolved = resolveMatches(chain)
  assert.equal(resolved.combo, 2, 'the two corals rejoin the third and pop')
  assert.equal(resolved.steps.length, 2)
  assert.equal(resolved.chain.marbles.length, 0)
  assert.ok(resolved.score > 0)
  assert.equal(resolved.popped, 6)
})

test('a bomb takes its neighbours with it', () => {
  const chain = createChain(
    [{ color: 'coral' }, { color: 'jade' }, { color: 'jade', special: 'bomb' }, { color: 'jade' }, { color: 'coral' }],
    { startS: 4 * SPACING },
  )
  const resolved = resolveMatches(chain)
  assert.equal(resolved.popped, 5, 'the blast takes both coral neighbours with the jade group')
  assert.ok(isCleared(resolved.chain))
})

test('long boards always terminate and never loop forever', () => {
  const defs = []
  for (let i = 0; i < 40; i += 1) defs.push({ color: 'jade' })
  const chain = createChain(defs, { startS: 39 * SPACING })
  const resolved = resolveMatches(chain)
  assert.equal(resolved.chain.marbles.length, 0)
  assert.ok(resolved.steps.length <= 10)
})

test('shots determine the same insertion for the same collision', () => {
  const path = straight()
  const chain = createChain(lineDefs(['jade', 'coral', 'sky']), { startS: 2 * SPACING })
  const hitAhead = findInsertion(chain, path, { x: 62 + 10, y: 0 })
  const hitBehind = findInsertion(chain, path, { x: 46, y: 0 })
  assert.equal(hitAhead.index, 0, 'in front of the head')
  assert.equal(hitBehind.index, 1, 'between the head and the second marble')
  assert.equal(findInsertion(chain, path, { x: 20, y: 0 }).index, 2, 'between the second marble and the tail')
})

test('win and loss conditions read the model, not sprites', () => {
  const path = straight()
  const chain = createChain(lineDefs(['jade']), { startS: 10 })
  assert.equal(isCleared(chain), false)
  assert.equal(hasReachedEnd(chain, path), false)
  advance(chain, path.length)
  assert.equal(hasReachedEnd(chain, path), true)
  assert.ok(chainProgress(chain, path) >= 1)
  assert.equal(isCleared(resolveMatches(createChain(lineDefs(['jade', 'jade', 'jade']))).chain), true)
})

test('journey levels are deterministic, fair and never open with a free match', () => {
  assert.equal(TOTAL_LEVELS, 100)
  assert.equal(CHAPTERS.reduce((n, c) => n + c.count, 0), 100)

  for (let n = 1; n <= TOTAL_LEVELS; n += 1) {
    const level = journeyLevel(n)
    const again = journeyLevel(n)
    assert.equal(level.marbles.length, again.marbles.length)
    assert.deepEqual(level.marbles, again.marbles, `level ${n} is stable`)
    assert.ok(level.metrics.slack >= 1.2, `level ${n} slack ${level.metrics.slack}`)
    assert.ok(level.metrics.rating >= 1 && level.metrics.rating <= 5)
    const check = validateLevel(level)
    assert.equal(check.ok, true, `level ${n}: ${check.problems.join(', ')}`)
  }
})

test('speed is capped by the shot budget instead of being taken on faith', () => {
  const level = makeLevel({ seed: 'speed-cap', kind: 'serpentine', colorCount: 4, speed: 999 })
  assert.ok(level.speed < 999)
  assert.ok(level.metrics.slack >= 1.2)
})

test('daily boards are identical for a date and valid', () => {
  const a = dailyLevel('2026-11-02')
  const b = dailyLevel('2026-11-02')
  assert.deepEqual(a.marbles, b.marbles)
  assert.deepEqual(a.path.length, b.path.length)
  assert.notDeepEqual(dailyLevel('2026-11-03').marbles, a.marbles)
  assert.equal(validateLevel(a).ok, true)
})

test('classic, endless and zen boards are valid', () => {
  for (const level of [classicLevel(1), classicLevel(9), endlessLevel(3), endlessLevel(12), zenLevel(7)]) {
    assert.equal(validateLevel(level).ok, true, `${level.id}: ${validateLevel(level).problems.join(', ')}`)
  }
  assert.ok(endlessLevel(12).speed > endlessLevel(1).speed)
})

test('stars reward accuracy and early clears', () => {
  assert.equal(starsFor({ accuracy: 0.95, cleared: true, progress: 0.5 }), 3)
  assert.equal(starsFor({ accuracy: 0.95, cleared: true, progress: 0.95 }), 2)
  assert.equal(starsFor({ accuracy: 0.4, cleared: true }), 1)
  assert.equal(starsFor({ accuracy: 1, cleared: false }), 0)
})

test('progress records results without mutating the input', () => {
  const start = defaultSave()
  const after = recordResult(start, {
    mode: 'journey',
    levelId: 1,
    cleared: true,
    stars: 3,
    score: 500,
    combo: 2,
    popped: 30,
    matches: 10,
    accuracy: 0.9,
    rainbow: true,
  })
  assert.equal(start.levelsCleared, 0)
  assert.equal(after.levelsCleared, 1)
  assert.equal(after.unlocked, 2)
  assert.equal(after.stars['1'], 3)
  assert.equal(after.bestCombo, 2)
  assert.equal(after.bestAccuracy, 0.9)
  assert.equal(after.rainbowClears, 1)
  assert.ok(after.achievements.includes('first_match'))
  assert.ok(after.achievements.includes('chain_reaction'))
  assert.ok(after.achievements.includes('precision_shooter'))
  assert.equal(totalStars(after), 3)

  const worse = recordResult(after, { mode: 'journey', levelId: 1, cleared: true, stars: 1 })
  assert.equal(worse.stars['1'], 3, 'a worse replay never removes stars')
})

test('dailies build a streak and survive normalisation', () => {
  let save = defaultSave()
  save = recordResult(save, { mode: 'daily', levelId: 'daily-2026-11-01', cleared: true, stars: 2 })
  save = recordResult(save, { mode: 'daily', levelId: 'daily-2026-11-02', cleared: true, stars: 3 })
  assert.equal(save.streak.count, 2)
  assert.equal(save.daily['2026-11-02'].stars, 3)
  const restored = normalizeSave(JSON.parse(JSON.stringify(save)))
  assert.equal(restored.streak.count, 2)
})

test('a corrupted save still yields a playable one', () => {
  const broken = normalizeSave({ stars: { x: 'nope', 3: 9 }, unlocked: 'abc', daily: { bad: 1 }, settings: null })
  assert.equal(broken.unlocked, 1)
  assert.deepEqual(broken.stars, { 3: 3 })
  assert.deepEqual(broken.daily, {})
  assert.equal(broken.settings.sound, true)
  assert.equal(normalizeSave(null).unlocked, 1)
  for (const achievement of ACHIEVEMENTS) assert.equal(typeof achievement.check(defaultSave()), 'boolean')
})
