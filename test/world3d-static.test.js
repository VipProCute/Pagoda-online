'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { startServer } = require('./helpers/live');

test('Three.js: phục vụ build có cache và module phụ thuộc, không lộ node_modules', async t => {
  const server = await startServer();
  t.after(() => server.stop());
  for (const file of ['three.module.js', 'three.core.js']) {
    const response = await fetch(server.url + '/vendor/three/' + file);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.match(response.headers.get('cache-control'), /max-age=600/);
    assert.ok((await response.text()).length > 1000);
  }
  // http.request giữ nguyên đường dẫn ..; fetch sẽ tự chuẩn hóa trước khi gửi.
  for (const url of [
    '/vendor/three/../package.json', '/vendor/three/..%2fpackage.json',
    '/vendor/three/%2e%2e%2f%2e%2e%2fexpress/package.json',
    '/vendor/three/..%5cpackage.json', '/vendor/three/.git/config',
    '/vendor/three/package.json', '/vendor/three/', '/node_modules/three/package.json'
  ]) {
    const status = await new Promise((resolve, reject) => {
      http.get(server.url + url, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    assert.ok(status === 403 || status === 404, url + ': ' + status);
  }
  const module = await fetch(server.url + '/js/world3d/index.mjs?v=14');
  assert.equal(module.status, 200);
  assert.match(module.headers.get('content-type'), /javascript/);
  const page = await fetch(server.url + '/world3d-test.html');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('cache-control'), /no-cache/);
  assert.match(await page.text(), /type="importmap"/);
});

test('World3D: thiếu WebGL2 hoặc khung vẽ thì trả lý do tiếng Việt, không ném lỗi', async () => {
  const world = await import(pathToFileURL(path.join(__dirname, '../public/js/world3d/index.mjs')).href + '?v=14');
  for (const options of [undefined, { canvas: { getContext: () => null } }, { canvas: { getContext() { throw new Error('Không có ngữ cảnh'); } } }]) {
    const result = await world.start(options);
    assert.equal(result.ok, false);
    assert.match(result.reason, /3D|WebGL2/);
  }
  world.stop();
});
