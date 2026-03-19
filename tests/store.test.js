const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeData, sanitizeSettings, sanitizeCategories, sanitizeTools } = require('../dist/main/main/store.js');

test('sanitizeSettings restores invalid enum values and booleans', () => {
  const settings = sanitizeSettings({
    theme: 'neon',
    fontSize: 'huge',
    cardSize: 'tiny',
    hoverSwitchCategories: 'yes',
    showRecentTools: undefined,
    startAtLogin: 'sometimes',
    minimizeToTray: null,
  });

  assert.equal(settings.theme, 'dark');
  assert.equal(settings.fontSize, 'medium');
  assert.equal(settings.cardSize, 'medium');
  assert.equal(settings.hoverSwitchCategories, true);
  assert.equal(settings.showRecentTools, true);
  assert.equal(settings.startAtLogin, false);
  assert.equal(settings.minimizeToTray, true);
});

test('sanitizeCategories preserves built-ins and normalizes ordering', () => {
  const categories = sanitizeCategories([
    { id: 'custom', name: '自定义', icon: '✨', order: 99 },
    { id: 'misc', name: '', icon: '', order: -1 },
  ]);

  assert.equal(categories[0].id, 'misc');
  assert.ok(categories.some(category => category.id === 'all'));
  assert.ok(categories.some(category => category.id === 'custom'));
  assert.deepEqual(categories.map(category => category.order), categories.map((_, index) => index));
});

test('sanitizeTools removes invalid tools and fixes duplicate ids and missing categories', () => {
  const categories = sanitizeCategories([{ id: 'custom', name: '自定义', icon: '✨', order: 6 }]);
  const tools = sanitizeTools([
    { id: 'dup', name: 'Tool A', type: 'app', path: '/Applications/A.app', categoryId: 'missing', args: '' },
    { id: 'dup', name: 'Tool B', type: 'shell', path: '/tmp/run.sh', categoryId: 'custom', args: '' },
    { id: 'bad', name: '', type: 'url', path: 'https://example.com', categoryId: 'custom', args: '' },
    { id: 'bad-type', name: 'Broken', type: 'unknown', path: '/tmp/nope', categoryId: 'custom', args: '' },
  ], categories);

  assert.equal(tools.length, 2);
  assert.equal(tools[0].categoryId, 'misc');
  assert.equal(tools[1].categoryId, 'custom');
  assert.notEqual(tools[0].id, tools[1].id);
});

test('sanitizeData returns a complete normalized app data object', () => {
  const data = sanitizeData({
    settings: { theme: 'light' },
    categories: [{ id: 'ops', name: '运维', icon: '🛠️', order: 12 }],
    tools: [
      { id: 'x', name: 'Ops Tool', type: 'shell', path: '/tmp/ops.sh', categoryId: 'ops', args: '' },
    ],
  });

  assert.equal(data.settings.theme, 'light');
  assert.equal(data.settings.hoverSwitchCategories, true);
  assert.ok(data.categories.some(category => category.id === 'ops'));
  assert.equal(data.tools[0].categoryId, 'ops');
  assert.equal(data.tools[0].useCount, 0);
});
