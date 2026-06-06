import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQuizState,
  getAccuracy,
  hasWrongQuestion,
  recordAnswer,
  recordSeenWord,
  recordWrongQuestion,
  resetQuizProgress,
  startWrongQuestionReview
} from '../src/client/state.js';

test('starts quiz progress at zero accuracy', () => {
  const quizState = createQuizState();

  assert.equal(quizState.mode, 'zh-to-en');
  assert.equal(quizState.started, false);
  assert.equal(quizState.currentWrongAttempts, 0);
  assert.deepEqual(quizState.seenWordIds, []);
  assert.equal(quizState.total, 0);
  assert.equal(quizState.correct, 0);
  assert.equal(getAccuracy(quizState), 0);
});

test('records wrong questions once and starts review queue', () => {
  const quizState = createQuizState();
  const question = {
    wordId: 'word_1',
    meaningId: 'meaning_1',
    mode: 'zh-to-en',
    prompt: '苹果'
  };

  assert.equal(recordWrongQuestion(quizState, { question, submittedAnswer: 'aple' }), true);
  assert.equal(recordWrongQuestion(quizState, { question, submittedAnswer: 'applee' }), false);
  startWrongQuestionReview(quizState);

  assert.equal(quizState.wrongQuestions.length, 1);
  assert.equal(hasWrongQuestion(quizState, question), true);
  assert.equal(quizState.reviewMode, true);
  assert.equal(quizState.started, true);
  assert.deepEqual(quizState.reviewQueue, [question]);
});

test('records seen words once per round', () => {
  const quizState = createQuizState();

  recordSeenWord(quizState, ' word_1 ');
  recordSeenWord(quizState, 'word_1');
  recordSeenWord(quizState, 'word_2');

  assert.deepEqual(quizState.seenWordIds, ['word_1', 'word_2']);
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
    currentWrongAttempts: 1,
    answeredCurrent: true,
    started: true,
    seenWordIds: ['word_1'],
    total: 4,
    correct: 3
  };

  resetQuizProgress(quizState);

  assert.equal(quizState.mode, 'zh-to-en');
  assert.equal(quizState.range, 'recent');
  assert.equal(quizState.days, 30);
  assert.equal(quizState.currentQuestion, null);
  assert.equal(quizState.currentWrongAttempts, 0);
  assert.equal(quizState.answeredCurrent, false);
  assert.equal(quizState.started, false);
  assert.deepEqual(quizState.seenWordIds, []);
  assert.equal(quizState.total, 0);
  assert.equal(quizState.correct, 0);
  assert.equal(getAccuracy(quizState), 0);
});
