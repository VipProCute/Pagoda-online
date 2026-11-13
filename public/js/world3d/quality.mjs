const SETTINGS = Object.freeze({
  low: Object.freeze({ pixelRatio: 1, shadows: false, particles: false, viewDistance: 24 }),
  medium: Object.freeze({ pixelRatio: 1.5, shadows: false, particles: true, viewDistance: 48 }),
  high: Object.freeze({ pixelRatio: 2, shadows: true, particles: true, viewDistance: 100 })
});

export function qualitySettings(quality) {
  return SETTINGS[quality] || SETTINGS.medium;
}

// World3D.setQuality điều chỉnh pixel ratio và bóng; cấu hình trả về để cảnh
// áp khoảng nhìn và hiệu ứng hạt mà không để module này phụ thuộc vào Three.js.
export function applyQuality(world3d, quality) {
  const settings = qualitySettings(quality);
  const result = world3d.setQuality(quality);
  return result?.ok ? { ...result, settings } : result;
}

export { SETTINGS as QUALITY_SETTINGS };
