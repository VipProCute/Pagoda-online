'use strict';
/*
 * Trợ giúp chạy máy chủ thật trong tiến trình con và nối bằng socket.io-client (dùng cho test e2e).
 * Chỉ xuất hàm, không chạy gì khi được nạp.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const ROOT = path.join(__dirname, '..', '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Mở máy chủ. env ghi đè biến môi trường. Trả { port, url, logs, stop(), restart(), admin(path, method, body), dataFile }. */
async function startServer(env = {}) {
  const port = env.PORT ? Number(env.PORT) : await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chua-'));
  const dataFile = env.DATA_FILE || path.join(dir, 'db.json');
  const base = {
    PATH: process.env.PATH, PORT: String(port), ADMIN_KEY: 'khoa-quan-tri-thu', TRUST_PROXY: '0', DATA_FILE: dataFile,
    MARTIAL_SWEEP_MS: '100', SITE_NAME: 'Chua Thu', NODE_ENV: 'test'
  };
  const state = { logs: [], child: null };
  async function launch() {
    const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...base, ...env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    state.child = child;
    child.stdout.on('data', d => state.logs.push(String(d)));
    child.stderr.on('data', d => state.logs.push(String(d)));
    const t0 = Date.now();
    for (;;) {
      if (child.exitCode != null) throw new Error('Máy chủ thoát sớm:\n' + state.logs.join(''));
      try { const r = await fetch(`http://127.0.0.1:${port}/healthz`); if (r.ok) return; } catch (e) { /* chưa lên */ }
      if (Date.now() - t0 > 20000) { child.kill('SIGKILL'); throw new Error('Máy chủ không lên được:\n' + state.logs.join('')); }
      await sleep(80);
    }
  }
  async function stop() {
    const c = state.child;
    if (!c || c.exitCode != null) return;
    await new Promise(res => { c.once('exit', res); c.kill('SIGTERM'); setTimeout(() => c.kill('SIGKILL'), 12000).unref(); });
  }
  await launch();
  const url = `http://127.0.0.1:${port}`;
  async function admin(p, method = 'GET', body, key = base.ADMIN_KEY) {
    const r = await fetch(url + p, { method, headers: { 'x-admin-key': key, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) { /* không phải JSON */ }
    return { status: r.status, json, text };
  }
  return { port, url, dataFile, logs: state.logs, stop, restart: async () => { await stop(); await launch(); }, admin, get child() { return state.child; } };
}

module.exports = { startServer, freePort, sleep, ROOT };
