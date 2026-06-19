import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"

test("TypingSessionState excludes paused time from elapsed metrics", async () => {
  const { TypingSessionState } = await loadSessionState()
  const session = new TypingSessionState({ excerpt: excerpt("abc"), durationSeconds: 30 })

  session.type("a", 1000)
  session.pause(4000)

  withPerformanceNow(9000, () => {
    assert.equal(session.paused, true)
    assert.equal(session.elapsedMs, 3000)
  })

  session.type("b", 9000)

  assert.equal(session.paused, false)
  withPerformanceNow(9000, () => {
    assert.equal(session.elapsedMs, 3000)
  })
  withPerformanceNow(10000, () => {
    assert.equal(session.elapsedMs, 4000)
  })
  assert.equal(session.characterTimings[1].elapsedMs, 3000)
})

test("TypingSessionState resumes when backspacing after a pause", async () => {
  const { TypingSessionState } = await loadSessionState()
  const session = new TypingSessionState({ excerpt: excerpt("ab"), durationSeconds: 30 })

  session.type("a", 1000)
  session.type("b", 1500)
  session.pause(2000)
  session.backspace(7000)

  assert.equal(session.paused, false)
  assert.equal(session.cursor, 1)
  assert.equal(session.keyEvents.at(-1).action, "backspace")
  assert.equal(session.keyEvents.at(-1).elapsedMs, 1000)
})

test("TypingSessionState can delete the previous word", async () => {
  const { TypingSessionState } = await loadSessionState()
  const session = new TypingSessionState({ excerpt: excerpt("hello world again"), durationSeconds: 30 })

  typeText(session, "hello world", 1000)

  assert.equal(session.backspacePreviousWord(3000), 5)
  assert.equal(session.typedCharacters.join(""), "hello ")
  assert.equal(session.cursor, 6)
  assert.deepEqual(session.characterTimings.map((timing) => timing.index), [0, 1, 2, 3, 4, 5])
  assert.equal(session.keyEvents.filter((event) => event.action === "backspace").length, 5)
})

test("TypingSessionState deletes the previous word from target text boundaries", async () => {
  const { TypingSessionState } = await loadSessionState()
  const session = new TypingSessionState({ excerpt: excerpt("hello world"), durationSeconds: 30 })

  typeText(session, "helloxworld", 1000)

  assert.equal(session.backspacePreviousWord(3000), 5)
  assert.equal(session.typedCharacters.join(""), "hellox")
  assert.deepEqual(session.characterTimings.map((timing) => timing.index), [0, 1, 2, 3, 4, 5])
})

test("TypingSessionState can delete to a target index", async () => {
  const { TypingSessionState } = await loadSessionState()
  const session = new TypingSessionState({ excerpt: excerpt("hello world"), durationSeconds: 30 })

  typeText(session, "hello world", 1000)

  assert.equal(session.backspaceToIndex(6, 3000), 5)
  assert.equal(session.typedCharacters.join(""), "hello ")
  assert.equal(session.cursor, 6)
  assert.deepEqual(session.characterTimings.map((timing) => timing.index), [0, 1, 2, 3, 4, 5])
  assert.equal(session.keyEvents.filter((event) => event.action === "backspace").length, 5)
})

test("TypingSessionState freezes remaining seconds while paused", async () => {
  const { TypingSessionState } = await loadSessionState()
  const session = new TypingSessionState({ excerpt: excerpt("abc"), durationSeconds: 10 })

  session.type("a", 1000)
  session.pause(4000)

  withPerformanceNow(24000, () => {
    assert.equal(session.remainingSeconds, 7)
  })

  session.resume(24000)
  withPerformanceNow(24000, () => {
    assert.equal(session.remainingSeconds, 7)
  })
})

test("TypingSessionState requires exact accented characters", async () => {
  const { TypingSessionState } = await loadSessionState()
  const session = new TypingSessionState({ excerpt: excerpt("ç"), durationSeconds: 30 })

  session.type("c", 1000)

  assert.equal(session.correctCharacters, 0)
  assert.equal(session.keyEvents.at(-1).correct, false)

  const accentedSession = new TypingSessionState({ excerpt: excerpt("ç"), durationSeconds: 30 })
  accentedSession.type("c\u0327", 1000)

  assert.equal(accentedSession.correctCharacters, 1)
  assert.equal(accentedSession.keyEvents.at(-1).actual, "ç")
  assert.equal(accentedSession.keyEvents.at(-1).correct, true)
})

function excerpt(normalizedText) {
  return {
    id: "test-excerpt",
    title: "Test excerpt",
    author: "Test author",
    source: "Test source",
    normalized_text: normalizedText
  }
}

function typeText(session, text, firstTimestamp) {
  ;[...text].forEach((character, index) => {
    session.type(character, firstTimestamp + (index * 100))
  })
}

async function loadSessionState() {
  const sourcePath = new URL("../../app/javascript/lib/typing/session_state.js", import.meta.url)
  const metricsPath = new URL("../../app/javascript/lib/typing/metrics.js", import.meta.url)
  const deletionPath = new URL("../../app/javascript/lib/typing/deletion.js", import.meta.url)
  const source = await readFile(sourcePath, "utf8")
  const tempDirectory = await mkdtemp(join(tmpdir(), "frank-type-session-state-"))
  const modulePath = join(tempDirectory, "session_state.mjs")
  const rewrittenSource = source
    .replace('from "lib/typing/metrics"', `from ${JSON.stringify(metricsPath.href)}`)
    .replace('from "lib/typing/deletion"', `from ${JSON.stringify(deletionPath.href)}`)

  await writeFile(modulePath, rewrittenSource)

  try {
    return await import(pathToFileURL(modulePath).href)
  } finally {
    await rm(tempDirectory, { force: true, recursive: true })
  }
}

function withPerformanceNow(now, callback) {
  const originalPerformance = globalThis.performance
  globalThis.performance = { now: () => now }

  try {
    callback()
  } finally {
    globalThis.performance = originalPerformance
  }
}
