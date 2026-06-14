const STORAGE_KEY = "frank_type.sessions.v1"
const MAX_SESSIONS = 100

export class SessionStore {
  static all() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]")
    } catch (_error) {
      return []
    }
  }

  static save(session) {
    const sessions = [session, ...this.all()].slice(0, MAX_SESSIONS)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    return sessions
  }

  static clear() {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}
