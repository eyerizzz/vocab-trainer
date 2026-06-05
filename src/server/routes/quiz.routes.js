import { getWords, incrementMeaningError } from '../services/wordStore.js';
import { checkAnswer, pickRandomQuestion } from '../services/quizService.js';

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

export async function handleQuizRoute(request, response, url) {
  if (url.pathname === '/api/quiz/random' && request.method === 'GET') {
    const mode = url.searchParams.get('mode') || 'zh-to-en';
    const range = url.searchParams.get('range') || 'all';
    const days = url.searchParams.get('days');
    const words = await getWords();
    const result = pickRandomQuestion(words, { mode, range, days });

    sendJson(response, 200, result);
    return;
  }

  if (url.pathname === '/api/quiz/check' && request.method === 'POST') {
    const input = await readJsonBody(request);
    const words = await getWords();
    const result = checkAnswer(words, input);

    if (!result.correct) {
      const updated = await incrementMeaningError(result.word.id, result.meaning.id);
      result.meaning.errorCount = updated.meaning.errorCount;
    }

    sendJson(response, 200, result);
    return;
  }

  sendJson(response, 404, { error: '接口不存在' });
}
