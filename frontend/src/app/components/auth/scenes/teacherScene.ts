import * as THREE from 'three';
import type { FloatConfig } from '../LoginPanel3D.types';
import { ROLE_CONFIG } from '../LoginPanel3D.types';
import { createLights } from './sceneUtils';

export interface SceneObjects {
  meshes: THREE.Mesh[];
  configs: FloatConfig[];
}

const cfg = ROLE_CONFIG.teacher;

const makeMat = (color: string, emissive: string) =>
  new THREE.MeshStandardMaterial({ color, emissive, transparent: true, opacity: 1 });

export const buildTeacherScene = (scene: THREE.Scene, group: THREE.Group): SceneObjects => {
  createLights(scene, cfg, 1.2);

  const meshes: THREE.Mesh[] = [];
  const configs: FloatConfig[] = [];

  const add = (mesh: THREE.Mesh, fc: Omit<FloatConfig, 'baseY'>) => {
    group.add(mesh);
    meshes.push(mesh);
    configs.push({ ...fc, baseY: mesh.position.y });
  };

  // Blackboard
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.06), makeMat('#1E1B4B', '#4C1D95'));
  board.position.set(0, 0.2, 0);
  add(board, { phaseOffset: 0, amplitude: 0.08, floatSpeed: 0.3, rotSpeed: { x: 0.002, y: 0.006, z: 0 } });

  // Stars ×6 (gold)
  const starMat = makeMat('#FBBF24', '#92400E');
  const starPositions: [number, number, number][] = [[-1.2, 0.8, 0.2], [1.1, 0.6, 0.1], [-0.6, -0.7, 0.3],
    [0.9, -0.5, -0.2], [-1.0, 0.1, -0.3], [0.4, 1.0, 0.4]];
  starPositions.forEach((pos, i) => {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), starMat);
    star.position.set(...pos);
    add(star, { phaseOffset: i * 0.8, amplitude: 0.1, floatSpeed: 0.7 + i * 0.1, rotSpeed: { x: 0.015, y: 0.02, z: 0.01 } });
  });

  // Open books ×2
  const bookMat = makeMat(cfg.primaryColor, cfg.emissiveColor);
  const bookPositions: [number, number, number][] = [[-0.9, -0.3, 0.2], [0.8, -0.6, -0.1]];
  bookPositions.forEach((pos, i) => {
    const pageL = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), bookMat);
    const pageR = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), bookMat);
    pageL.rotation.y = 0.35;
    pageR.rotation.y = -0.35;
    pageL.position.x = -0.2;
    pageR.position.x = 0.2;
    const bookGroup = new THREE.Group();
    bookGroup.add(pageL, pageR);
    bookGroup.position.set(...pos);
    group.add(bookGroup);
    // represent with pageL
    meshes.push(pageL);
    configs.push({ phaseOffset: i * 1.3, amplitude: 0.09, floatSpeed: 0.45, rotSpeed: { x: 0.002, y: 0.004, z: 0.001 }, baseY: bookGroup.position.y });
    pageL.userData.parentGroup = bookGroup;
  });

  // Teaching sphere
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 32), makeMat('#7C3AED', cfg.emissiveColor));
  sphere.position.set(0.3, -0.9, 0.1);
  add(sphere, { phaseOffset: 1.0, amplitude: 0.14, floatSpeed: 0.5, rotSpeed: { x: 0.003, y: 0.007, z: 0.002 } });

  // Arrows ×4
  const arrowMat = makeMat(cfg.primaryColor, cfg.emissiveColor);
  const arrowConfigs: { pos: [number, number, number]; rot: [number, number, number] }[] = [
    { pos: [-1.3, -0.6, 0.4], rot: [0, 0, 0] },
    { pos: [1.2, 0.1, 0.3], rot: [0, 0, Math.PI] },
    { pos: [-0.3, 0.9, -0.2], rot: [0, 0, Math.PI / 2] },
    { pos: [0.7, 0.7, 0.5], rot: [0, 0, -Math.PI / 2] },
  ];
  arrowConfigs.forEach((ac, i) => {
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 8), arrowMat);
    arrow.position.set(...ac.pos);
    arrow.rotation.set(...ac.rot);
    add(arrow, { phaseOffset: i * 1.1, amplitude: 0.07, floatSpeed: 0.55 + i * 0.1, rotSpeed: { x: 0.003, y: 0.005, z: 0.002 } });
  });

  return { meshes, configs };
};
