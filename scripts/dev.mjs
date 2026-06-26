import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getConnectableHost } from '../shared/networkHosts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const children = new Map();
const serverPort = process.env.SERVER_PORT || '3001';
const serverHost = getConnectableHost(process.env.HOST || '0.0.0.0');
const serverHealthUrl = `http://${serverHost}:${serverPort}/health`;

let shuttingDown = false;
let rawModeEnabled = false;

function fromRoot(...parts) {
  return path.join(root, ...parts);
}

function start(name, args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: process.env,
    shell: false,
    stdio: ['pipe', 'inherit', 'inherit'],
    windowsHide: false,
  });

  children.set(name, child);
  child.stdin?.on('error', () => {});

  child.on('exit', (code, signal) => {
    children.delete(name);

    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 1}`;
    console.error(`[dev] ${name} exited with ${reason}; stopping dev server.`);
    void shutdown(code ?? 1);
  });

  child.on('error', (error) => {
    children.delete(name);

    if (shuttingDown) {
      return;
    }

    console.error(`[dev] failed to start ${name}: ${error.message}`);
    void shutdown(1);
  });
}

function setupInputShortcuts() {
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    const input = chunk.toLowerCase();
    if (input.includes('\u0003') || input.trim() === 'q') {
      void shutdown(0);
    }
  });

  if (process.stdin.isTTY) {
    rawModeEnabled = true;
    process.stdin.setRawMode(true);
    console.log('[dev] Press Ctrl+C or q to stop.');
  }
}

function restoreInput() {
  if (rawModeEnabled && process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const startedAt = Date.now();
  const timeoutMs = 30_000;

  console.log(`[dev] Waiting for server at ${serverHealthUrl}`);

  while (!shuttingDown && Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(serverHealthUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still booting.
    }

    await sleep(250);
  }

  if (!shuttingDown) {
    console.error(`[dev] Server did not become ready within ${timeoutMs / 1000}s.`);
    await shutdown(1);
  }
}

function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    child.once('exit', () => resolve());

    if (isWindows) {
      const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.on('error', () => resolve());
      killer.on('exit', () => resolve());
      return;
    }

    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }
    }, 5000).unref();
  });
}

async function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  restoreInput();

  const running = [...children.values()];
  children.clear();
  await Promise.all(running.map(stopChild));
  process.exit(exitCode);
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
process.on('SIGHUP', () => void shutdown(0));

async function main() {
  setupInputShortcuts();
  start('server', [
    fromRoot('node_modules', 'tsx', 'dist', 'cli.mjs'),
    '--tsconfig',
    fromRoot('server', 'tsconfig.json'),
    fromRoot('server', 'index.js'),
  ]);
  await waitForServer();

  if (!shuttingDown) {
    start('client', [fromRoot('node_modules', 'vite', 'bin', 'vite.js')]);
  }
}

void main();
