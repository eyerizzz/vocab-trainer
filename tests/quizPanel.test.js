import test from 'node:test';
import assert from 'node:assert/strict';
import { renderQuizPanel } from '../src/client/components/QuizPanel.js';
import { createQuizState } from '../src/client/state.js';

const words = [{
  id: 'word_apple',
  english: 'apple',
  meanings: [{
    id: 'meaning_apple',
    partOfSpeech: 'noun',
    chinese: '苹果'
  }]
}];

test('renders library button before add-word button in quiz header', () => {
  const html = renderQuizPanel(createQuizState(), null, {
    showLibraryButton: true,
    showAddWordButton: true,
    words
  });

  assert.ok(html.indexOf('id="quiz-library-button"') < html.indexOf('id="add-word-button"'));
});

test('renders each part of speech and meaning on separate quiz lines', () => {
  const quizState = {
    ...createQuizState(),
    currentQuestion: {
      wordId: 'word_record',
      meaningId: 'meaning_record_noun',
      mode: 'zh-to-en',
      prompt: '记录',
      partOfSpeech: 'noun'
    }
  };
  const html = renderQuizPanel(quizState, null, {
    words: [{
      id: 'word_record',
      english: 'record',
      meanings: [
        { id: 'meaning_record_noun', partOfSpeech: 'noun', chinese: '记录' },
        { id: 'meaning_record_verb', partOfSpeech: 'verb', chinese: '录制' }
      ]
    }]
  });

  assert.match(html, /n\./);
  assert.match(html, /记录/);
  assert.match(html, /v\./);
  assert.match(html, /录制/);
  assert.equal((html.match(/question-meaning-line/g) || []).length, 2);
});

test('renders yesterday as a quiz range option', () => {
  const html = renderQuizPanel({ ...createQuizState(), range: 'yesterday' }, null, { words });

  assert.match(html, /value="yesterday" selected>昨天/);
});

test('does not render removed quiz range options', () => {
  const html = renderQuizPanel(createQuizState(), null, { words });

  assert.doesNotMatch(html, /近 30 天/);
  assert.doesNotMatch(html, /自定义/);
  assert.doesNotMatch(html, /quiz-days/);
});

test('renders wrong-question choices before revealing wrong words', () => {
  const quizState = {
    ...createQuizState(),
    ended: true,
    wrongQuestions: [{
      question: {
        wordId: 'word_apple',
        meaningId: 'meaning_apple',
        mode: 'zh-to-en',
        prompt: '苹果',
        partOfSpeech: 'noun'
      },
      submittedAnswer: 'aple',
      reason: 'two-wrong'
    }]
  };
  const html = renderQuizPanel(quizState, null, { words });

  assert.match(html, /本轮错题 1 道/);
  assert.match(html, /显示错题/);
  assert.match(html, /重做错题/);
  assert.doesNotMatch(html, /wrong-review-item/);
});

test('lists wrong questions after the user chooses to show them', () => {
  const quizState = {
    ...createQuizState(),
    ended: true,
    wrongQuestionsVisible: true,
    wrongQuestions: [{
      question: {
        wordId: 'word_apple',
        meaningId: 'meaning_apple',
        mode: 'zh-to-en',
        prompt: '苹果',
        partOfSpeech: 'noun'
      },
      submittedAnswer: 'aple',
      reason: 'two-wrong'
    }]
  };
  const html = renderQuizPanel(quizState, null, { words });

  assert.doesNotMatch(html, /显示错题/);
  assert.match(html, /重做错题/);
  assert.match(html, /apple/);
  assert.match(html, /苹果/);
});

test('does not offer another redo after wrong-question review is completed', () => {
  const quizState = {
    ...createQuizState(),
    ended: true,
    wrongReviewCompleted: true,
    wrongQuestions: [{
      question: {
        wordId: 'word_apple',
        meaningId: 'meaning_apple',
        mode: 'zh-to-en',
        prompt: '苹果',
        partOfSpeech: 'noun'
      }
    }]
  };
  const html = renderQuizPanel(quizState, null, { words });

  assert.doesNotMatch(html, /显示错题/);
  assert.doesNotMatch(html, /重做错题/);
});
