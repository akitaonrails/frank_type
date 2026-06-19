import assert from "node:assert/strict"
import test from "node:test"

import { bulkInputEvent, clearInputSink, committedTextFromBeforeInput, committedTextFromInput, shouldClearInputSinkAfterInput, unsupportedInputEvent } from "../../app/javascript/lib/typing/input_events.js"

test("committed beforeinput text accepts accented characters", () => {
  assert.equal(committedTextFromBeforeInput({ inputType: "insertText", data: "cafe\u0301", isComposing: false }), "café")
  assert.equal(committedTextFromBeforeInput({ inputType: "insertText", data: "Ç", isComposing: false }), "ç")
})

test("beforeinput ignores dead key and composition starter events", () => {
  assert.equal(committedTextFromBeforeInput({ inputType: "insertText", data: "", isComposing: false }), "")
  assert.equal(committedTextFromBeforeInput({ inputType: "insertCompositionText", data: "~", isComposing: true }), "")
})

test("committed beforeinput text accepts final composition text", () => {
  assert.equal(committedTextFromBeforeInput({ inputType: "insertCompositionText", data: "ã", isComposing: false }), "ã")
})

test("bulk input events are blocked as typing input", () => {
  assert.equal(bulkInputEvent({ inputType: "insertFromPaste" }), true)
  assert.equal(bulkInputEvent({ inputType: "insertFromDrop" }), true)
  assert.equal(bulkInputEvent({ inputType: "insertReplacementText" }), true)
  assert.equal(committedTextFromBeforeInput({ inputType: "insertFromPaste", data: "pasted", isComposing: false }), "")
})

test("unsupported input events are blocked as typing input", () => {
  assert.equal(unsupportedInputEvent({ inputType: "insertLineBreak" }), true)
  assert.equal(unsupportedInputEvent({ inputType: "deleteContentBackward" }), true)
  assert.equal(unsupportedInputEvent({ inputType: "insertText" }), false)
})

test("input fallback only accepts committed text input events", () => {
  assert.equal(committedTextFromInput({ inputType: "insertText", data: "é", isComposing: false }, { value: "" }), "é")
  assert.equal(committedTextFromInput({ inputType: "insertCompositionText", data: "ã", isComposing: false }, { value: "" }), "ã")
  assert.equal(committedTextFromInput({ inputType: "insertCompositionText", data: "~", isComposing: true }, { value: "~" }), "")
  assert.equal(committedTextFromInput({ inputType: "insertLineBreak", data: null, isComposing: false }, { value: "\n" }), "")
  assert.equal(committedTextFromInput({ inputType: "insertFromPaste", data: "pasted", isComposing: false }, { value: "pasted" }), "")
})

test("input sink is not cleared during active composition", () => {
  assert.equal(shouldClearInputSinkAfterInput({ isComposing: true }), false)
  assert.equal(shouldClearInputSinkAfterInput({ isComposing: false }), true)
})

test("input sink fallback reads normalized committed text and clears state", () => {
  const sink = { value: "A\u0303" }

  assert.equal(committedTextFromInput({ inputType: "insertText", data: null, isComposing: false }, sink), "ã")
  clearInputSink(sink)
  assert.equal(sink.value, "")
})
