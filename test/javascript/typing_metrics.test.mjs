import assert from "node:assert/strict"
import test from "node:test"

import { calculateMetrics, summarizeDigraphs, summarizeWords } from "../../app/javascript/lib/typing/metrics.js"

test("calculateMetrics returns wpm accuracy and mistakes", () => {
  const metrics = calculateMetrics({
    typedEvents: [
      { action: "type", correct: true },
      { action: "type", correct: false },
      { action: "type", correct: true },
      { action: "backspace" },
      { action: "type", correct: true }
    ],
    correctCharacters: 3,
    elapsedMs: 30000,
    targetText: "test"
  })

  assert.equal(metrics.wpm, 1)
  assert.equal(metrics.rawWpm, 2)
  assert.equal(metrics.accuracy, 75)
  assert.equal(metrics.mistakes, 1)
})

test("summarizeWords groups character timings by word", () => {
  const words = summarizeWords({
    text: "one two",
    characterTimings: [
      { index: 0, correct: true, elapsedMs: 0 },
      { index: 1, correct: true, elapsedMs: 60 },
      { index: 2, correct: true, elapsedMs: 120 },
      { index: 4, correct: true, elapsedMs: 260 },
      { index: 5, correct: false, elapsedMs: 320 }
    ]
  })

  assert.deepEqual(words[0], {
    word: "one",
    wordIndex: 0,
    startIndex: 0,
    endIndex: 2,
    elapsedMs: 120,
    correct: true
  })

  assert.equal(words[1].word, "two")
  assert.equal(words[1].correct, false)
})

test("summarizeDigraphs ranks correct adjacent character pairs", () => {
  const summary = summarizeDigraphs({
    characterTimings: [
      { index: 0, expected: "t", correct: true, elapsedMs: 0 },
      { index: 1, expected: "h", correct: true, elapsedMs: 180 },
      { index: 2, expected: "e", correct: true, elapsedMs: 240 },
      { index: 3, expected: " ", correct: true, elapsedMs: 520 },
      { index: 4, expected: "m", correct: true, elapsedMs: 610 }
    ],
    keyEvents: []
  })

  assert.equal(summary.samples.length, 4)
  assert.equal(summary.rankedPairs[0].displayPair, "e␠")
  assert.equal(summary.rankedPairs[0].medianLatencyMs, 280)
  assert(summary.samples.some((sample) => sample.heat > 0))
})

test("summarizeDigraphs filters mistakes corrections and long pauses", () => {
  const summary = summarizeDigraphs({
    characterTimings: [
      { index: 0, expected: "a", correct: true, elapsedMs: 0 },
      { index: 1, expected: "b", correct: false, elapsedMs: 100 },
      { index: 2, expected: "c", correct: true, elapsedMs: 260 },
      { index: 3, expected: "d", correct: true, elapsedMs: 1900 },
      { index: 4, expected: "e", correct: true, elapsedMs: 2020 },
      { index: 5, expected: "f", correct: true, elapsedMs: 2300 }
    ],
    keyEvents: [{ action: "backspace", elapsedMs: 2100 }]
  })

  assert.deepEqual(summary.samples.map((sample) => sample.pair), ["de"])
})

test("summarizeDigraphs only heats the most actionable slow pairs", () => {
  const latencies = [40, 45, 50, 55, 60, 65, 70, 75, 160, 180, 200, 220, 240, 260, 280]
  const summary = summarizeDigraphs({ characterTimings: timingsFromLatencies(latencies), keyEvents: [] })
  const heatedSamples = summary.samples.filter((sample) => sample.heat > 0)

  assert.equal(heatedSamples.length, 3)
  assert.deepEqual(heatedSamples.map((sample) => sample.latencyMs), [240, 260, 280])
  assert(summary.samples.some((sample) => sample.latencyMs > summary.medianLatencyMs && sample.heat === 0))
})

test("summarizeDigraphs caps heat to a small fraction of long sessions", () => {
  const latencies = Array.from({ length: 80 }, (_value, index) => 50 + index * 6)
  const summary = summarizeDigraphs({ characterTimings: timingsFromLatencies(latencies), keyEvents: [] })
  const heatedSamples = summary.samples.filter((sample) => sample.heat > 0)

  assert(heatedSamples.length <= 6)
  assert(heatedSamples.length < summary.samples.length / 2)
})

function timingsFromLatencies(latencies) {
  let elapsedMs = 0
  const characters = "abcdefghijklmnopqrstuvwxyz"
  const timings = [{ index: 0, expected: characters[0], correct: true, elapsedMs }]

  latencies.forEach((latencyMs, index) => {
    elapsedMs += latencyMs
    timings.push({ index: index + 1, expected: characters[(index + 1) % characters.length], correct: true, elapsedMs })
  })

  return timings
}
