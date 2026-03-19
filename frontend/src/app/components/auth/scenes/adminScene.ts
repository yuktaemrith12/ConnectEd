import * as THREE from 'three';
import type { FloatConfig } from '../LoginPanel3D.types';
import { ROLE_CONFIG } from '../LoginPanel3D.types';
import { createLights } from './sceneUtils';

export interface SceneObjects {
  meshes: THREE.Mesh[];
  configs: FloatConfig[];
}

const cfg = ROLE_CONFIG.admin;

const makeMat = (color: string, emissive: string) =>
  new THREE.MeshStandardMaterial({ color, emissive, transparent: true, opacity: 1 });

export const buildAdminScene = (scene: THREE.Scene, group: THREE.Group): SceneObjects => {
  createLights(scene, cfg, 1.5);

  const meshes: THREE.Mesh[] = [];
  const configs: FloatConfig[] = [];

  const add = (mesh: THREE.Mesh, fc: Omit<FloatConfig, 'baseY'>) => {
    group.add(mesh);
    meshes.push(mesh);
    configs.push({ ...fc, baseY: mesh.position.y });
  };

  // Server cubes ×4
  const serverMat = makeMat(cfg.primaryColor, cfg.emissiveColor);
  const serverPositions: [number, number, number][] = [[-0.8, 0.5, 0], [0.8, 0.3, 0.1], [-0.3, -0.6, 0.2], [0.4, 0.9, -0.3]];
  serverPositions.forEach((pos, i) => {
    const server = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.4), serverMat);
    server.position.set(...pos);
    add(server, { phaseOffset: i * 0.9, amplitude: 0.08, floatSpeed: 0.4 + i * 0.05, rotSpeed: { x: 0.002, y: 0.006, z: 0.001 } });
  });

  // Gear rings ×3
  const gearMat = new THREE.MeshStandardMaterial({ color: cfg.primaryColor, emissive: cfg.emissiveColor, transparent: true, opacity: 1 });
  const gearData = [
    { pos: [0, 0.1, 0.3] as [number, number, number], speed: 0.012 },
    { pos: [-1.1, -0.2, 0.1] as [number, number, number], speed: -0.008 },
    { pos: [1.0, -0.5, -0.2] as [number, number, number], speed: 0.015 },
  ];
  gearData.forEach((gd, i) => {
    const gear = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 24), gearMat);
    gear.position.set(...gd.pos);
    add(gear, { phaseOffset: i * 1.1, amplitude: 0.07, floatSpeed: 0.35, rotSpeed: { x: 0, y: 0, z: gd.speed } });
  });

  // Dashboard frame (wireframe)
  const dashMat = new THREE.MeshBasicMaterial({ color: cfg.primaryColor, wireframe: true, transparent: true, opacity: 0.8 });
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.04), dashMat);
  dash.position.set(-0.1, -0.8, 0.5);
  group.add(dash);
  meshes.push(dash);
  configs.push({ phaseOffset: 0.5, amplitude: 0.06, floatSpeed: 0.32, rotSpeed: { x: 0, y: 0.003, z: 0 }, baseY: dash.position.y });
  dash.userData.isPulse = true;

  // Bar graph ×5
  const barMat = makeMat('#FB923C', cfg.emissiveColor);
  const barHeights = [0.3, 0.5, 0.2, 0.6, 0.4];
  barHeights.forEach((h, i) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.1), barMat);
    bar.position.set(0.6 + i * 0.15 - 0.3, -0.2 + h / 2, 0.4);
    add(bar, { phaseOffset: i * 0.4, amplitude: 0.05, floatSpeed: 0.5, rotSpeed: { x: 0, y: 0.003, z: 0 } });
  });

  // Orbiting rings ×2
  const ringMat = new THREE.MeshStandardMaterial({ color: '#FB923C', emissive: cfg.emissiveColor, transparent: true, opacity: 0.9 });
  const ringData = [
    { pos: [0.1, 0.2, 0] as [number, number, number], rotX: Math.PI / 4 },
    { pos: [0.1, 0.2, 0] as [number, number, number], rotX: -Math.PI / 4 },
  ];
  ringData.forEach((rd, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 8, 64), ringMat);
    ring.position.set(...rd.pos);
    ring.rotation.x = rd.rotX;
    add(ring, { phaseOffset: i * Math.PI, amplitude: 0.04, floatSpeed: 0.3, rotSpeed: { x: 0, y: 0.01 * (i % 2 === 0 ? 1 : -1), z: 0 } });
  });

  return { meshes, configs };
};
