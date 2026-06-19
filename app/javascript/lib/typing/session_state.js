import { calculateMetrics, summarizeDigraphs, summarizeWords } from "lib/typing/metrics"
import { previousWordDeletionCount } from "lib/typing/deletion"

export class TypingSessionState {
  constructor({ excerpt, durationSeconds }) {
    this.excerpt = excerpt
    this.durationSeconds = durationSeconds
    this.targetText = normalizeText(excerpt.normalized_text)
    this.typedCharacters = []
    this.keyEvents = []
    this.characterTimings = []
    this.startedAtEpoch = null
    this.startedAtPerformance = null
    this.finishedAtEpoch = null
    this.pausedMs = 0
    this.pausedAtPerformance = null
  }

  get started() {
    return this.startedAtPerformance !== null
  }

  get finished() {
    return this.finishedAtEpoch !== null
  }

  get paused() {
    return this.pausedAtPerformance !== null
  }

  get cursor() {
    return this.typedCharacters.length
  }

  get correctCharacters() {
    return this.typedCharacters.filter((actual, index) => actual === this.targetText[index]).length
  }

  get elapsedMs() {
    if (!this.started) return 0
    const end = this.finishedAtEpoch ? this.finishedAtPerformance : performance.now()
    return Math.max(0, end - this.startedAtPerformance - this.pausedSoFar(end))
  }

  get remainingSeconds() {
    return Math.max(0, Math.ceil(this.durationSeconds - (this.elapsedMs / 1000)))
  }

  pausedSoFar(now = performance.now()) {
    const ongoing = this.pausedAtPerformance !== null ? now - this.pausedAtPerformance : 0
    return this.pausedMs + ongoing
  }

  start(now = performance.now()) {
    if (this.started) return

    this.startedAtEpoch = new Date().toISOString()
    this.startedAtPerformance = now
  }

  pause(now = performance.now()) {
    if (!this.started || this.finished || this.paused) return

    this.pausedAtPerformance = now
  }

  resume(now = performance.now()) {
    if (!this.paused) return false

    this.pausedMs += now - this.pausedAtPerformance
    this.pausedAtPerformance = null
    return true
  }

  type(character, now = performance.now()) {
    this.start(now)
    this.resume(now)

    if (this.finished || this.cursor >= this.targetText.length) return

    character = normalizeText(character)
    const index = this.cursor
    const expected = this.targetText[index]
    const correct = character === expected
    const elapsedMs = Math.round(now - this.startedAtPerformance - this.pausedSoFar(now))

    this.typedCharacters.push(character)
    this.keyEvents.push({ action: "type", index, expected, actual: character, correct, elapsedMs })
    this.characterTimings.push({ index, expected, actual: character, correct, elapsedMs, wordIndex: wordIndexFor(this.targetText, index) })
  }

  backspace(now = performance.now(), count = 1) {
    if (!this.started || this.finished || this.cursor === 0 || count <= 0) return 0

    this.resume(now)
    const deletedCount = Math.min(count, this.cursor)
    const firstDeletedIndex = this.cursor - deletedCount
    const elapsedMs = Math.round(now - this.startedAtPerformance - this.pausedSoFar(now))

    for (let index = this.cursor - 1; index >= firstDeletedIndex; index -= 1) {
      this.keyEvents.push({ action: "backspace", index, elapsedMs })
    }

    this.typedCharacters.splice(firstDeletedIndex, deletedCount)
    this.characterTimings = this.characterTimings.filter((timing) => timing.index < firstDeletedIndex)

    return deletedCount
  }

  backspacePreviousWord(now = performance.now()) {
    return this.backspace(now, previousWordDeletionCount(this.targetText, this.cursor))
  }

  backspaceToIndex(index, now = performance.now()) {
    const targetIndex = Math.min(Math.max(index, 0), this.cursor)
    return this.backspace(now, this.cursor - targetIndex)
  }

  shouldFinish() {
    return this.remainingSeconds <= 0
  }

  finish(now = performance.now()) {
    if (this.finished) return this.toResult()

    this.finishedAtEpoch = new Date().toISOString()
    this.finishedAtPerformance = now
    return this.toResult()
  }

  currentMetrics() {
    return calculateMetrics({
      typedEvents: this.keyEvents,
      correctCharacters: this.correctCharacters,
      elapsedMs: this.elapsedMs,
      targetText: this.targetText
    })
  }

  digraphSummary() {
    return summarizeDigraphs({
      characterTimings: this.characterTimings,
      keyEvents: this.keyEvents
    })
  }

  toResult() {
    const metrics = this.currentMetrics()
    const digraphSummary = this.digraphSummary()

    return {
      id: crypto.randomUUID(),
      excerptId: this.excerpt.id,
      title: this.excerpt.title,
      author: this.excerpt.author,
      source: this.excerpt.source,
      startedAt: this.startedAtEpoch,
      finishedAt: this.finishedAtEpoch || new Date().toISOString(),
      durationSeconds: this.durationSeconds,
      elapsedMs: Math.round(this.elapsedMs),
      metrics,
      characterTimings: this.characterTimings,
      digraphTimings: digraphSummary.samples,
      slowPairs: digraphSummary.rankedPairs,
      wordTimings: summarizeWords({ text: this.targetText, characterTimings: this.characterTimings }),
      keyEvents: this.keyEvents
    }
  }
}

function normalizeText(text) {
  return text.normalize("NFC").toLowerCase()
}

function wordIndexFor(text, characterIndex) {
  return text.slice(0, characterIndex).split(" ").length - 1
}
