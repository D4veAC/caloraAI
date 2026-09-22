// ==========================================================================
// FITVAULT — Three.js 3D Wireframe Orb Gyroscope (Pure Outline, Zero Fill)
// ==========================================================================

let dashCanvasAnimId = null;
let threeJSAnimId    = null;

export function initDashCanvas() {
  const canvas = document.getElementById('dash-bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (dashCanvasAnimId) {
    cancelAnimationFrame(dashCanvasAnimId);
    dashCanvasAnimId = null;
  }

  const updateSize = () => {
    const parent = canvas.parentElement;
    canvas.width  = (parent && parent.offsetWidth > 0) ? parent.offsetWidth : window.innerWidth;
    canvas.height = (parent && parent.offsetHeight > 0) ? parent.offsetHeight : 520;
  };

  updateSize();

  const stars = Array.from({ length: 50 }, () => ({
    x: Math.random() * (canvas.width || 800),
    y: Math.random() * (canvas.height || 520),
    r: Math.random() * 1.5 + 0.5,
    a: Math.random() * 0.5 + 0.2,
    speed: Math.random() * 0.2 + 0.05
  }));

  function animate() {
    const w = canvas.width || 800;
    const h = canvas.height || 520;
    ctx.clearRect(0, 0, w, h);

    stars.forEach(s => {
      s.y -= s.speed;
      if (s.y < 0) { s.y = h; s.x = Math.random() * w; }

      ctx.fillStyle = `rgba(247, 241, 232, ${s.a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    dashCanvasAnimId = requestAnimationFrame(animate);
  }

  animate();
  window.addEventListener('resize', updateSize);
}

export function initThreeJS() {
  const container = document.getElementById('canvas-container');
  if (!container || typeof THREE === 'undefined') return;

  if (threeJSAnimId) {
    cancelAnimationFrame(threeJSAnimId);
    threeJSAnimId = null;
  }

  container.innerHTML = '';

  const getW = () => container.clientWidth  || 450;
  const getH = () => container.clientHeight || 480;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(getW(), getH());
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, getW() / getH(), 0.1, 100);
  camera.position.set(0, 0, 4.2);
  camera.lookAt(0, 0, 0);

  // Soft ambient lighting
  scene.add(new THREE.AmbientLight(0xfff8f0, 2.5));
  const key = new THREE.DirectionalLight(0xffeedd, 1.2);
  key.position.set(3, 5, 4); scene.add(key);

  // Hairline metallic ring material
  const lineMat = new THREE.MeshStandardMaterial({
    color:       0xf7f1e8,
    emissive:    0x332a1e,
    roughness:   0.20,
    metalness:   0.80,
    transparent: true,
    opacity:     0.85
  });

  // Razor-thin torus ring helper
  function mkRing(r, tube = 0.006, seg = 128) {
    return new THREE.TorusGeometry(r, tube, 6, seg);
  }

  const root = new THREE.Group();
  scene.add(root);

  const R = 0.95;

  // ── 2 PERPENDICULAR 90-DEGREE HAIRLINE RINGS ─────────────────────────────
  const ringA = new THREE.Group();
  const ringB = new THREE.Group();

  // Ring A — Horizontal ring
  ringA.add(new THREE.Mesh(mkRing(R), lineMat));
  ringA.rotation.x = Math.PI * 0.15;

  // Ring B — Exactly 90 degrees perpendicular to Ring A
  ringB.add(new THREE.Mesh(mkRing(R), lineMat));
  ringB.rotation.x = Math.PI * 0.15;
  ringB.rotation.y = Math.PI * 0.50;

  root.add(ringA, ringB);

  // ── PURE TRANSPARENT WIREFRAME CORE ORB (NO WHITE FILL, ONLY OUTLINE) ──────
  const coreGroup = new THREE.Group();

  const outerWireMat = new THREE.MeshStandardMaterial({
    color:             0xf7f1e8,
    emissive:          0x221a10,
    roughness:         0.40,
    metalness:         0.20,
    transparent:       true,
    opacity:           0.65,
    wireframe:         true
  });

  // Dual Icosahedron wireframe core for elegant geometric outline depth
  const outerWire1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), outerWireMat);
  const outerWire2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.76, 2), outerWireMat);
  coreGroup.add(outerWire1, outerWire2);

  root.add(coreGroup);

  // Mouse / Touch Drag interaction
  let mouseX = 0, mouseY = 0;
  let targetRotX = 0.22, targetRotY = 0.35;
  let isDragging = false;
  let prevMouse  = { x: 0, y: 0 };
  let dragVel    = { x: 0, y: 0 };

  container.addEventListener('mousemove', e => {
    const rect = container.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;

    if (!isDragging) {
      targetRotY = mouseX * 0.65 + 0.35;
      targetRotX = mouseY * 0.45 + 0.22;
    } else {
      dragVel.y = (e.clientX - prevMouse.x) * 0.007;
      dragVel.x = (e.clientY - prevMouse.y) * 0.007;
      targetRotY += dragVel.y;
      targetRotX += dragVel.x;
      prevMouse = { x: e.clientX, y: e.clientY };
    }
  });

  container.addEventListener('mousedown', e => {
    isDragging = true;
    prevMouse = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  container.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      isDragging = true;
      prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  window.addEventListener('touchend', () => { isDragging = false; });

  container.addEventListener('touchmove', e => {
    if (!isDragging || e.touches.length !== 1) return;
    dragVel.y = (e.touches[0].clientX - prevMouse.x) * 0.007;
    dragVel.x = (e.touches[0].clientY - prevMouse.y) * 0.007;
    targetRotY += dragVel.y;
    targetRotX += dragVel.x;
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  const ro = new ResizeObserver(() => {
    const w = getW();
    const h = getH();
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(container);

  function animate() {
    if (!isDragging) {
      targetRotY += 0.004;
    }

    root.rotation.y += (targetRotY - root.rotation.y) * 0.05;
    root.rotation.x += (targetRotX - root.rotation.x) * 0.05;

    ringA.rotation.z += 0.006;
    ringB.rotation.z -= 0.006;
    outerWire1.rotation.y += 0.002;
    outerWire2.rotation.y -= 0.003;

    renderer.render(scene, camera);
    threeJSAnimId = requestAnimationFrame(animate);
  }

  animate();
}
