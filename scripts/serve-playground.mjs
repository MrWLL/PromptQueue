import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
let currentPort = Number(process.env.PORT || 4173);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function resolveRequestPath(urlPath) {
  if (urlPath === '/' || urlPath === '/playground') {
    return path.join(repoRoot, 'playground', 'promptqueue-playground.html');
  }

  const relativePath = decodeURIComponent(urlPath).replace(/^\/+/, '');
  const sanitizedPath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  return path.join(repoRoot, sanitizedPath);
}

function sendNotFound(response) {
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Not Found');
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
  const filePath = resolveRequestPath(requestUrl.pathname);

  if (!filePath.startsWith(repoRoot)) {
    sendNotFound(response);
    return;
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      sendNotFound(response);
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': mimeTypes[extension] || 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    sendNotFound(response);
  }
});

function listen(port) {
  currentPort = port;
  server.listen(port, '127.0.0.1');
}

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    const nextPort = currentPort + 1;

    if (nextPort > 4183) {
      console.error('PromptQueue playground failed to start: no free port between 4173 and 4183.');
      process.exit(1);
    }

    listen(nextPort);
    return;
  }

  console.error(error);
  process.exit(1);
});

server.on('listening', () => {
  const address = server.address();

  if (!address || typeof address === 'string') {
    return;
  }

  console.log(`PromptQueue playground running at http://127.0.0.1:${address.port}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});

listen(Number(process.env.PORT || 4173));
