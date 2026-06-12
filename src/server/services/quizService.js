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

function getRandomValue(rng) {
  const randomValue = Number(rng());
  return Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 1 - Number.EPSILON)
    : 0;
}

function getMeanings(word) {
  if (Array.isArray(word.meanings)) {
    return word.meanings;
  }

  return [{
    id: word.meaningId || `${word.id}_meaning`,
    partOfSpeech: word.partOfSpeech,
    chinese: word.chinese
  }];
}

function getMeaningWeight(meaning) {
  const legacyErrorCount = Number(meaning.errorCount || 0);
  const spellingErrorCount = Number(meaning.spellingErrorCount ?? legacyErrorCount);
  const skipCount = Number(meaning.skipCount || 0);
  const errorCount = (Number.isFinite(spellingErrorCount) ? spellingErrorCount : 0)
    + (Number.isFinite(skipCount) ? skipCount : 0);
  return 1 + Math.min(Math.max(errorCount, 0), 10);
}

function createQuestionCandidates(words) {
  return words.flatMap((word) => getMeanings(word).map((meaning) => ({
    word,
    meaning,
    weight: getMeaningWeight(meaning)
  })));
}

function pickWeightedCandidate(candidates, rng) {
  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let target = getRandomValue(rng) * totalWeight;

  for (const candidate of candidates) {
    target -= candidate.weight;

    if (target < 0) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
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
  const meaning = getMeanings(word)[0];

  return {
    wordId: word.id,
    meaningId: meaning.id,
    english: word.english,
    mode,
    prompt: mode === 'en-to-zh' ? word.english : meaning.chinese,
    answerLanguage: mode === 'en-to-zh' ? '中文释义' : '英文单词',
    partOfSpeech: meaning.partOfSpeech
  };
}

export function pickRandomQuestion(words, options = {}, rng = Math.random, now = new Date()) {
  const mode = options.mode || 'zh-to-en';
  assertMode(mode);

  const rangePool = filterWordsByRange(words, options, now);

  if (rangePool.length === 0) {
    return {
      empty: true,
      message: '当前范围没有可测试单词'
    };
  }

  const excludeWordIds = new Set(Array.isArray(options.excludeWordIds) ? options.excludeWordIds : []);
  const pool = rangePool.filter((word) => !excludeWordIds.has(word.id));

  if (pool.length === 0) {
    return {
      empty: true,
      exhausted: true,
      message: '本轮题目已完成',
      poolSize: rangePool.length
    };
  }

  const candidates = createQuestionCandidates(pool);
  const candidate = pickWeightedCandidate(candidates, rng);

  return {
    empty: false,
    question: buildQuestion({ ...candidate.word, meanings: [candidate.meaning] }, mode),
    poolSize: pool.length
  };
}

export function getCorrectAnswer(word, mode, meaning = getMeanings(word)[0]) {
  assertMode(mode);
  return mode === 'en-to-zh' ? meaning.chinese : word.english;
}

export function normalizeAnswer(answer, mode) {
  assertMode(mode);
  const cleaned = cleanText(answer);
  return mode === 'zh-to-en' ? cleaned.toLowerCase() : cleaned;
}

export function checkAnswer(words, input) {
  const wordId = cleanText(input.wordId);
  const mode = input.mode || 'zh-to-en';
  assertMode(mode);

  const word = words.find((item) => item.id === wordId);

  if (!word) {
    throw new Error('题目不存在');
  }

  const meaningId = cleanText(input.meaningId);
  const meanings = getMeanings(word);
  const meaning = meaningId
    ? meanings.find((item) => item.id === meaningId)
    : meanings[0];

  if (!meaning) {
    throw new Error('题目不存在');
  }

  const correctAnswer = getCorrectAnswer(word, mode, meaning);
  const correct = normalizeAnswer(input.answer, mode) === normalizeAnswer(correctAnswer, mode);

  return {
    correct,
    submittedAnswer: cleanText(input.answer),
    correctAnswer,
    word: {
      id: word.id,
      english: word.english,
      meanings,
      createdAt: word.createdAt
    },
    meaning
  };
}
