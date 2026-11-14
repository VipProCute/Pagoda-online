'use strict';

import * as THREE from 'three';

let noise = null;
let dot = null;

export function dotTexture() {
  if (dot) return dot;
  const data = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const r = Math.min(1, Math.hypot(x - 15.5, y - 15.5) / 15.5);
    const smooth = r * r * (3 - 2 * r), offset = (y * 32 + x) * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = 255;
    data[offset + 3] = Math.round(255 * Math.pow(1 - smooth, 1.5));
  }
  dot = new THREE.DataTexture(data, 32, 32, THREE.RGBAFormat, THREE.UnsignedByteType);
  dot.magFilter = dot.minFilter = THREE.LinearFilter;
  dot.generateMipmaps = false; dot.needsUpdate = true;
  return dot;
}

export function sparkMaterial(color) {
  return new THREE.PointsMaterial({ color, map: dotTexture(), size: 0.09, sizeAttenuation: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, alphaTest: 0.01 });
}

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function noiseTexture() {
  if (noise) return noise;
  const random = mulberry32(1337);
  const grids = [8, 16].map(size => ({ size, values: Float32Array.from({ length: size * size }, random) }));
  const smooth = x => x * x * (3 - 2 * x);
  const mix = (a, b, t) => a + (b - a) * t;
  function sample(grid, x, y) {
    const gx = x * grid.size / 64, gy = y * grid.size / 64;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    const at = (dx, dy) => grid.values[((iy + dy) % grid.size) * grid.size + (ix + dx) % grid.size];
    return mix(mix(at(0, 0), at(1, 0), smooth(gx - ix)), mix(at(0, 1), at(1, 1), smooth(gx - ix)), smooth(gy - iy));
  }
  const data = new Uint8Array(64 * 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) data[y * 64 + x] = Math.round(255 * (sample(grids[0], x, y) * 0.65 + sample(grids[1], x, y) * 0.35));
  }
  noise = new THREE.DataTexture(data, 64, 64, THREE.RedFormat, THREE.UnsignedByteType);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = noise.minFilter = THREE.LinearFilter;
  noise.generateMipmaps = false;
  noise.needsUpdate = true;
  return noise;
}

const spiritVaryings = `
varying float vLocalY;
varying vec2 vNoiseUv;`;
const spiritPosition = `
vLocalY = transformed.y;
vNoiseUv = vec2(transformed.x + transformed.z, transformed.y) * 0.9;`;
const spiritCut = `
float spiritN = texture2D(uNoise, vNoiseUv + vec2(0.0, -uTime * 0.35)).r;
float spiritCut = smoothstep(uDissolve.x, uDissolve.y, vLocalY + (spiritN - 0.5) * 0.35);`;

export function spiritMaterial({ color = '#5a1418', rim = '#ff7a1a', glow = '#ffc23a', alpha = 1, dissolveY = [-0.6, 0.15], glowMask = false, map = null, normalMap = null, emissiveMap = null } = {}) {
  const textured = !!map;
  const material = new THREE.MeshStandardMaterial({
    ...(textured ? { color: '#ffffff', map, normalMap, emissiveMap, emissive: '#ffffff', emissiveIntensity: 1, roughness: 0.62, metalness: 0.05 }
      : { color, roughness: 0.7, metalness: 0.0 }),
    transparent: true, depthWrite: false, side: THREE.FrontSide, depthFunc: THREE.LessEqualDepth
  });
  material.userData.uniforms = {
    uRim: { value: new THREE.Color(rim) },
    uGlow: { value: new THREE.Color(glow) },
    uAlpha: { value: alpha },
    uDissolve: { value: new THREE.Vector2(dissolveY[0], dissolveY[1]) },
    uTime: { value: 0 },
    uNoise: { value: noiseTexture() }
  };
  if (textured) material.defines = { SPIRIT_TEX: '' };
  else if (glowMask) material.defines = { SPIRIT_GLOW: '' };
  material.customProgramCacheKey = () => 'fx-spirit' + (textured ? '-tex' : glowMask ? '-glow' : '');
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, material.userData.uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>${spiritVaryings}
#ifdef SPIRIT_GLOW
attribute vec3 color_1;
varying float vGlow;
#endif`).replace('#include <begin_vertex>', `#include <begin_vertex>${spiritPosition}
#ifdef SPIRIT_GLOW
vGlow = color_1.r;
#endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uRim; uniform vec3 uGlow; uniform float uAlpha; uniform vec2 uDissolve; uniform float uTime; uniform sampler2D uNoise;
${spiritVaryings}
#ifdef SPIRIT_GLOW
varying float vGlow;
#endif`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float fr = pow(1.0 - abs(dot(normalize(${textured ? 'nonPerturbedNormal' : 'normal'}), normalize(vViewPosition))), 4.0);
float spiritGlow = 0.0;
#if defined(SPIRIT_TEX) && defined(USE_EMISSIVEMAP)
spiritGlow = max(max(emissiveColor.r, emissiveColor.g), emissiveColor.b);
#endif
totalEmissiveRadiance += uRim * fr * 0.6;
// T-203: linh thể tự sáng nhẹ theo màu da để ban đêm không chìm thành bóng đen như ảnh 2D vẽ tay.
totalEmissiveRadiance += diffuseColor.rgb * 0.18;
#ifdef SPIRIT_GLOW
spiritGlow = vGlow;
totalEmissiveRadiance += uGlow * vGlow * 2.2;
#endif`).replace('#include <dithering_fragment>', `#include <dithering_fragment>
${spiritCut}
float body = uAlpha * spiritCut;
float rimA = fr * spiritCut * min(1.0, uAlpha * 2.0 + 0.25);
float glowA = spiritGlow * spiritCut;
gl_FragColor.a = clamp(max(body, max(rimA, glowA)), 0.0, 1.0);`);
  };
  return material;
}

export function spiritDepthMaterial({ dissolveY = [-0.6, 0.15], threshold = 0.55, minAlpha = 0.6 } = {}) {
  const material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, side: THREE.FrontSide });
  material.userData.uniforms = {
    uDissolve: { value: new THREE.Vector2(dissolveY[0], dissolveY[1]) },
    uThreshold: { value: threshold }, uAlpha: { value: 1 }, uMinAlpha: { value: minAlpha },
    uTime: { value: 0 }, uNoise: { value: noiseTexture() }
  };
  material.customProgramCacheKey = () => 'fx-spirit-depth';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, material.userData.uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>${spiritVaryings}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>${spiritPosition}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>${spiritVaryings}
uniform vec2 uDissolve; uniform float uThreshold; uniform float uAlpha; uniform float uMinAlpha; uniform float uTime; uniform sampler2D uNoise;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>${spiritCut}
if (spiritCut < uThreshold || uAlpha < uMinAlpha) discard;`);
  };
  return material;
}

export function flameShellMaterial({ ribbon = false, color = ribbon ? '#ff6a1a' : '#8fd3ff', height = 2.1, displace = true, opacity = 1, seed = 0, side = THREE.FrontSide } = {}) {
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uHeight: { value: height },
    uTime: { value: 0 },
    uOpacity: { value: opacity },
    uSeed: { value: seed },
    uDisplace: { value: displace ? 1 : 0 },
    uNoise: { value: noiseTexture() }
  };
  const vertexShader = `
#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
uniform float uHeight; uniform float uTime; uniform float uDisplace; uniform float uSeed; uniform sampler2D uNoise;
varying float vH; varying float vDist; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main() {
  #include <morphinstance_vertex>
  #include <beginnormal_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #ifdef FLAME_RIBBON
  vH = uv.y;
  #else
  vH = clamp(position.y / uHeight, 0.0, 1.0);
  #endif
  vUv = uv;
  vec3 p = transformed;
  #ifdef FLAME_RIBBON
  float n = texture2D(uNoise, vec2(uv.x * 2.0, uv.y * 1.5 - uTime * 0.7)).r;
  p += objectNormal * (n - 0.3) * 0.22 * smoothstep(0.4, 1.0, vH) * uDisplace;
  p.y += n * 0.45 * smoothstep(0.55, 1.0, vH) * uDisplace;
  #else
  float around = uv.x;
  float k = texture2D(uNoise, vec2(around * 4.0 + uSeed, uTime * 0.35)).r;
  p += objectNormal * (k - 0.4) * 0.12 * smoothstep(0.3, 1.0, vH) * uDisplace;
  p.y += pow(vH, 2.0) * (k - 0.3) * 0.7 * uDisplace;
  p.x += sin(uTime * 2.1 + p.y * 3.0 + uSeed * 6.0) * 0.025 * vH * uDisplace;
  #endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDist = -mv.z;
  vN = normalize(transformedNormal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
  const fragmentShader = `
uniform vec3 uColor; uniform float uTime; uniform float uOpacity; uniform float uSeed; uniform sampler2D uNoise;
varying float vH; varying float vDist; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main() {
  #ifdef FLAME_RIBBON
  float n1 = texture2D(uNoise, vec2(vUv.x * 3.0, vUv.y * 1.2 - uTime * 0.9)).r;
  float n2 = texture2D(uNoise, vec2(vUv.x * 7.0 + 0.3, vUv.y * 2.4 - uTime * 1.6)).r;
  float n = n1 * 0.65 + n2 * 0.35;
  float tongue = smoothstep(0.0, 0.25, (1.0 - vH) * 0.9 + n * 0.55 - 0.45);
  float streak = pow(texture2D(uNoise, vec2(vUv.x * 9.0, vUv.y * 0.35 - uTime * 0.8)).r, 4.0);
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.3);
  // T-203: trộn thường nên tăng độ đục để lửa giữ màu cam đỏ trên nền sáng.
  float a = min(0.9, edge * tongue * (0.6 + streak) * uOpacity);
  vec3 col = mix(uColor, vec3(1.0, 0.62, 0.18), clamp(streak * 0.6 + (1.0 - vH) * 0.3, 0.0, 0.6));
  col = mix(col, uColor * vec3(0.8, 0.35, 0.2), smoothstep(0.7, 1.0, vH));
  gl_FragColor = vec4(col * (0.9 + n * 0.5), a);
  #else
  float around = vUv.x;
  // Điều phối chỉnh khi xem trong trình duyệt: viền đứt thành sợi lửa, giữa thân gần trong suốt, màu đậm theo bậc.
  float n1 = texture2D(uNoise, vec2(around * 3.0 + uSeed, vH * 0.9 - uTime * 0.7)).r;
  float n2 = texture2D(uNoise, vec2(around * 7.0 - uSeed, vH * 1.8 - uTime * 1.4)).r;
  float n = n1 * 0.6 + n2 * 0.4;
  float s = texture2D(uNoise, vec2(around * 6.0 + n1 * 0.6 + uSeed, vH * 0.3 - uTime * 0.9)).r;
  float strand = smoothstep(0.35, 0.75, s);
  // T-203: lưới đã có lưỡi lửa nên chỉ mờ ở ngọn; trộn thường (không cộng sáng) để giữ màu bậc trên nền sáng.
  float top = 1.0 - smoothstep(0.72 + n * 0.2, 0.98 + n * 0.2, vH);
  float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
  float a = (fr * 1.7 + 0.1) * mix(0.2, 1.0, strand) * top * smoothstep(0.04, 0.24, vH) * uOpacity;
  a *= smoothstep(0.9, 2.6, vDist);
  a = min(a, 0.8);
  vec3 deep = uColor * uColor;
  vec3 col = mix(deep, mix(uColor, vec3(1.0), 0.25), smoothstep(0.6, 0.95, s) * fr);
  gl_FragColor = vec4(col * 1.25, a);
  #endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
  return new THREE.ShaderMaterial({ defines: ribbon ? { FLAME_RIBBON: '' } : {}, uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.NormalBlending, side, toneMapped: true });
}

export function glowMaterial(color = '#ffd36b') {
  return new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
}

export function tick(material, time) {
  if (material?.userData?.uniforms?.uTime) material.userData.uniforms.uTime.value = time;
  if (material?.isShaderMaterial && material.uniforms?.uTime) material.uniforms.uTime.value = time;
}
