import { Controller } from "@hotwired/stimulus"
import { raceProgress } from "lib/typing/race_progress"
import { TypingSessionState } from "lib/typing/session_state"
import { preferredSpeedBand, randomExcerptIndex } from "lib/typing/speed_band"
import { SessionStore } from "lib/storage/session_store"

export default class extends Controller {
  static values = {
    excerpts: Array
  }

  static targets = [
    "accuracy",
    "categoryButton",
    "durationButton",
    "fastRacer",
    "helpOverlay",
    "progress",
    "results",
    "resultSummary",
    "source",
    "slowRacer",
    "stateLabel",
    "text",
    "textScroller",
    "timeLeft",
    "typingSurface",
    "userRacer",
    "wpm"
  ]

  connect() {
    this.durationSeconds = 30
    this.selectedCategory = "random"
    this.excerptIndex = this.randomCompatibleExcerptIndex()
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

  setCategory(event) {
    this.selectedCategory = event.params.category
    this.excerptIndex = this.randomCompatibleExcerptIndex({ except: this.excerptIndex })
    this.updateCategoryButtons()
    this.resetSession()
  }

  keydown(event) {
    if (["?", "Escape", "Tab"].includes(event.key)) {
      event.preventDefault()
      return
    }

    if (event.ctrlKey || event.metaKey) {
      return
    }

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
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      if (this.helpIsOpen()) {
        this.closeHelp()
      } else {
        this.resetSession()
      }
      return
    }

    if (event.key === "Tab") {
      event.preventDefault()
      if (!this.helpIsOpen()) this.nextExcerpt()
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

  helpIsOpen() {
    return !this.helpOverlayTarget.classList.contains("hidden")
  }

  closeHelpFromBackdrop(event) {
    if (event.target !== event.currentTarget) return

    this.closeHelp()
  }

  resetSession() {
    this.stopTicker()
    this.resultsTarget.classList.add("hidden")
    this.session = new TypingSessionState({ excerpt: this.currentExcerpt, durationSeconds: this.durationSeconds })
    this.updateDurationButtons()
    this.updateCategoryButtons()
    this.render()
    this.focus()
  }

  nextExcerpt() {
    this.excerptIndex = this.randomCompatibleExcerptIndex({ except: this.excerptIndex })
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
    this.scrollCursorIntoView()
    this.renderRaceTrack(metrics)
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
      if (index === this.session.cursor) span.dataset.current = "true"
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
      button.classList.toggle("choice-pill-active", active)
    })
  }

  updateCategoryButtons() {
    this.categoryButtonTargets.forEach((button) => {
      const active = button.dataset.typingCategoryParam === this.selectedCategory
      button.classList.toggle("choice-pill-active", active)
    })
  }

  renderRaceTrack(metrics) {
    const progress = raceProgress({
      elapsedMs: this.session.elapsedMs,
      durationSeconds: this.durationSeconds,
      userWpm: metrics.wpm
    })

    this.moveRacer(this.slowRacerTarget, progress.slow)
    this.moveRacer(this.userRacerTarget, progress.user)
    this.moveRacer(this.fastRacerTarget, progress.fast)
  }

  moveRacer(racer, progress) {
    racer.style.left = `${progress * 100}%`
  }

  scrollCursorIntoView() {
    const current = this.textTarget.querySelector("[data-current='true']")
    if (!current) return

    current.scrollIntoView({ block: "nearest", inline: "nearest" })
  }

  randomCompatibleExcerptIndex({ except = null } = {}) {
    return randomExcerptIndex(this.excerptsValue, {
      category: this.selectedCategory,
      except,
      speedBand: preferredSpeedBand(SessionStore.all())
    })
  }

  get currentExcerpt() {
    return this.excerptsValue[this.excerptIndex]
  }
}
