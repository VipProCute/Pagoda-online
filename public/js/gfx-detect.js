(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GfxDetect = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LEVELS = ['low', 'medium', 'high'];

  function pickQuality({ webgl2, cores, memory, dpr, mobile, reduceMotion } = {}) {
    if (!webgl2 || reduceMotion || mobile || (Number.isFinite(cores) && cores <= 4) || (Number.isFinite(memory) && memory <= 4) || (Number.isFinite(dpr) && dpr >= 2.5)) return 'low';
    if (Number.isFinite(cores) && cores >= 8 && Number.isFinite(memory) && memory >= 8 && (!Number.isFinite(dpr) || dpr <= 1.5)) return 'high';
    return 'medium';
  }

  function createFpsGovernor({ low = 30, windowMs = 3000, initial = 'high', now = () => performance.now() } = {}) {
    let quality = LEVELS.includes(initial) ? initial : 'medium';
    let started = now();
    let frames = 0;

    return {
      frame(time = now()) {
        frames++;
        const elapsed = time - started;
        if (elapsed < windowMs) return null;
        if (frames * 1000 / elapsed < low && quality !== 'low') {
          quality = LEVELS[Math.max(0, LEVELS.indexOf(quality) - 1)];
          started = time;
          frames = 0;
          return quality;
        }
        started = time;
        frames = 0;
        return null;
      },
      get quality() { return quality; }
    };
  }

  return { pickQuality, createFpsGovernor };
});
