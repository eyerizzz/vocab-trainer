import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWordForm } from '../src/client/components/WordForm.js';

test('renders editable multi-line Chinese meaning draft', () => {
  const html = renderWordForm({
    english: 'phenomenon',
    chinese: 'n. 现象；杰出的人\nv. 发生',
    partOfSpeech: 'noun'
  });

  assert.match(html, /<textarea name="chinese"/);
  assert.match(html, /n\. 现象；杰出的人\nv\. 发生/);
  assert.match(html, /type="checkbox" name="partOfSpeech" value="noun" checked/);
});

test('renders blank add form without preselected part of speech', () => {
  const html = renderWordForm();

  assert.doesNotMatch(html, /name="partOfSpeech" value="noun" checked/);
  assert.doesNotMatch(html, /name="partOfSpeech" value="verb" checked/);
  assert.doesNotMatch(html, /name="partOfSpeech" value="adjective" checked/);
});

test('renders multiple selected parts of speech', () => {
  const html = renderWordForm({
    english: 'alarm',
    chinese: 'adj. 令人担忧的\nv. 使不安',
    partOfSpeech: ['adjective', 'verb']
  });

  assert.match(html, /value="adjective" checked/);
  assert.match(html, /value="verb" checked/);
  assert.doesNotMatch(html, /value="noun" checked/);
});
