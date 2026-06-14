import assert from "node:assert/strict"
import test from "node:test"

import { preferredSpeedBand, randomExcerptIndex } from "../../app/javascript/lib/typing/speed_band.js"

test("preferredSpeedBand defaults new users to slow", () => {
  assert.equal(preferredSpeedBand([]), "slow")
})

test("preferredSpeedBand uses recent average WPM", () => {
  assert.equal(preferredSpeedBand([{ metrics: { wpm: 55 } }, { metrics: { wpm: 62 } }]), "slow")
  assert.equal(preferredSpeedBand([{ metrics: { wpm: 91 } }, { metrics: { wpm: 83 } }]), "medium")
  assert.equal(preferredSpeedBand([{ metrics: { wpm: 125 } }, { metrics: { wpm: 132 } }]), "fast")
})

test("randomExcerptIndex prefers the matching speed band", () => {
  const excerpts = [
    { category: "scifi", speed_band: "slow" },
    { category: "scifi", speed_band: "medium" },
    { category: "scifi", speed_band: "fast" },
    { category: "fantasy", speed_band: "fast" }
  ]

  for (let index = 0; index < 20; index += 1) {
    assert([2, 3].includes(randomExcerptIndex(excerpts, { speedBand: "fast" })))
  }
})

test("randomExcerptIndex respects category when selected", () => {
  const excerpts = [
    { category: "scifi", speed_band: "fast" },
    { category: "fantasy", speed_band: "fast" },
    { category: "fantasy", speed_band: "fast" }
  ]

  for (let index = 0; index < 20; index += 1) {
    assert([1, 2].includes(randomExcerptIndex(excerpts, { category: "fantasy", speedBand: "fast" })))
  }
})

test("randomExcerptIndex avoids the current excerpt when possible", () => {
  const excerpts = [
    { category: "scifi", speed_band: "slow" },
    { category: "scifi", speed_band: "slow" }
  ]

  for (let index = 0; index < 20; index += 1) {
    assert.equal(randomExcerptIndex(excerpts, { speedBand: "slow", except: 0 }), 1)
  }
})
