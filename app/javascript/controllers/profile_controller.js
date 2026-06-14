import { Controller } from "@hotwired/stimulus"
import { LineChart } from "lib/charts/line_chart"
import { SessionStore } from "lib/storage/session_store"

export default class extends Controller {
  static values = {
    i18n: Object
  }

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
    if (!window.confirm(this.i18nValue.confirm_clear)) return

    SessionStore.clear()
    this.render()
  }

  render() {
    const sessions = SessionStore.all()
    const chronological = [...sessions].reverse()

    this.sessionCountTarget.textContent = sessions.length
    this.bestWpmTarget.textContent = maximum(sessions.map((session) => metric(session, "wpm")))
    this.averageWpmTarget.textContent = average(sessions.map((session) => metric(session, "wpm")))
    this.averageAccuracyTarget.textContent = average(sessions.map((session) => metric(session, "accuracy")))

    new LineChart(this.wpmChartTarget, { label: this.i18nValue.labels.wpm, color: "#5eead4", emptyLabel: this.i18nValue.chart_empty }).render(chronological.map((session) => metric(session, "wpm")).slice(-20))
    new LineChart(this.accuracyChartTarget, { label: this.i18nValue.labels.accuracy, color: "#c084fc", emptyLabel: this.i18nValue.chart_empty }).render(chronological.map((session) => metric(session, "accuracy")).slice(-20))

    this.recentSessionsTarget.replaceChildren(...this.sessionRows(sessions.slice(0, 12)))
  }

  sessionRows(sessions) {
    if (sessions.length === 0) {
      const empty = document.createElement("div")
      empty.className = "px-4 py-8 text-center text-slate-400"
      empty.textContent = this.i18nValue.empty_sessions
      return [empty]
    }

    return sessions.map((session) => {
      const row = document.createElement("div")
      row.className = "grid grid-cols-5 gap-2 px-4 py-3"

      row.append(
        cell(formatDate(session?.finishedAt)),
        cell(metric(session, "wpm")),
        cell(`${metric(session, "accuracy")}%`),
        cell(`${Number(session?.durationSeconds) || 0}${this.i18nValue.seconds_suffix}`),
        cell(session?.title || this.i18nValue.untitled, "truncate")
      )

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

function cell(value, className = "") {
  const span = document.createElement("span")
  span.textContent = value
  if (className) span.className = className
  if (className.includes("truncate")) span.title = value
  return span
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(document.documentElement.lang || undefined)
}

function metric(session, key) {
  return Number(session?.metrics?.[key]) || 0
}
