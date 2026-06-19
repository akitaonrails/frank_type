import { Controller } from "@hotwired/stimulus"
import { backwardDeletionIntent } from "lib/typing/deletion"
import { bulkInputEvent, clearInputSink, committedTextFromBeforeInput, committedTextFromInput, shouldClearInputSinkAfterInput, unsupportedInputEvent } from "lib/typing/input_events"
import { raceProgress } from "lib/typing/race_progress"
import { TypingSessionState } from "lib/typing/session_state"
import { preferredSpeedBand, randomExcerptIndex } from "lib/typing/speed_band"
import { SessionStore } from "lib/storage/session_store"

export default class extends Controller {
  static values = {
    excerpts: Array,
    i18n: Object
  }

  static targets = [
    "accuracy",
    "categoryButton",
    "durationButton",
    "fastRacer",
    "helpOverlay",
    "inputSink",
    "pausedOverlay",
    "progress",
    "results",
    "resultDetails",
    "resultWpm",
    "slowPairList",
    "slowPairPanel",
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
    this.lastScrolledLineTop = null
    this.timer = null

    this.resetSession()
    this.focus()
  }

  disconnect() {
    this.stopTicker()
  }

  focus() {
    if (this.hasInputSinkTarget) {
      this.inputSinkTarget.focus()
    } else {
      this.typingSurfaceTarget.focus()
    }
  }

  surfaceBlurred(event) {
    if (this.typingSurfaceTarget.contains(event.relatedTarget)) return
    if (!this.session.started || this.session.finished || this.session.paused) return

    this.session.pause()
    this.stopTicker()
    this.showPausedOverlay()
    this.render()
  }

  surfaceFocused() {
    const wasPaused = this.session.paused
    this.session.resume()
    this.hidePausedOverlay()

    if (!wasPaused) return

    this.startTicker()
    this.render()
    if (this.session.shouldFinish()) this.finishSession()
  }

  showPausedOverlay() {
    this.pausedOverlayTarget.classList.remove("hidden")
    this.typingSurfaceTarget.classList.add("is-paused")
  }

  hidePausedOverlay() {
    this.pausedOverlayTarget.classList.add("hidden")
    this.typingSurfaceTarget.classList.remove("is-paused")
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
      event.stopPropagation()
      this.handleControlKey(event.key)
      return
    }

    const deletionIntent = backwardDeletionIntent(event)
    if (deletionIntent) {
      event.preventDefault()
      this.backspace(deletionIntent)
      this.render()
      return
    }

  }

  beforeInput(event) {
    if (event.isComposing) return

    if (bulkInputEvent(event) || unsupportedInputEvent(event)) {
      event.preventDefault()
      clearInputSink(this.inputSinkTarget)
      return
    }

    const text = committedTextFromBeforeInput(event)
    if (!text) return
    if (!event.cancelable) return

    event.preventDefault()
    this.typeText(text)
    clearInputSink(this.inputSinkTarget)
  }

  inputChanged(event) {
    const text = committedTextFromInput(event, event.currentTarget)
    if (shouldClearInputSinkAfterInput(event)) clearInputSink(event.currentTarget)
    if (!text) return

    this.typeText(text)
  }

  blockBulkInput(event) {
    event.preventDefault()
    clearInputSink(this.inputSinkTarget)
  }

  typeText(text) {
    this.hidePausedOverlay()
    ;[...text].forEach((character) => this.session.type(character))
    this.startTicker()
    this.render()

    if (this.session.shouldFinish()) this.finishSession()
  }

  backspace(intent = "character") {
    if (intent === "start") {
      this.session.backspaceToIndex(this.currentVisualLineStartIndex())
      return
    }

    if (intent === "word") {
      this.session.backspacePreviousWord()
      return
    }

    this.session.backspace()
  }

  currentVisualLineStartIndex() {
    if (this.session.cursor === 0) return 0

    const referenceIndex = Math.min(this.session.cursor, this.session.targetText.length - 1)
    const referenceSpan = this.characterSpanForIndex(referenceIndex) || this.characterSpanForIndex(referenceIndex - 1)
    if (!referenceSpan) return 0

    const referenceTop = Math.round(referenceSpan.getBoundingClientRect().top)
    const lineSpans = [...this.textTarget.querySelectorAll("[data-character-index]")]
      .filter((span) => Math.round(span.getBoundingClientRect().top) === referenceTop)

    const firstLineIndex = Number.parseInt(lineSpans.at(0)?.dataset.characterIndex, 10)
    return Number.isFinite(firstLineIndex) ? Math.min(firstLineIndex, this.session.cursor) : 0
  }

  characterSpanForIndex(index) {
    if (index < 0) return null

    return this.textTarget.querySelector(`[data-character-index="${index}"]`)
  }

  globalKeydown(event) {
    if (event.key === "?") {
      event.preventDefault()
      this.handleControlKey(event.key)
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      this.handleControlKey(event.key)
      return
    }

    if (event.key === "Tab") {
      event.preventDefault()
      this.handleControlKey(event.key)
    }
  }

  handleControlKey(key) {
    if (key === "?") {
      this.openHelp()
      return
    }

    if (key === "Escape") {
      if (this.helpIsOpen()) {
        this.closeHelp()
      } else {
        this.resetSession()
      }
      return
    }

    if (key === "Tab" && !this.helpIsOpen()) this.nextExcerpt()
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
    this.hidePausedOverlay()
    this.resultsTarget.classList.add("hidden")
    this.session = new TypingSessionState({ excerpt: this.currentExcerpt, durationSeconds: this.durationSeconds })
    this.lastScrolledLineTop = null
    this.scrollTextToTop()
    this.updateDurationButtons()
    this.updateCategoryButtons()
    this.render()
    this.scrollTextToTop()
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
    this.hidePausedOverlay()
    const result = this.session.finish()
    SessionStore.save(result)
    this.render()
    this.scrollTextToTop({ smooth: true })
    this.resultsTarget.classList.remove("hidden")
    this.resultWpmTarget.textContent = result.metrics.wpm
    this.resultDetailsTarget.textContent = `${result.metrics.accuracy}% ${this.i18nValue.result.accuracy} · ${result.metrics.typedCharacters} ${this.i18nValue.result.keystrokes_captured}`
  }

  render() {
    const metrics = this.session.currentMetrics()

    this.wpmTarget.textContent = metrics.wpm
    this.accuracyTarget.textContent = metrics.accuracy
    this.timeLeftTarget.textContent = this.session.remainingSeconds
    this.progressTarget.textContent = `${this.session.cursor}/${this.session.targetText.length}`
    this.sourceTarget.textContent = `${this.currentExcerpt.title} · ${this.currentExcerpt.author}`
    this.stateLabelTarget.textContent = this.session.finished ? this.i18nValue.states.complete : this.session.paused ? this.i18nValue.states.paused : this.session.started ? this.i18nValue.states.typing : this.i18nValue.states.ready
    const digraphSummary = this.session.finished ? this.session.digraphSummary() : emptyDigraphSummary()
    this.textTarget.replaceChildren(...this.characterSpans(digraphSummary))
    this.renderSlowPairs(digraphSummary)
    this.scrollCursorIntoView()
    this.renderRaceTrack(metrics)
  }

  characterSpans(digraphSummary) {
    const words = []
    let word = document.createElement("span")
    word.className = "inline-flex whitespace-nowrap"
    const heatByIndex = this.heatByCharacterIndex(digraphSummary)

    ;[...this.session.targetText].forEach((expected, index) => {
      const actual = this.session.typedCharacters[index]
      const span = document.createElement("span")
      span.textContent = expected === " " ? " " : expected
      span.className = this.characterClass({ expected, actual, index })
      span.dataset.characterIndex = index
      this.applyHeat(span, heatByIndex.get(index))
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

  heatByCharacterIndex(digraphSummary) {
    const heatByIndex = new Map()

    digraphSummary.samples.forEach((sample) => {
      if (sample.heat <= 0) return

      ;[sample.startIndex, sample.endIndex].forEach((index) => {
        const current = heatByIndex.get(index)
        if (!current || sample.heat > current.heat) heatByIndex.set(index, sample)
      })
    })

    return heatByIndex
  }

  applyHeat(span, sample) {
    if (!sample) return

    const alpha = 0.1 + (sample.heat * 0.35)
    const [red, green, blue] = this.heatRgb(sample.heat)

    span.style.backgroundColor = `rgba(${red}, ${green}, ${blue}, ${alpha})`
    span.style.boxShadow = `0 0 ${Math.round(2 + sample.heat * 7)}px rgba(${red}, ${green}, ${blue}, ${alpha / 1.8})`
    span.title = `${sample.displayPair}: ${sample.latencyMs}ms`
  }

  heatRgb(heat) {
    const styles = window.getComputedStyle(document.documentElement)
    const token = heat > 0.66 ? "--color-heat-high-rgb" : heat > 0.33 ? "--color-heat-mid-rgb" : "--color-heat-low-rgb"
    const rgb = styles.getPropertyValue(token).trim().split(/\s+/).map((value) => Number.parseInt(value, 10))
    return rgb.length === 3 && rgb.every(Number.isFinite) ? rgb : [251, 191, 36]
  }

  characterClass({ expected, actual, index }) {
    const base = "relative inline-block rounded px-px transition-colors "
    const spacing = expected === " " ? "w-[0.65ch] " : ""
    if (index === this.session.cursor && !this.session.finished) return `${base}${spacing}char-current after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-full after:rounded-full`
    if (actual === undefined) return `${base}${spacing}char-untyped`
    if (actual === expected) return `${base}${spacing}char-correct`
    return `${base}${spacing}char-mistake`
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

  renderSlowPairs(digraphSummary) {
    const rankedPairs = digraphSummary.rankedPairs
      .filter((pair) => pair.heat > 0)
      .slice(0, 5)

    this.slowPairPanelTarget.classList.toggle("hidden", rankedPairs.length === 0)
    this.slowPairListTarget.replaceChildren(...rankedPairs.map((pair) => this.slowPairElement(pair, digraphSummary.medianLatencyMs)))
  }

  slowPairElement(pair, baselineMs) {
    const element = document.createElement("span")
    element.className = "slow-pair-chip"
    element.textContent = `${pair.displayPair} ${pair.medianLatencyMs}ms`
    const sampleLabel = pair.count === 1 ? this.i18nValue.slow_pair.sample : this.i18nValue.slow_pair.samples
    element.title = `${pair.displayPair}: ${this.i18nValue.slow_pair.median} ${pair.medianLatencyMs}ms, ${pair.count} ${sampleLabel}, ${Math.max(0, pair.medianLatencyMs - baselineMs)}ms ${this.i18nValue.slow_pair.over_session_median}`
    return element
  }

  moveRacer(racer, progress) {
    racer.style.left = `calc(3.5rem + ${progress * 100}% - ${progress * 5.25}rem)`
  }

  scrollCursorIntoView() {
    if (this.session.finished) return

    const current = this.textTarget.querySelector("[data-current='true']")
    if (!current) return

    const scroller = this.textScrollerTarget
    const currentLineTop = current.offsetTop
    const currentLineBottom = currentLineTop + current.offsetHeight
    const halfwayPoint = scroller.scrollTop + (scroller.clientHeight / 2)

    if (currentLineBottom <= halfwayPoint) return
    if (this.lastScrolledLineTop === currentLineTop) return

    this.lastScrolledLineTop = currentLineTop
    scroller.scrollBy({ top: this.lineScrollAmount(), behavior: "smooth" })
  }

  scrollTextToTop({ smooth = false } = {}) {
    const scroller = this.textScrollerTarget

    if (smooth) {
      scroller.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    const previousScrollBehavior = scroller.style.scrollBehavior
    scroller.style.scrollBehavior = "auto"
    scroller.scrollTop = 0
    scroller.style.scrollBehavior = previousScrollBehavior
  }

  lineScrollAmount() {
    const computedStyle = window.getComputedStyle(this.textTarget)
    const lineHeight = Number.parseFloat(computedStyle.lineHeight)
    return Number.isFinite(lineHeight) ? lineHeight : 48
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

function emptyDigraphSummary() {
  return {
    samples: [],
    rankedPairs: [],
    medianLatencyMs: 0
  }
}
