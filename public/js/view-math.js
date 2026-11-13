(function (root) {
  'use strict';

  const SCENE_SIZE = Object.freeze({
    hall: Object.freeze({ width: 16, depth: 10 }),
    yard: Object.freeze({ width: 24, depth: 15 }),
    library: Object.freeze({ width: 16, depth: 10 }),
    arena: Object.freeze({ width: 20, depth: 12.5 })
  });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const radians = (degrees) => degrees * Math.PI / 180;

  function toWorld(scene, x, z) {
    const size = SCENE_SIZE[scene];
    return { x: (x - 0.5) * size.width, z: (z - 0.5) * size.depth };
  }

  function toFloor(scene, x, z) {
    const size = SCENE_SIZE[scene];
    return { x: x / size.width + 0.5, z: z / size.depth + 0.5 };
  }

  function createView(options = {}) {
    const view = {
      mode: 'third', yaw: 0, pitch: radians(20), dist: 5,
      rotate(dx, dy) {
        this.yaw += dx;
        const limits = this.mode === 'first' ? [-60, 60] : [5, 70];
        this.pitch = clamp(this.pitch + dy, radians(limits[0]), radians(limits[1]));
      },
      zoom(factor) {
        this.dist = clamp(this.dist * factor, 2, 9);
      },
      setMode(mode) {
        if (mode !== 'first' && mode !== 'third') throw new RangeError('Góc nhìn không hợp lệ');
        this.mode = mode;
        this.rotate(0, 0);
      }
    };
    view.setMode(options.mode || 'third');
    return view;
  }

  function cameraPose(view, target, bounds) {
    const eye = { x: target.x, y: (target.y || 0) + 1.55, z: target.z };
    const horizontal = Math.cos(view.pitch);
    const direction = { x: Math.sin(view.yaw) * horizontal, y: Math.sin(view.pitch), z: -Math.cos(view.yaw) * horizontal };
    if (view.mode === 'first') {
      return { pos: eye, look: { x: eye.x + direction.x, y: eye.y + direction.y, z: eye.z + direction.z } };
    }
    // Rút cả tia về mắt để giữ góc cúi, thay vì đẩy riêng X/Z lên đầu người.
    const offset = { x: -direction.x * view.dist, y: direction.y * view.dist, z: -direction.z * view.dist };
    let t = 1;
    for (const axis of ['x', 'z']) {
      if (offset[axis] > 0) t = Math.min(t, (bounds[axis === 'x' ? 'maxX' : 'maxZ'] - eye[axis]) / offset[axis]);
      else if (offset[axis] < 0) t = Math.min(t, (bounds[axis === 'x' ? 'minX' : 'minZ'] - eye[axis]) / offset[axis]);
    }
    if (Number.isFinite(bounds.maxY) && offset.y > 0) t = Math.min(t, (bounds.maxY - eye.y) / offset.y);
    // Sát tường hơn 12% khoảng cách thì ưu tiên ở trong bounds, không xuyên tường.
    t = clamp(t, 0, 1);
    return {
      pos: {
        x: eye.x + offset.x * t,
        y: Math.max(0.3, eye.y + offset.y * t),
        z: eye.z + offset.z * t
      },
      look: eye
    };
  }

  function moveTarget(scene, x, z, yaw, fwd, strafe, step) {
    const length = Math.hypot(fwd, strafe);
    if (length > 1) { fwd /= length; strafe /= length; }
    const position = toWorld(scene, x, z);
    const result = toFloor(scene,
      position.x + (Math.sin(yaw) * fwd + Math.cos(yaw) * strafe) * step * SCENE_SIZE[scene].depth,
      position.z + (-Math.cos(yaw) * fwd + Math.sin(yaw) * strafe) * step * SCENE_SIZE[scene].depth);
    return { x: clamp(result.x, 0.03, 0.97), z: clamp(result.z, 0.12, 0.97) };
  }

  function smooth(cur, goal, dt, reduceMotion) {
    return reduceMotion ? goal : cur + (goal - cur) * (1 - Math.exp(-10 * Math.max(0, dt)));
  }

  const api = { SCENE_SIZE, toWorld, toFloor, createView, cameraPose, moveTarget, smooth };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ViewMath = api;
})(this);
