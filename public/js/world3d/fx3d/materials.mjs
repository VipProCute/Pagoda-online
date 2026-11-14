'use strict';

import * as THREE from 'three';

let noise = null;

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

export function spiritMaterial({ color = '#5a1418', rim = '#ff7a1a', glow = '#ffc23a', alpha = 1, dissolveY = [-0.6, 0.15], glowMask = false } = {}) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.0, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  material.userData.uniforms = {
    uRim: { value: new THREE.Color(rim) },
    uGlow: { value: new THREE.Color(glow) },
    uAlpha: { value: alpha },
    uDissolve: { value: new THREE.Vector2(dissolveY[0], dissolveY[1]) },
    uTime: { value: 0 },
    uNoise: { value: noiseTexture() }
  };
  if (glowMask) material.defines = { SPIRIT_GLOW: '' };
  material.customProgramCacheKey = () => 'fx-spirit' + (glowMask ? '-glow' : '');
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, material.userData.uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
varying float vLocalY;
varying vec2 vNoiseUv;
#ifdef SPIRIT_GLOW
attribute vec3 color_1;
varying float vGlow;
#endif`).replace('#include <begin_vertex>', `#include <begin_vertex>
vLocalY = transformed.y;
vNoiseUv = vec2(transformed.x + transformed.z, transformed.y) * 0.9;
#ifdef SPIRIT_GLOW
vGlow = color_1.r;
#endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uRim; uniform vec3 uGlow; uniform float uAlpha; uniform vec2 uDissolve; uniform float uTime; uniform sampler2D uNoise;
varying float vLocalY; varying vec2 vNoiseUv;
#ifdef SPIRIT_GLOW
varying float vGlow;
#endif`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float spiritFr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
totalEmissiveRadiance += uRim * spiritFr * 1.6;
#ifdef SPIRIT_GLOW
totalEmissiveRadiance += uGlow * vGlow * 2.2;
#endif`).replace('#include <dithering_fragment>', `#include <dithering_fragment>
float spiritN = texture2D(uNoise, vNoiseUv + vec2(0.0, -uTime * 0.35)).r;
float spiritCut = smoothstep(uDissolve.x, uDissolve.y, vLocalY + (spiritN - 0.5) * 0.35);
gl_FragColor.a *= uAlpha * spiritCut * mix(0.55, 1.0, spiritFr);
#ifdef SPIRIT_GLOW
gl_FragColor.a = max(gl_FragColor.a, vGlow * uAlpha * spiritCut);
#endif`);
  };
  return material;
}

export function flameShellMaterial({ color = '#8fd3ff', height = 2.1, displace = true, opacity = 1, side = THREE.FrontSide } = {}) {
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uHeight: { value: height },
    uTime: { value: 0 },
    uOpacity: { value: opacity },
    uDisplace: { value: displace ? 1 : 0 },
    uNoise: { value: noiseTexture() }
  };
  const vertexShader = `
uniform float uHeight; uniform float uTime; uniform float uDisplace; uniform sampler2D uNoise;
varying float vH; varying vec3 vN; varying vec3 vV; varying vec2 vUv2;
void main() {
  vH = clamp(position.y / uHeight, 0.0, 1.0);
  vUv2 = vec2(uv.x * 2.0, uv.y * 1.5 - uTime * 0.55);
  float n = texture2D(uNoise, vUv2).r;
  vec3 p = position + normal * (n - 0.35) * 0.32 * smoothstep(0.35, 1.0, vH) * uDisplace;
  p.y += n * 0.25 * smoothstep(0.6, 1.0, vH) * uDisplace;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
  const fragmentShader = `
uniform vec3 uColor; uniform float uTime; uniform float uOpacity; uniform sampler2D uNoise;
varying float vH; varying vec3 vN; varying vec3 vV; varying vec2 vUv2;
void main() {
  float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
  float band = texture2D(uNoise, vUv2 * vec2(1.0, 0.6)).r;
  float a = (0.25 + fr) * smoothstep(0.15, 0.75, band + 0.25) * (1.0 - vH) * smoothstep(0.0, 0.08, vH) * uOpacity;
  gl_FragColor = vec4(uColor * (0.8 + band * 0.6), a);
}`;
  return new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side, toneMapped: false });
}

export function glowMaterial(color = '#ffd36b') {
  return new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
}

export function tick(material, time) {
  if (material?.userData?.uniforms?.uTime) material.userData.uniforms.uTime.value = time;
  if (material?.isShaderMaterial && material.uniforms?.uTime) material.uniforms.uTime.value = time;
}
