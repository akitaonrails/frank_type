const ACTIONABLE_PAIR_LIMIT = 3
const MAX_HEATED_SAMPLE_LIMIT = 18
const MAX_HEATED_SAMPLE_RATIO = 0.08
const MIN_HEATED_SAMPLE_LIMIT = 3

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

export function summarizeDigraphs({ characterTimings = [], keyEvents = [], minLatencyMs = 30, maxLatencyMs = 1200 } = {}) {
  const backspaces = keyEvents.filter((event) => event.action === "backspace")
  const samples = []

  for (let index = 1; index < characterTimings.length; index += 1) {
    const previous = characterTimings[index - 1]
    const current = characterTimings[index]

    if (current.index !== previous.index + 1) continue
    if (!previous.correct || !current.correct) continue

    const latencyMs = current.elapsedMs - previous.elapsedMs
    if (latencyMs < minLatencyMs || latencyMs > maxLatencyMs) continue
    if (hasCorrectionBetween(backspaces, previous.elapsedMs, current.elapsedMs)) continue

    samples.push({
      pair: `${previous.expected}${current.expected}`,
      displayPair: displayPair(`${previous.expected}${current.expected}`),
      startIndex: previous.index,
      endIndex: current.index,
      latencyMs
    })
  }

  const latencies = samples.map((sample) => sample.latencyMs).sort((left, right) => left - right)
  const baseline = median(latencies)
  const actionablePairs = rankPairs(samples)
    .filter((pair) => pair.medianLatencyMs > baseline)
    .slice(0, ACTIONABLE_PAIR_LIMIT)
  const actionablePairMap = new Map(actionablePairs.map((pair) => [pair.pair, pair]))
  const heatableSamples = selectHeatableSamples({ actionablePairMap, baseline, samples })
  const actionableGains = [...heatableSamples]
    .map((sample) => sample.latencyMs - baseline)
    .sort((left, right) => left - right)
  const lowGain = Math.max(percentile(actionableGains, 0.25), 1)
  const highGain = Math.max(percentile(actionableGains, 0.95), lowGain + 1)
  const heatedSamples = samples.map((sample) => ({
    ...sample,
    heat: heatForSample({ baseline, heatableSamples, highGain, lowGain, sample })
  }))

  return {
    samples: heatedSamples,
    rankedPairs: rankPairs(heatedSamples),
    medianLatencyMs: baseline
  }
}

function selectHeatableSamples({ actionablePairMap, baseline, samples }) {
  const limit = Math.min(
    MAX_HEATED_SAMPLE_LIMIT,
    Math.max(MIN_HEATED_SAMPLE_LIMIT, Math.floor(samples.length * MAX_HEATED_SAMPLE_RATIO))
  )

  return new Set(samples
    .filter((sample) => actionablePairMap.has(sample.pair))
    .filter((sample) => sample.latencyMs >= actionablePairMap.get(sample.pair).medianLatencyMs)
    .filter((sample) => sample.latencyMs > baseline)
    .sort((left, right) => (right.latencyMs - baseline) - (left.latencyMs - baseline))
    .slice(0, limit))
}

function heatForSample({ baseline, heatableSamples, highGain, lowGain, sample }) {
  if (!heatableSamples.has(sample)) return 0

  const gain = sample.latencyMs - baseline
  return 0.35 + (clamp((gain - lowGain) / (highGain - lowGain)) * 0.65)
}

export function displayPair(pair) {
  return pair.replaceAll(" ", "␠")
}

function rankPairs(samples) {
  const groups = new Map()

  samples.forEach((sample) => {
    if (!groups.has(sample.pair)) groups.set(sample.pair, [])
    groups.get(sample.pair).push(sample)
  })

  return [...groups.entries()]
    .map(([pair, pairSamples]) => {
      const latencies = pairSamples.map((sample) => sample.latencyMs).sort((left, right) => left - right)

      return {
        pair,
        displayPair: displayPair(pair),
        count: pairSamples.length,
        medianLatencyMs: median(latencies),
        maxLatencyMs: Math.max(...latencies),
        heat: Math.max(...pairSamples.map((sample) => sample.heat || 0))
      }
    })
    .sort((left, right) => right.medianLatencyMs - left.medianLatencyMs || right.count - left.count)
}

function hasCorrectionBetween(backspaces, previousElapsedMs, currentElapsedMs) {
  return backspaces.some((event) => event.elapsedMs > previousElapsedMs && event.elapsedMs < currentElapsedMs)
}

function median(values) {
  if (values.length === 0) return 0

  const middle = Math.floor(values.length / 2)
  return values.length % 2 === 0 ? Math.round((values[middle - 1] + values[middle]) / 2) : values[middle]
}

function percentile(values, ratio) {
  if (values.length === 0) return 0

  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * ratio))]
}

function clamp(value) {
  return Math.max(0, Math.min(value, 1))
}
