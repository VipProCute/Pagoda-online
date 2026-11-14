'use strict';

import { register } from './index.mjs?v=3';

function demon(env) {
  const { THREE, materials, RENDER, track } = env;
  const group = env.group('demon');
  if (env.host.rig) env.host.rig.add(group);
  group.position.set(0, 1.1, -0.5);
  group.visible = false;
  const material = track(materials.spiritMaterial());
  const body = new THREE.Mesh(track(new THREE.SphereGeometry(0.5, 24, 16)), material);
  body.renderOrder = RENDER.demon;
  group.add(body);
  const eyeGeometry = track(new THREE.SphereGeometry(0.055, 8, 6));
  const eyeMaterial = track(materials.glowMaterial('#ffc23a'));
  const eyes = [-1, 1].map(sign => {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(sign * 0.15, 0.2, 0.43);
    eye.renderOrder = RENDER.demon;
    group.add(eye);
    return eye;
  });
  let time = 0;
  return {
    update(state, dt) {
      const n = state.demon?.n || 0;
      const height = [0, 0.45, 1.3, 1.9, 2.8][n] || 0;
      group.visible = height > 0;
      if (!group.visible) return false;
      if (!env.reducedMotion) time += dt;
      body.scale.y = height;
      eyes.forEach(eye => { eye.position.y = height * 0.2; });
      material.userData.uniforms.uAlpha.value = state.demon.alpha ?? 1;
      eyeMaterial.opacity = state.demon.alpha ?? 1;
      materials.tick(material, time);
      return true;
    },
    hide() { group.visible = false; },
    dispose() { group.removeFromParent(); group.clear(); }
  };
}

function lotus(env) {
  const { THREE, RENDER, track } = env;
  const group = env.group('lotus');
  group.visible = false;
  const material = track(new THREE.MeshStandardMaterial({ color: '#d9a640', metalness: 0.6, roughness: 0.35, emissive: '#5a3a08' }));
  const disk = new THREE.Mesh(track(new THREE.CylinderGeometry(0.5, 0.42, 0.08, 16)), material);
  disk.position.y = 0.04;
  disk.renderOrder = RENDER.lotus;
  group.add(disk);
  const petalGeometry = track(new THREE.ConeGeometry(0.09, 0.32, 4));
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI * 2 / 16;
    const petal = new THREE.Mesh(petalGeometry, material);
    petal.position.set(Math.sin(angle) * 0.46, 0.1, Math.cos(angle) * 0.46);
    petal.rotation.set(Math.PI / 3, 0, 0);
    petal.rotation.order = 'YXZ';
    petal.rotation.y = angle;
    petal.renderOrder = RENDER.lotus;
    group.add(petal);
  }
  return {
    update(state) { group.visible = state.tier >= 2; return group.visible; },
    hide() { group.visible = false; },
    dispose() { group.removeFromParent(); group.clear(); }
  };
}

function aura(env) {
  const { THREE, materials, RENDER, track } = env;
  const group = env.group('aura');
  group.visible = false;
  const geometry = track(new THREE.SphereGeometry(0.55, 16, 12));
  const shells = [THREE.BackSide, THREE.FrontSide].map((side, i) => {
    const material = track(materials.flameShellMaterial({ side }));
    const shell = new THREE.Mesh(geometry, material);
    shell.scale.set(1, 2.1 / 1.1, 1);
    shell.position.y = 1.05;
    shell.renderOrder = i === 0 ? RENDER.shellBack : RENDER.shellFront;
    group.add(shell);
    return shell;
  });
  let time = 0, points = null;
  function syncParticles() {
    const enabled = env.quality === 'high' && !env.reducedMotion;
    if (enabled && !points) {
      points = env.particles(32, track(new THREE.PointsMaterial({ color: '#8fd3ff', size: 0.05, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    }
    if (points) points.visible = enabled && group.visible;
  }
  syncParticles();
  return {
    update(state, dt) {
      group.visible = state.tier >= 1;
      syncParticles();
      if (!group.visible) return false;
      if (!env.reducedMotion) time += dt;
      for (const shell of shells) {
        shell.material.uniforms.uColor.value.set(state.color || '#ffd36b');
        shell.material.uniforms.uOpacity.value = state.fade ?? 1;
        shell.material.uniforms.uDisplace.value = env.quality === 'low' ? 0 : 1;
        materials.tick(shell.material, time);
      }
      if (points?.visible) {
        points.material.color.set(state.color || '#ffd36b');
        points.material.opacity = state.fade ?? 1;
        const position = points.geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          const angle = i * 2.39996 + time * 0.4;
          position.setXYZ(i, Math.sin(angle) * 0.6, (i / position.count * 2.1 + time * 0.45) % 2.1, Math.cos(angle) * 0.6);
        }
        position.needsUpdate = true;
      }
      return true;
    },
    setQuality() { syncParticles(); },
    setReducedMotion() { syncParticles(); },
    hide() { group.visible = false; if (points) points.visible = false; },
    dispose() { group.removeFromParent(); group.clear(); points?.removeFromParent(); }
  };
}

export function placeholderParts() { return { demon, lotus, aura }; }

export function registerPlaceholders() {
  const parts = placeholderParts();
  for (const name in parts) register(name, parts[name]);
}
