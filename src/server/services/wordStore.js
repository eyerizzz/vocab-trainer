import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');
const defaultWordsFile = process.env.WORDS_FILE
  ? path.resolve(process.env.WORDS_FILE)
  : path.join(projectRoot, 'data', 'words.json');

export const PART_OF_SPEECH_OPTIONS = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'phrase',
  'other'
];

const partOfSpeechSet = new Set(PART_OF_SPEECH_OPTIONS);

function cleanText(value) {
  return String(value ?? '').trim();
}

function createWordId() {
  return `word_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

function createMeaningId() {
  return `meaning_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

function normalizePartOfSpeech(partOfSpeech) {
  const cleaned = cleanText(partOfSpeech);

  if (!partOfSpeechSet.has(cleaned)) {
    throw new Error('请选择有效词性');
  }

  return cleaned;
}

function normalizeEnglish(value) {
  const english = cleanText(value).toLowerCase();

  if (!english) {
    throw new Error('请输入英文单词');
  }

  return english;
}

function normalizeMeaningInput(input) {
  const partOfSpeech = cleanText(input.partOfSpeech);
  const chinese = cleanText(input.chinese);
  const legacyErrorCount = Number(input.errorCount || 0);
  const spellingErrorCount = Number(input.spellingErrorCount ?? legacyErrorCount);
  const skipCount = Number(input.skipCount || 0);

  if (!chinese) {
    throw new Error('请输入中文释义');
  }

  const normalizedSpellingErrorCount = Number.isFinite(spellingErrorCount) && spellingErrorCount > 0
    ? Math.floor(spellingErrorCount)
    : 0;
  const normalizedSkipCount = Number.isFinite(skipCount) && skipCount > 0 ? Math.floor(skipCount) : 0;

  return {
    id: cleanText(input.id) || createMeaningId(),
    partOfSpeech: normalizePartOfSpeech(partOfSpeech),
    chinese,
    spellingErrorCount: normalizedSpellingErrorCount,
    skipCount: normalizedSkipCount,
    errorCount: normalizedSpellingErrorCount + normalizedSkipCount
  };
}

function normalizeWordInput(input) {
  return {
    english: normalizeEnglish(input.english),
    meaning: normalizeMeaningInput(input)
  };
}

function getMeaningKey(meaning) {
  return `${meaning.partOfSpeech}|${meaning.chinese}`;
}

function mergeMeanings(existingMeanings, nextMeanings) {
  const merged = [];
  const seen = new Set();

  for (const meaning of [...existingMeanings, ...nextMeanings]) {
    const normalized = normalizeMeaningInput(meaning);
    const key = getMeaningKey(normalized);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(normalized);
  }

  return merged;
}

function normalizeStoredWord(rawWord) {
  const english = normalizeEnglish(rawWord.english);
  const rawMeanings = Array.isArray(rawWord.meanings)
    ? rawWord.meanings
    : [{
        id: rawWord.meaningId,
        partOfSpeech: rawWord.partOfSpeech,
        chinese: rawWord.chinese
      }];
  const meanings = mergeMeanings([], rawMeanings);

  if (meanings.length === 0) {
    throw new Error('单词至少需要一个释义');
  }

  return {
    id: cleanText(rawWord.id) || createWordId(),
    english,
    meanings,
    createdAt: cleanText(rawWord.createdAt) || new Date().toISOString(),
    updatedAt: cleanText(rawWord.updatedAt) || cleanText(rawWord.createdAt) || new Date().toISOString()
  };
}

function normalizeWordList(rawWords) {
  const byEnglish = new Map();

  for (const rawWord of rawWords) {
    const word = normalizeStoredWord(rawWord);
    const existing = byEnglish.get(word.english);

    if (!existing) {
      byEnglish.set(word.english, word);
      continue;
    }

    existing.meanings = mergeMeanings(existing.meanings, word.meanings);
    existing.createdAt = existing.createdAt <= word.createdAt ? existing.createdAt : word.createdAt;
    existing.updatedAt = new Date().toISOString();
  }

  return [...byEnglish.values()];
}

function findWordByEnglish(words, english) {
  return words.find((word) => word.english.toLowerCase() === english.toLowerCase());
}

export function createWordStore(wordsFile = defaultWordsFile) {
  async function ensureWordsFile() {
    await mkdir(path.dirname(wordsFile), { recursive: true });

    try {
      await readFile(wordsFile, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }

      await writeFile(wordsFile, '[]\n', 'utf8');
    }
  }

  async function getWords() {
    await ensureWordsFile();
    const content = await readFile(wordsFile, 'utf8');
    const parsed = JSON.parse(content || '[]');

    if (!Array.isArray(parsed)) {
      throw new Error('words.json 必须是数组');
    }

    return normalizeWordList(parsed);
  }

  async function saveWords(words) {
    await mkdir(path.dirname(wordsFile), { recursive: true });
    await writeFile(wordsFile, `${JSON.stringify(normalizeWordList(words), null, 2)}\n`, 'utf8');
  }

  async function addWord(input) {
    const { english, meaning } = normalizeWordInput(input);
    const words = await getWords();
    const existing = findWordByEnglish(words, english);

    if (existing) {
      existing.meanings = mergeMeanings(existing.meanings, [meaning]);
      existing.updatedAt = new Date().toISOString();
      await saveWords(words);
      return existing;
    }

    const word = {
      id: createWordId(),
      english,
      meanings: [meaning],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    words.push(word);
    await saveWords(words);
    return word;
  }

  async function addWords(inputs) {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new Error('请选择要保存的释义');
    }

    const normalizedInputs = inputs.map(normalizeWordInput);
    const words = await getWords();
    const affectedWordIds = new Set();
    let savedCount = 0;

    for (const { english, meaning } of normalizedInputs) {
      const existing = findWordByEnglish(words, english);

      if (existing) {
        const before = existing.meanings.length;
        existing.meanings = mergeMeanings(existing.meanings, [meaning]);
        existing.updatedAt = new Date().toISOString();
        savedCount += existing.meanings.length > before ? 1 : 0;
        affectedWordIds.add(existing.id);
        continue;
      }

      const word = {
        id: createWordId(),
        english,
        meanings: [meaning],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      words.push(word);
      savedCount += 1;
      affectedWordIds.add(word.id);
    }

    await saveWords(words);

    return {
      words: words.filter((word) => affectedWordIds.has(word.id)),
      savedCount
    };
  }

  async function updateWord(id, input) {
    const wordId = cleanText(id);
    const words = await getWords();
    const word = words.find((item) => item.id === wordId);

    if (!word) {
      throw new Error('单词不存在');
    }

    const english = normalizeEnglish(input.english);
    const duplicate = words.find((item) => item.id !== wordId && item.english === english);

    if (duplicate) {
      throw new Error('英文单词已存在');
    }

    const meaningsInput = Array.isArray(input.meanings)
      ? input.meanings
      : [{ partOfSpeech: input.partOfSpeech, chinese: input.chinese }];
    const meanings = mergeMeanings([], meaningsInput);

    if (meanings.length === 0) {
      throw new Error('单词至少需要一个释义');
    }

    word.english = english;
    word.meanings = meanings;
    word.updatedAt = new Date().toISOString();
    await saveWords(words);
    return word;
  }

  async function incrementMeaningError(wordId, meaningId, reason = 'spelling') {
    const words = await getWords();
    const word = words.find((item) => item.id === cleanText(wordId));

    if (!word) {
      throw new Error('单词不存在');
    }

    const meaning = word.meanings.find((item) => item.id === cleanText(meaningId));

    if (!meaning) {
      throw new Error('题目不存在');
    }

    if (reason === 'skipped') {
      meaning.skipCount = Number(meaning.skipCount || 0) + 1;
    } else {
      meaning.spellingErrorCount = Number(meaning.spellingErrorCount || 0) + 1;
    }

    meaning.errorCount = Number(meaning.spellingErrorCount || 0) + Number(meaning.skipCount || 0);
    word.updatedAt = new Date().toISOString();
    await saveWords(words);
    return { word, meaning };
  }

  async function deleteWord(id) {
    const wordId = cleanText(id);
    const words = await getWords();
    const nextWords = words.filter((word) => word.id !== wordId);

    if (nextWords.length === words.length) {
      throw new Error('单词不存在');
    }

    await saveWords(nextWords);
    return { deleted: true };
  }

  return {
    getWords,
    saveWords,
    addWord,
    addWords,
    updateWord,
    incrementMeaningError,
    deleteWord
  };
}

const defaultStore = createWordStore();

export const getWords = defaultStore.getWords;
export const saveWords = defaultStore.saveWords;
export const addWord = defaultStore.addWord;
export const addWords = defaultStore.addWords;
export const updateWord = defaultStore.updateWord;
export const incrementMeaningError = defaultStore.incrementMeaningError;
export const deleteWord = defaultStore.deleteWord;
