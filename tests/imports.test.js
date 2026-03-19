const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { expandImportItems } = require('../dist/main/main/imports.js');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'launchbox-imports-'));
}

test('expandImportItems keeps app bundles and supported files', () => {
  const root = makeTempDir();
  const appDir = path.join(root, 'Demo.app');
  const shellFile = path.join(root, 'run.sh');
  const ignoredFile = path.join(root, 'notes.txt');

  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(shellFile, '#!/bin/bash\necho ok\n');
  fs.writeFileSync(ignoredFile, 'ignore');

  const result = expandImportItems([root]);

  assert.ok(result.includes(appDir));
  assert.ok(result.includes(shellFile));
  assert.ok(!result.includes(ignoredFile));
});

test('expandImportItems recurses into directories up to two levels', () => {
  const root = makeTempDir();
  const nestedDir = path.join(root, 'tools', 'scripts');
  const deepDir = path.join(nestedDir, 'too-deep');
  const pyFile = path.join(nestedDir, 'tool.py');
  const deepFile = path.join(deepDir, 'deep.sh');

  fs.mkdirSync(deepDir, { recursive: true });
  fs.writeFileSync(pyFile, 'print("ok")\n');
  fs.writeFileSync(deepFile, '#!/bin/bash\necho deep\n');

  const result = expandImportItems([root]);

  assert.ok(result.includes(pyFile));
  assert.ok(!result.includes(deepFile));
});

test('expandImportItems includes executable files without known extensions', () => {
  const root = makeTempDir();
  const binaryFile = path.join(root, 'custom-tool');

  fs.writeFileSync(binaryFile, '#!/bin/bash\necho exec\n');
  fs.chmodSync(binaryFile, 0o755);

  const result = expandImportItems([binaryFile]);

  assert.deepEqual(result, [binaryFile]);
});
