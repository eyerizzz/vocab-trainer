import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compactChineseDefinition,
  lookupWordDefinitions,
  parseYoudaoLookup,
  parseYoudaoSuggest
} from '../src/server/services/dictionaryLookup.js';

test('parses Youdao English-Chinese definitions into word candidates', () => {
  const payload = {
    ec: {
      word: [{
        trs: [{
          tr: [{
            l: {
              i: [
                'n. 苹果；苹果树',
                'v. 申请；应用',
                'adj. 快的'
              ]
            }
          }]
        }]
      }]
    }
  };

  assert.deepEqual(parseYoudaoLookup(payload, 'Apple'), [
    { english: 'apple', partOfSpeech: 'noun', chinese: '苹果；苹果树' },
    { english: 'apple', partOfSpeech: 'verb', chinese: '申请；应用' },
    { english: 'apple', partOfSpeech: 'adjective', chinese: '快的' }
  ]);
});

test('compacts long dictionary explanations into memory-friendly meanings', () => {
  assert.equal(
    compactChineseDefinition('（书面或口头的）测验，考试；（医疗上的）检查，化验，检验；复杂解释'),
    '测验；考试；检查'
  );
});

test('removes participle notes from compact meanings', () => {
  assert.equal(
    compactChineseDefinition('使不安，使恐慌；给（门等）安装警报器（alarm 的现在分词）'),
    '使不安；使恐慌；给安装警报器'
  );
});

test('parses Youdao suggestions for the exact queried word', () => {
  const payload = {
    data: {
      entries: [
        { entry: 'runner', explain: 'n. 跑步者' },
        { entry: 'run', explain: 'v. 跑；经营 n. 奔跑；连续的一段时间' }
      ]
    }
  };

  assert.deepEqual(parseYoudaoSuggest(payload, 'run'), [
    { english: 'run', partOfSpeech: 'verb', chinese: '跑；经营' },
    { english: 'run', partOfSpeech: 'noun', chinese: '奔跑；连续的一段时间' }
  ]);
});

test('lookup falls back to suggestion endpoint when the first provider fails', async () => {
  let requestCount = 0;
  const fetchImpl = async () => {
    requestCount += 1;

    if (requestCount === 1) {
      throw new Error('offline');
    }

    return new Response(JSON.stringify({
      data: {
        entries: [
          { entry: 'test', explain: 'n. 测试；试验 v. 测试；检验' }
        ]
      }
    }), { status: 200 });
  };

  const result = await lookupWordDefinitions('test', { fetchImpl });

  assert.equal(result.english, 'test');
  assert.equal(result.source, 'youdao-suggest');
  assert.deepEqual(result.candidates, [
    { english: 'test', partOfSpeech: 'noun', chinese: '测试；试验' },
    { english: 'test', partOfSpeech: 'verb', chinese: '测试；检验' }
  ]);
});
