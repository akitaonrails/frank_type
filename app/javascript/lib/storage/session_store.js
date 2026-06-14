const STORAGE_KEY = "frank_type.sessions.v1"
const MAX_SESSIONS = 100

export class SessionStore {
  static all() {
    try {
      const sessions = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]")
      return Array.isArray(sessions) ? sessions : []
    } catch (_error) {
      return []
    }
  }

  static save(session) {
    const sessions = [session, ...this.all()].slice(0, MAX_SESSIONS)

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    } catch (_error) {
      return this.all()
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
}
