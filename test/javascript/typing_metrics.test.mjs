import assert from "node:assert/strict"
import test from "node:test"

import { calculateMetrics, summarizeWords } from "../../app/javascript/lib/typing/metrics.js"

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
