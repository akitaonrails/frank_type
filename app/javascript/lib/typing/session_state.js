import { calculateMetrics, summarizeWords } from "lib/typing/metrics"

export class TypingSessionState {
  constructor({ excerpt, durationSeconds }) {
    this.excerpt = excerpt
    this.durationSeconds = durationSeconds
    this.targetText = excerpt.normalized_text
    this.typedCharacters = []
    this.keyEvents = []
    this.characterTimings = []
    this.startedAtEpoch = null
    this.startedAtPerformance = null
    this.finishedAtEpoch = null
  }

  get started() {
    return this.startedAtPerformance !== null
  }

  get finished() {
    return this.finishedAtEpoch !== null
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
    return Math.max(0, end - this.startedAtPerformance)
  }

  get remainingSeconds() {
    return Math.max(0, Math.ceil(this.durationSeconds - (this.elapsedMs / 1000)))
  }

  start(now = performance.now()) {
    if (this.started) return

    this.startedAtEpoch = new Date().toISOString()
    this.startedAtPerformance = now
  }

  type(character, now = performance.now()) {
    this.start(now)

    if (this.finished || this.cursor >= this.targetText.length) return

    const index = this.cursor
    const expected = this.targetText[index]
    const correct = character === expected
    const elapsedMs = Math.round(now - this.startedAtPerformance)

    this.typedCharacters.push(character)
    this.keyEvents.push({ action: "type", index, expected, actual: character, correct, elapsedMs })
    this.characterTimings.push({ index, expected, actual: character, correct, elapsedMs, wordIndex: wordIndexFor(this.targetText, index) })
  }

  backspace(now = performance.now()) {
    if (!this.started || this.finished || this.cursor === 0) return

    const index = this.cursor - 1
    const elapsedMs = Math.round(now - this.startedAtPerformance)
    this.keyEvents.push({ action: "backspace", index, elapsedMs })
    this.typedCharacters.pop()
    this.characterTimings = this.characterTimings.filter((timing) => timing.index !== index)
  }

  shouldFinish() {
    return this.remainingSeconds <= 0 || this.cursor >= this.targetText.length
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

  toResult() {
    const metrics = this.currentMetrics()

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
      wordTimings: summarizeWords({ text: this.targetText, characterTimings: this.characterTimings }),
      keyEvents: this.keyEvents
    }
  }
}

function wordIndexFor(text, characterIndex) {
  return text.slice(0, characterIndex).split(" ").length - 1
}
