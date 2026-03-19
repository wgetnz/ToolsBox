const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

let electronProcess = null;
let mainReady = false;
let rendererReady = false;
let shuttingDown = false;
let restartTimer = null;
let outputWatcher = null;

function runCommand(command, args, label, onOutput) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  const forward = (stream, level) => {
    stream.on('data', (chunk) => {
      const text = chunk.toString();
      process[level].write(`[${label}] ${text}`);
      onOutput?.(text);
    });
  };

  forward(child.stdout, 'stdout');
  forward(child.stderr, 'stderr');

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const detail = signal ? `signal ${signal}` : `code ${code}`;
    process.stderr.write(`[${label}] exited with ${detail}\n`);
    shutdown(code ?? 1);
  });

  return child;
}

function startElectron() {
  if (electronProcess || !mainReady || !rendererReady || shuttingDown) return;

  electronProcess = spawn(
    isWindows ? 'electron.cmd' : 'electron',
    ['.'],
    {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: false,
    }
  );

  electronProcess.on('exit', () => {
    electronProcess = null;
  });
}

function restartElectron() {
  if (shuttingDown || !mainReady || !rendererReady) return;

  if (!electronProcess) {
    startElectron();
    return;
  }

  const current = electronProcess;
  electronProcess = null;
  current.once('exit', () => {
    if (!shuttingDown) startElectron();
  });
  current.kill('SIGTERM');
}

function queueRestart() {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    restartElectron();
  }, 150);
}

function ensureOutputWatcher() {
  if (outputWatcher) return;

  const mainOutDir = path.join(projectRoot, 'dist', 'main', 'main');
  if (!fs.existsSync(mainOutDir)) return;

  outputWatcher = fs.watch(mainOutDir, (_eventType, fileName) => {
    if (!fileName || !String(fileName).endsWith('.js')) return;
    queueRestart();
  });

  outputWatcher.on('error', () => {
    outputWatcher?.close();
    outputWatcher = null;
  });
}

function onMainOutput(text) {
  if (!text.includes('Found 0 errors')) return;
  mainReady = true;
  ensureOutputWatcher();
  startElectron();
}

function onRendererOutput(text) {
  if (!text.includes('compiled successfully')) return;
  rendererReady = true;
  startElectron();
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (restartTimer) clearTimeout(restartTimer);
  outputWatcher?.close();

  if (electronProcess) {
    electronProcess.kill('SIGTERM');
  }

  if (mainWatcher) mainWatcher.kill('SIGTERM');
  if (rendererWatcher) rendererWatcher.kill('SIGTERM');

  setTimeout(() => process.exit(code), 50);
}

const mainWatcher = runCommand(
  isWindows ? 'npx.cmd' : 'npx',
  ['tsc', '-p', 'tsconfig.main.json', '--watch', '--preserveWatchOutput'],
  'main',
  onMainOutput
);

const rendererWatcher = runCommand(
  isWindows ? 'npx.cmd' : 'npx',
  ['webpack', '--config', 'webpack.config.js', '--watch'],
  'renderer',
  onRendererOutput
);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
