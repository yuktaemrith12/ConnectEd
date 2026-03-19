import * as THREE from 'three';
import type { FloatConfig } from '../LoginPanel3D.types';
import { ROLE_CONFIG } from '../LoginPanel3D.types';
import { createLights } from './sceneUtils';

export interface SceneObjects {
  meshes: THREE.Mesh[];
  configs: FloatConfig[];
}

const cfg = ROLE_CONFIG.student;

const makeMat = (color: string, emissive: string) =>
  new THREE.MeshStandardMaterial({ color, emissive, transparent: true, opacity: 1 });

export const buildStudentScene = (scene: THREE.Scene, group: THREE.Group): SceneObjects => {
  createLights(scene, cfg, 1.4);

  const meshes: THREE.Mesh[] = [];
  const configs: FloatConfig[] = [];

  const add = (mesh: THREE.Mesh, fc: Omit<FloatConfig, 'baseY'>) => {
    group.add(mesh);
    meshes.push(mesh);
    configs.push({ ...fc, baseY: mesh.position.y });
  };

  // Books ×3
  const bookPositions: [number, number, number][] = [[-1.2, 0.3, 0], [0.2, -0.5, 0.2], [1.0, 0.6, -0.3]];
  bookPositions.forEach((pos, i) => {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.08), makeMat(cfg.primaryColor, cfg.emissiveColor));
    book.position.set(...pos);
    book.rotation.set(0.2 * i, 0.3 * i, 0.1 * i);
    add(book, { phaseOffset: i * 1.2, amplitude: 0.12, floatSpeed: 0.5 + i * 0.1, rotSpeed: { x: 0.003, y: 0.005, z: 0.002 } });
  });

  // Pencils ×3
  const pencilMat = makeMat('#FBBF24', '#92400E');
  const pencilPositions: [number, number, number][] = [[-0.5, 0.8, 0.4], [0.7, -0.2, 0.5], [-1.0, -0.6, 0.1]];
  pencilPositions.forEach((pos, i) => {
    const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), pencilMat);
    pencil.position.set(...pos);
    pencil.rotation.set(Math.PI / 4 * i, 0, Math.PI / 3 * i);
    add(pencil, { phaseOffset: i * 0.9, amplitude: 0.08, floatSpeed: 0.9 + i * 0.2, rotSpeed: { x: 0.02, y: 0.008, z: 0.015 } });
  });

  // Graduation cap
  const capGroup = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 16), makeMat('#1E40AF', '#1D4ED8'));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8), makeMat('#1E40AF', '#1D4ED8'));
  top.position.y = 0.18;
  capGroup.add(brim, top);
  capGroup.position.set(0.5, 0.9, -0.4);
  group.add(capGroup);
  // Treat capGroup as a single mesh by pushing brim as representative
  meshes.push(brim);
  configs.push({ phaseOffset: 2.0, amplitude: 0.1, floatSpeed: 0.4, rotSpeed: { x: 0, y: 0.008, z: 0 }, baseY: capGroup.position.y });
  // Store capGroup ref on brim for animation
  brim.userData.parentGroup = capGroup;

  // Paper planes ×2
  const planeMat = makeMat('#BFDBFE', '#3B82F6');
  const planePositions: [number, number, number][] = [[-0.8, -0.9, -0.2], [1.2, -0.3, 0.3]];
  planePositions.forEach((pos, i) => {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      0, 0, 0.3,
      -0.25, 0, -0.25,
      0.25, 0, -0.25,
      0, 0.15, 0,
    ]);
    const idx = new Uint16Array([0, 1, 3, 0, 3, 2, 1, 2, 3]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const plane = new THREE.Mesh(geo, planeMat);
    plane.position.set(...pos);
    plane.rotation.set(-0.2, i * 0.8, 0.1);
    add(plane, { phaseOffset: i * 1.5, amplitude: 0.1, floatSpeed: 0.6, rotSpeed: { x: 0.002, y: 0.004, z: 0.003 } });
  });

  // Marbles ×5
  const marbleMat = makeMat('#93C5FD', cfg.emissiveColor);
  for (let i = 0; i < 5; i++) {
    const marble = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), marbleMat);
    marble.position.set((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.0);
    add(marble, { phaseOffset: i * 0.7, amplitude: 0.06, floatSpeed: 1.0 + i * 0.15, rotSpeed: { x: 0.01, y: 0.01, z: 0.01 } });
  }

  return { meshes, configs };
};
