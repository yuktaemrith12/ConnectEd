import * as THREE from 'three';
import type { RoleConfig } from '../LoginPanel3D.types';

export const createLights = (scene: THREE.Scene, roleConfig: RoleConfig, intensity = 1.2) => {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(roleConfig.lightColor, intensity, 100);
  pointLight.position.set(2, 3, 4);
  scene.add(pointLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
  rimLight.position.set(-3, -1, -2);
  scene.add(rimLight);
};

export const createParticles = (count: number, color: number): THREE.Points => {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 8;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    velocities[i] = 0.002 + Math.random() * 0.004;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color,
    size: 0.04,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.userData.velocities = velocities;
  return points;
};

export const updateParticles = (points: THREE.Points | null) => {
  if (!points) return;
  const positions = points.geometry.attributes.position.array as Float32Array;
  const velocities = points.userData.velocities as Float32Array;
  const limit = 4;
  for (let i = 0; i < velocities.length; i++) {
    positions[i * 3 + 1] += velocities[i];
    if (positions[i * 3 + 1] > limit) positions[i * 3 + 1] = -limit;
  }
  points.geometry.attributes.position.needsUpdate = true;
};

export const updateParticleColor = (points: THREE.Points | null, color: number) => {
  if (!points) return;
  (points.material as THREE.PointsMaterial).color.setHex(color);
};

export const disposeGroup = (group: THREE.Group) => {
  group.traverse(obj => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        (mesh.material as THREE.Material).dispose();
      }
    }
  });
};

export const setGroupOpacity = (group: THREE.Group, opacity: number) => {
  group.traverse(obj => {
    if ((obj as THREE.Mesh).isMesh) {
      const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.transparent = true;
      mat.opacity = opacity;
    }
  });
};

export const fadeGroup = (group: THREE.Group, from: number, to: number, duration: number): Promise<void> => {
  return new Promise<void>(resolve => {
    const start = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - start) / duration, 1);
      setGroupOpacity(group, from + (to - from) * t);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
};
