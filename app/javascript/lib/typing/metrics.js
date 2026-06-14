export function calculateMetrics({ typedEvents = [], correctCharacters = 0, elapsedMs = 0, targetText = "" }) {
  const typedCharacters = typedEvents.filter((event) => event.action === "type").length
  const mistakes = typedEvents.filter((event) => event.action === "type" && !event.correct).length
  const minutes = Math.max(elapsedMs / 60000, 1 / 60000)

  return {
    wpm: Math.round((correctCharacters / 5) / minutes),
    rawWpm: Math.round((typedCharacters / 5) / minutes),
    accuracy: typedCharacters === 0 ? 100 : Math.max(0, Math.round(((typedCharacters - mistakes) / typedCharacters) * 100)),
    typedCharacters,
    correctCharacters,
    mistakes,
    completion: targetText.length === 0 ? 0 : Math.round((correctCharacters / targetText.length) * 100)
  }
}

export function summarizeWords({ text, characterTimings }) {
  const words = text.split(" ")
  const summaries = []
  let cursor = 0

  words.forEach((word, wordIndex) => {
    const startIndex = cursor
    const endIndex = cursor + word.length - 1
    const timings = characterTimings.filter((timing) => timing.index >= startIndex && timing.index <= endIndex)
    const first = timings.at(0)
    const last = timings.at(-1)

    summaries.push({
      word,
      wordIndex,
      startIndex,
      endIndex,
      elapsedMs: first && last ? Math.round(last.elapsedMs - first.elapsedMs) : null,
      correct: timings.length === word.length && timings.every((timing) => timing.correct)
    })

    cursor += word.length + 1
  })

  return summaries
}
