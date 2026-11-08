'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('node:vm');

test('tự vào chỉ nghe, micro chỉ xin quyền sau khi chủ động bật và phòng phân biệt theo khu', async () => {
  let micRequests = 0, joinPayload, micPayload, rejectMic = false;
  const handlers = {};
  const track = { enabled: true }, stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  const node = () => ({ connect() {}, disconnect() {}, gain: { value: 0, setTargetAtTime() {} }, getFloatTimeDomainData() {} });
  const ac = { state: 'running', currentTime: 0, destination: {}, createGain: node, createAnalyser: node, createMediaStreamSource: node };
  const socket = { connected: true, on(event, fn) { handlers[event] = fn; }, emit() {}, timeout() { return { emit(ev, data, cb) {
    if (ev === 'voice:join') { joinPayload = data; cb(null, { ok: true, ice: [] }); }
    else { micPayload = data; cb(null, rejectMic ? { ok: false, reason: 'Micro bị khóa' } : { ok: true }); }
  } }; } };
  const players = [ { id: 1, scene: 'hall', place: 'hall', x: 0.5, z: 0.5 } ];
  const sandbox = { Math, Date, Float32Array, navigator: { mediaDevices: { getUserMedia: async () => { micRequests++; return stream; } } },
    RTCPeerConnection: function () {}, AudioContext: function () {}, setInterval: () => 1, clearInterval() {}, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/voice.js'), 'utf8'), sandbox);
  const voice = sandbox.Voice;
  voice.init(socket, { myId: () => 1, player: id => players.find(p => p.id === id), players: () => players, audioContext: () => ac });
  assert.equal((await voice.join()).ok, true);
  assert.equal(micRequests, 0);
  assert.equal(joinPayload.mic, false);
  assert.equal(voice.mic, false);
  assert.equal(await voice.toggleMic(), true);
  assert.equal(micRequests, 1);
  assert.equal(micPayload.on, true);
  assert.equal(track.enabled, true);
  socket.connected = false; handlers.disconnect();
  socket.connected = true; assert.equal((await voice.join()).ok, true);
  assert.equal(joinPayload.mic, true, 'khôi phục trạng thái micro người dùng đã chọn');
  assert.equal(micRequests, 1);
  assert.equal(await voice.toggleMic(), true);
  assert.equal(track.enabled, false);
  rejectMic = true;
  assert.equal(await voice.toggleMic(), 'Micro bị khóa');
  assert.equal(track.enabled, false);
  assert.equal(voice.mic, false);
  const hall = { scene: 'hall', place: 'hall', x: 0.5, z: 0.5 };
  assert.equal(voice.sameRoom(hall, { ...hall }), true);
  assert.equal(voice.sameRoom(hall, { ...hall, scene: 'yard' }), false);
  assert.equal(voice.sameRoom(hall, { ...hall, place: 'arena' }), false);
  assert.equal(voice.sameRoom({ ...hall, scene: 'yard', place: 'arena' }, { ...hall, scene: 'library', place: 'arena' }), true);
  assert.equal(voice.sameRoom({ ...hall, place: 'dojo' }, { ...hall, place: 'arena' }), false);
});
