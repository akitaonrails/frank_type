import assert from "node:assert/strict"
import test from "node:test"

import { raceProgress } from "../../app/javascript/lib/typing/race_progress.js"

test("raceProgress starts all racers at zero", () => {
  assert.deepEqual(raceProgress({ elapsedMs: 0, durationSeconds: 30, userWpm: 90 }), {
    slow: 0,
    user: 0,
    fast: 0
  })
})

test("raceProgress makes the fastest racer reach the flag at time limit", () => {
  assert.deepEqual(raceProgress({ elapsedMs: 30000, durationSeconds: 30, userWpm: 90 }), {
    slow: 0.5,
    user: 0.75,
    fast: 1
  })
})

test("raceProgress lets the user win if their WPM is highest", () => {
  assert.deepEqual(raceProgress({ elapsedMs: 60000, durationSeconds: 60, userWpm: 150 }), {
    slow: 0.4,
    user: 1,
    fast: 0.8
  })
})

test("raceProgress is capped by elapsed duration", () => {
  assert.deepEqual(raceProgress({ elapsedMs: 90000, durationSeconds: 30, userWpm: 90 }), {
    slow: 0.5,
    user: 0.75,
    fast: 1
  })
})
