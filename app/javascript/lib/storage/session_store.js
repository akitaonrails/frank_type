const STORAGE_KEY = "frank_type.sessions.v1"
const FULL_SESSION_LIMIT = 30
const DAILY_SUMMARY_LIMIT = 90
const MAX_RECORDS = FULL_SESSION_LIMIT + DAILY_SUMMARY_LIMIT

export class SessionStore {
  static all() {
    const sessions = this.compact(this.readRaw())
    this.persistCompaction(sessions)
    return sessions
  }

  static save(session) {
    const sessions = this.compact([session, ...this.readRaw()])

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    } catch (_error) {
      return sessions
    }

    return sessions
  }

  static clear() {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch (_error) {
      // Local storage can be unavailable in hardened/private contexts.
    }
  }

  static compact(sessions) {
    const sortedSessions = sessions
      .filter((session) => session && typeof session === "object")
      .sort((left, right) => timestamp(right.finishedAt) - timestamp(left.finishedAt))

    const detailedSessions = sortedSessions.slice(0, FULL_SESSION_LIMIT)
    const dailySummaries = summarizeByDay(sortedSessions.slice(FULL_SESSION_LIMIT)).slice(0, DAILY_SUMMARY_LIMIT)

    return [...detailedSessions, ...dailySummaries].slice(0, MAX_RECORDS)
  }

  static readRaw() {
    try {
      const sessions = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]")
      return Array.isArray(sessions) ? sessions : []
    } catch (_error) {
      return []
    }
  }

  static persistCompaction(compactedSessions) {
    const rawSessions = this.readRaw()
    if (JSON.stringify(rawSessions) === JSON.stringify(compactedSessions)) return

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compactedSessions))
    } catch (_error) {
      // Reading history should still work when storage is full or unavailable.
    }
  }
}

function summarizeByDay(sessions) {
  const groups = new Map()

  sessions.forEach((session) => {
    const day = dayKey(session.finishedAt)
    if (!day) return

    if (!groups.has(day)) groups.set(day, [])
    groups.get(day).push(session)
  })

  return [...groups.entries()]
    .map(([day, daySessions]) => dailySummary(day, daySessions))
    .sort((left, right) => timestamp(right.finishedAt) - timestamp(left.finishedAt))
}

function dailySummary(day, sessions) {
  const sampleCount = sessions.reduce((sum, session) => sum + sessionWeight(session), 0)

  return {
    id: `summary-${day}`,
    summary: true,
    sampleCount,
    title: "Daily summary",
    author: "Frank Type",
    source: "Local history",
    startedAt: `${day}T00:00:00.000Z`,
    finishedAt: latestFinishedAt(sessions),
    durationSeconds: weightedAverage(sessions, (session) => Number(session.durationSeconds)),
    elapsedMs: weightedAverage(sessions, (session) => Number(session.elapsedMs)),
    metrics: {
      wpm: weightedAverage(sessions, (session) => Number(session.metrics?.wpm)),
      rawWpm: weightedAverage(sessions, (session) => Number(session.metrics?.rawWpm)),
      accuracy: weightedAverage(sessions, (session) => Number(session.metrics?.accuracy)),
      mistakes: sessions.reduce((sum, session) => sum + (Number(session.metrics?.mistakes) || 0), 0),
      typedCharacters: sessions.reduce((sum, session) => sum + (Number(session.metrics?.typedCharacters) || 0), 0)
    }
  }
}

function weightedAverage(sessions, valueFor) {
  const totals = sessions.reduce((result, session) => {
    const value = valueFor(session)
    if (!Number.isFinite(value)) return result

    const weight = sessionWeight(session)
    result.sum += value * weight
    result.weight += weight
    return result
  }, { sum: 0, weight: 0 })

  return totals.weight === 0 ? 0 : Math.round(totals.sum / totals.weight)
}

function latestFinishedAt(sessions) {
  return sessions.reduce((latest, session) => (timestamp(session.finishedAt) > timestamp(latest) ? session.finishedAt : latest), sessions[0]?.finishedAt)
}

function dayKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toISOString().slice(0, 10)
}

function timestamp(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function sessionWeight(session) {
  return Math.max(1, Number(session?.sampleCount) || 1)
}
