import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuestion,
  checkAnswer,
  filterWordsByRange,
  getRangeStart,
  pickRandomQuestion
} from '../src/server/services/quizService.js';

const fixedNow = new Date('2026-06-03T20:00:00.000Z');

const words = [
  {
    id: 'word_old',
    english: 'ancient',
    meanings: [
      { id: 'meaning_old_adj', chinese: '古老的', partOfSpeech: 'adjective' }
    ],
    createdAt: '2026-05-01T00:00:00.000Z'
  },
  {
    id: 'word_week',
    english: 'apple',
    meanings: [
      { id: 'meaning_week_noun', chinese: '苹果', partOfSpeech: 'noun' }
    ],
    createdAt: '2026-06-01T10:00:00.000Z'
  },
  {
    id: 'word_today',
    english: 'run',
    meanings: [
      { id: 'meaning_today_verb', chinese: '跑', partOfSpeech: 'verb' },
      { id: 'meaning_today_noun', chinese: '奔跑', partOfSpeech: 'noun' }
    ],
    createdAt: '2026-06-03T08:00:00.000Z'
  },
  {
    id: 'word_bad_date',
    english: 'drift',
    meanings: [
      { id: 'meaning_bad_date_verb', chinese: '漂移', partOfSpeech: 'verb' }
    ],
    createdAt: 'not-a-date'
  }
];

test('filters words by all, today, and recent ranges', () => {
  assert.equal(filterWordsByRange(words, { range: 'all' }, fixedNow).length, 4);

  const today = filterWordsByRange(words, { range: 'today' }, fixedNow);
  assert.deepEqual(today.map((word) => word.id), ['word_today']);

  const recentSeven = filterWordsByRange(words, { range: 'recent', days: 7 }, fixedNow);
  assert.deepEqual(recentSeven.map((word) => word.id), ['word_week', 'word_today']);
});

test('includes words created exactly at the selected range start', () => {
  const rangeStart = getRangeStart('recent', 2, fixedNow).toISOString();
  const rangeWords = [
    ...words,
    {
      id: 'word_range_start',
      english: 'edge',
      meanings: [
        { id: 'meaning_range_start_noun', chinese: '边缘', partOfSpeech: 'noun' }
      ],
      createdAt: rangeStart
    }
  ];

  const filtered = filterWordsByRange(rangeWords, { range: 'recent', days: 2 }, fixedNow);

  assert.ok(filtered.some((word) => word.id === 'word_range_start'));
});

test('returns empty state when selected range has no words', () => {
  const result = pickRandomQuestion(
    [words[0]],
    { mode: 'en-to-zh', range: 'today' },
    () => 0,
    fixedNow
  );

  assert.equal(result.empty, true);
  assert.equal(result.message, '当前范围没有可测试单词');
});

test('keeps random selection inside the available pool', () => {
  const first = pickRandomQuestion(words, { mode: 'en-to-zh', range: 'all' }, () => -0.5, fixedNow);
  const last = pickRandomQuestion(words, { mode: 'en-to-zh', range: 'all' }, () => 1, fixedNow);

  assert.equal(first.question.wordId, 'word_old');
  assert.equal(last.question.wordId, 'word_bad_date');
  assert.equal(last.poolSize, 4);
});

test('builds questions for both quiz modes', () => {
  const enToZh = pickRandomQuestion(words, { mode: 'en-to-zh', range: 'all' }, () => 0, fixedNow);
  const zhToEn = pickRandomQuestion(words, { mode: 'zh-to-en', range: 'all' }, () => 0, fixedNow);

  assert.equal(enToZh.question.prompt, 'ancient');
  assert.equal(enToZh.question.english, 'ancient');
  assert.equal(enToZh.question.answerLanguage, '中文释义');
  assert.equal(enToZh.question.meaningId, 'meaning_old_adj');
  assert.equal(zhToEn.question.prompt, '古老的');
  assert.equal(zhToEn.question.english, 'ancient');
  assert.equal(zhToEn.question.answerLanguage, '英文单词');
});

test('can build a question for a selected meaning under one word', () => {
  const result = pickRandomQuestion(words, { mode: 'en-to-zh', range: 'today' }, () => 0.75, fixedNow);

  assert.equal(result.question.wordId, 'word_today');
  assert.equal(result.question.meaningId, 'meaning_today_noun');
  assert.equal(result.question.partOfSpeech, 'noun');
});

test('prioritizes meanings with higher cumulative error count', () => {
  const weightedWords = [{
    id: 'word_weighted',
    english: 'record',
    meanings: [
      { id: 'meaning_low', chinese: '记录', partOfSpeech: 'noun', errorCount: 0 },
      { id: 'meaning_high', chinese: '录制', partOfSpeech: 'verb', errorCount: 4 }
    ],
    createdAt: fixedNow.toISOString()
  }];
  const result = pickRandomQuestion(weightedWords, { mode: 'zh-to-en', range: 'all' }, () => 0.4, fixedNow);

  assert.equal(result.question.meaningId, 'meaning_high');
});

test('checks answers with mode-specific normalization', () => {
  const englishAnswer = checkAnswer(words, {
    wordId: 'word_week',
    meaningId: 'meaning_week_noun',
    mode: 'zh-to-en',
    answer: ' APPLE '
  });
  const chineseAnswer = checkAnswer(words, {
    wordId: 'word_week',
    meaningId: 'meaning_week_noun',
    mode: 'en-to-zh',
    answer: ' 苹果 '
  });
  const wrongChineseAnswer = checkAnswer(words, {
    wordId: 'word_week',
    meaningId: 'meaning_week_noun',
    mode: 'en-to-zh',
    answer: '水果'
  });

  assert.equal(englishAnswer.correct, true);
  assert.equal(chineseAnswer.correct, true);
  assert.equal(wrongChineseAnswer.correct, false);
  assert.equal(wrongChineseAnswer.correctAnswer, '苹果');
});

test('trims word id and returns the checked word details', () => {
  const result = checkAnswer(words, {
    wordId: ' word_today ',
    meaningId: 'meaning_today_verb',
    mode: 'en-to-zh',
    answer: '跑'
  });

  assert.equal(result.correct, true);
  assert.deepEqual(result.word, words[2]);
  assert.equal(result.meaning.id, 'meaning_today_verb');
});

test('rejects invalid custom day values', () => {
  assert.throws(
    () => filterWordsByRange(words, { range: 'recent', days: 0 }, fixedNow),
    /自定义天数必须是正整数/
  );
});

test('rejects invalid ranges, modes, and missing questions', () => {
  assert.throws(
    () => filterWordsByRange(words, { range: 'tomorrow' }, fixedNow),
    /测试范围无效/
  );
  assert.throws(
    () => buildQuestion(words[0], 'bad-mode'),
    /测试模式无效/
  );
  assert.throws(
    () => pickRandomQuestion(words, { mode: 'bad-mode', range: 'all' }, () => 0, fixedNow),
    /测试模式无效/
  );
  assert.throws(
    () => checkAnswer(words, { wordId: 'missing', mode: 'en-to-zh', answer: '苹果' }),
    /题目不存在/
  );
});
