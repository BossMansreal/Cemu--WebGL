// js/renderer.js - local-only, imports local three.module.js
import * as THREE from '../vendor/three.module.js';

let renderer, scene, camera, texture, texData, mesh;

export function createRenderer(width, height) {
  // Create renderer and append canvas to body
  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.display = 'block';
  document.body.appendChild(renderer.domElement);

  // Scene + camera (ortho to map texture to full screen)
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  // texture backing
  texData = new Uint8Array(width * height * 4);
  texture = new THREE.DataTexture(texData, width, height, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.flipY = true;

  const material = new THREE.MeshBasicMaterial({ map: texture });
  mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);

  // Handle resize
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function updateTexture(frameUint8) {
    // Accept either a typed array or an HEAPU8 view
    if (!frameUint8) return;
    if (frameUint8.buffer === texData.buffer) {
      // same buffer, nothing to do
    } else {
      // If frameUint8 is a view of HEAPU8, create a copy
      texData.set(frameUint8.subarray(0, texData.length));
    }
    texture.needsUpdate = true;
  }

  function render() {
    renderer.render(scene, camera);
  }

  return { updateTexture, render };
}

