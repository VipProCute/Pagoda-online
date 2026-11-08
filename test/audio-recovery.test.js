'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(ios) {
  let time = 100000, mediaSources = 0, resumes = 0;
  const elements = [], intervals = [], listeners = {};
  const param = () => ({ value: 0, setTargetAtTime() {} });
  const node = () => ({ gain: param(), threshold: param(), ratio: param(), connect() {}, disconnect() {} });
  class Context {
    constructor() { this.state = 'running'; this.sampleRate = 100; this.currentTime = 1; this.destination = {}; }
    createDynamicsCompressor() { return node(); } createGain() { return node(); } createConvolver() { return node(); }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createMediaElementSource() { mediaSources++; return node(); }
    resume() { resumes++; this.state = 'running'; return Promise.resolve(); }
  }
  class Audio {
    constructor(src) { this.src = src; this.paused = true; this.currentTime = 0; this.duration = 120; this.events = {}; elements.push(this); }
    setAttribute() {} addEventListener(name, fn) { this.events[name] = fn; }
    removeAttribute() { this.src = ''; } load() {} pause() { this.paused = true; }
    play() { this.paused = false; return Promise.resolve(); }
  }
  const document = { hidden: false, addEventListener(name, fn) { listeners[name] = fn; } };
  const sandbox = { Audio, AudioContext: Context, Math, Float32Array, Date: { now: () => time }, document,
    navigator: { userAgent: ios ? 'iPhone' : 'Chrome', platform: ios ? 'iPhone' : 'Linux' },
    performance: { now: () => time }, setInterval(fn) { intervals.push(fn); return intervals.length; },
    setTimeout() { return 1; }, clearTimeout() {}, addEventListener(name, fn) { listeners[name] = fn; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/audio.js'), 'utf8'), sandbox);
  return { sfx: sandbox.SFX, elements, document, listeners, intervals, advance(ms) { time += ms; intervals.forEach(fn => fn()); }, get sources() { return mediaSources; }, get resumes() { return resumes; } };
}
test('iPhone phát nhạc nền ngoài Web Audio, dừng khi ẩn và phục hồi khi trở lại', () => {
  const e = setup(true); e.sfx.unlock(); e.sfx.unlock();
  assert.equal(e.sources, 0); assert.equal(e.elements.length, 1);
  assert.equal(e.elements[0].paused, false);
  e.document.hidden = true; e.listeners.visibilitychange(); assert.equal(e.elements[0].paused, true);
  const ac = e.sfx.context(); ac.state = 'interrupted';
  e.document.hidden = false; e.listeners.visibilitychange();
  assert.equal(e.elements[0].paused, false); assert.equal(e.resumes, 1);
  e.sfx.setMuted(true); assert.equal(e.elements[0].paused, true);
});
test('nhạc bị kẹt vị trí được tạo lại một lần; desktop giữ một media source qua các lần unlock', () => {
  const e = setup(true); e.sfx.unlock(); e.advance(2000); e.advance(8000);
  assert.equal(e.elements.length, 2); assert.equal(e.elements[0].src, ''); assert.equal(e.elements[0].paused, true);
  e.elements[1].currentTime = 2; e.advance(2000); assert.equal(e.elements.length, 2);
  const d = setup(false); d.sfx.unlock(); d.sfx.unlock(); d.sfx.recover(); assert.equal(d.sources, 1);
});
