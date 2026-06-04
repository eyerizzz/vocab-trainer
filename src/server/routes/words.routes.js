import { lookupWordDefinitions } from '../services/dictionaryLookup.js';
import { addWord, addWords, getWords } from '../services/wordStore.js';

async function readJsonBody(request) {
  let body = '';

  for await (const chunk of request) {
    body += chunk;
  }

  return body ? JSON.parse(body) : {};
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

export async function handleWordsRoute(request, response, url) {
  if (url.pathname === '/api/words/lookup' && request.method === 'GET') {
    const english = url.searchParams.get('english') || '';
    const result = await lookupWordDefinitions(english);

    sendJson(response, 200, result);
    return;
  }

  if (url.pathname === '/api/words/batch' && request.method === 'POST') {
    const input = await readJsonBody(request);
    const words = await addWords(input.words);

    sendJson(response, 201, { words });
    return;
  }

  if (url.pathname !== '/api/words') {
    sendJson(response, 404, { error: '接口不存在' });
    return;
  }

  if (request.method === 'GET') {
    sendJson(response, 200, { words: await getWords() });
    return;
  }

  if (request.method === 'POST') {
    const input = await readJsonBody(request);
    const word = await addWord(input);
    sendJson(response, 201, { word });
    return;
  }

  sendJson(response, 405, { error: '请求方法不支持' });
}
