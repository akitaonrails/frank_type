import { Controller } from "@hotwired/stimulus"
import { LineChart } from "lib/charts/line_chart"
import { SessionStore } from "lib/storage/session_store"

export default class extends Controller {
  static targets = [
    "accuracyChart",
    "averageAccuracy",
    "averageWpm",
    "bestWpm",
    "recentSessions",
    "sessionCount",
    "wpmChart"
  ]

  connect() {
    this.render()
  }

  clearHistory() {
    if (!window.confirm("Clear local typing history?")) return

    SessionStore.clear()
    this.render()
  }

  render() {
    const sessions = SessionStore.all()
    const chronological = [...sessions].reverse()

    this.sessionCountTarget.textContent = sessions.length
    this.bestWpmTarget.textContent = maximum(sessions.map((session) => session.metrics.wpm))
    this.averageWpmTarget.textContent = average(sessions.map((session) => session.metrics.wpm))
    this.averageAccuracyTarget.textContent = average(sessions.map((session) => session.metrics.accuracy))

    new LineChart(this.wpmChartTarget, { label: "WPM", color: "#5eead4" }).render(chronological.map((session) => session.metrics.wpm).slice(-20))
    new LineChart(this.accuracyChartTarget, { label: "Accuracy", color: "#c084fc" }).render(chronological.map((session) => session.metrics.accuracy).slice(-20))

    this.recentSessionsTarget.replaceChildren(...this.sessionRows(sessions.slice(0, 12)))
  }

  sessionRows(sessions) {
    if (sessions.length === 0) {
      const empty = document.createElement("div")
      empty.className = "px-4 py-8 text-center text-slate-400"
      empty.textContent = "No sessions yet. Finish one practice run to populate your profile."
      return [empty]
    }

    return sessions.map((session) => {
      const row = document.createElement("div")
      row.className = "grid grid-cols-5 gap-2 px-4 py-3"
      row.innerHTML = `
        <span>${new Date(session.finishedAt).toLocaleDateString()}</span>
        <span>${session.metrics.wpm}</span>
        <span>${session.metrics.accuracy}%</span>
        <span>${session.durationSeconds}s</span>
        <span class="truncate" title="${escapeHtml(session.title)}">${escapeHtml(session.title)}</span>
      `
      return row
    })
  }
}

function average(values) {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function maximum(values) {
  if (values.length === 0) return 0
  return Math.max(...values)
}

function escapeHtml(value) {
  const div = document.createElement("div")
  div.textContent = value
  return div.innerHTML
}
