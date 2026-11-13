'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const seats = [[0.22,0.44],[0.41,0.44],[0.59,0.44],[0.78,0.44],[0.22,0.72],[0.41,0.72],[0.59,0.72],[0.78,0.72]];

test('Cảnh dùng tọa độ bồ đoàn từ state và chọn bồ đoàn, kệ, sàn', async () => {
  const THREE = await import('three');
  const kit = await import('../public/js/world3d/kit.mjs');
  const { build } = await import('../public/js/world3d/scenes/library.mjs');
  const scene = build({ THREE, kit, quality: 'low', size: { width: 16, depth: 10 } });
  scene.update({ seats });
  const ray = new THREE.Raycaster(new THREE.Vector3((seats[0][0]-0.5)*16, 3, (seats[0][1]-0.5)*10), new THREE.Vector3(0,-1,0));
  assert.deepEqual(scene.pick(ray), {kind:'seat',index:0});
  ray.set(new THREE.Vector3(0,3,4), new THREE.Vector3(0,-1,0));
  const floor = scene.pick(ray);
  assert.equal(floor.kind,'floor'); assert.ok(Math.abs(floor.x-0.5)<1e-6); assert.ok(Math.abs(floor.z-0.9)<1e-6);
  ray.set(new THREE.Vector3(-4.17,1,0),new THREE.Vector3(0,0,-1));
  assert.deepEqual(scene.pick(ray), {kind:'shelf',shelf:'read'});
  ray.set(new THREE.Vector3(4.17,1,0),new THREE.Vector3(0,0,-1));
  assert.deepEqual(scene.pick(ray), {kind:'shelf',shelf:'dojo'});
  scene.update({seats:[{x:0.5,z:0.5}]});
  ray.set(new THREE.Vector3(0,3,0),new THREE.Vector3(0,-1,0));
  assert.deepEqual(scene.pick(ray),{kind:'seat',index:0});
  scene.dispose(); scene.dispose(); assert.equal(scene.pick(ray),null); kit.disposeKit();
});

test('Ba mức chất lượng dựng và giải phóng cảnh an toàn', async () => {
  const THREE = await import('three'); const kit = await import('../public/js/world3d/kit.mjs');
  const { build } = await import('../public/js/world3d/scenes/library.mjs');
  for (const quality of ['low','medium','high']) {
    const scene = build({THREE,kit,quality,size:{width:16,depth:10},reduceMotion:true});
    scene.update({seats,daylight:false},0.1);
    assert.equal(scene.group.children.filter(child => child.isPointLight).length,2);
    assert.ok(scene.bounds.minX < scene.bounds.maxX);
    if (quality === 'low') scene.group.traverse(child => { if(child.isMesh) assert.equal(child.castShadow,false); });
    scene.dispose();
  }
  kit.disposeKit();
});
