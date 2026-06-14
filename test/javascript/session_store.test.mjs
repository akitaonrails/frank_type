import assert from "node:assert/strict"
import test from "node:test"

import { SessionStore } from "../../app/javascript/lib/storage/session_store.js"

const STORAGE_KEY = "frank_type.sessions.v1"

test("SessionStore keeps recent sessions detailed and compacts older runs by day", () => {
  installLocalStorage()
  const recentSessions = Array.from({ length: 29 }, (_value, index) => session({ id: `recent-${index}`, day: 30 - index, wpm: 90 }))
  const olderSessions = Array.from({ length: 6 }, (_value, index) => session({ id: `older-${index}`, day: 1, wpm: 60 + index }))

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...recentSessions, ...olderSessions]))

  const sessions = SessionStore.save(session({ id: "new", day: 31, wpm: 120 }))
  const summary = sessions.at(-1)

  assert.equal(sessions.length, 31)
  assert.equal(sessions[0].id, "new")
  assert.deepEqual(sessions[0].keyEvents, [{ action: "type" }])
  assert.equal(summary.summary, true)
  assert.equal(summary.sampleCount, 6)
  assert.equal(summary.metrics.wpm, 63)
  assert.equal(summary.title, "Daily summary")
  assert.equal(summary.keyEvents, undefined)
  assert.equal(summary.characterTimings, undefined)
  assert.equal(summary.wordTimings, undefined)
  assert.equal(summary.digraphTimings, undefined)
})

test("SessionStore.all rewrites legacy oversized storage with compact summaries", () => {
  installLocalStorage()
  const sessions = Array.from({ length: 35 }, (_value, index) => session({ id: `session-${index}`, day: index < 30 ? 35 - index : 1, wpm: 80 }))
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))

  const compacted = SessionStore.all()
  const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY))

  assert.equal(compacted.length, 31)
  assert.equal(stored.length, 31)
  assert.equal(stored.at(-1).summary, true)
  assert.equal(stored.at(-1).sampleCount, 5)
})

test("SessionStore limits retained daily summaries", () => {
  installLocalStorage()
  const oldSessions = Array.from({ length: 130 }, (_value, index) => session({ id: `old-${index}`, day: index + 1, wpm: 70 }))

  const compacted = SessionStore.compact(oldSessions)

  assert.equal(compacted.length, 120)
  assert.equal(compacted.filter((storedSession) => storedSession.summary).length, 90)
})

function session({ id, day, wpm }) {
  const date = new Date(Date.UTC(2026, 5, day, 12, 0, 0))
  const finishedAt = new Date(date.getTime() + 30000)

  return {
    id,
    title: "The War of the Worlds",
    author: "H. G. Wells",
    source: "Project Gutenberg",
    startedAt: date.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationSeconds: 30,
    elapsedMs: 30000,
    metrics: {
      wpm,
      rawWpm: wpm,
      accuracy: 98,
      mistakes: 1,
      typedCharacters: 250
    },
    keyEvents: [{ action: "type" }],
    characterTimings: [{ index: 0, elapsedMs: 100 }],
    wordTimings: [{ word: "the", durationMs: 200 }],
    digraphTimings: [{ displayPair: "th", latencyMs: 120 }]
  }
}

function installLocalStorage() {
  const data = new Map()

  global.window = {
    localStorage: {
      getItem(key) {
        return data.has(key) ? data.get(key) : null
      },
      setItem(key, value) {
        data.set(key, value)
      },
      removeItem(key) {
        data.delete(key)
      }
    }
  }
}
