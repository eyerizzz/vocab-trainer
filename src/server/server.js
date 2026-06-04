import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleQuizRoute } from './routes/quiz.routes.js';
import { handleWordsRoute } from './routes/words.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const publicDir = path.join(projectRoot, 'public');
const clientDir = path.join(projectRoot, 'src', 'client');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8']
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

function isInside(candidate, parent) {
  const relativePath = path.relative(parent, candidate);
  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

async function serveFile(response, filePath) {
  const extension = path.extname(filePath);
  const contentType = mimeTypes.get(extension) || 'application/octet-stream';
  const content = await readFile(filePath);

  response.writeHead(200, { 'Content-Type': contentType });
  response.end(content);
}

async function serveStatic(url, response) {
  if (url.pathname === '/') {
    await serveFile(response, path.join(publicDir, 'index.html'));
    return true;
  }

  if (url.pathname.startsWith('/src/client/')) {
    const filePath = path.resolve(projectRoot, decodeURIComponent(url.pathname.slice(1)));

    if (!isInside(filePath, clientDir)) {
      sendJson(response, 403, { error: '禁止访问' });
      return true;
    }

    await serveFile(response, filePath);
    return true;
  }

  const publicPath = path.resolve(publicDir, decodeURIComponent(url.pathname.slice(1)));

  if (isInside(publicPath, publicDir)) {
    await serveFile(response, publicPath);
    return true;
  }

  return false;
}

export const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  try {
    if (url.pathname.startsWith('/api/words')) {
      await handleWordsRoute(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/api/quiz')) {
      await handleQuizRoute(request, response, url);
      return;
    }

    if (request.method === 'GET' && await serveStatic(url, response)) {
      return;
    }

    sendJson(response, 404, { error: '页面不存在' });
  } catch (error) {
    const statusCode = error.message === '题目不存在' ? 404 : 400;
    sendJson(response, statusCode, { error: error.message || '服务器错误' });
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  server.listen(port, host, () => {
    console.log(`vocab-trainer is running at http://${host}:${port}`);
  });
}
