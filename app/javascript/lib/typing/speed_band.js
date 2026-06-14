const RECENT_SESSION_LIMIT = 5

export function preferredSpeedBand(sessions = []) {
  const recentWpms = sessions
    .slice(0, RECENT_SESSION_LIMIT)
    .map((session) => Number(session?.metrics?.wpm))
    .filter((wpm) => Number.isFinite(wpm) && wpm > 0)

  if (recentWpms.length === 0) return "slow"

  const averageWpm = recentWpms.reduce((sum, wpm) => sum + wpm, 0) / recentWpms.length

  if (averageWpm >= 140) return "fast"
  if (averageWpm >= 75) return "medium"
  return "slow"
}

export function randomExcerptIndex(excerpts, { category = "random", except = null, speedBand = "slow" } = {}) {
  if (excerpts.length <= 1) return 0

  const candidateIndexes = excerpts
    .map((excerpt, index) => ({ excerpt, index }))
    .filter(({ excerpt, index }) => matchesCategory(excerpt, category) && excerpt.speed_band === speedBand && index !== except)
    .map(({ index }) => index)

  const fallbackIndexes = excerpts
    .map((_excerpt, index) => index)
    .filter((index) => index !== except)

  const pool = candidateIndexes.length > 0 ? candidateIndexes : fallbackIndexes
  return pool[Math.floor(Math.random() * pool.length)]
}

function matchesCategory(excerpt, category) {
  return category === "random" || excerpt.category === category
}
