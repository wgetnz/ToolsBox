const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeData, sanitizeSettings, sanitizeCategories, sanitizeTools } = require('../dist/main/main/store.js');

test('sanitizeSettings restores invalid enum values and booleans', () => {
  const settings = sanitizeSettings({
    theme: 'neon',
    fontSize: 'huge',
    cardSize: 'tiny',
    viewMode: 'table',
    sidebarWidth: 999,
    startAtLogin: 'sometimes',
    minimizeToTray: null,
  });

  assert.equal(settings.theme, 'system');
  assert.equal(settings.fontSize, 'medium');
  assert.equal(settings.cardSize, 'medium');
  assert.equal(settings.viewMode, 'grid');
  assert.equal(settings.sidebarWidth, 520);
  assert.equal(settings.startAtLogin, false);
  assert.equal(settings.minimizeToTray, true);
});

test('sanitizeCategories preserves built-ins and normalizes parent references', () => {
  const categories = sanitizeCategories([
    { id: 'custom', name: '自定义', icon: '✨', order: 99 },
    { id: 'child', name: '子分类', icon: '📂', order: 100, parentId: 'custom' },
    { id: 'broken', name: '坏分类', icon: '❌', order: 101, parentId: 'missing' },
    { id: 'nested', name: '嵌套坏分类', icon: '⚠️', order: 102, parentId: 'child' },
  ]);

  assert.equal(categories[0].id, 'all');
  assert.ok(categories.some(category => category.id === 'custom'));
  assert.equal(categories.find(category => category.id === 'child')?.parentId, 'custom');
  assert.equal(categories.find(category => category.id === 'broken')?.parentId, undefined);
  assert.equal(categories.find(category => category.id === 'nested')?.parentId, undefined);
});

test('sanitizeTools removes invalid tools and migrates legacy color/customOrder', () => {
  const categories = sanitizeCategories([{ id: 'custom', name: '自定义', icon: '✨', order: 6 }]);
  const tools = sanitizeTools([
    { id: 'dup', name: 'Tool A', type: 'app', path: '/Applications/A.app', categoryId: 'missing', args: '', customOrder: 5, color: '#123456' },
    { id: 'dup', name: 'Tool B', type: 'shell', path: '/tmp/run.sh', categoryId: 'custom', args: '', customOrder: 1, workingDirectory: '/tmp' },
    { id: 'bad', name: '', type: 'url', path: 'https://example.com', categoryId: 'custom', args: '' },
    { id: 'bad-type', name: 'Broken', type: 'batch', path: '/tmp/nope', categoryId: 'custom', args: '' },
  ], categories);

  assert.equal(tools.length, 2);
  assert.equal(tools[0].name, 'Tool B');
  assert.equal(tools[0].categoryId, 'custom');
  assert.equal(tools[0].workingDirectory, '/tmp');
  assert.equal(tools[1].categoryId, 'misc');
  assert.equal(tools[1].accentColor, '#123456');
  assert.notEqual(tools[0].id, tools[1].id);
});

test('sanitizeData returns a complete normalized app data object', () => {
  const data = sanitizeData({
    settings: { theme: 'light', viewMode: 'list' },
    categories: [
      { id: 'ops', name: '运维', icon: '🛠️', order: 12 },
      { id: 'ops-child', name: '自动化', icon: '🤖', order: 13, parentId: 'ops' },
    ],
    tools: [
      { id: 'x', name: 'Ops Tool', type: 'shell', path: '/tmp/ops.sh', categoryId: 'ops-child', args: '' },
    ],
  });

  assert.equal(data.settings.theme, 'light');
  assert.equal(data.settings.viewMode, 'list');
  assert.equal(data.settings.sidebarWidth, 220);
  assert.ok(data.categories.some(category => category.id === 'ops'));
  assert.equal(data.categories.find(category => category.id === 'ops-child')?.parentId, 'ops');
  assert.equal(data.tools[0].categoryId, 'ops-child');
  assert.equal(data.tools[0].useCount, 0);
});
