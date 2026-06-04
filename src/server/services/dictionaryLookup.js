import { PART_OF_SPEECH_OPTIONS } from './wordStore.js';

const youdaoBaseUrl = 'https://dict.youdao.com/jsonapi';
const youdaoSuggestUrl = 'https://dict.youdao.com/suggest';
const requestTimeoutMs = 5500;
const maxCandidates = 40;

const partOfSpeechSet = new Set(PART_OF_SPEECH_OPTIONS);

const posAliases = new Map([
  ['n', 'noun'],
  ['noun', 'noun'],
  ['v', 'verb'],
  ['vi', 'verb'],
  ['vt', 'verb'],
  ['verb', 'verb'],
  ['adj', 'adjective'],
  ['a', 'adjective'],
  ['adjective', 'adjective'],
  ['adv', 'adverb'],
  ['adverb', 'adverb'],
  ['phr', 'phrase'],
  ['phrase', 'phrase'],
  ['phrasal verb', 'phrase'],
  ['idiom', 'phrase']
]);

function cleanText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertEnglishWord(value) {
  const english = cleanText(value).toLowerCase();

  if (!english) {
    throw new Error('请输入英文单词');
  }

  if (!/^[a-z][a-z\s'-]*$/.test(english)) {
    throw new Error('请输入有效英文单词');
  }

  return english;
}

function normalizePartOfSpeech(value) {
  const cleaned = cleanText(value).toLowerCase().replace(/\.$/, '');
  return posAliases.get(cleaned) || (partOfSpeechSet.has(cleaned) ? cleaned : 'other');
}

function splitDefinitionLine(line) {
  const cleaned = cleanText(line);
  const match = cleaned.match(/^([a-zA-Z. ]+)\s+(.+)$/);

  if (!match) {
    return {
      partOfSpeech: 'other',
      chinese: cleaned
    };
  }

  return {
    partOfSpeech: normalizePartOfSpeech(match[1]),
    chinese: cleanText(match[2])
  };
}

function getArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return value == null ? [] : [value];
}

function collectYoudaoDefinitionLines(payload) {
  const lines = [];

  for (const word of getArray(payload?.ec?.word)) {
    for (const trsItem of getArray(word?.trs)) {
      for (const trItem of getArray(trsItem?.tr)) {
        for (const line of getArray(trItem?.l?.i)) {
          const cleaned = cleanText(line);

          if (cleaned) {
            lines.push(cleaned);
          }
        }
      }
    }
  }

  return lines;
}

function parseExplainText(explain) {
  return cleanText(explain)
    .split(/(?=\b(?:n|v|vi|vt|adj|a|adv|phr)\.\s)/i)
    .map((line) => cleanText(line))
    .filter(Boolean);
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const deduped = [];

  for (const candidate of candidates) {
    const english = cleanText(candidate.english).toLowerCase();
    const chinese = cleanText(candidate.chinese);
    const partOfSpeech = normalizePartOfSpeech(candidate.partOfSpeech);
    const key = `${english}|${partOfSpeech}|${chinese}`;

    if (!english || !chinese || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push({ english, chinese, partOfSpeech });

    if (deduped.length >= maxCandidates) {
      break;
    }
  }

  return deduped;
}

export function parseYoudaoLookup(payload, english) {
  const query = assertEnglishWord(english);
  const candidates = collectYoudaoDefinitionLines(payload).map((line) => ({
    english: query,
    ...splitDefinitionLine(line)
  }));

  return dedupeCandidates(candidates);
}

export function parseYoudaoSuggest(payload, english) {
  const query = assertEnglishWord(english);
  const exactEntry = getArray(payload?.data?.entries).find((entry) => (
    cleanText(entry?.entry).toLowerCase() === query
  ));

  if (!exactEntry) {
    return [];
  }

  const candidates = parseExplainText(exactEntry.explain).map((line) => ({
    english: query,
    ...splitDefinitionLine(line)
  }));

  return dedupeCandidates(candidates);
}

async function fetchJson(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'vocab-trainer/1.0'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`lookup failed with ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function createYoudaoUrl(english) {
  const dicts = JSON.stringify({ count: 1, dicts: [['ec']] });
  const url = new URL(youdaoBaseUrl);

  url.searchParams.set('jsonversion', '2');
  url.searchParams.set('client', 'mobile');
  url.searchParams.set('q', english);
  url.searchParams.set('dicts', dicts);
  url.searchParams.set('network', 'wifi');
  url.searchParams.set('xmlVersion', '5.1');

  return url;
}

function createYoudaoSuggestUrl(english) {
  const url = new URL(youdaoSuggestUrl);

  url.searchParams.set('q', english);
  url.searchParams.set('le', 'eng');
  url.searchParams.set('num', '8');
  url.searchParams.set('doctype', 'json');

  return url;
}

export async function lookupWordDefinitions(english, options = {}) {
  const query = assertEnglishWord(english);
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new Error('当前环境不支持联网查词');
  }

  const lookups = [
    {
      source: 'youdao',
      url: createYoudaoUrl(query),
      parse: (payload) => parseYoudaoLookup(payload, query)
    },
    {
      source: 'youdao-suggest',
      url: createYoudaoSuggestUrl(query),
      parse: (payload) => parseYoudaoSuggest(payload, query)
    }
  ];

  for (const lookup of lookups) {
    try {
      const payload = await fetchJson(lookup.url, fetchImpl);
      const candidates = lookup.parse(payload);

      if (candidates.length > 0) {
        return {
          english: query,
          candidates,
          source: lookup.source
        };
      }
    } catch {
      // Try the next provider so a single flaky endpoint does not break lookup.
    }
  }

  return {
    english: query,
    candidates: [],
    source: null
  };
}
