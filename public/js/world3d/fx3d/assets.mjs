'use strict';

async function defaultLoad(url) {
  const [loader] = await Promise.all([import('/vendor/three-addons/loaders/GLTFLoader.js')]);
  const gltf = await new loader.GLTFLoader().loadAsync(url);
  return { scene: gltf.scene, animations: gltf.animations || [] };
}

let clonePromise = null;
function loadClone() {
  if (!clonePromise) {
    clonePromise = import('/vendor/three-addons/utils/SkeletonUtils.js')
      .then(utils => utils.clone).catch(() => scene => scene.clone(true));
  }
  return clonePromise;
}

function disposeAsset(value) {
  const resources = new Set();
  value.scene.traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    for (const material of [].concat(node.material || [])) {
      if (!material) continue;
      resources.add(material);
      for (const key of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap']) {
        if (material[key]?.isTexture) resources.add(material[key]);
      }
    }
  });
  resources.forEach(resource => resource.dispose?.());
}

export function createAssets({ loadGltf = defaultLoad } = {}) {
  const cache = new Map();
  function load(url) {
    if (typeof url !== 'string' || !url.trim()) return Promise.resolve(null);
    let entry = cache.get(url);
    if (!entry) {
      entry = { promise: null, refs: 0, value: null };
      cache.set(url, entry);
      entry.promise = Promise.resolve().then(() => loadGltf(url))
        .then(value => value && value.scene ? value : null).catch(() => null)
        .then(async value => {
          if (!value) {
            if (cache.get(url) === entry) cache.delete(url);
            return null;
          }
          const clone = await loadClone();
          const asset = { scene: value.scene, animations: value.animations || [], clone };
          // Lượt tải đã hết người dùng vẫn phải dọn tài nguyên khi hoàn tất.
          if (entry.refs === 0) { disposeAsset(asset); return null; }
          entry.value = asset;
          return asset;
        });
    }
    entry.refs++;
    return entry.promise;
  }
  function release(url) {
    const entry = cache.get(url);
    if (!entry) return;
    entry.refs--;
    if (entry.refs > 0) return;
    cache.delete(url);
    if (entry.value) disposeAsset(entry.value);
  }
  return { load, release, size: () => cache.size };
}

export const sharedAssets = createAssets();
