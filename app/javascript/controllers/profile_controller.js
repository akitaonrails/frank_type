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
    this.themeChanged = () => this.render()
    window.addEventListener("theme:change", this.themeChanged)
    this.render()
  }

  disconnect() {
    window.removeEventListener("theme:change", this.themeChanged)
  }

  clearHistory() {
    if (!window.confirm(this.i18nValue.confirm_clear)) return

    SessionStore.clear()
    this.render()
  }

  render() {
    const sessions = SessionStore.all()
    const chronological = [...sessions].reverse()

    this.sessionCountTarget.textContent = sessions.reduce((sum, session) => sum + sampleCount(session), 0)
    this.bestWpmTarget.textContent = maximum(sessions.map((session) => metric(session, "wpm")))
    this.averageWpmTarget.textContent = weightedAverage(sessions, "wpm")
    this.averageAccuracyTarget.textContent = weightedAverage(sessions, "accuracy")

    new LineChart(this.wpmChartTarget, { label: this.i18nValue.labels.wpm, color: themeColor("--chart-wpm"), emptyLabel: this.i18nValue.chart_empty }).render(chronological.map((session) => metric(session, "wpm")).slice(-20))
    new LineChart(this.accuracyChartTarget, { label: this.i18nValue.labels.accuracy, color: themeColor("--chart-accuracy"), emptyLabel: this.i18nValue.chart_empty }).render(chronological.map((session) => metric(session, "accuracy")).slice(-20))

    this.recentSessionsTarget.replaceChildren(...this.sessionRows(sessions.slice(0, 12)))
  }

  sessionRows(sessions) {
    if (sessions.length === 0) {
      const empty = document.createElement("div")
      empty.className = "text-muted px-4 py-8 text-center"
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
        cell(sessionTitle(session, this.i18nValue), "truncate")
      )

      return row
    })
  }
}

function themeColor(name) {
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function weightedAverage(sessions, key) {
  const totals = sessions.reduce((result, session) => {
    const value = metric(session, key)
    const weight = sampleCount(session)
    result.sum += value * weight
    result.weight += weight
    return result
  }, { sum: 0, weight: 0 })

  return totals.weight === 0 ? 0 : Math.round(totals.sum / totals.weight)
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

function sampleCount(session) {
  return Math.max(1, Number(session?.sampleCount) || 1)
}

function sessionTitle(session, i18n) {
  if (!session?.summary) return session?.title || i18n.untitled

  return `${i18n.daily_summary} (${sampleCount(session)} ${i18n.summary_sessions})`
}
