/* Samson Pest Control hero: a dusk lawn of instanced grass blades that sway in the wind and part
   around the visitor's cursor, with fireflies above. Mirrors the grass in the Samson logo.
   Vanilla three.js (self hosted). Falls back to a photo when WebGL is unavailable. */
import * as THREE from '../vendor/three.module.min.js';

const mount = document.getElementById('grass');
const hero = mount ? mount.closest('[data-hero]') : null;

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

const srgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

if (mount && hero) {
  if (!webglOK()) hero.classList.add('no-webgl');
  else {
    try { start(); } catch (err) { console.warn('[samson] grass', err); hero.classList.add('no-webgl'); }
  }
}

function start() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.innerWidth < 760;
  let count = small ? 13000 : 34000;

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(mount.clientWidth, mount.clientHeight, false);
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const fov = small ? 58 : 44;
  const camera = new THREE.PerspectiveCamera(fov, mount.clientWidth / mount.clientHeight, 0.1, 200);
  const camBase = new THREE.Vector3(0, 1.35, 7.5);
  camera.position.copy(camBase);
  camera.lookAt(0, 2.1, -10);

  /* ---- one blade: tapered strip, 5 segments, y in [0,1], x in [-0.5,0.5] ---- */
  const SEG = 5;
  const pos = [];
  const idx = [];
  for (let i = 0; i < SEG; i++) {
    const y = i / SEG;
    const hw = 0.5 * (1 - Math.pow(y, 1.35));
    pos.push(-hw, y, 0, hw, y, 0);
  }
  pos.push(0, 1, 0);
  for (let i = 0; i < SEG - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const lastL = (SEG - 1) * 2, lastR = lastL + 1, tip = SEG * 2;
  idx.push(lastL, lastR, tip);

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);

  const offsets = new Float32Array(count * 3);
  const params = new Float32Array(count * 4);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const aspect = Math.max(1.2, mount.clientWidth / mount.clientHeight);
  for (let i = 0; i < count; i++) {
    const z = 6.2 - Math.pow(Math.random(), 1.45) * 48;
    const dist = camBase.z - z;
    const half = dist * tanHalf * aspect * 1.2 + 1.5;
    offsets[i * 3] = (Math.random() * 2 - 1) * half;
    offsets[i * 3 + 1] = 0;
    offsets[i * 3 + 2] = z;
    const near = THREE.MathUtils.clamp((dist - 1.5) / 6, 0.35, 1);
    params[i * 4] = (0.38 + Math.random() * 0.62) * near + (dist > 20 ? 0.25 : 0);   // height
    params[i * 4 + 1] = (0.045 + Math.random() * 0.05) * (dist > 18 ? 1.8 : 1);       // width
    params[i * 4 + 2] = Math.random() * Math.PI;                                       // rotation
    params[i * 4 + 3] = Math.random();                                                 // random
  }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 4));
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -18), 80);

  const uniforms = {
    uTime: { value: 0 },
    uGrow: { value: reduce ? 1 : 0 },
    uMouse: { value: new THREE.Vector2(0, -100) },
    uMouseStrength: { value: 0 },
    uBase: { value: srgb('#06140a') },
    uTip: { value: srgb('#5c9e36') },
    uTip2: { value: srgb('#7fbf55') },
    uRim: { value: srgb('#00aaaf') },
    uFog: { value: srgb('#123420') },
    uFogNear: { value: 12 },
    uFogFar: { value: 50 },
  };

  const grassMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uGrow;
      uniform vec2 uMouse;
      uniform float uMouseStrength;
      attribute vec3 aOffset;
      attribute vec4 aParams;
      varying float vY;
      varying float vRnd;
      varying float vDist;
      void main() {
        float h = aParams.x;
        float w = aParams.y;
        float rot = aParams.z;
        float rnd = aParams.w;
        float grow = clamp(uGrow * 1.5 - rnd * 0.5, 0.0, 1.0);
        grow = grow * grow * (3.0 - 2.0 * grow);
        float y = position.y;
        h *= max(grow, 0.001);

        vec3 p = vec3(position.x * w, y * h, 0.0);
        float c = cos(rot), s = sin(rot);
        p = vec3(p.x * c, p.y, p.x * s);
        vec3 world = p + aOffset;

        float t = uTime;
        float gust = sin(aOffset.x * 0.11 + t * 0.85) * 0.55 + sin(aOffset.z * 0.19 + t * 1.25 + aOffset.x * 0.05) * 0.45;
        float flutter = sin(t * 2.4 + rnd * 6.2831 + aOffset.x * 0.5) * 0.07;
        float bend = (gust * 0.32 + flutter + 0.14) * y * y * h;
        world.x += bend;
        world.z -= bend * 0.35;

        vec2 away = aOffset.xz - uMouse;
        float md = length(away);
        float push = smoothstep(2.4, 0.0, md) * uMouseStrength;
        world.xz += normalize(away + vec2(0.0001)) * push * y * y * h * 1.2;
        world.y -= push * y * y * h * 0.4;

        vY = y;
        vRnd = rnd;
        vec4 mv = viewMatrix * vec4(world, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform vec3 uTip;
      uniform vec3 uTip2;
      uniform vec3 uRim;
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      varying float vY;
      varying float vRnd;
      varying float vDist;
      void main() {
        vec3 tip = mix(uTip, uTip2, vRnd);
        vec3 col = mix(uBase, tip, smoothstep(0.0, 1.05, vY));
        col *= 0.62 + 0.36 * vY;
        col += uRim * pow(vY, 4.0) * (0.12 + 0.2 * vRnd);
        float fog = smoothstep(uFogNear, uFogFar, vDist);
        col = mix(col, uFog, fog * 0.9);
        float alpha = 1.0 - smoothstep(uFogFar * 0.8, uFogFar, vDist);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const grass = new THREE.Mesh(geo, grassMat);
  grass.frustumCulled = false;
  scene.add(grass);

  /* ---- ground: dark plane so gaps between blades read as soil, fading to the horizon ---- */
  const groundMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uFog: uniforms.uFog },
    vertexShader: /* glsl */ `
      varying float vDist;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFog;
      varying float vDist;
      void main() {
        vec3 col = mix(vec3(0.02, 0.06, 0.03), uFog, smoothstep(6.0, 46.0, vDist));
        float a = 1.0 - smoothstep(38.0, 52.0, vDist);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 80), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.01, -30);
  ground.renderOrder = -1;
  scene.add(ground);

  /* ---- fireflies ---- */
  const flyCount = small ? 38 : 80;
  const flyPos = new Float32Array(flyCount * 3);
  const flySeed = new Float32Array(flyCount * 3);
  for (let i = 0; i < flyCount; i++) {
    flyPos[i * 3] = (Math.random() * 2 - 1) * 13;
    flyPos[i * 3 + 1] = 0.35 + Math.random() * 1.9;
    flyPos[i * 3 + 2] = 4.5 - Math.random() * 26;
    flySeed[i * 3] = Math.random();
    flySeed[i * 3 + 1] = Math.random();
    flySeed[i * 3 + 2] = Math.random();
  }
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  flyGeo.setAttribute('aSeed', new THREE.BufferAttribute(flySeed, 3));
  const flyUniforms = { uTime: uniforms.uTime, uPR: { value: renderer.getPixelRatio() * mount.clientHeight * 0.0025 } };
  const flies = new THREE.Points(flyGeo, new THREE.ShaderMaterial({
    uniforms: flyUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPR;
      attribute vec3 aSeed;
      varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.35 + aSeed.x * 6.2831) * 0.9;
        p.y += sin(uTime * 0.6 + aSeed.y * 6.2831) * 0.3;
        p.z += cos(uTime * 0.3 + aSeed.z * 6.2831) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float blink = 0.5 + 0.5 * sin(uTime * (1.2 + aSeed.x * 1.8) + aSeed.z * 30.0);
        vA = smoothstep(0.25, 1.0, blink);
        gl_PointSize = (120.0 + aSeed.y * 90.0) * uPR / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.5, 0.0, d);
        float a = pow(core, 2.6) * vA;
        gl_FragColor = vec4(vec3(0.82, 1.0, 0.52) * a, a);
      }`,
  }));
  flies.frustumCulled = false;
  scene.add(flies);

  /* ---- interaction ---- */
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const mouseTarget = new THREE.Vector2(0, -100);
  let lastMove = -10;
  let clock = 0;

  function onPointer(e) {
    if (reduce) return;
    const r = mount.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) {
      mouseTarget.set(hit.x, hit.z);
      lastMove = clock;
    }
  }
  hero.addEventListener('pointermove', onPointer, { passive: true });
  hero.addEventListener('pointerdown', onPointer, { passive: true });

  let w0 = mount.clientWidth, h0 = mount.clientHeight;
  function resize() {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (Math.abs(w - w0) < 2 && Math.abs(h - h0) < 80) return;
    w0 = w; h0 = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    flyUniforms.uPR.value = renderer.getPixelRatio() * h * 0.0025;
    if (reduce) renderer.render(scene, camera);
  }
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); }, { passive: true });

  if (reduce) {
    uniforms.uTime.value = 3.2;
    renderer.render(scene, camera);
    return;
  }

  /* ---- loop ---- */
  const html = document.documentElement;
  const growDelay = html.classList.contains('anim') && !html.classList.contains('seen') && document.querySelector('.loader') ? 1.3 : 0.15;
  let visible = true;
  let last = performance.now();
  let slowFrames = 0, sampled = 0, degraded = false;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0 }).observe(mount);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const real = Math.max(0, (now - last) / 1000);
    const dt = Math.min(0.05, real);
    last = now;
    if (!visible || document.hidden) return;
    clock += Math.min(0.25, real);
    uniforms.uTime.value = clock;

    const g = THREE.MathUtils.clamp((clock - growDelay) / 2.4, 0, 1);
    uniforms.uGrow.value = 1 - Math.pow(1 - g, 3);

    uniforms.uMouse.value.lerp(mouseTarget, 1 - Math.pow(0.001, dt));
    const active = clock - lastMove < 1.4 ? 1 : 0;
    uniforms.uMouseStrength.value += (active - uniforms.uMouseStrength.value) * (1 - Math.pow(0.02, dt));

    const sy = window.scrollY || 0;
    const p = THREE.MathUtils.clamp(sy / (hero.offsetHeight || 1), 0, 1);
    camera.position.set(camBase.x + Math.sin(clock * 0.12) * 0.25, camBase.y + p * 1.3, camBase.z - p * 1.5);
    camera.lookAt(Math.sin(clock * 0.1) * 0.3, 2.1 - p * 1.8, -10);

    renderer.render(scene, camera);

    // adapt to slow devices: fewer blades and a lower pixel ratio
    if (!degraded && clock > 2.5 && sampled < 90) {
      sampled++;
      if (dt > 0.03) slowFrames++;
      if (sampled === 90 && slowFrames > 45) {
        degraded = true;
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        renderer.setSize(mount.clientWidth, mount.clientHeight, false);
        geo.instanceCount = Math.floor(count * 0.55);
      }
    }
  }
  requestAnimationFrame(frame);
}
