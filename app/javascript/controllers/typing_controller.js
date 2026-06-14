import { Controller } from "@hotwired/stimulus"
import { TypingSessionState } from "lib/typing/session_state"
import { SessionStore } from "lib/storage/session_store"

export default class extends Controller {
  static values = {
    excerpts: Array
  }

  static targets = [
    "accuracy",
    "durationButton",
    "helpOverlay",
    "progress",
    "results",
    "resultSummary",
    "source",
    "stateLabel",
    "text",
    "timeLeft",
    "typingSurface",
    "wpm"
  ]

  connect() {
    this.durationSeconds = 30
    this.excerptIndex = Math.floor(Math.random() * this.excerptsValue.length)
    this.pendingTabRestart = false
    this.timer = null

    this.resetSession()
    this.focus()
  }

  disconnect() {
    this.stopTicker()
  }

  focus() {
    this.typingSurfaceTarget.focus()
  }

  setDuration(event) {
    this.durationSeconds = Number(event.params.duration)
    this.resetSession()
  }

  keydown(event) {
    if (event.key === "?") {
      event.preventDefault()
      event.stopPropagation()
      this.openHelp()
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      this.closeHelp()
      return
    }

    if (event.ctrlKey || event.metaKey) {
      this.handleShortcut(event)
      return
    }

    if (this.pendingTabRestart && event.key === "Enter") {
      event.preventDefault()
      this.pendingTabRestart = false
      this.resetSession()
      return
    }

    if (event.key === "Tab") {
      event.preventDefault()
      this.pendingTabRestart = true
      this.stateLabelTarget.textContent = "press Enter to restart"
      return
    }

    this.pendingTabRestart = false

    if (event.key === "Backspace") {
      event.preventDefault()
      this.session.backspace()
      this.render()
      return
    }

    if (event.key.length !== 1 || event.altKey) return

    event.preventDefault()
    this.session.type(event.key.toLowerCase())
    this.startTicker()
    this.render()

    if (this.session.shouldFinish()) this.finishSession()
  }

  globalKeydown(event) {
    if (event.key === "?") {
      event.preventDefault()
      this.openHelp()
    }

    if (event.key === "Escape") {
      event.preventDefault()
      this.closeHelp()
    }
  }

  openHelp() {
    this.helpOverlayTarget.classList.remove("hidden")
    this.helpOverlayTarget.classList.add("flex")
  }

  closeHelp() {
    this.helpOverlayTarget.classList.add("hidden")
    this.helpOverlayTarget.classList.remove("flex")
    this.focus()
  }

  closeHelpFromBackdrop(event) {
    if (event.target !== event.currentTarget) return

    this.closeHelp()
  }

  handleShortcut(event) {
    const key = event.key.toLowerCase()

    if (key === "r") {
      event.preventDefault()
      this.resetSession()
    }

    if (key === "n") {
      event.preventDefault()
      this.nextExcerpt()
    }
  }

  resetSession() {
    this.stopTicker()
    this.resultsTarget.classList.add("hidden")
    this.session = new TypingSessionState({ excerpt: this.currentExcerpt, durationSeconds: this.durationSeconds })
    this.updateDurationButtons()
    this.render()
  }

  nextExcerpt() {
    this.excerptIndex = (this.excerptIndex + 1) % this.excerptsValue.length
    this.resetSession()
  }

  startTicker() {
    if (this.timer) return

    this.timer = window.setInterval(() => {
      this.render()
      if (this.session.shouldFinish()) this.finishSession()
    }, 100)
  }

  stopTicker() {
    if (!this.timer) return

    window.clearInterval(this.timer)
    this.timer = null
  }

  finishSession() {
    this.stopTicker()
    const result = this.session.finish()
    SessionStore.save(result)
    this.render()
    this.resultsTarget.classList.remove("hidden")
    this.resultSummaryTarget.textContent = `${result.metrics.wpm} WPM · ${result.metrics.accuracy}% accuracy · ${result.metrics.typedCharacters} keystrokes captured`
  }

  render() {
    const metrics = this.session.currentMetrics()

    this.wpmTarget.textContent = metrics.wpm
    this.accuracyTarget.textContent = metrics.accuracy
    this.timeLeftTarget.textContent = this.session.remainingSeconds
    this.progressTarget.textContent = `${this.session.cursor}/${this.session.targetText.length}`
    this.sourceTarget.textContent = `${this.currentExcerpt.title} · ${this.currentExcerpt.author}`
    this.stateLabelTarget.textContent = this.session.finished ? "complete" : this.session.started ? "typing" : "click here and start typing"
    this.textTarget.replaceChildren(...this.characterSpans())
  }

  characterSpans() {
    const words = []
    let word = document.createElement("span")
    word.className = "inline-flex whitespace-nowrap"

    ;[...this.session.targetText].forEach((expected, index) => {
      const actual = this.session.typedCharacters[index]
      const span = document.createElement("span")
      span.textContent = expected === " " ? " " : expected
      span.className = this.characterClass({ expected, actual, index })
      word.appendChild(span)

      if (expected === " ") {
        words.push(word)
        word = document.createElement("span")
        word.className = "inline-flex whitespace-nowrap"
      }
    })

    if (word.childNodes.length > 0) words.push(word)

    return words
  }

  characterClass({ expected, actual, index }) {
    const base = "relative inline-block rounded px-px transition-colors "
    const spacing = expected === " " ? "w-[0.65ch] " : ""
    if (index === this.session.cursor && !this.session.finished) return `${base}${spacing}bg-teal-300/25 text-white after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-full after:rounded-full after:bg-teal-300`
    if (actual === undefined) return `${base}${spacing}text-slate-500`
    if (actual === expected) return `${base}${spacing}text-teal-100`
    return `${base}${spacing}bg-rose-400/20 text-rose-200`
  }

  updateDurationButtons() {
    this.durationButtonTargets.forEach((button) => {
      const active = Number(button.dataset.typingDurationParam) === this.durationSeconds
      button.classList.toggle("bg-teal-300", active)
      button.classList.toggle("text-slate-950", active)
      button.classList.toggle("border-teal-300", active)
    })
  }

  get currentExcerpt() {
    return this.excerptsValue[this.excerptIndex]
  }
}
