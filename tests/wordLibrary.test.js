import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWordLibrary } from '../src/client/components/WordLibrary.js';

const words = [
  {
    id: 'word_apple',
    english: 'apple',
    meanings: [
      {
        id: 'meaning_apple',
        partOfSpeech: 'noun',
        chinese: '苹果',
        spellingErrorCount: 1,
        skipCount: 0,
        errorCount: 1
      }
    ]
  },
  {
    id: 'word_record',
    english: 'record',
    meanings: [
      {
        id: 'meaning_record',
        partOfSpeech: 'verb',
        chinese: '记录；录制',
        spellingErrorCount: 2,
        skipCount: 1,
        errorCount: 3
      }
    ]
  }
];

test('filters word library by English and renders suggestions', () => {
  const html = renderWordLibrary(words, null, 'default', 'app');

  assert.match(html, /value="app"/);
  assert.match(html, /<option value="apple"><\/option>/);
  assert.match(html, /apple/);
  assert.doesNotMatch(html, /record/);
});

test('filters English search by word prefix only', () => {
  const html = renderWordLibrary([
    {
      id: 'word_robust',
      english: 'robust',
      meanings: [
        { id: 'meaning_robust', partOfSpeech: 'adjective', chinese: '稳健的' }
      ]
    },
    {
      id: 'word_chronic',
      english: 'chronic',
      meanings: [
        { id: 'meaning_chronic', partOfSpeech: 'adjective', chinese: '慢性的' }
      ]
    },
    {
      id: 'word_tropical',
      english: 'tropical',
      meanings: [
        { id: 'meaning_tropical', partOfSpeech: 'adjective', chinese: '热带的' }
      ]
    }
  ], null, 'default', 'ro');

  assert.match(html, /robust/);
  assert.match(html, /<option value="robust"><\/option>/);
  assert.doesNotMatch(html, /chronic/);
  assert.doesNotMatch(html, /tropical/);
});

test('filters word library by Chinese meaning', () => {
  const html = renderWordLibrary(words, null, 'default', '录制');

  assert.match(html, /record/);
  assert.doesNotMatch(html, /apple/);
});

test('shows only words with historical errors in frequent error mode', () => {
  const html = renderWordLibrary([
    ...words,
    {
      id: 'word_clean',
      english: 'clean',
      meanings: [
        { id: 'meaning_clean', partOfSpeech: 'adjective', chinese: '干净的', errorCount: 0 }
      ]
    }
  ], null, 'frequent-errors');

  assert.match(html, /record/);
  assert.match(html, /apple/);
  assert.match(html, /拼写错误 2 次 · 跳过 1 次/);
  assert.match(html, /拼写错误 1 次 · 跳过 0 次/);
  assert.doesNotMatch(html, /clean/);
  assert.ok(html.indexOf('record') < html.indexOf('apple'));
});

test('shows an empty state when no word has historical errors', () => {
  const html = renderWordLibrary([{
    id: 'word_clean',
    english: 'clean',
    meanings: [
      { id: 'meaning_clean', partOfSpeech: 'adjective', chinese: '干净的', errorCount: 0 }
    ]
  }], null, 'frequent-errors');

  assert.match(html, /还没有经常出错的单词。/);
  assert.doesNotMatch(html, /clean/);
});
