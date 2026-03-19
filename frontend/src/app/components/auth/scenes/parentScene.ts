import * as THREE from 'three';
import type { FloatConfig } from '../LoginPanel3D.types';
import { ROLE_CONFIG } from '../LoginPanel3D.types';
import { createLights } from './sceneUtils';

export interface SceneObjects {
  meshes: THREE.Mesh[];
  configs: FloatConfig[];
}

const cfg = ROLE_CONFIG.parent;

const makeMat = (color: string, emissive: string) =>
  new THREE.MeshStandardMaterial({ color, emissive, transparent: true, opacity: 1 });

export const buildParentScene = (scene: THREE.Scene, group: THREE.Group): SceneObjects => {
  createLights(scene, cfg, 1.0);

  const meshes: THREE.Mesh[] = [];
  const configs: FloatConfig[] = [];

  const add = (mesh: THREE.Mesh, fc: Omit<FloatConfig, 'baseY'>) => {
    group.add(mesh);
    meshes.push(mesh);
    configs.push({ ...fc, baseY: mesh.position.y });
  };

  // House body
  const houseBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.7), makeMat('#065F46', cfg.emissiveColor));
  houseBody.position.set(0, 0, 0);

  // Roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.5, 4), makeMat('#047857', cfg.emissiveColor));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.6;

  const houseGroup = new THREE.Group();
  houseGroup.add(houseBody, roof);
  houseGroup.position.set(0, 0.1, 0);
  group.add(houseGroup);
  meshes.push(houseBody);
  configs.push({ phaseOffset: 0, amplitude: 0.06, floatSpeed: 0.28, rotSpeed: { x: 0, y: 0.004, z: 0 }, baseY: houseGroup.position.y });
  houseBody.userData.parentGroup = houseGroup;

  // Hearts ×4
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, 0.25);
  heartShape.bezierCurveTo(0, 0.5, -0.5, 0.5, -0.5, 0.25);
  heartShape.bezierCurveTo(-0.5, 0, 0, -0.1, 0, -0.4);
  heartShape.bezierCurveTo(0, -0.1, 0.5, 0, 0.5, 0.25);
  heartShape.bezierCurveTo(0.5, 0.5, 0, 0.5, 0, 0.25);
  const heartGeo = new THREE.ShapeGeometry(heartShape);
  const heartMat = makeMat('#F43F5E', '#9F1239');

  const heartPositions: [number, number, number][] = [[-1.0, 0.5, 0.3], [1.1, 0.2, 0.1], [-0.5, -0.8, 0.4], [0.8, -0.5, -0.2]];
  heartPositions.forEach((pos, i) => {
    const heart = new THREE.Mesh(heartGeo, heartMat);
    heart.position.set(...pos);
    heart.scale.set(0.5, 0.5, 0.5);
    add(heart, { phaseOffset: i * 0.9, amplitude: 0.15, floatSpeed: 0.35 + i * 0.08, rotSpeed: { x: 0, y: 0.006, z: 0.003 } });
  });

  // Calendar
  const calendar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.04), makeMat(cfg.primaryColor, cfg.emissiveColor));
  calendar.position.set(-1.0, -0.4, -0.1);
  add(calendar, { phaseOffset: 1.5, amplitude: 0.07, floatSpeed: 0.38, rotSpeed: { x: 0.002, y: 0.004, z: 0.003 } });

  // Leaves ×4
  const leafMat = makeMat('#34D399', '#065F46');
  const leafPositions: [number, number, number][] = [[0.9, 0.8, 0.5], [-0.7, 0.9, -0.2], [1.2, -0.3, 0.3], [-1.2, -0.6, 0.4]];
  leafPositions.forEach((pos, i) => {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 3), leafMat);
    leaf.position.set(...pos);
    leaf.rotation.set(0.3 * i, 0.5 * i, 0.2 * i);
    add(leaf, { phaseOffset: i * 1.2, amplitude: 0.09, floatSpeed: 0.4 + i * 0.08, rotSpeed: { x: 0.007, y: 0.005, z: 0.004 } });
  });

  // Small ambient stars ×5
  const starMat = makeMat('#A7F3D0', '#065F46');
  for (let i = 0; i < 5; i++) {
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), starMat);
    star.position.set((Math.random() - 0.5) * 2.8, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.0);
    add(star, { phaseOffset: i * 0.8, amplitude: 0.05, floatSpeed: 0.6 + i * 0.1, rotSpeed: { x: 0.005, y: 0.005, z: 0.005 } });
  }

  return { meshes, configs };
};
