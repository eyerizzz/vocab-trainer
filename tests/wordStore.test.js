import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWordStore } from '../src/server/services/wordStore.js';

async function createTempStore() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'vocab-store-'));
  const wordsFile = path.join(directory, 'words.json');
  const store = createWordStore(wordsFile);

  return { directory, wordsFile, store };
}

test('adds a word with english, chinese, part of speech, and createdAt', async () => {
  const { directory, wordsFile, store } = await createTempStore();

  try {
    const word = await store.addWord({
      english: ' apple ',
      chinese: ' 苹果 ',
      partOfSpeech: 'noun'
    });

    const saved = JSON.parse(await readFile(wordsFile, 'utf8'));

    assert.equal(saved.length, 1);
    assert.equal(saved[0].english, 'apple');
    assert.equal(saved[0].chinese, '苹果');
    assert.equal(saved[0].partOfSpeech, 'noun');
    assert.match(saved[0].id, /^word_/);
    assert.ok(Number.isFinite(new Date(saved[0].createdAt).getTime()));
    assert.deepEqual(saved[0], word);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('allows the same English word to be saved as separate meanings', async () => {
  const { directory, store } = await createTempStore();

  try {
    await store.addWord({
      english: 'run',
      chinese: '跑',
      partOfSpeech: 'verb'
    });
    await store.addWord({
      english: 'run',
      chinese: '一段连续的时间',
      partOfSpeech: 'noun'
    });

    const words = await store.getWords();

    assert.equal(words.length, 2);
    assert.deepEqual(words.map((word) => word.partOfSpeech), ['verb', 'noun']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('adds multiple selected meanings in one save', async () => {
  const { directory, store } = await createTempStore();

  try {
    const saved = await store.addWords([
      {
        english: 'run',
        chinese: '跑',
        partOfSpeech: 'verb'
      },
      {
        english: 'run',
        chinese: '奔跑',
        partOfSpeech: 'noun'
      }
    ]);
    const words = await store.getWords();

    assert.equal(saved.length, 2);
    assert.deepEqual(words.map((word) => word.chinese), ['跑', '奔跑']);
    assert.deepEqual(words.map((word) => word.partOfSpeech), ['verb', 'noun']);
    assert.ok(words.every((word) => Number.isFinite(new Date(word.createdAt).getTime())));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects invalid word input', async () => {
  const { directory, store } = await createTempStore();

  try {
    await assert.rejects(
      () => store.addWord({ english: '', chinese: '苹果', partOfSpeech: 'noun' }),
      /请输入英文单词/
    );
    await assert.rejects(
      () => store.addWord({ english: 'apple', chinese: '', partOfSpeech: 'noun' }),
      /请输入中文释义/
    );
    await assert.rejects(
      () => store.addWord({ english: 'apple', chinese: '苹果', partOfSpeech: 'bad' }),
      /请选择有效词性/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
