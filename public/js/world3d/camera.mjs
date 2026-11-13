'use strict';

// Tách từ trang thử Chánh điện: cùng quỹ đạo, giới hạn và chiều xoay.
export function createCamera({ camera, math, mode = 'third' }) {
  const view = math.createView();
  view.dist = 5.7;
  function setView(value) {
    view.setMode(value);
    view.pitch = value === 'first' ? 0.04 : 0.34;
  }
  setView(mode);
  return {
    view, setView,
    update(state, content) {
      const self = state.players?.find(p => p.id === state.me);
      const position = math.toWorld(state.scene, self?.x ?? 0.5, self?.z ?? 0.67);
      position.y = content.surfaceHeight?.(self?.x ?? 0.5, self?.z ?? 0.67) || 0;
      const size = math.SCENE_SIZE[state.scene];
      const bounds = content.bounds || { minX: -size.width / 2, maxX: size.width / 2, minZ: -size.depth / 2, maxZ: size.depth / 2 };
      const pose = math.cameraPose(view, position, bounds);
      camera.position.set(pose.pos.x, Math.min(6, pose.pos.y), pose.pos.z);
      camera.lookAt(pose.look.x, pose.look.y, pose.look.z);
      camera.updateMatrixWorld();
    }
  };
}
