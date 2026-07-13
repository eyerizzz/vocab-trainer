import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQuizState,
  finishWrongQuestionReview,
  getAccuracy,
  hasWrongQuestion,
  recordAnswer,
  recordSeenWord,
  recordWrongQuestion,
  resetQuizProgress,
  showWrongQuestions,
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
  assert.equal(quizState.wrongQuestionsVisible, false);
  assert.equal(quizState.wrongReviewCompleted, false);
  assert.deepEqual(quizState.reviewQueue, [question]);
});

test('shows wrong questions and completes one wrong-question review', () => {
  const quizState = createQuizState();
  const question = {
    wordId: 'word_1',
    meaningId: 'meaning_1',
    mode: 'zh-to-en',
    prompt: '苹果'
  };

  recordWrongQuestion(quizState, { question, submittedAnswer: 'aple' });
  showWrongQuestions(quizState);

  assert.equal(quizState.wrongQuestionsVisible, true);

  startWrongQuestionReview(quizState);
  finishWrongQuestionReview(quizState);

  assert.equal(quizState.started, false);
  assert.equal(quizState.ended, true);
  assert.equal(quizState.reviewMode, false);
  assert.equal(quizState.wrongQuestionsVisible, false);
  assert.equal(quizState.wrongReviewCompleted, true);
  assert.deepEqual(quizState.reviewQueue, []);
});

test('shuffles wrong-question review queue before redo', () => {
  const quizState = createQuizState();
  const questions = ['one', 'two', 'three'].map((wordId) => ({
    wordId,
    meaningId: `${wordId}_meaning`,
    mode: 'zh-to-en',
    prompt: wordId
  }));

  questions.forEach((question) => {
    recordWrongQuestion(quizState, { question });
  });
  startWrongQuestionReview(quizState, () => 0);

  assert.deepEqual(quizState.reviewQueue.map((question) => question.wordId), ['two', 'three', 'one']);
});

test('records seen words once per round', () => {
  const quizState = createQuizState();

  recordSeenWord(quizState, ' word_1 ');
  recordSeenWord(quizState, 'word_1');
  recordSeenWord(quizState, 'word_2');

  assert.deepEqual(quizState.seenWordIds, ['word_1', 'word_2']);
});

test('records completed question outcomes for accuracy', () => {
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
    wrongQuestionsVisible: true,
    wrongReviewCompleted: true,
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
  assert.equal(quizState.wrongQuestionsVisible, false);
  assert.equal(quizState.wrongReviewCompleted, false);
  assert.deepEqual(quizState.seenWordIds, []);
  assert.equal(quizState.total, 0);
  assert.equal(quizState.correct, 0);
  assert.equal(getAccuracy(quizState), 0);
});
