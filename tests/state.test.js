import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQuizState,
  getAccuracy,
  recordAnswer,
  resetQuizProgress
} from '../src/client/state.js';

test('starts quiz progress at zero accuracy', () => {
  const quizState = createQuizState();

  assert.equal(quizState.total, 0);
  assert.equal(quizState.correct, 0);
  assert.equal(getAccuracy(quizState), 0);
});

test('records correct and incorrect answers for accuracy', () => {
  const quizState = createQuizState();

  recordAnswer(quizState, true);
  recordAnswer(quizState, false);
  recordAnswer(quizState, true);

  assert.equal(quizState.total, 3);
  assert.equal(quizState.correct, 2);
  assert.equal(getAccuracy(quizState), 67);
});

test('resets quiz progress without changing selected controls', () => {
  const quizState = {
    ...createQuizState(),
    mode: 'zh-to-en',
    range: 'recent',
    days: 30,
    currentQuestion: { wordId: 'word_1' },
    answeredCurrent: true,
    total: 4,
    correct: 3
  };

  resetQuizProgress(quizState);

  assert.equal(quizState.mode, 'zh-to-en');
  assert.equal(quizState.range, 'recent');
  assert.equal(quizState.days, 30);
  assert.equal(quizState.currentQuestion, null);
  assert.equal(quizState.answeredCurrent, false);
  assert.equal(quizState.total, 0);
  assert.equal(quizState.correct, 0);
  assert.equal(getAccuracy(quizState), 0);
});
