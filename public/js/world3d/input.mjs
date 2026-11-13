'use strict';

const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
const editing = target => !!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],dialog[open]');

export function createInput({ canvas, camera, math, getState, fire, choose, joystick }) {
  const view = camera.view, keys = new Set(), pointers = new Map(), listeners = [];
  let dragging = null, pinch = null, lastMove = -Infinity, stick = null, axes = { fwd: 0, strafe: 0 };
  function listen(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  }
  function clear() { keys.clear(); pointers.clear(); dragging = null; pinch = null; stick = null; axes = { fwd: 0, strafe: 0 }; }
  listen(canvas, 'pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, travel: 0 };
    else {
      if (dragging) dragging.travel = Infinity;
      const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  listen(canvas, 'pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (view.mode === 'third' && pinch && distance) view.zoom(pinch / distance);
      pinch = distance; return;
    }
    if (!dragging || dragging.id !== event.pointerId) return;
    const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
    dragging.travel += Math.hypot(dx, dy); dragging.x = event.clientX; dragging.y = event.clientY;
    // Góc thứ nhất: kéo xuống là nhìn xuống; góc thứ ba: kéo xuống nâng máy quay.
    view.rotate(-dx * 0.005, dy * (view.mode === 'first' ? -0.004 : 0.004));
  });
  function endPointer(event) {
    if (event.type === 'pointerup' && dragging?.id === event.pointerId && dragging.travel < 7) choose(event);
    pointers.delete(event.pointerId); pinch = null;
    if (!pointers.size) dragging = null;
  }
  listen(canvas, 'pointerup', endPointer); listen(canvas, 'pointercancel', endPointer);
  listen(canvas, 'lostpointercapture', endPointer);
  listen(canvas, 'wheel', event => {
    event.preventDefault(); if (view.mode === 'third') view.zoom(Math.exp(event.deltaY * 0.001));
  }, { passive: false });
  listen(globalThis, 'keydown', event => {
    if (editing(event.target) || !movementKeys.includes(event.key.toLowerCase())) return;
    keys.add(event.key.toLowerCase()); event.preventDefault();
  });
  listen(globalThis, 'keyup', event => keys.delete(event.key.toLowerCase()));
  listen(globalThis, 'blur', clear);
  listen(document, 'visibilitychange', clear);
  listen(document, 'focusin', event => { if (editing(event.target)) clear(); });
  if (joystick) {
    function moveStick(event) {
      if (stick !== event.pointerId) return;
      const r = joystick.getBoundingClientRect(), radius = r.width / 2;
      axes = { strafe: Math.max(-1, Math.min(1, (event.clientX - r.left - radius) / radius)),
        fwd: Math.max(-1, Math.min(1, (r.top + r.height / 2 - event.clientY) / radius)) };
    }
    listen(joystick, 'pointerdown', event => {
      if (stick !== null) return;
      event.preventDefault(); stick = event.pointerId; joystick.setPointerCapture(stick); moveStick(event);
    });
    listen(joystick, 'pointermove', moveStick);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(joystick, type, event => {
      if (stick === event.pointerId) { stick = null; axes = { fwd: 0, strafe: 0 }; }
    });
  }
  return {
    update(time) {
      if (editing(document.activeElement) || document.hidden || time - lastMove < 125) return;
      const fwd = axes.fwd + Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
      const strafe = axes.strafe + Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
      if (Math.hypot(fwd, strafe) < 0.15) return;
      const state = getState(), self = state.players?.find(p => p.id === state.me);
      if (!self || !math.SCENE_SIZE[state.scene]) return;
      const target = math.moveTarget(state.scene, self.x, self.z, view.yaw, fwd, strafe, 0.12);
      lastMove = time; fire('floor', target.x, target.z);
    },
    dispose() { clear(); listeners.forEach(remove => remove()); }
  };
}
