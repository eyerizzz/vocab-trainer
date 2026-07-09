import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSubmitWordFormOnEnter } from '../src/client/formShortcuts.js';

test('submits the add-word form on a plain Enter key', () => {
  assert.equal(shouldSubmitWordFormOnEnter({ key: 'Enter' }), true);
});

test('keeps modified Enter keys available for editing text', () => {
  assert.equal(shouldSubmitWordFormOnEnter({ key: 'Enter', shiftKey: true }), false);
  assert.equal(shouldSubmitWordFormOnEnter({ key: 'Enter', altKey: true }), false);
  assert.equal(shouldSubmitWordFormOnEnter({ key: 'Enter', ctrlKey: true }), false);
  assert.equal(shouldSubmitWordFormOnEnter({ key: 'Enter', metaKey: true }), false);
});

test('does not submit while the input method is composing text', () => {
  assert.equal(shouldSubmitWordFormOnEnter({ key: 'Enter', isComposing: true }), false);
});

test('ignores non-Enter keys', () => {
  assert.equal(shouldSubmitWordFormOnEnter({ key: 'a' }), false);
});
