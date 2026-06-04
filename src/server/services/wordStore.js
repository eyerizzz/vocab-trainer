import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');
const defaultWordsFile = path.join(projectRoot, 'data', 'words.json');

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

function normalizeWordInput(input) {
  const english = cleanText(input.english);
  const chinese = cleanText(input.chinese);
  const partOfSpeech = cleanText(input.partOfSpeech);

  if (!english) {
    throw new Error('请输入英文单词');
  }

  if (!chinese) {
    throw new Error('请输入中文释义');
  }

  if (!partOfSpeechSet.has(partOfSpeech)) {
    throw new Error('请选择有效词性');
  }

  return { english, chinese, partOfSpeech };
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

    return parsed;
  }

  async function saveWords(words) {
    await mkdir(path.dirname(wordsFile), { recursive: true });
    await writeFile(wordsFile, `${JSON.stringify(words, null, 2)}\n`, 'utf8');
  }

  async function addWord(input) {
    const normalized = normalizeWordInput(input);
    const words = await getWords();
    const word = {
      id: createWordId(),
      ...normalized,
      createdAt: new Date().toISOString()
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
    const createdAt = new Date().toISOString();
    const newWords = normalizedInputs.map((normalized) => ({
      id: createWordId(),
      ...normalized,
      createdAt
    }));

    words.push(...newWords);
    await saveWords(words);
    return newWords;
  }

  return {
    getWords,
    saveWords,
    addWord,
    addWords
  };
}

const defaultStore = createWordStore();

export const getWords = defaultStore.getWords;
export const saveWords = defaultStore.saveWords;
export const addWord = defaultStore.addWord;
export const addWords = defaultStore.addWords;
