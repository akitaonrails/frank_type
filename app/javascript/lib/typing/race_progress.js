const SLOW_RACER_WPM = 60
const FAST_RACER_WPM = 140

export function raceProgress({ elapsedMs = 0, durationSeconds = 30, userWpm = 0 } = {}) {
  const elapsedRatio = clamp(elapsedMs / Math.max(durationSeconds * 1000, 1))
  const speeds = {
    slow: SLOW_RACER_WPM,
    user: Math.max(Number(userWpm) || 0, 0),
    fast: FAST_RACER_WPM
  }
  const winningWpm = Math.max(...Object.values(speeds), 1)

  return {
    slow: clamp(elapsedRatio * (speeds.slow / winningWpm)),
    user: clamp(elapsedRatio * (speeds.user / winningWpm)),
    fast: clamp(elapsedRatio * (speeds.fast / winningWpm))
  }
}

function clamp(value) {
  return Math.max(0, Math.min(value, 1))
}
