import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { type Role, ROLE_CONFIG } from './LoginPanel3D.types';

// ─── Per-role title copy ─────────────────────────────────────────────────────
const HERO_CONFIG: Record<Role, { headline: string; tagline: string }> = {
  student: { headline: 'The grind \nhas a home now.', tagline: 'Classes, grades, and everything AI in between.' },
  teacher: { headline: 'Teach smarter,\nnot harder.', tagline: 'AI-powered insights to help every teacher relax more.' },
  parent: { headline: 'Stay close,\neven from afar.', tagline: 'Real-time visibility into your child\'s journey.' },
  admin: { headline: 'Everything\nunder control.', tagline: 'One dashboard. Every metric. Full command.' },
};

const MODEL_PATHS: Record<Role, string> = {
  student: '/3d_models/student.glb',
  teacher: '/3d_models/teacher.glb',
  parent: '/3d_models/parent.glb',
  admin: '/3d_models/admin.glb',
};

const DEFAULT_CAM = new THREE.Vector3(0, 0, 4);

// ─── Singleton loaders ───────────────────────────────────────────────────────
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// ─── Utilities ────────────────────────────────────────────────────────────────
const setModelOpacity = (root: THREE.Object3D, opacity: number) => {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m: THREE.Material) => {
        m.transparent = true;
        (m as THREE.MeshStandardMaterial).opacity = opacity;
        m.needsUpdate = true;
      });
    }
  });
};

const fadeOpacity = (root: THREE.Object3D, from: number, to: number, ms: number): Promise<void> =>
  new Promise<void>(resolve => {
    const start = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - start) / ms, 1);
      setModelOpacity(root, from + (to - from) * t);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });

const fitModel = (root: THREE.Group): THREE.Group => {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  root.scale.setScalar(1.8 / maxDim);
  box.setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center);
  return root;
};

const disposeObject = (root: THREE.Object3D) => {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m: THREE.Material) => m?.dispose());
    }
  });
};

const buildBubbles = (color: number): THREE.Group => {
  const group = new THREE.Group();
  for (let i = 0; i < 28; i++) {
    const radius = 0.08 + Math.random() * 0.35;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: 0.15 + Math.random() * 0.2,
        shininess: 120,
        specular: new THREE.Color(0xffffff),
      }),
    );
    mesh.position.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 8,
      -2 - Math.random() * 4,
    );
    mesh.userData = {
      speedY: 0.003 + Math.random() * 0.006,
      speedX: (Math.random() - 0.5) * 0.002,
      phaseOffset: Math.random() * Math.PI * 2,
    };
    group.add(mesh);
  }
  return group;
};

const updateBubbleColor = (group: THREE.Group, color: number) => {
  group.children.forEach(child => {
    ((child as THREE.Mesh).material as THREE.MeshPhongMaterial).color.setHex(color);
  });
};

const buildFallback = (role: Role): THREE.Group => {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 32, 32),
    new THREE.MeshStandardMaterial({
      color: ROLE_CONFIG[role].primaryColor,
      emissive: ROLE_CONFIG[role].emissiveColor,
      transparent: true,
      opacity: 0,
    }),
  ));
  return group;
};

// ─── Component ────────────────────────────────────────────────────────────────
interface Props { role: Role }

export const LoginPanel3D: React.FC<Props> = ({ role }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const fillLightRef = useRef<THREE.PointLight | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const bubblesRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef(performance.now());

  const roleRef = useRef<Role>(role);
  const genRef = useRef(0);          // generation counter for transitions
  const initRef = useRef(false);
  const mountedRef = useRef(true);

  const isDragRef = useRef(false);
  const isSnapRef = useRef(false);
  const snapStartTimeRef = useRef(0);
  const snapStartPosRef = useRef(new THREE.Vector3());
  const baseYRef = useRef(0);
  const baseScaleRef = useRef(1);

  const [isLoading, setIsLoading] = useState(true);

  // ─── One-time Three.js init ─────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el || initRef.current) return;
    initRef.current = true;
    mountedRef.current = true;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    Object.assign(renderer.domElement.style, { position: 'absolute', top: '0', left: '0' });
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene + Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.copy(DEFAULT_CAM);
    cameraRef.current = camera;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(-3, 4, 5);
    const fillLight = new THREE.PointLight(ROLE_CONFIG[roleRef.current].lightColor, 1.8, 25);
    fillLight.position.set(4, -1, 3);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(3, -2, -5);
    scene.add(ambient, keyLight, fillLight, rimLight);
    fillLightRef.current = fillLight;

    // Bubbles (added before model — renders behind)
    const bubbles = buildBubbles(ROLE_CONFIG[roleRef.current].lightColor);
    scene.add(bubbles);
    bubblesRef.current = bubbles;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = false;
    controls.rotateSpeed = 0.8;
    controlsRef.current = controls;

    // Drag events
    const onMouseDown = () => {
      isDragRef.current = true;
      isSnapRef.current = false;
      controls.enabled = true;
    };
    const onMouseUp = () => {
      if (!isDragRef.current) return;
      isDragRef.current = false;
      isSnapRef.current = true;
      snapStartTimeRef.current = performance.now();
      snapStartPosRef.current.copy(camera.position);
      controls.enabled = false;
    };
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    // Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const t = (performance.now() - startTimeRef.current) / 1000;
      const model = modelRef.current;

      if (isSnapRef.current) {
        // Time-based exponential ease-out — smooth, frame-rate independent
        const elapsed = (performance.now() - snapStartTimeRef.current) / 1000;
        const progress = 1 - Math.exp(-elapsed * 3.5);
        camera.position.lerpVectors(snapStartPosRef.current, DEFAULT_CAM, progress);
        camera.lookAt(0, 0, 0);
        if (progress >= 0.995) {
          camera.position.copy(DEFAULT_CAM);
          controls.target.set(0, 0, 0);
          controls.enabled = true;
          isSnapRef.current = false;
          if (model) model.rotation.y = 0;
        }
      } else {
        if (controls.enabled) controls.update();
        if (model && !isDragRef.current) {
          model.position.y = baseYRef.current + Math.sin(t * 0.8) * 0.15;
          model.rotation.y += 0.004;
          model.scale.setScalar(baseScaleRef.current + Math.sin(t * 1.2) * 0.02);
        }
      }

      // Animate bubbles
      const bg = bubblesRef.current;
      if (bg) {
        bg.children.forEach(child => {
          const s = child as THREE.Mesh;
          s.position.y += s.userData.speedY;
          s.position.x += Math.sin(t + s.userData.phaseOffset) * s.userData.speedX;
          if (s.position.y > 5) s.position.y = -5;
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // Load initial model
    gltfLoader.load(
      MODEL_PATHS[roleRef.current],
      (gltf) => {
        if (!mountedRef.current) return;
        const model = fitModel(gltf.scene);
        setModelOpacity(model, 0);
        scene.add(model);
        modelRef.current = model;
        baseYRef.current = model.position.y + 0.38; // shift up in frame
        baseScaleRef.current = model.scale.x;
        fadeOpacity(model, 0, 1, 400).then(() => {
          if (mountedRef.current) setIsLoading(false);
        });
      },
      undefined,
      (err) => {
        if (!mountedRef.current) return;
        console.warn('GLB load failed, using fallback:', err);
        const fb = buildFallback(roleRef.current);
        scene.add(fb);
        modelRef.current = fb;
        baseYRef.current = 0;
        baseScaleRef.current = 1;
        fadeOpacity(fb, 0, 1, 400).then(() => {
          if (mountedRef.current) setIsLoading(false);
        });
      },
    );

    // ResizeObserver
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    ro.observe(el);

    return () => {
      initRef.current = false;
      mountedRef.current = false;
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      controls.dispose();
      if (modelRef.current) {
        scene.remove(modelRef.current);
        disposeObject(modelRef.current);
      }
      if (bubblesRef.current) {
        bubblesRef.current.children.forEach(child => {
          const m = child as THREE.Mesh;
          m.geometry?.dispose();
          (m.material as THREE.Material)?.dispose();
        });
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // ─── Role transition ────────────────────────────────────────────────────
  useEffect(() => {
    if (!initRef.current || !sceneRef.current || roleRef.current === role) return;

    const myGen = ++genRef.current;
    roleRef.current = role;
    if (mountedRef.current) setIsLoading(true);

    const scene = sceneRef.current;
    const oldModel = modelRef.current;

    (async () => {
      // Fade out old model
      if (oldModel) {
        await fadeOpacity(oldModel, 1, 0, 250);
        if (myGen !== genRef.current) return;
        scene.remove(oldModel);
        disposeObject(oldModel);
        modelRef.current = null;
      }

      if (myGen !== genRef.current) return;

      // Update fill light + bubbles for new role
      fillLightRef.current?.color.setHex(ROLE_CONFIG[role].lightColor);
      if (bubblesRef.current) updateBubbleColor(bubblesRef.current, ROLE_CONFIG[role].lightColor);

      // Snap camera back to default
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.copy(DEFAULT_CAM);
        cameraRef.current.lookAt(0, 0, 0);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.enabled = true;
        isDragRef.current = false;
        isSnapRef.current = false;
      }

      // Load new model
      gltfLoader.load(
        MODEL_PATHS[role],
        (gltf) => {
          if (myGen !== genRef.current || !mountedRef.current) return;
          const model = fitModel(gltf.scene);
          setModelOpacity(model, 0);
          scene.add(model);
          modelRef.current = model;
          baseYRef.current = model.position.y + 0.38;
          baseScaleRef.current = model.scale.x;
          fadeOpacity(model, 0, 1, 250).then(() => {
            if (mountedRef.current && myGen === genRef.current) setIsLoading(false);
          });
        },
        undefined,
        (err) => {
          if (myGen !== genRef.current || !mountedRef.current) return;
          console.warn('GLB load failed, using fallback:', err);
          const fb = buildFallback(role);
          scene.add(fb);
          modelRef.current = fb;
          baseYRef.current = 0;
          baseScaleRef.current = 1;
          fadeOpacity(fb, 0, 1, 250).then(() => {
            if (mountedRef.current && myGen === genRef.current) setIsLoading(false);
          });
        },
      );
    })();
  }, [role]);

  // ─── Render ─────────────────────────────────────────────────────────────
  const cfg = HERO_CONFIG[role];

  return (
    <div ref={mountRef} className="relative w-full h-full overflow-hidden">
      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-16 h-16 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
        </div>
      )}

      {/* Title card — dark gradient scrim + expressive type */}
      <div
        className="absolute bottom-0 left-0 right-0 p-8 z-10"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)' }}
      >
        {/* Role tag */}
        <div
          className="inline-block px-3 py-1 rounded-full mb-3 uppercase tracking-widest"
          style={{ background: 'rgba(255,255,255,0.2)', color: 'white', backdropFilter: 'blur(8px)', fontFamily: "'Syne', sans-serif", fontSize: '0.7rem', fontWeight: 700 }}
        >
          {role} portal
        </div>

        {/* Big headline */}
        <h2
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 'clamp(2rem, 4vw, 3.2rem)',
            fontWeight: 800,
            color: 'white',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textShadow: '0 2px 20px rgba(0,0,0,0.3)',
            whiteSpace: 'pre-line',
            margin: 0,
          }}
        >
          {cfg.headline}
        </h2>

        {/* Tagline */}
        <p
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: '0.95rem',
            color: 'rgba(255,255,255,0.75)',
            marginTop: '0.5rem',
            fontWeight: 400,
          }}
        >
          {cfg.tagline}
        </p>
      </div>
    </div>
  );
};
