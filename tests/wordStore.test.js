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

test('adds a word with english, meanings, and timestamps', async () => {
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
    assert.equal(saved[0].meanings.length, 1);
    assert.equal(saved[0].meanings[0].chinese, '苹果');
    assert.equal(saved[0].meanings[0].partOfSpeech, 'noun');
    assert.match(saved[0].id, /^word_/);
    assert.match(saved[0].meanings[0].id, /^meaning_/);
    assert.ok(Number.isFinite(new Date(saved[0].createdAt).getTime()));
    assert.deepEqual(saved[0], word);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('keeps multiple parts of speech under one English word', async () => {
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

    assert.equal(words.length, 1);
    assert.equal(words[0].english, 'run');
    assert.deepEqual(words[0].meanings.map((meaning) => meaning.partOfSpeech), ['verb', 'noun']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('adds multiple selected meanings in one save without duplicate word records', async () => {
  const { directory, store } = await createTempStore();

  try {
    const result = await store.addWords([
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

    assert.equal(result.savedCount, 2);
    assert.equal(result.words.length, 1);
    assert.equal(words.length, 1);
    assert.deepEqual(words[0].meanings.map((meaning) => meaning.chinese), ['跑', '奔跑']);
    assert.deepEqual(words[0].meanings.map((meaning) => meaning.partOfSpeech), ['verb', 'noun']);
    assert.ok(words.every((word) => Number.isFinite(new Date(word.createdAt).getTime())));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('updates and deletes a stored word', async () => {
  const { directory, store } = await createTempStore();

  try {
    const word = await store.addWord({
      english: 'record',
      chinese: '记录',
      partOfSpeech: 'noun'
    });

    const updated = await store.updateWord(word.id, {
      english: 'record',
      meanings: [
        { partOfSpeech: 'noun', chinese: '记录' },
        { partOfSpeech: 'verb', chinese: '记录；录制' }
      ]
    });

    assert.equal(updated.meanings.length, 2);
    assert.equal(updated.meanings[1].partOfSpeech, 'verb');

    await store.deleteWord(word.id);
    assert.deepEqual(await store.getWords(), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('increments cumulative error count for a meaning', async () => {
  const { directory, store } = await createTempStore();

  try {
    const word = await store.addWord({
      english: 'apple',
      chinese: '苹果',
      partOfSpeech: 'noun'
    });
    const meaningId = word.meanings[0].id;

    await store.incrementMeaningError(word.id, meaningId);
    const result = await store.incrementMeaningError(word.id, meaningId);
    const words = await store.getWords();

    assert.equal(result.meaning.errorCount, 2);
    assert.equal(result.meaning.spellingErrorCount, 2);
    assert.equal(result.meaning.skipCount, 0);
    assert.equal(words[0].meanings[0].errorCount, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('tracks spelling errors and skips separately', async () => {
  const { directory, store } = await createTempStore();

  try {
    const word = await store.addWord({
      english: 'apple',
      chinese: '苹果',
      partOfSpeech: 'noun'
    });
    const meaningId = word.meanings[0].id;

    await store.incrementMeaningError(word.id, meaningId, 'spelling');
    const result = await store.incrementMeaningError(word.id, meaningId, 'skipped');

    assert.equal(result.meaning.spellingErrorCount, 1);
    assert.equal(result.meaning.skipCount, 1);
    assert.equal(result.meaning.errorCount, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('migrates legacy flat word records into meanings', async () => {
  const { directory, wordsFile, store } = await createTempStore();

  try {
    await store.saveWords([
      {
        id: 'word_1',
        english: 'record',
        chinese: '记录',
        partOfSpeech: 'noun',
        createdAt: '2026-06-01T00:00:00.000Z'
      },
      {
        id: 'word_2',
        english: 'record',
        chinese: '记录；录制',
        partOfSpeech: 'verb',
        createdAt: '2026-06-02T00:00:00.000Z'
      }
    ]);

    const saved = JSON.parse(await readFile(wordsFile, 'utf8'));

    assert.equal(saved.length, 1);
    assert.equal(saved[0].english, 'record');
    assert.deepEqual(saved[0].meanings.map((meaning) => meaning.partOfSpeech), ['noun', 'verb']);
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
