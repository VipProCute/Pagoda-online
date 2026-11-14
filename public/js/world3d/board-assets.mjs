// T-113 · Nạp mô hình .glb cho skin Kỳ Đài (nửa sân, bộ quân) một cách lười.
// - GLTFLoader chỉ được import() khi lần đầu có skin cần mô hình.
// - Mỗi đường dẫn nạp đúng một lần mỗi trang; kết quả (kể cả "không có") được nhớ.
// - Lỗi mạng, 404, file hỏng: trả null, không ném lỗi, không ghi console; bàn tự lùi về vẽ bằng palette.
// - Mẫu trong bộ nhớ đệm là dùng chung, KHÔNG được sửa; bàn nào cần thì gọi instantiate() để có bản riêng.
// File này không import gì ở mức module để Node test nạp thẳng được.
'use strict';

export const LOADER_URL = '/vendor/three-addons/loaders/GLTFLoader.js';

/** createAssetLoader({ importer, loaderUrl }) → { loadModel(url), has(url), clear() }.
 * importer(url) → Promise<module có GLTFLoader>; mặc định là import() động của trình duyệt. */
export function createAssetLoader({ importer = url => import(url), loaderUrl = LOADER_URL } = {}) {
  let loader = null;
  const cache = new Map();
  function getLoader() {
    if (!loader) {
      loader = Promise.resolve()
        .then(() => importer(loaderUrl))
        .then(mod => (mod && typeof mod.GLTFLoader === 'function' ? new mod.GLTFLoader() : null))
        .catch(() => null);
    }
    return loader;
  }
  /** Trả Promise<Object3D|null>: cảnh gốc của file .glb (mẫu dùng chung). */
  function loadModel(url) {
    if (typeof url !== 'string' || !url.startsWith('/')) return Promise.resolve(null);
    if (!cache.has(url)) {
      cache.set(url, getLoader()
        .then(gltf => (gltf ? gltf.loadAsync(url) : null))
        .then(result => (result && result.scene && result.scene.isObject3D ? result.scene : null))
        .catch(() => null));
    }
    return cache.get(url);
  }
  return {
    loadModel,
    has: url => cache.has(url),
    clear() { cache.clear(); }
  };
}

/** T-125 · Nạp ẢNH (sân v2) một lần mỗi đường dẫn; kết quả (kể cả "không có") được nhớ.
 * Cái được nhớ là ảnh đã giải mã (HTMLImageElement/ImageBitmap), KHÔNG phải THREE.Texture: mỗi bàn tự bọc ảnh
 * thành texture riêng rồi tự dispose(), còn ảnh dùng chung nên không bao giờ bị giải phóng theo bàn.
 * Lỗi mạng/404/ảnh hỏng: trả null, không ném lỗi, không ghi console.
 * make(url) → Promise<ảnh> (tiêm để test); mặc định dùng new Image() của trình duyệt. */
export function createImageLoader({ make } = {}) {
  const cache = new Map();
  const decode = make || (url => new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không nạp được ảnh.'));
    img.src = url;
  }));
  function loadImage(url) {
    if (typeof url !== 'string' || !url.startsWith('/')) return Promise.resolve(null);
    if (!cache.has(url)) {
      cache.set(url, Promise.resolve().then(() => decode(url))
        .then(img => (img && img.width > 0 && img.height > 0 ? img : null))
        .catch(() => null));
    }
    return cache.get(url);
  }
  return { loadImage, has: url => cache.has(url), clear() { cache.clear(); } };
}

const shared = createAssetLoader();
const sharedImages = createImageLoader();
/** Bộ nạp ảnh dùng chung cho cả trang. */
export const loadImage = url => sharedImages.loadImage(url);
/** Bộ nạp dùng chung cho cả trang (mọi bàn 3D cùng chia bộ nhớ đệm). */
export const loadModel = url => shared.loadModel(url);

/** Tạo bản riêng của một mẫu: hình học, vật liệu, texture đều được nhân bản để bàn này tự giải phóng.
 * materials:false giữ nguyên vật liệu của mẫu (bàn sẽ thay bằng vật liệu skin, chỉ đọc tên).
 * Trả { root, resources:Set } — resources là mọi thứ cần dispose() khi bỏ bản này. */
export function instantiate(template, { materials = true } = {}) {
  const resources = new Set();
  const root = template.clone(true);
  const geometries = new Map(), mats = new Map(), textures = new Map();
  const texture = t => {
    if (!textures.has(t)) { const c = t.clone(); textures.set(t, c); resources.add(c); }
    return textures.get(t);
  };
  const material = m => {
    if (!m) return m;
    if (!mats.has(m)) {
      const c = m.clone();
      for (const key of Object.keys(c)) if (c[key] && c[key].isTexture) c[key] = texture(c[key]);
      mats.set(m, c); resources.add(c);
    }
    return mats.get(m);
  };
  root.traverse(o => {
    if (o.geometry) {
      if (!geometries.has(o.geometry)) { const g = o.geometry.clone(); geometries.set(o.geometry, g); resources.add(g); }
      o.geometry = geometries.get(o.geometry);
    }
    if (materials && o.material) o.material = Array.isArray(o.material) ? o.material.map(material) : material(o.material);
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return { root, resources };
}

export function disposeAll(resources) {
  for (const r of resources) if (r && typeof r.dispose === 'function') r.dispose();
  resources.clear();
}
