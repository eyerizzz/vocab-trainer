export const QUIZ_MODES = ['en-to-zh', 'zh-to-en'];
export const QUIZ_RANGES = ['all', 'today', 'recent'];

const modeSet = new Set(QUIZ_MODES);
const rangeSet = new Set(QUIZ_RANGES);
const oneDayMs = 24 * 60 * 60 * 1000;

function cleanText(value) {
  return String(value ?? '').trim();
}

function assertMode(mode) {
  if (!modeSet.has(mode)) {
    throw new Error('测试模式无效');
  }
}

function assertRange(range) {
  if (!rangeSet.has(range)) {
    throw new Error('测试范围无效');
  }
}

function parsePositiveInteger(value) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error('自定义天数必须是正整数');
  }

  return numberValue;
}

function getRandomIndex(length, rng) {
  const randomValue = Number(rng());
  const boundedValue = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 1 - Number.EPSILON)
    : 0;

  return Math.floor(boundedValue * length);
}

export function getRangeStart(range = 'all', days, now = new Date()) {
  assertRange(range);

  if (range === 'all') {
    return null;
  }

  if (range === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  return new Date(now.getTime() - parsePositiveInteger(days) * oneDayMs);
}

export function filterWordsByRange(words, options = {}, now = new Date()) {
  const range = options.range || 'all';
  const start = getRangeStart(range, options.days, now);

  if (!start) {
    return words;
  }

  return words.filter((word) => {
    const createdAt = new Date(word.createdAt);
    return Number.isFinite(createdAt.getTime()) && createdAt >= start;
  });
}

export function buildQuestion(word, mode) {
  assertMode(mode);

  return {
    wordId: word.id,
    mode,
    prompt: mode === 'en-to-zh' ? word.english : word.chinese,
    answerLanguage: mode === 'en-to-zh' ? '中文释义' : '英文单词',
    partOfSpeech: word.partOfSpeech
  };
}

export function pickRandomQuestion(words, options = {}, rng = Math.random, now = new Date()) {
  const mode = options.mode || 'en-to-zh';
  assertMode(mode);

  const pool = filterWordsByRange(words, options, now);

  if (pool.length === 0) {
    return {
      empty: true,
      message: '当前范围没有可测试单词'
    };
  }

  const randomIndex = getRandomIndex(pool.length, rng);

  return {
    empty: false,
    question: buildQuestion(pool[randomIndex], mode),
    poolSize: pool.length
  };
}

export function getCorrectAnswer(word, mode) {
  assertMode(mode);
  return mode === 'en-to-zh' ? word.chinese : word.english;
}

export function normalizeAnswer(answer, mode) {
  assertMode(mode);
  const cleaned = cleanText(answer);
  return mode === 'zh-to-en' ? cleaned.toLowerCase() : cleaned;
}

export function checkAnswer(words, input) {
  const wordId = cleanText(input.wordId);
  const mode = input.mode || 'en-to-zh';
  assertMode(mode);

  const word = words.find((item) => item.id === wordId);

  if (!word) {
    throw new Error('题目不存在');
  }

  const correctAnswer = getCorrectAnswer(word, mode);
  const correct = normalizeAnswer(input.answer, mode) === normalizeAnswer(correctAnswer, mode);

  return {
    correct,
    submittedAnswer: cleanText(input.answer),
    correctAnswer,
    word: {
      id: word.id,
      english: word.english,
      chinese: word.chinese,
      partOfSpeech: word.partOfSpeech,
      createdAt: word.createdAt
    }
  };
}
