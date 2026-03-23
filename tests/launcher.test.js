const test = require('node:test');
const assert = require('node:assert/strict');

const { parseArgs, buildCommand } = require('../dist/main/main/launcher.js');

const defaultSettings = {
  theme: 'system',
  fontSize: 'medium',
  cardSize: 'medium',
  viewMode: 'grid',
  sidebarWidth: 220,
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
    ['/System/Applications/FindMy.app', '--args', '--profile', 'test', 'two words']
  );
});

test('buildCommand prefers explicit workingDirectory for script tools', () => {
  const command = buildCommand({
    id: '2',
    name: 'Runner',
    description: '',
    type: 'shell',
    path: '/tmp/scripts/run.sh',
    args: '--port 8080',
    workingDirectory: '/tmp/workdir',
    categoryId: 'misc',
    useCount: 0,
    createdAt: 1,
  }, defaultSettings);

  assert.equal(command.cmd, '/bin/bash');
  assert.deepEqual(command.args, ['/tmp/scripts/run.sh', '--port', '8080']);
  assert.deepEqual(command.opts, { cwd: '/tmp/workdir' });
});

test('buildCommand auto-prefixes https for url tools', () => {
  const command = buildCommand({
    id: '3',
    name: 'Docs',
    description: '',
    type: 'url',
    path: 'platform.openai.com/docs',
    args: '',
    categoryId: 'misc',
    useCount: 0,
    createdAt: 1,
  }, defaultSettings);

  assert.equal(command.cmd, 'open');
  assert.deepEqual(command.args, ['https://platform.openai.com/docs']);
});
