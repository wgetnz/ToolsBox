const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createToolShortcut } = require('../dist/main/main/shortcuts.js');

const defaultSettings = {
  theme: 'dark',
  fontSize: 'medium',
  cardSize: 'medium',
  backgroundColor: undefined,
  hoverSwitchCategories: true,
  showRecentTools: true,
  enableGlobalQuickLauncher: true,
  javaEnvs: [],
  pythonEnvs: [],
  startAtLogin: false,
  minimizeToTray: true,
};

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'launchbox-shortcuts-'));
}

test('createToolShortcut creates a webloc file for url tools on macOS', () => {
  const root = makeTempDir();
  const shortcutPath = createToolShortcut({
    id: '1',
    name: 'OpenAI Docs',
    description: '',
    type: 'url',
    path: 'https://platform.openai.com/docs',
    args: '',
    categoryId: 'misc',
    customOrder: 0,
    useCount: 0,
    createdAt: 1,
  }, defaultSettings, root, 'darwin');

  assert.ok(shortcutPath.endsWith('.webloc'));
  const content = fs.readFileSync(shortcutPath, 'utf-8');
  assert.match(content, /https:\/\/platform\.openai\.com\/docs/);
});

test('createToolShortcut creates an executable command file for local tools on macOS', () => {
  const root = makeTempDir();
  const shortcutPath = createToolShortcut({
    id: '2',
    name: 'My Script',
    description: '',
    type: 'shell',
    path: '/tmp/demo script.sh',
    args: '--name "Launch Box"',
    categoryId: 'misc',
    customOrder: 1,
    useCount: 0,
    createdAt: 1,
  }, defaultSettings, root, 'darwin');

  assert.ok(shortcutPath.endsWith('.command'));
  const content = fs.readFileSync(shortcutPath, 'utf-8');
  assert.match(content, /^#!\/bin\/bash/m);
  assert.match(content, /cd '\/tmp'/);
  assert.match(content, /'\/bin\/bash' '\/tmp\/demo script\.sh' '--name' 'Launch Box'/);
  assert.ok((fs.statSync(shortcutPath).mode & 0o111) !== 0);
});
