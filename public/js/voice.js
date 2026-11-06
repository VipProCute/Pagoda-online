/*
 * Nói chuyện bằng giọng trong chánh điện (WebRTC: tiếng nói đi thẳng giữa các trình duyệt).
 *
 * Giống đi chùa thật:
 *  - Đứng gần nghe rõ, đứng xa nghe nhỏ dần rồi im hẳn; người bên trái nghe ở tai trái.
 *  - Mỗi máy chỉ nối với tối đa 8 người gần nhất đang bật nói chuyện, nên chánh điện đông vẫn chạy.
 *  - Khi đại chúng đang tụng kinh, tiếng nói chuyện tự nhỏ lại.
 * Máy chủ chỉ chuyển lời mời kết nối (SDP/ICE), không nghe và không ghi âm.
 */
(function (root) {
  'use strict';
  const XW = 1.6;                    // sàn rộng hơn sâu (giống máy chủ)
  const NEAR = 0.16, FAR = 0.72;     // nghe rõ trong bán kính NEAR, im hẳn ở FAR
  const R_ON = 0.66, R_OFF = 0.8;    // nối khi gần hơn R_ON, ngắt khi xa hơn R_OFF
  const MAX_PEERS = 8, HARD_MAX = 12;
  const CONNECT_TIMEOUT = 20000;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => (a.scene || 'hall') !== (b.scene || 'hall') ? Infinity : Math.hypot((a.x - b.x) * XW, a.z - b.z);

  let sock = null, H = {};
  let active = false, joining = false, wanted = false;
  let stream = null, track = null, micOn = false, ice = [];
  let AC = null, bus = null, selfAn = null, selfBuf = null, selfLevel = 0, selfSilent = null;
  let volume = 1, duck = 1, muted = false;
  const peers = new Map();           // pid -> peer
  const blocked = new Set();         // người mình tự tắt tiếng
  const fails = new Map();           // pid -> { n, until }
  let loopT = 0, levelT = 0;

  const supported = () => !!(root.RTCPeerConnection && (root.AudioContext || root.webkitAudioContext));
  const canMic = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const send = (to, s) => { if (sock && sock.connected) sock.emit('voice:signal', { to, s }); };
  const changed = () => H.change && H.change();

  /* ---------- âm thanh ---------- */
  function ctx() {
    if (!AC) {
      AC = (H.audioContext && H.audioContext()) || new (root.AudioContext || root.webkitAudioContext)();
      bus = AC.createGain(); bus.connect(AC.destination);
      applyBus();
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function applyBus() { if (bus) bus.gain.setTargetAtTime(muted ? 0 : volume * duck, AC.currentTime, 0.12); }
  function rms(an, buf) {
    an.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }
  function setupSelf() {
    if (!stream) return;
    const ac = ctx();
    const src = ac.createMediaStreamSource(stream);
    selfAn = ac.createAnalyser(); selfAn.fftSize = 512; selfBuf = new Float32Array(selfAn.fftSize);
    selfSilent = ac.createGain(); selfSilent.gain.value = 0;
    src.connect(selfAn); selfAn.connect(selfSilent); selfSilent.connect(ac.destination);  // để trình duyệt chịu phân tích
  }
  function attach(peer, ms) {
    if (peer.src || peer.closed) return;
    const ac = ctx();
    // Chrome chỉ chịu đưa tiếng WebRTC vào Web Audio khi luồng cũng gắn vào một thẻ <audio> (tắt tiếng)
    peer.el = new Audio(); peer.el.muted = true; peer.el.srcObject = ms;
    const p = peer.el.play(); if (p && p.catch) p.catch(() => {});
    peer.src = ac.createMediaStreamSource(ms);
    peer.an = ac.createAnalyser(); peer.an.fftSize = 512; peer.buf = new Float32Array(peer.an.fftSize);
    peer.gain = ac.createGain(); peer.gain.gain.value = 0;
    peer.src.connect(peer.an); peer.src.connect(peer.gain);
    let last = peer.gain;
    if (ac.createStereoPanner) { peer.pan = ac.createStereoPanner(); peer.gain.connect(peer.pan); last = peer.pan; }
    last.connect(bus);
  }
  function detach(peer) {
    try { if (peer.src) peer.src.disconnect(); if (peer.gain) peer.gain.disconnect(); if (peer.pan) peer.pan.disconnect(); } catch (e) { /* bỏ qua */ }
    if (peer.el) { peer.el.srcObject = null; peer.el = null; }
    peer.src = peer.an = peer.gain = peer.pan = null;
  }

  /* ---------- kết nối từng người ---------- */
  function makePeer(pid, init) {
    const pc = new RTCPeerConnection({ iceServers: ice });
    const peer = { pid, pc, init, q: Promise.resolve(), state: 'connecting', born: Date.now(), level: 0, vol: 0, pending: [], closed: false };
    peers.set(pid, peer);
    pc.onicecandidate = e => { if (e.candidate) send(pid, { type: 'ice', c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.ontrack = e => attach(peer, e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]));
    pc.onconnectionstatechange = () => onState(peer);
    pc.oniceconnectionstatechange = () => onState(peer);
    changed();
    return peer;
  }
  function run(peer, fn) {
    peer.q = peer.q.then(() => (peer.closed ? null : fn())).catch(e => {
      if (!peer.closed) { if (root.console) console.warn('[voice]', e); markFail(peer.pid); close(peer, true); }
    });
  }
  function call(pid) {
    const peer = makePeer(pid, true);
    run(peer, async () => {
      peer.pc.addTransceiver(track || 'audio', { direction: 'sendrecv' });
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      send(pid, { type: 'offer', sdp: peer.pc.localDescription.sdp });
    });
  }
  async function flushIce(peer) {
    const list = peer.pending; peer.pending = [];
    for (const c of list) await peer.pc.addIceCandidate(c).catch(() => {});
  }
  function onSignal(from, s) {
    if (!active || !s) return;
    let peer = peers.get(from);
    if (s.type === 'bye') { if (peer) close(peer, false); return; }
    if (s.type === 'offer') {
      if (peer) close(peer, false);
      if (peers.size >= HARD_MAX || typeof s.sdp !== 'string') { send(from, { type: 'bye' }); return; }
      peer = makePeer(from, false);
      run(peer, async () => {
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: s.sdp });
        const tr = peer.pc.getTransceivers()[0];
        if (tr) { tr.direction = 'sendrecv'; if (track) await tr.sender.replaceTrack(track); }
        const ans = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(ans);
        send(from, { type: 'answer', sdp: peer.pc.localDescription.sdp });
        await flushIce(peer);
      });
    } else if (s.type === 'answer') {
      if (!peer || !peer.init || typeof s.sdp !== 'string') return;
      run(peer, async () => { await peer.pc.setRemoteDescription({ type: 'answer', sdp: s.sdp }); await flushIce(peer); });
    } else if (s.type === 'ice') {
      if (!peer || !s.c) return;
      run(peer, async () => {
        if (!peer.pc.remoteDescription) peer.pending.push(s.c);
        else await peer.pc.addIceCandidate(s.c).catch(() => {});
      });
    }
  }
  function onState(peer) {
    if (peer.closed) return;
    const st = peer.pc.connectionState || peer.pc.iceConnectionState;
    if (st === 'connected' || st === 'completed') { peer.state = 'connected'; peer.ok = true; fails.delete(peer.pid); clearTimeout(peer.dt); }
    else if (st === 'failed') { markFail(peer.pid); close(peer, true); return; }
    else if (st === 'disconnected') {
      peer.state = 'connecting';
      clearTimeout(peer.dt);
      peer.dt = setTimeout(() => {
        const now = peer.pc.connectionState || peer.pc.iceConnectionState;
        if (!peer.closed && (now === 'disconnected' || now === 'failed')) { markFail(peer.pid); close(peer, true); }
      }, 8000);
    }
    changed();
  }
  function markFail(pid) {
    const f = fails.get(pid) || { n: 0, until: 0 };
    f.n++; f.until = Date.now() + Math.min(120e3, 10e3 * Math.pow(2, f.n - 1));
    fails.set(pid, f);
    if (f.n === 2 && H.notice) {
      const p = H.player(pid);
      H.notice(`Chưa nối được tiếng với ${p ? p.name : 'một đạo hữu'}. Mạng của một trong hai người đang chặn kết nối trực tiếp.`);
    }
  }
  function close(peer, notify) {
    if (peer.closed) return;
    peer.closed = true;
    clearTimeout(peer.dt);
    if (peers.get(peer.pid) === peer) peers.delete(peer.pid);
    if (notify) send(peer.pid, { type: 'bye' });
    try { peer.pc.close(); } catch (e) { /* bỏ qua */ }
    detach(peer);
    H.talk && H.talk(peer.pid, 0);
    changed();
  }
  function closeAll(notify) { [...peers.values()].forEach(p => close(p, notify)); }

  /* ---------- chọn người để nối, chỉnh âm lượng theo khoảng cách ---------- */
  function loop() {
    if (!active) return;
    const myId = H.myId(), meP = H.player(myId);
    if (!meP) return;
    const list = H.players();
    const byId = new Map(list.map(p => [p.id, p]));
    for (const peer of [...peers.values()]) {
      const p = byId.get(peer.pid);
      if (!p || !p.v) close(peer, false);
      else if (dist(meP, p) > R_OFF) close(peer, true);
      else if (!peer.ok && Date.now() - peer.born > CONNECT_TIMEOUT) { markFail(peer.pid); close(peer, true); }
    }
    const near = list.filter(p => p.id !== myId && p.v && dist(meP, p) < R_ON)
      .sort((a, b) => dist(meP, a) - dist(meP, b)).slice(0, MAX_PEERS);
    for (const p of near) {
      if (peers.has(p.id) || peers.size >= MAX_PEERS) continue;
      if (myId > p.id) continue;                       // người có số nhỏ hơn mời trước, tránh hai bên cùng mời
      const f = fails.get(p.id); if (f && f.until > Date.now()) continue;
      call(p.id);
    }
  }
  function levels() {
    if (!active || !AC) return;
    const myId = H.myId(), meP = H.player(myId);
    for (const peer of peers.values()) {
      if (!peer.an) continue;
      const p = H.player(peer.pid);
      if (meP && p) {
        const d = dist(meP, p);
        let v = d <= NEAR ? 1 : d >= FAR ? 0 : 1 - (d - NEAR) / (FAR - NEAR);
        v = Math.pow(v, 1.3);
        if (blocked.has(peer.pid)) v = 0;
        peer.vol = v;
        peer.gain.gain.setTargetAtTime(v, AC.currentTime, 0.15);
        if (peer.pan) peer.pan.pan.setTargetAtTime(clamp((p.x - meP.x) * XW / 0.55, -0.8, 0.8), AC.currentTime, 0.15);
      }
      const lv = rms(peer.an, peer.buf);
      peer.level = Math.max(lv, peer.level * 0.82);
      const talking = peer.level > 0.018 && !blocked.has(peer.pid);
      H.talk(peer.pid, talking ? Math.min(1, peer.level * 10) : 0);
    }
    if (selfAn && micOn && track && track.enabled) {
      selfLevel = Math.max(rms(selfAn, selfBuf), selfLevel * 0.82);
      const talking = selfLevel > 0.018;
      H.talk(myId, talking ? Math.min(1, selfLevel * 10) : 0);
    } else H.talk(myId, 0);
  }

  /* ---------- micro ---------- */
  async function getMic() {
    if (!canMic()) { const e = new Error('Trang cần mở bằng https để dùng micro.'); e.name = 'NotSupported'; throw e; }
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false });
  }
  function useStream(s) {
    stream = s; track = s.getAudioTracks()[0] || null;
    if (track) track.onended = () => { micOn = false; track = null; if (sock && active) sock.emit('voice:mic', { on: false }); changed(); };
    setupSelf();
  }
  function stopStream() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; track = null; selfAn = null; micOn = false;
  }
  const micError = e => (e && e.name === 'NotAllowedError' ? 'denied' : e && e.name === 'NotSupported' ? 'insecure' : 'nomic');

  /* ---------- API ---------- */
  async function join() {
    if (active || joining) return { ok: active };
    if (!supported()) return { ok: false, reason: 'Trình duyệt này chưa hỗ trợ nói chuyện bằng giọng. Bạn thử Chrome, Safari hoặc Firefox bản mới nhé.' };
    joining = true;
    ctx();
    let why = '';
    if (!stream) { try { useStream(await getMic()); } catch (e) { why = micError(e); } }
    const r = await new Promise(res => sock.timeout(10000).emit('voice:join', { mic: !!track }, (err, x) => res(err ? null : x)));
    joining = false;
    if (!r || !r.ok) { stopStream(); return { ok: false, reason: (r && r.reason) || 'Máy chủ chưa trả lời. Thử lại nhé.' }; }
    ice = Array.isArray(r.ice) ? r.ice : [];
    active = true; wanted = true; micOn = !!track;
    if (track) track.enabled = true;
    clearInterval(loopT); clearInterval(levelT);
    loopT = setInterval(loop, 800); levelT = setInterval(levels, 100);
    loop(); changed();
    return { ok: true, listenOnly: !track, why };
  }
  function leave(keepWanted) {
    if (sock && active && sock.connected) sock.emit('voice:leave');
    active = false; wanted = !!keepWanted;
    clearInterval(loopT); clearInterval(levelT);
    closeAll(!keepWanted);
    if (!keepWanted) stopStream();
    H.talk && H.myId && H.talk(H.myId(), 0);
    changed();
  }
  async function setMic(on) {
    if (!active) return false;
    if (on && !track) {
      try { useStream(await getMic()); } catch (e) { return micError(e); }
      for (const peer of peers.values()) {
        const tr = peer.pc.getTransceivers()[0];
        if (tr && tr.sender) tr.sender.replaceTrack(track).catch(() => {});
      }
    }
    micOn = !!(on && track);
    if (track) track.enabled = micOn;
    sock.emit('voice:mic', { on: micOn });
    changed();
    return true;
  }

  root.Voice = {
    init(socket, hooks) {
      sock = socket; H = hooks || {};
      sock.on('voice:signal', d => d && onSignal(Number(d.from), d.s));
      sock.on('disconnect', () => { if (active) leave(true); });     // máy chủ quên trạng thái, vào lại thì nối lại
    },
    get supported() { return supported(); },
    get active() { return active; },
    get joining() { return joining; },
    get wanted() { return wanted; },
    get mic() { return micOn; },
    get hasMic() { return !!track; },
    join, leave: () => leave(false), setMic,
    toggleMic() { return setMic(!micOn); },
    drop(pid) { const p = peers.get(pid); if (p) close(p, false); },
    mute(pid, on) { if (on) blocked.add(pid); else blocked.delete(pid); changed(); },
    isMuted: pid => blocked.has(pid),
    setDuck(x) { duck = x; applyBus(); },
    setMuted(m) { muted = !!m; applyBus(); },
    setVolume(v) { volume = clamp(v, 0, 1.5); applyBus(); },
    get volume() { return volume; },
    peers() {
      return [...peers.values()].map(p => ({ pid: p.pid, state: p.state, vol: p.vol, level: p.level, muted: blocked.has(p.pid) }));
    },
    stats() {
      let connected = 0; for (const p of peers.values()) if (p.state === 'connected') connected++;
      return { peers: peers.size, connected };
    }
  };
})(this);
