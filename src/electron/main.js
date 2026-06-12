import { app, BrowserWindow, dialog } from 'electron';
import { access, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

app.setName('Vocab Trainer');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

let mainWindow = null;
let localServer = null;

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function prepareWordsFile(wordsFile) {
  if (await fileExists(wordsFile)) {
    return;
  }

  const projectWordsFile = path.join(projectRoot, 'data', 'words.example.json');

  if (!await fileExists(projectWordsFile)) {
    return;
  }

  await mkdir(path.dirname(wordsFile), { recursive: true });
  await copyFile(projectWordsFile, wordsFile);
}

async function startLocalServer() {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 0);
  process.env.HOST = host;
  const wordsFile = process.env.WORDS_FILE || path.join(app.getPath('userData'), 'words.json');
  process.env.WORDS_FILE = wordsFile;
  await prepareWordsFile(wordsFile);

  const { server } = await import('../server/server.js');
  localServer = server;

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  const resolvedPort = typeof address === 'object' && address ? address.port : port;
  return `http://${host}:${resolvedPort}`;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 860,
    minHeight: 620,
    title: 'Vocab Trainer',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL(url);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    const url = await startLocalServer();
    createWindow(url);
  } catch (error) {
    console.error(error);
    dialog.showErrorBox('启动失败', error.message || '本地服务启动失败');
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow && localServer) {
    const address = localServer.address();
    const port = typeof address === 'object' && address ? address.port : Number(process.env.PORT || 3000);
    createWindow(`http://${process.env.HOST || '127.0.0.1'}:${port}`);
  }
});

app.on('before-quit', () => {
  localServer?.close();
});
