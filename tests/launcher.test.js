const test = require('node:test');
const assert = require('node:assert/strict');

const { parseArgs, buildCommand } = require('../dist/main/main/launcher.js');

const defaultSettings = {
  theme: 'dark',
  fontSize: 'medium',
  cardSize: 'medium',
  iconDisplaySize: 'medium',
  backgroundColor: undefined,
  hoverSwitchCategories: true,
  showRecentTools: true,
  enableGlobalQuickLauncher: true,
  javaEnvs: [],
  pythonEnvs: [],
  startAtLogin: false,
  minimizeToTray: true,
};

test('parseArgs keeps quoted segments together', () => {
  assert.deepEqual(
    parseArgs('--name "Launch Box" --flag \'two words\' plain'),
    ['--name', 'Launch Box', '--flag', 'two words', 'plain']
  );
});

test('buildCommand uses --args for mac app launch parameters', () => {
  const command = buildCommand({
    id: '1',
    name: 'FindMy',
    description: '',
    type: 'app',
    path: '/System/Applications/FindMy.app',
    args: '--profile test "two words"',
    categoryId: 'misc',
    useCount: 0,
    createdAt: 1,
  }, defaultSettings);

  assert.equal(command.cmd, 'open');
  assert.deepEqual(
    command.args,
    ['-a', '/System/Applications/FindMy.app', '--args', '--profile', 'test', 'two words']
  );
});
