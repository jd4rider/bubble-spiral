// Progression rules, free of rendering and storage.

export const SAVE_VERSION = 1
export const JOURNEY_LEVELS = 100
export const MAX_STARS = 3

export const ACHIEVEMENTS = [
  { id: 'first_match', name: 'First Match', description: 'Pop your first group of three.', check: (s) => s.matchesMade >= 1 },
  { id: 'chain_reaction', name: 'Chain Reaction', description: 'Trigger a reaction from a closing gap.', check: (s) => s.bestCombo >= 2 },
  { id: 'combo_king', name: 'Combo King', description: 'Reach a combo of five.', check: (s) => s.bestCombo >= 5 },
  { id: 'spiral_survivor', name: 'Spiral Survivor', description: 'Finish Chapter 1.', check: (s) => s.unlocked >= 13 },
  { id: 'precision_shooter', name: 'Precision Shooter', description: 'Clear a level with 90% accuracy.', check: (s) => s.bestAccuracy >= 0.9 },
  { id: 'rainbow_master', name: 'Rainbow Master', description: 'Clear a level using a rainbow shot.', check: (s) => s.rainbowClears >= 1 },
  { id: 'thousand_marbles', name: '1,000 Marbles Popped', description: 'Pop one thousand marbles.', check: (s) => s.marblesPopped >= 1000 },
  { id: 'daily_three', name: 'Daily Habit', description: 'Clear three daily challenges.', check: (s) => Object.keys(s.daily).length >= 3 },
  { id: 'streak_seven', name: 'Seven Days Running', description: 'Keep a seven-day daily streak.', check: (s) => s.streak.count >= 7 },
  { id: 'spiral_champion', name: 'Spiral Champion', description: 'Finish every Journey level.', check: (s) => s.completedJourney },
]

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    unlocked: 1,
    stars: {},
    daily: {},
    achievements: [],
    levelsCleared: 0,
    matchesMade: 0,
    marblesPopped: 0,
    bestCombo: 0,
    bestScore: 0,
    bestAccuracy: 0,
    rainbowClears: 0,
    classicBest: 0,
    endlessBest: 0,
    zenCleared: 0,
    streak: { last: null, count: 0 },
    settings: { sound: true, theme: 'candy', reducedMotion: false },
    completedJourney: false,
    updatedAt: 0,
  }
}

const asInt = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : fallback)
const asNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback)

export function normalizeSave(raw) {
  const base = defaultSave()
  if (!raw || typeof raw !== 'object') return base

  const stars = {}
  if (raw.stars && typeof raw.stars === 'object') {
    for (const [key, value] of Object.entries(raw.stars)) {
      const star = Math.min(MAX_STARS, asInt(value))
      if (star > 0 && /^\d+$/.test(key)) stars[key] = star
    }
  }

  const daily = {}
  if (raw.daily && typeof raw.daily === 'object') {
    for (const [date, entry] of Object.entries(raw.daily)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      daily[date] = { stars: Math.min(MAX_STARS, Math.max(1, asInt(entry?.stars, 1))) }
    }
  }

  return {
    ...base,
    version: SAVE_VERSION,
    unlocked: Math.min(JOURNEY_LEVELS, Math.max(1, asInt(raw.unlocked, 1))),
    stars,
    daily,
    achievements: Array.isArray(raw.achievements) ? raw.achievements.filter((id) => typeof id === 'string') : [],
    levelsCleared: asInt(raw.levelsCleared),
    matchesMade: asInt(raw.matchesMade),
    marblesPopped: asInt(raw.marblesPopped),
    bestCombo: asInt(raw.bestCombo),
    bestScore: asInt(raw.bestScore),
    bestAccuracy: Math.min(1, asNumber(raw.bestAccuracy)),
    rainbowClears: asInt(raw.rainbowClears),
    classicBest: asInt(raw.classicBest),
    endlessBest: asInt(raw.endlessBest),
    zenCleared: asInt(raw.zenCleared),
    streak: { last: typeof raw.streak?.last === 'string' ? raw.streak.last : null, count: asInt(raw.streak?.count) },
    settings: {
      sound: raw.settings?.sound !== false,
      theme: typeof raw.settings?.theme === 'string' ? raw.settings.theme : base.settings.theme,
      reducedMotion: raw.settings?.reducedMotion === true,
    },
    completedJourney: raw.completedJourney === true || Object.keys(stars).length >= JOURNEY_LEVELS,
    updatedAt: asInt(raw.updatedAt),
  }
}

/** Stars measure care: accuracy first, then how much of the track was left. */
export function starsFor({ accuracy = 0, cleared = false, progress = 1 } = {}) {
  if (!cleared) return 0
  if (accuracy >= 0.85 && progress <= 0.75) return 3
  if (accuracy >= 0.6) return 2
  return 1
}

export function unlockedAchievements(save) {
  return ACHIEVEMENTS.filter((achievement) => {
    try {
      return achievement.check(save)
    } catch {
      return false
    }
  })
}

export function totalStars(save) {
  return Object.values(save.stars).reduce((sum, value) => sum + value, 0)
}

export function isLevelUnlocked(save, level) {
  return level <= Math.max(1, save.unlocked)
}

export function previousDate(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
}

function updateStreak(save, date) {
  if (save.streak.last === date) return
  save.streak.count = save.streak.last && previousDate(date) === save.streak.last ? save.streak.count + 1 : 1
  save.streak.last = date
}

/**
 * Record a finished board. Input is never mutated; a failed write cannot
 * corrupt the in-memory session.
 */
export function recordResult(save, result = {}) {
  const {
    mode = 'journey',
    levelId = 0,
    cleared = false,
    stars = 0,
    score = 0,
    combo = 0,
    popped = 0,
    matches = 0,
    accuracy = 0,
    rainbow = false,
    stage = 0,
    wave = 0,
  } = result

  const next = normalizeSave(save)
  next.marblesPopped += Math.max(0, Math.round(popped))
  next.matchesMade += Math.max(0, Math.round(matches))
  next.bestCombo = Math.max(next.bestCombo, Math.round(combo))
  next.bestScore = Math.max(next.bestScore, Math.round(score))
  next.bestAccuracy = Math.max(next.bestAccuracy, Math.min(1, accuracy))
  if (rainbow) next.rainbowClears += 1

  if (cleared) {
    next.levelsCleared += 1
    const earned = Math.min(MAX_STARS, Math.max(1, Math.round(stars)))
    if (mode === 'journey' && levelId > 0) {
      const key = String(levelId)
      next.stars[key] = Math.max(next.stars[key] ?? 0, earned)
      next.unlocked = Math.min(JOURNEY_LEVELS, Math.max(next.unlocked, levelId + 1))
      if (levelId >= JOURNEY_LEVELS) next.completedJourney = true
    } else if (mode === 'daily' && levelId) {
      const date = String(levelId).replace(/^daily-/, '')
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        next.daily[date] = { stars: Math.max(next.daily[date]?.stars ?? 0, earned) }
        updateStreak(next, date)
      }
    } else if (mode === 'classic' && stage > 0) {
      next.classicBest = Math.max(next.classicBest, Math.round(stage))
    } else if (mode === 'endless' && wave > 0) {
      next.endlessBest = Math.max(next.endlessBest, Math.round(wave))
    } else if (mode === 'zen') {
      next.zenCleared += 1
    }
  }

  next.achievements = unlockedAchievements(next).map((achievement) => achievement.id)
  next.updatedAt = Date.now()
  return next
}

export function newlyUnlocked(before, after) {
  const had = new Set(before?.achievements ?? [])
  return ACHIEVEMENTS.filter((achievement) => after.achievements.includes(achievement.id) && !had.has(achievement.id))
}
