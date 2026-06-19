export function committedTextFromBeforeInput(event) {
  if (event.isComposing) return ""
  if (!typedInputType(event.inputType)) return ""

  return normalizeTypedText(event.data || "")
}

export function committedTextFromInput(event, inputSink) {
  if (event.isComposing) return ""
  if (!typedInputType(event.inputType)) return ""

  return normalizeTypedText(event.data || inputSink?.value || "")
}

export function shouldClearInputSinkAfterInput(event) {
  return !event.isComposing
}

export function bulkInputEvent(event) {
  return ["insertFromPaste", "insertFromDrop", "insertReplacementText"].includes(event.inputType)
}

export function unsupportedInputEvent(event) {
  return Boolean(event.inputType) && !typedInputType(event.inputType) && !bulkInputEvent(event)
}

export function clearInputSink(inputSink) {
  if (inputSink) inputSink.value = ""
}

export function typedInputType(inputType) {
  return ["insertText", "insertCompositionText"].includes(inputType)
}

function normalizeTypedText(text) {
  return text.normalize("NFC").toLowerCase().replace(/[\r\n\t]/g, "")
}
