'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { resolveFile } = require('../tools/ui-harness/serve.js');

const ROOT = path.join(__dirname, '..');
const dentro = (file, dir) => { const r = path.relative(dir, file); return !r.startsWith('..') && !path.isAbsolute(r); };

test('đường hợp lệ trả 200 và nằm đúng thư mục gốc', () => {
  const ca = [
    ['/css/kydao.css', path.join(ROOT, 'public')],
    ['/harness/kydao/index.html', path.join(ROOT, 'tools', 'ui-harness')],
    ['/vendor/three/three.module.js', path.join(ROOT, 'node_modules', 'three', 'build')],
    ['/vendor/three-addons/loaders/GLTFLoader.js', path.join(ROOT, 'node_modules', 'three', 'examples', 'jsm')],
  ];
  for (const [url, dir] of ca) {
    const r = resolveFile(url);
    assert.strictEqual(r.status, 200, url);
    assert.ok(dentro(r.file, dir), url);
  }
});

test('đường thoát khỏi thư mục gốc bị từ chối 403', () => {
  for (const url of ['/../package.json', '/%2e%2e/package.json', '/vendor/three/%2e%2e/%2e%2e/package.json', '/vendor/three/../build-private/x', '/harness/../../server.js']) {
    assert.strictEqual(resolveFile(url).status, 403, url);
  }
});

test('mã hóa URL hỏng trả 400', () => {
  assert.strictEqual(resolveFile('/%E0%A4%A').status, 400);
  assert.strictEqual(resolveFile('/css/kydao.css%00').status, 400);   // ký tự NUL
});
