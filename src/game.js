import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* =========================================================================
   Fireside Bluff — 3D dice cup for bluffing around the fire
   ========================================================================= */

const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;
const Q = THREE.Quaternion;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const d6 = () => 1 + Math.floor(Math.random() * 6);
const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); }

/* ---------------- tweens ---------------- */
const tweens = [];
function tween(dur, update, easing = ease.inOutCubic) {
  wake();
  return new Promise((res) => tweens.push({ t: 0, dur, update, easing, res }));
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const p = Math.min(1, tw.t / tw.dur);
    tw.update(tw.easing(p), p);
    if (p >= 1) { tweens.splice(i, 1); tw.res(); }
  }
}

/* =========================================================================
   Renderer & scene
   ========================================================================= */
const canvas = $('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' });
} catch (e) {
  $('nogl').hidden = false;
  throw e;
}
// Battery: cap the pixel ratio — 1.75 is visually indistinguishable from 3x on a phone at arm's length.
const PR = Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2);
renderer.setPixelRatio(PR);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; // re-rendered only when something moves
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
const NIGHT = new THREE.Color('#0b0604');
scene.background = NIGHT;
scene.fog = new THREE.Fog(NIGHT, 14, 30);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);

/* ---------------- canvas textures ---------------- */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function grain(g, w, h, amt, tint = [1, 0.8, 0.6]) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amt;
    d[i] += n * tint[0]; d[i + 1] += n * tint[1]; d[i + 2] += n * tint[2];
  }
  g.putImageData(img, 0, 0);
}

function stumpTopCanvas() {
  const S = 1024, [c, g] = makeCanvas(S, S), cx = S / 2, cy = S / 2, R = S / 2;
  const base = g.createRadialGradient(cx, cy, 0, cx, cy, R);
  base.addColorStop(0, '#9a6638');
  base.addColorStop(0.5, '#8a5a31');
  base.addColorStop(0.85, '#774b27');
  base.addColorStop(0.9, '#6a4020');
  base.addColorStop(0.935, '#3a200c');
  base.addColorStop(1, '#1a0d04');
  g.fillStyle = base; g.fillRect(0, 0, S, S);

  let r = 4;
  const p1 = rand(0, 6.28), p2 = rand(0, 6.28);
  while (r < R * 0.88) {
    r += rand(4, 12) * (0.55 + r / R);
    const w = rand(0.6, 2.4), a = rand(0.18, 0.5);
    g.beginPath();
    for (let k = 0; k <= 240; k++) {
      const th = (k / 240) * Math.PI * 2;
      const rr = r * (1 + 0.035 * Math.sin(th * 2 + p1) + 0.02 * Math.sin(th * 5 + p2)) + Math.sin(th * 11 + r * 0.05) * 1.2;
      const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.strokeStyle = `rgba(70,36,14,${a})`; g.lineWidth = w; g.stroke();
    if (Math.random() < 0.45) { g.strokeStyle = `rgba(40,20,6,${a * 0.25})`; g.lineWidth = w * 5; g.stroke(); }
  }
  // radial checks
  g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    let th = rand(0, 6.28), rr = rand(R * 0.05, R * 0.3);
    const len = rand(R * 0.2, R * 0.55), steps = 22;
    g.beginPath(); g.moveTo(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr);
    for (let s = 1; s <= steps; s++) { th += rand(-0.018, 0.018); rr += len / steps; g.lineTo(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr); }
    g.strokeStyle = 'rgba(40,18,6,.18)'; g.lineWidth = rand(6, 10); g.stroke();
    g.strokeStyle = 'rgba(22,9,2,.55)'; g.lineWidth = rand(1.2, 2.2); g.stroke();
  }
  grain(g, S, S, 16);
  // scorch & wear
  for (let i = 0; i < 7; i++) {
    const th = rand(0, 6.28), rr = rand(R * 0.55, R * 0.9);
    const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr, s = rand(40, 130);
    const sg = g.createRadialGradient(x, y, 0, x, y, s);
    sg.addColorStop(0, 'rgba(12,5,1,.4)'); sg.addColorStop(1, 'rgba(12,5,1,0)');
    g.fillStyle = sg; g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  // a worn ring where the cup has been slammed a thousand times
  g.beginPath(); g.arc(cx, cy, R * 0.315, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(255,225,180,.07)'; g.lineWidth = 12; g.stroke();
  return c;
}

function barkCanvas() {
  const W = 1024, H = 256, [c, g] = makeCanvas(W, H);
  g.fillStyle = '#24160b'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 520; i++) {
    const x = rand(0, W), w = rand(2, 11), l = rand(0.25, 0.9);
    g.strokeStyle = `rgba(${lerp(20, 90, l) | 0},${lerp(12, 58, l) | 0},${lerp(5, 30, l) | 0},${rand(0.3, 0.8)})`;
    g.lineWidth = w; g.beginPath();
    let xx = x; g.moveTo(xx, 0);
    for (let y = 0; y <= H; y += 16) { xx += rand(-3, 3); g.lineTo(xx, y); }
    g.stroke();
  }
  const band = g.createLinearGradient(0, 0, 0, 22);
  band.addColorStop(0, '#8a5a30'); band.addColorStop(0.5, '#5a3818'); band.addColorStop(1, 'rgba(36,22,11,0)');
  g.fillStyle = band; g.fillRect(0, 0, W, 22);
  return c;
}

function groundCanvas() {
  const S = 512, [c, g] = makeCanvas(S, S);
  g.fillStyle = '#170f09'; g.fillRect(0, 0, S, S);
  grain(g, S, S, 22, [1, 0.9, 0.8]);
  for (let i = 0; i < 160; i++) {
    const x = rand(0, S), y = rand(0, S), r = rand(1, 5);
    g.fillStyle = `rgba(${rand(40, 80) | 0},${rand(35, 65) | 0},${rand(30, 55) | 0},${rand(0.4, 0.8)})`;
    g.beginPath(); g.ellipse(x, y, r, r * rand(0.5, 1), rand(0, 3), 0, Math.PI * 2); g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 140; i++) { // pine needles
    const x = rand(0, S), y = rand(0, S), a = rand(0, 6.28), l = rand(8, 22);
    g.strokeStyle = `rgba(${rand(60, 110) | 0},${rand(40, 70) | 0},20,${rand(0.3, 0.6)})`;
    g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return c;
}

const PIP_LAYOUT = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]],
};
function dieFace(v) {
  const S = 256, [c, g] = makeCanvas(S, S), [bc, bg] = makeCanvas(S, S);
  const bgGrad = g.createLinearGradient(0, 0, S, S);
  bgGrad.addColorStop(0, '#fffaf0'); bgGrad.addColorStop(1, '#efe2c6');
  g.fillStyle = bgGrad; g.fillRect(0, 0, S, S);
  grain(g, S, S, 7, [1, 0.9, 0.7]);
  bg.fillStyle = '#fff'; bg.fillRect(0, 0, S, S);
  for (const [x, y] of PIP_LAYOUT[v]) {
    const red = v === 1, r = S * (red ? 0.13 : 0.088), px = x * S, py = y * S;
    const gr = g.createRadialGradient(px - r * 0.25, py - r * 0.25, r * 0.1, px, py, r);
    if (red) { gr.addColorStop(0, '#e2452c'); gr.addColorStop(0.7, '#a3180c'); gr.addColorStop(1, '#4a0803'); }
    else { gr.addColorStop(0, '#3a3029'); gr.addColorStop(0.7, '#15100c'); gr.addColorStop(1, '#040201'); }
    g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = S * 0.008;
    g.beginPath(); g.arc(px, py, r * 0.8, 0.1 * Math.PI, 0.6 * Math.PI); g.stroke();
    const bgr = bg.createRadialGradient(px, py, 0, px, py, r * 1.08);
    bgr.addColorStop(0, '#000'); bgr.addColorStop(0.8, '#333'); bgr.addColorStop(1, '#fff');
    bg.fillStyle = bgr; bg.beginPath(); bg.arc(px, py, r * 1.08, 0, Math.PI * 2); bg.fill();
  }
  return [c, bc];
}

function leatherCanvases(total, H) {
  const W = 1024, Ht = 512;
  const [c, g] = makeCanvas(W, Ht), [bc, bg] = makeCanvas(W, Ht);
  const vy = (y) => Ht * (1 - y / total);

  const base = g.createLinearGradient(0, 0, 0, Ht);
  base.addColorStop(0, '#8a5530'); base.addColorStop(0.22, '#7a4a25'); base.addColorStop(0.4, '#6d411f'); base.addColorStop(1, '#5c3517');
  g.fillStyle = base; g.fillRect(0, 0, W, Ht);
  bg.fillStyle = '#808080'; bg.fillRect(0, 0, W, Ht);

  // mottling
  for (let i = 0; i < 70; i++) {
    const x = rand(0, W), y = rand(0, Ht), s = rand(40, 170), light = Math.random() < 0.5;
    const gr = g.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, light ? 'rgba(255,200,140,.07)' : 'rgba(20,8,2,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  // pebble grain (colour + bump)
  for (let i = 0; i < 12000; i++) {
    const x = rand(0, W), y = rand(24, Ht), r = rand(0.6, 2), l = Math.random();
    g.fillStyle = l < 0.5 ? `rgba(25,10,3,${rand(0.05, 0.18)})` : `rgba(255,210,150,${rand(0.02, 0.07)})`;
    g.fillRect(x, y, r, r);
    const v = (l * 255) | 0;
    bg.fillStyle = `rgba(${v},${v},${v},.3)`; bg.fillRect(x, y, r * 1.4, r * 1.4);
  }
  // stitched grooves
  function stitchRow(y) {
    g.fillStyle = 'rgba(15,6,1,.55)'; g.fillRect(0, y - 3, W, 6);
    bg.fillStyle = '#202020'; bg.fillRect(0, y - 3, W, 6);
    for (let x = 4; x < W; x += 19) {
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x + 1, y - 1, 11, 4);
      g.fillStyle = '#e9cf9f'; g.fillRect(x, y - 2, 11, 3.2);
      bg.fillStyle = '#e0e0e0'; bg.fillRect(x, y - 2, 11, 3.2);
    }
  }
  stitchRow(vy(0.42));
  stitchRow(vy(H - 0.55));
  stitchRow(vy(total - 0.72));
  // back seam
  for (const sx of [2, W - 2]) {
    g.fillStyle = 'rgba(10,4,0,.6)'; g.fillRect(sx - 4, vy(H - 0.4), 8, vy(0.3) - vy(H - 0.4));
    bg.fillStyle = '#1a1a1a'; bg.fillRect(sx - 4, vy(H - 0.4), 8, vy(0.3) - vy(H - 0.4));
  }
  // debossed brand, front (u = .5)
  const y = vy(1.55);
  for (const [ctx, isBump] of [[g, false], [bg, true]]) {
    ctx.save(); ctx.translate(W / 2, y); ctx.scale(0.8, 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '62px Rye, Georgia, serif';
    if (!isBump) { ctx.fillStyle = 'rgba(255,215,160,.16)'; ctx.fillText('BLUFF & CO.', 0, 3); }
    ctx.fillStyle = isBump ? '#101010' : 'rgba(26,11,3,.85)';
    ctx.fillText('BLUFF & CO.', 0, 0);
    ctx.font = 'italic 25px "IM Fell English", Georgia, serif';
    ctx.fillText('~ est. by the fire ~', 0, 52);
    ctx.fillRect(-180, -44, 360, 3); ctx.fillRect(-180, 78, 360, 3);
    ctx.restore();
  }
  return [c, bc];
}

/* =========================================================================
   Lights
   ========================================================================= */
scene.add(new THREE.HemisphereLight('#3a4870', '#2a1206', 0.6));
const moon = new THREE.DirectionalLight('#8ea6e6', 0.55);
moon.position.set(-6, 10, -8);
scene.add(moon);

const FIRE_BASE = 300;
const fire = new THREE.SpotLight('#ff9448', FIRE_BASE, 0, 0.95, 0.9, 1.6);
fire.position.set(0, 4.6, 9.5);
fire.target.position.set(0, 0, -1.2);
fire.castShadow = true;
fire.shadow.mapSize.set(1024, 1024);
fire.shadow.radius = 5;
fire.shadow.camera.near = 3; fire.shadow.camera.far = 26;
fire.shadow.bias = -0.0012; fire.shadow.normalBias = 0.06;
scene.add(fire, fire.target);

const FILL_BASE = 30;
const fireFill = new THREE.PointLight('#ff6a1e', FILL_BASE, 0, 1.8);
fireFill.position.set(0, 0.6, 7.2);
scene.add(fireFill);

const glint = new THREE.PointLight('#fff4dc', 0, 7, 2);
scene.add(glint);

/* =========================================================================
   World: stump, ground
   ========================================================================= */
const STUMP_R = 5.3, STUMP_H = 1.5;
const stump = new THREE.Mesh(
  new THREE.CylinderGeometry(STUMP_R, STUMP_R * 1.06, STUMP_H, 96, 1, false),
  [
    new THREE.MeshStandardMaterial({ map: tex(barkCanvas(), { repeat: [3, 1] }), roughness: 0.95 }),
    (() => { const c = stumpTopCanvas(); return new THREE.MeshStandardMaterial({ map: tex(c), bumpMap: tex(c, { srgb: false }), bumpScale: 1.2, roughness: 0.78 }); })(),
    new THREE.MeshStandardMaterial({ color: '#150b05' }),
  ]
);
stump.position.y = -STUMP_H / 2;
stump.receiveShadow = true; stump.castShadow = true;
scene.add(stump);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 90),
  new THREE.MeshStandardMaterial({ map: tex(groundCanvas(), { repeat: [14, 14] }), roughness: 1 })
);
ground.rotation.x = -Math.PI / 2; ground.position.y = -STUMP_H; ground.receiveShadow = true;
scene.add(ground);

/* =========================================================================
   Dice
   ========================================================================= */
const FACE_ORDER = [3, 4, 1, 6, 2, 5]; // +x, -x, +y, -y, +z, -z
const dieMats = FACE_ORDER.map((v) => {
  const [c, b] = dieFace(v);
  return new THREE.MeshPhysicalMaterial({
    map: tex(c), bumpMap: tex(b, { srgb: false }), bumpScale: 2.5,
    roughness: 0.34, clearcoat: 0.75, clearcoatRoughness: 0.2,
  });
});
const dieGeo = new RoundedBoxGeometry(1, 1, 1, 5, 0.14);
const dice = [0, 1].map(() => {
  const m = new THREE.Mesh(dieGeo, dieMats);
  m.castShadow = true; m.receiveShadow = true; m.visible = false;
  scene.add(m);
  return m;
});
const FACE_Q = {
  1: new Q(),
  6: new Q().setFromEuler(new THREE.Euler(Math.PI, 0, 0)),
  2: new Q().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
  5: new Q().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
  3: new Q().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
  4: new Q().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)),
};
const UP = new V3(0, 1, 0);
const faceQuat = (v, yaw) => new Q().setFromAxisAngle(UP, yaw).multiply(FACE_Q[v]);

/* =========================================================================
   Leather cup
   ========================================================================= */
const CUP = { rB: 1.62, rT: 1.34, H: 3.05, sh: 0.28 };
const cup = new THREE.Group();     // pivot at open rim centre
const squash = new THREE.Group();  // scale for squash & stretch
cup.add(squash);
scene.add(cup);
let cupMat, cupInnerMat;

function buildCup() {
  const { rB, rT, H, sh } = CUP;
  const pts = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(lerp(rB, rT, t) + 0.035 * Math.sin(t * Math.PI), t * (H - sh)));
  }
  const cx = rT - sh, cy = H - sh;
  for (let i = 1; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; pts.push(new THREE.Vector2(cx + Math.cos(a) * sh, cy + Math.sin(a) * sh)); }
  for (let i = 1; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(Math.max(0.0001, cx * (1 - t)), H + 0.05 * Math.sin(t * Math.PI / 2))); }

  const SEG = 72;
  const geo = new THREE.LatheGeometry(pts, SEG);
  const arc = [0];
  for (let j = 1; j < pts.length; j++) arc[j] = arc[j - 1] + pts[j].distanceTo(pts[j - 1]);
  const total = arc[arc.length - 1];
  const uv = geo.attributes.uv;
  for (let i = 0; i <= SEG; i++) for (let j = 0; j < pts.length; j++) uv.setY(i * pts.length + j, arc[j] / total);

  const [lc, lb] = leatherCanvases(total, H);
  cupMat = new THREE.MeshPhysicalMaterial({
    map: tex(lc), bumpMap: tex(lb, { srgb: false }), bumpScale: 0.7,
    roughness: 0.62, sheen: 0.5, sheenColor: new THREE.Color('#ffc890'), sheenRoughness: 0.45,
  });
  cupInnerMat = new THREE.MeshStandardMaterial({ color: '#1a0c04', roughness: 1, side: THREE.BackSide });

  const outer = new THREE.Mesh(geo, cupMat);
  outer.castShadow = true; outer.receiveShadow = true;
  const inner = new THREE.Mesh(geo, cupInnerMat);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#3a1f0c', roughness: 0.5 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rB + 0.02, 0.085, 14, 80), rimMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.07; rim.castShadow = true;
  const band = new THREE.Mesh(new THREE.TorusGeometry(lerp(rB, rT, (H - 0.42) / (H - sh)) + 0.01, 0.045, 10, 80), rimMat);
  band.rotation.x = Math.PI / 2; band.position.y = H - 0.42;

  const body = new THREE.Group();
  body.rotation.y = Math.PI; // brand faces the fire (+z)
  body.add(outer, inner, rim, band);
  squash.add(body);
}

/* =========================================================================
   Particles (embers + dust) — one draw call each
   ========================================================================= */
class Particles {
  constructor(max, { additive, hot, cool }) {
    this.max = max; this.next = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max); this.baseAlpha = new Float32Array(max);
    this.buoy = new Float32Array(max); this.drag = new Float32Array(max);
    this.turb = new Float32Array(max); this.grow = new Float32Array(max); this.seed = new Float32Array(max);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.heat = new Float32Array(max);
    this.alive = 0;
    const geo = new THREE.BufferGeometry();
    const attr = (a, n) => { const b = new THREE.BufferAttribute(a, n); b.setUsage(THREE.DynamicDrawUsage); return b; };
    geo.setAttribute('position', attr(this.pos, 3));
    geo.setAttribute('aSize', attr(this.size, 1));
    geo.setAttribute('aAlpha', attr(this.alpha, 1));
    geo.setAttribute('aHeat', attr(this.heat, 1));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 }, uHot: { value: new V3(...hot) }, uCool: { value: new V3(...cool) } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute float aHeat;
        varying float vA; varying float vH; uniform float uScale;
        void main(){ vA=aAlpha; vH=aHeat; vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_Position=projectionMatrix*mv; gl_PointSize=aSize*uScale/-mv.z; }`,
      fragmentShader: additive ? `
        varying float vA; varying float vH; uniform vec3 uHot; uniform vec3 uCool;
        void main(){ float d=length(gl_PointCoord-.5)*2.0; float core=smoothstep(1.0,0.0,d);
          float a=pow(core,2.4)*vA; vec3 c=mix(uCool,uHot,vH)*(1.0+1.8*pow(core,10.0));
          gl_FragColor=vec4(c,a); }` : `
        varying float vA; varying float vH; uniform vec3 uHot; uniform vec3 uCool;
        void main(){ float d=length(gl_PointCoord-.5)*2.0; float a=smoothstep(1.0,0.1,d)*vA;
          gl_FragColor=vec4(mix(uCool,uHot,vH),a); }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(o) {
    const i = this.next; this.next = (this.next + 1) % this.max;
    this.pos.set(o.pos, i * 3); this.vel.set(o.vel, i * 3);
    this.life[i] = this.maxLife[i] = o.life;
    this.baseSize[i] = o.size; this.baseAlpha[i] = o.alpha ?? 1;
    this.buoy[i] = o.buoy ?? 0; this.drag[i] = o.drag ?? 0.3; this.turb[i] = o.turb ?? 0;
    this.grow[i] = o.grow ?? 1; this.seed[i] = Math.random();
  }
  update(dt, t, flickerEmbers) {
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; } continue; }
      alive++;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const j = i * 3, s = this.seed[i];
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[j] = (this.vel[j] + Math.sin(t * 2.3 + s * 40) * this.turb[i] * dt) * dr;
      this.vel[j + 1] = (this.vel[j + 1] + this.buoy[i] * dt) * dr;
      this.vel[j + 2] = (this.vel[j + 2] + Math.cos(t * 1.9 + s * 25) * this.turb[i] * dt) * dr;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      const fade = Math.min(1, (1 - k) * 8) * Math.min(1, k * 2.5);
      const fl = flickerEmbers ? 0.65 + 0.35 * Math.sin(t * 18 + s * 60) : 1;
      this.alpha[i] = this.baseAlpha[i] * fade * fl;
      this.heat[i] = k;
      this.size[i] = this.baseSize[i] * lerp(this.grow[i], 1, k);
    }
    this.alive = alive;
    const a = this.geo.attributes;
    a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.aHeat.needsUpdate = true;
  }
}
const embers = new Particles(420, { additive: true, hot: [1.0, 0.86, 0.45], cool: [0.9, 0.22, 0.04] });
const dust = new Particles(90, { additive: false, hot: [0.42, 0.33, 0.25], cool: [0.42, 0.33, 0.25] });

function emitAmbientEmber() {
  embers.emit({
    pos: [rand(-5, 5), rand(-1, 0.2), rand(5, 8.5)],
    vel: [rand(-0.3, 0.3), rand(1.2, 2.6), rand(-0.9, -0.2)],
    life: rand(2.5, 5), size: rand(0.05, 0.12), alpha: rand(0.6, 1), buoy: 0.35, drag: 0.25, turb: 1.3,
  });
}
function sparkRing(n = 36, strength = 1) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(1.5, 4) * strength;
    embers.emit({
      pos: [Math.cos(a) * 1.7, 0.08, Math.sin(a) * 1.7], vel: [Math.cos(a) * sp, rand(1, 3.2) * strength, Math.sin(a) * sp],
      life: rand(0.45, 1.1), size: rand(0.04, 0.085), buoy: -6, drag: 1.1,
    });
  }
}
function dustRing(n = 26, at = new V3(), radius = 1.7, strength = 1) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(0.8, 2.2) * strength;
    dust.emit({
      pos: [at.x + Math.cos(a) * radius, at.y + 0.1, at.z + Math.sin(a) * radius],
      vel: [Math.cos(a) * sp, rand(0.1, 0.5), Math.sin(a) * sp],
      life: rand(0.8, 1.4), size: rand(0.45, 0.85), alpha: 0.32 * strength, grow: 2.8, drag: 2.6, buoy: 0.25,
    });
  }
}
function fountain(n, power = 1) {
  for (let i = 0; i < n; i++) {
    embers.emit({
      pos: [rand(-0.9, 0.9), 1, rand(-0.4, 0.4)],
      vel: [rand(-1.6, 1.6) * power, rand(4, 8) * power, rand(-1.4, 1.4) * power],
      life: rand(1.2, 2.4), size: rand(0.07, 0.16), buoy: -2.4, drag: 0.45, turb: 2,
    });
  }
}

/* =========================================================================
   Sound — all synthesized, no files
   ========================================================================= */
const sfx = (() => {
  let ctx, master, noiseBuf, ambient = false;
  let muted = false;
  try { muted = localStorage.getItem('fb-muted') === '1'; } catch (e) { /* private mode */ }
  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise() {
    if (!noiseBuf) {
      const c = ac(); noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  function burst(t, { dur = 0.03, type = 'bandpass', freq = 2000, q = 1.2, gain = 0.3, attack = 0.001 } = {}) {
    const c = ac(), src = c.createBufferSource(); src.buffer = noise();
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 1.5); src.stop(t + attack + dur + 0.05);
    return f;
  }
  function tone(t, { freq = 200, end = freq, dur = 0.2, gain = 0.3, type = 'sine' } = {}) {
    const c = ac(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(end, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function click(t, v = 1) {
    burst(t, { dur: 0.025, freq: rand(2200, 4200), q: 3, gain: 0.22 * v });
    tone(t, { freq: rand(1800, 3200), end: rand(1400, 2400), dur: 0.04, gain: 0.05 * v, type: 'triangle' });
  }
  const now = () => ac().currentTime + 0.01;
  return {
    unlock: ac,
    get muted() { return muted; },
    setMuted(m) {
      muted = m;
      try { localStorage.setItem('fb-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
      if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    rattle(dur) {
      const t0 = now();
      for (let t = 0; t < dur; t += 0.112) {
        burst(t0 + t, { dur: 0.06, type: 'lowpass', freq: 520, q: 0.7, gain: 0.4 });
        const n = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) click(t0 + t + rand(0, 0.07), rand(0.55, 1));
      }
    },
    slam(s = 1) {
      const t = now();
      tone(t, { freq: 115, end: 40, dur: 0.3, gain: 0.9 * s });
      burst(t, { dur: 0.12, type: 'lowpass', freq: 380, q: 0.5, gain: 0.75 * s });
      burst(t, { dur: 0.05, freq: 900, q: 1, gain: 0.3 * s });
      click(t + 0.03, 0.7); click(t + 0.075, 0.45); click(t + 0.13, 0.25);
    },
    swoosh() {
      const t = now(), f = burst(t, { dur: 0.3, freq: 500, q: 0.9, gain: 0.2, attack: 0.1 });
      f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
    },
    land() {
      const t = now();
      tone(t, { freq: 85, end: 40, dur: 0.22, gain: 0.55 });
      burst(t, { dur: 0.1, type: 'lowpass', freq: 300, q: 0.6, gain: 0.4 });
    },
    scoop() { const t = now(); for (let k = 0; k < 6; k++) click(t + k * 0.03 + rand(0, 0.02), rand(0.4, 0.8)); },
    glint() {
      const t = now();
      tone(t + 0.05, { freq: 2637, dur: 0.7, gain: 0.05 });
      tone(t + 0.12, { freq: 3951, dur: 0.6, gain: 0.035 });
    },
    doubles() {
      const t = now();
      [1319, 1760, 2093].forEach((f, i) => tone(t + i * 0.08, { freq: f, dur: 0.6, gain: 0.07, type: 'triangle' }));
    },
    mia() {
      const t = now();
      const f = burst(t, { dur: 1.4, type: 'lowpass', freq: 300, q: 0.4, gain: 0.55, attack: 0.25 });
      f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(1600, t + 0.6);
      [523, 659, 784, 1047, 1319].forEach((fr, i) => tone(t + 0.05 + i * 0.07, { freq: fr, dur: 1.3, gain: 0.07, type: 'triangle' }));
      tone(t, { freq: 60, end: 35, dur: 0.8, gain: 0.5 });
    },
    knock() {
      const t = now();
      burst(t, { dur: 0.05, freq: 700, q: 4, gain: 0.16 });
      tone(t, { freq: 420, end: 360, dur: 0.07, gain: 0.07, type: 'triangle' });
    },
    ambient() {
      if (ambient) return; ambient = true;
      const c = ac(), src = c.createBufferSource(); src.buffer = noise(); src.loop = true;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 360;
      const g = c.createGain(); g.gain.value = 0.05;
      src.connect(lp); lp.connect(g); g.connect(master); src.start();
      const pop = () => {
        if (c.state === 'running' && !muted) {
          const t = c.currentTime + 0.01, big = Math.random() < 0.14;
          burst(t, { dur: big ? 0.05 : 0.014, freq: rand(1500, 5200), q: rand(0.5, 2), gain: big ? rand(0.07, 0.15) : rand(0.02, 0.055) });
          if (Math.random() < 0.3) burst(t + rand(0.02, 0.08), { dur: 0.012, freq: rand(2000, 6000), q: 1, gain: rand(0.02, 0.05) });
        }
        setTimeout(pop, rand(70, 450));
      };
      pop();
    },
  };
})();
const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* unsupported */ } };

/* =========================================================================
   Camera rig: framing, parallax, shake
   ========================================================================= */
const rig = { focus: 0, orbit: 0, trauma: 0, kick: 0, px: 0, py: 0, tpx: 0, tpy: 0, surge: 1, dist: 14, fov: 45 };
const target = new V3();

function layout() {
  const w = innerWidth, h = innerHeight, aspect = w / h;
  renderer.setSize(w, h, false);
  camera.aspect = aspect;
  rig.fov = aspect < 0.8 ? 50 : aspect < 1.2 ? 44 : 36;
  const tv = Math.tan(THREE.MathUtils.degToRad(rig.fov / 2));
  rig.dist = Math.max(2.95 / (aspect * tv), 3.4 / tv);
  scene.fog.near = rig.dist * 0.95; scene.fog.far = rig.dist * 2.1;
  const scale = (h * PR) / (2 * tv);
  embers.mat.uniforms.uScale.value = scale; dust.mat.uniforms.uScale.value = scale;
  requestRender();
}

const ui = { top: $('top'), callout: $('callout'), bottom: $('bottom'), glow: $('glow') };
let lastDom = '';
function updateCamera(dt, t) {
  const k = 1 - Math.exp(-dt * 5);
  rig.px += (rig.tpx - rig.px) * k; rig.py += (rig.tpy - rig.py) * k;
  const f = rig.focus;
  target.set(0, lerp(0.45, 0.9, f), lerp(0.1, -1.75, f));
  const dist = rig.dist * lerp(1, 0.94, f);
  const elev = lerp(0.98, 1.02, f) + rig.py * 0.07;
  const az = rig.orbit + rig.px * 0.13 + (reduceMotion ? 0 : Math.sin(t * 0.21) * 0.012);
  camera.position.set(
    target.x + Math.sin(az) * Math.cos(elev) * dist,
    target.y + Math.sin(elev) * dist,
    target.z + Math.cos(az) * Math.cos(elev) * dist
  );
  const s = reduceMotion ? 0 : rig.trauma * rig.trauma;
  if (s > 0.0001) {
    camera.position.x += (vnoise(t * 22) - 0.5) * s * 0.9;
    camera.position.y += (vnoise(t * 22 + 50) - 0.5) * s * 0.9;
  }
  camera.lookAt(target);
  if (s > 0.0001) camera.rotateZ((vnoise(t * 18 + 90) - 0.5) * s * 0.06);
  camera.fov = rig.fov + rig.kick;
  camera.updateProjectionMatrix();
  rig.trauma = Math.max(0, rig.trauma - dt * 1.5);
  rig.kick *= Math.exp(-dt * 7);

  // layered DOM parallax — header far, callout floats nearest
  const x = rig.px, y = rig.py;
  const key = `${x.toFixed(3)}${y.toFixed(3)}`;
  if (key !== lastDom) {
    lastDom = key;
    ui.top.style.transform = `translate3d(${x * -5}px,${y * -3}px,0)`;
    ui.callout.style.transform = `translate3d(calc(-50% + ${x * -14}px),${y * -8}px,0)`;
    ui.bottom.style.transform = `translate3d(${x * 3}px,${y * 2}px,0)`;
  }
}
const addTrauma = (a) => { rig.trauma = Math.min(1, rig.trauma + a); wake(); };

/* =========================================================================
   Game state & choreography
   ========================================================================= */
const state = { values: null, revealed: false, busy: false, player: 1, sheet: 'start', lastAction: 0 };
const CUP_HOME = new V3(0, 0, 0);
const REVEAL_POS = new V3(0.25, 1.68, -1.45);
const REVEAL_Q = new Q().setFromEuler(new THREE.Euler(-(Math.PI / 2 + 0.09), 0.28, 0, 'YXZ'));

const btn = { roll: $('rollBtn'), reveal: $('revealBtn'), pass: $('passBtn') };
const hintEl = $('hint');
function setHint(s) { hintEl.textContent = s; }
function setButtons() {
  btn.roll.disabled = state.busy;
  btn.reveal.disabled = state.busy || state.revealed || !state.values;
  btn.pass.disabled = state.busy || !state.values;
  btn.reveal.querySelector('span').textContent = state.revealed ? 'Revealed' : 'Reveal';
}

function squashSpring(amount = 0.12) {
  return tween(0.5, (_, p) => {
    const e = Math.exp(-p * 6) * Math.cos(p * 20);
    squash.scale.set(1 + amount * 0.5 * e, 1 - amount * e, 1 + amount * 0.5 * e);
  }, ease.linear);
}

function jolt() {
  if (reduceMotion) return;
  document.body.classList.remove('jolt'); void document.body.offsetWidth; document.body.classList.add('jolt');
}

function impact(strength = 1) {
  sfx.slam(strength);
  addTrauma(0.55 * strength);
  rig.kick = -2.2 * strength;
  squashSpring(0.12 * strength);
  dustRing(Math.round(26 * strength), CUP_HOME, 1.7, strength);
  sparkRing(Math.round(30 * strength), strength);
  jolt();
  buzz(strength > 0.7 ? [35, 25, 15] : 20);
}

function placeDice() {
  const cfg = [
    [-0.62 + rand(-0.1, 0.08), rand(-0.05, 0.2)],
    [0.62 + rand(-0.08, 0.1), rand(-0.2, 0.05)],
  ];
  dice.forEach((d, i) => {
    d.position.set(cfg[i][0], 0.5, cfg[i][1]);
    d.quaternion.copy(faceQuat(state.values[i], rand(-0.5, 0.5)));
    d.scale.setScalar(1);
    d.visible = true;
  });
}

async function slamDown(strength = 1) {
  const p0 = cup.position.clone(), q0 = cup.quaternion.clone();
  const qEnd = new Q().setFromAxisAngle(UP, rand(-0.25, 0.25));
  await tween(0.13, (t) => { cup.position.lerpVectors(p0, CUP_HOME, t); cup.quaternion.slerpQuaternions(q0, qEnd, t); }, ease.inCubic);
  impact(strength);
}

function focusTo(v, dur = 0.7) {
  const f0 = rig.focus;
  return tween(dur, (t) => { rig.focus = lerp(f0, v, t); }, ease.inOutCubic);
}

async function roll() {
  if (state.busy || state.sheet) return;
  state.busy = true; state.lastAction = performance.now(); setButtons(); hideCallout();
  const fromRevealed = state.revealed;
  state.revealed = false;
  if (fromRevealed) focusTo(0, 0.5);

  // swoop the cup up and scoop the dice in
  const p0 = cup.position.clone(), q0 = cup.quaternion.clone();
  const pUp = new V3(0, 1.7, 0.2), qUp = new Q();
  const starts = dice.map((d) => ({ p: d.position.clone(), vis: d.visible }));
  if (starts.some((s) => s.vis)) sfx.scoop();
  if (fromRevealed) sfx.swoosh();
  await tween(fromRevealed ? 0.36 : 0.2, (t) => {
    cup.position.lerpVectors(p0, pUp, t); cup.quaternion.slerpQuaternions(q0, qUp, t);
    dice.forEach((d, i) => {
      if (!starts[i].vis) return;
      const e = ease.inCubic(t);
      d.position.set(lerp(starts[i].p.x, starts[i].p.x * 0.3, e), lerp(starts[i].p.y, pUp.y + 1, e), lerp(starts[i].p.z, 0.2, e));
      d.scale.setScalar(lerp(1, 0.6, e));
    });
  }, ease.inOutCubic);
  dice.forEach((d) => { d.visible = false; d.scale.setScalar(1); });

  // shake it
  const dur = reduceMotion ? 0.5 : 0.95;
  sfx.rattle(dur);
  buzz([22, 60, 22, 60, 22, 60, 22, 60, 22]);
  const e = new THREE.Euler();
  const amp0 = reduceMotion ? 0.25 : 1;
  await tween(dur, (_, p) => {
    const tt = p * dur, amp = (Math.sin(p * Math.PI) * 0.8 + 0.2) * amp0;
    cup.position.set(pUp.x + Math.sin(tt * 38) * 0.32 * amp, pUp.y + Math.abs(Math.sin(tt * 28)) * 0.45 * amp, pUp.z + Math.cos(tt * 31) * 0.22 * amp);
    cup.quaternion.setFromEuler(e.set(Math.sin(tt * 33) * 0.28 * amp, tt * 2, Math.cos(tt * 29) * 0.3 * amp));
    rig.trauma = Math.max(rig.trauma, 0.2 * amp);
  }, ease.linear);

  state.values = window.__forceRoll || [d6(), d6()];
  placeDice();
  await slamDown(1);
  state.busy = false; state.lastAction = performance.now(); setButtons();
  setHint('Peek with Reveal, or pass it on hidden.');
}

async function reveal() {
  if (state.busy || state.revealed || !state.values || state.sheet) return;
  state.busy = true; state.lastAction = performance.now(); setButtons();
  buzz(10);
  await tween(0.12, (t) => squash.scale.set(1 + 0.04 * t, 1 - 0.08 * t, 1 + 0.04 * t), ease.outCubic);
  sfx.swoosh();
  focusTo(1, 0.8);
  const p0 = cup.position.clone(), q0 = cup.quaternion.clone();
  const pMid = new V3(0.1, 3.4, -0.8), qMid = new Q().setFromEuler(new THREE.Euler(-0.9, 0.15, 0, 'YXZ'));
  await tween(0.26, (t, p) => {
    cup.position.lerpVectors(p0, pMid, t); cup.quaternion.slerpQuaternions(q0, qMid, t);
    const st = Math.sin(p * Math.PI) * 0.07;
    squash.scale.set(lerp(1.04, 1, p) - st * 0.5, lerp(0.92, 1, p) + st, lerp(1.04, 1, p) - st * 0.5);
  }, ease.outCubic);
  squash.scale.setScalar(1);
  showCallout();
  let landed = false;
  await tween(0.62, (_, p) => {
    const e = ease.outCubic(p);
    cup.position.x = lerp(pMid.x, REVEAL_POS.x, e);
    cup.position.z = lerp(pMid.z, REVEAL_POS.z, e);
    cup.position.y = lerp(pMid.y, REVEAL_POS.y, ease.outBounce(p));
    cup.quaternion.slerpQuaternions(qMid, REVEAL_Q, ease.outCubic(Math.min(1, p * 1.3)));
    if (!landed && p > 0.36) {
      landed = true; sfx.land(); addTrauma(0.22); buzz(12);
      dustRing(14, new V3(REVEAL_POS.x, 0, REVEAL_POS.z - 1.4), 1.3, 0.6);
    }
  }, ease.linear);
  state.revealed = true; state.busy = false; state.lastAction = performance.now(); setButtons();
  setHint('Roll again, or pass it on hidden.');
}

async function coverFromRevealed() {
  sfx.swoosh(); focusTo(0, 0.6); hideCallout();
  const p0 = cup.position.clone(), q0 = cup.quaternion.clone();
  const pMid = new V3(0, 2.4, 0.1), qMid = new Q().setFromEuler(new THREE.Euler(0.2, 0, 0));
  await tween(0.36, (t) => { cup.position.lerpVectors(p0, pMid, t); cup.quaternion.slerpQuaternions(q0, qMid, t); }, ease.inOutCubic);
  await slamDown(0.6);
  state.revealed = false;
}

async function pass() {
  if (state.busy || !state.values || state.sheet) return;
  state.busy = true; state.lastAction = performance.now(); setButtons();
  if (state.revealed) await coverFromRevealed();
  else sfx.knock();
  state.player++;
  sfx.swoosh();
  const o0 = rig.orbit;
  tween(0.7, (t) => { rig.orbit = lerp(o0, 0.75, t); }, ease.inCubic);
  $('passTo').textContent = `Player ${state.player}`;
  await wait(250);
  openSheet('pass');
  state.busy = false;
}

function takeCup() {
  closeSheet();
  sfx.knock();
  $('seat').textContent = `Player ${state.player}’s cup`;
  rig.orbit = -0.75;
  tween(0.9, (t) => { rig.orbit = lerp(-0.75, 0, t); }, ease.outCubic);
  setHint('Believe the call? Roll. Doubt it? Reveal.');
  setButtons();
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- callout ---------------- */
const TENS = { 3: 'Thirty', 4: 'Forty', 5: 'Fifty', 6: 'Sixty' };
const ONES = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six' };
const PLURAL = { 1: 'ones', 2: 'twos', 3: 'threes', 4: 'fours', 5: 'fives', 6: 'sixes' };
function describe(a, b) {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  if (hi === 2 && lo === 1) return { big: 'MIA!', small: 'Two & one — nothing beats it', kind: 'mia' };
  if (hi === lo) return { big: `${hi}${lo}`, small: `Double ${PLURAL[hi]}`, kind: 'double' };
  return { big: `${hi}${lo}`, small: `${TENS[hi]}-${ONES[lo]}`, kind: 'plain' };
}
function showCallout() {
  const d = describe(...state.values);
  const big = $('calloutBig');
  big.innerHTML = [...d.big].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
  $('calloutSmall').textContent = d.small;
  ui.callout.className = '';
  void ui.callout.offsetWidth;
  ui.callout.className = `show ${d.kind}`;
  glintSweep();
  sfx.glint();
  if (d.kind === 'mia') {
    sfx.mia(); fountain(170, 1.1); surge(2.1, 1.6); addTrauma(0.45); buzz([60, 40, 60, 40, 120]);
  } else if (d.kind === 'double') {
    sfx.doubles(); fountain(70, 0.8); surge(1.5, 1); buzz([30, 30, 30]);
  }
}
function hideCallout() { ui.callout.className = ''; }

function glintSweep() {
  tween(0.8, (t) => { glint.position.set(lerp(-2.4, 2.4, t), 1.5, 1.3); glint.intensity = Math.sin(t * Math.PI) * 30; }, ease.inOutCubic)
    .then(() => { glint.intensity = 0; });
}
function surge(peak, dur) {
  tween(dur, (_, p) => { rig.surge = 1 + (peak - 1) * Math.sin(Math.min(1, p * 3) * Math.PI / 2) * (1 - p); }, ease.linear)
    .then(() => { rig.surge = 1; });
}

/* ---------------- sheets ---------------- */
function openSheet(name) {
  state.sheet = name;
  document.querySelectorAll('.sheet').forEach((s) => s.classList.toggle('open', s.dataset.sheet === name));
  requestRender();
}
function closeSheet() {
  state.sheet = null;
  document.querySelectorAll('.sheet').forEach((s) => s.classList.remove('open'));
  wake();
}

/* =========================================================================
   Input: buttons, tilt parallax, shake-to-roll
   ========================================================================= */
btn.roll.addEventListener('click', roll);
btn.reveal.addEventListener('click', reveal);
btn.pass.addEventListener('click', pass);
$('takeBtn').addEventListener('click', takeCup);
$('rulesBtn').addEventListener('click', () => { sfx.knock(); openSheet('rules'); });
$('rulesClose').addEventListener('click', () => { closeSheet(); });
const soundBtn = $('soundBtn');
function paintSound() { soundBtn.classList.toggle('off', sfx.muted); soundBtn.setAttribute('aria-label', sfx.muted ? 'Turn sound on' : 'Mute sound'); }
soundBtn.addEventListener('click', () => { sfx.unlock(); sfx.setMuted(!sfx.muted); paintSound(); });
paintSound();

// tap the cup to peek
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener('pointerup', (e) => {
  if (state.sheet || state.busy || state.revealed || !state.values) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (ray.intersectObject(cup, true).length) reveal();
});

// mouse parallax (desktop)
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  rig.tpx = (e.clientX / innerWidth) * 2 - 1;
  rig.tpy = (e.clientY / innerHeight) * 2 - 1;
  wake(false);
});

// tilt parallax + shake-to-roll (phone)
let b0 = null, g0 = null;
function onOrient(e) {
  if (e.beta == null) return;
  if (b0 === null) { b0 = e.beta; g0 = e.gamma; }
  b0 += (e.beta - b0) * 0.015; g0 += (e.gamma - g0) * 0.015;
  const nx = clamp((e.gamma - g0) / 16, -1, 1), ny = clamp((e.beta - b0) / 16, -1, 1);
  const moved = Math.abs(nx - rig.tpx) + Math.abs(ny - rig.tpy);
  if (moved > 0.35) wake(true);
  else if (moved > 0.04 && !dormant) wake(false);
  rig.tpx = nx; rig.tpy = ny;
}
let shakeScore = 0;
function onMotion(e) {
  const a = e.acceleration;
  if (!a || a.x == null) return;
  const m = Math.hypot(a.x, a.y, a.z);
  shakeScore = m > 16 ? shakeScore + 1 : Math.max(0, shakeScore - 0.2);
  if (shakeScore >= 5 && !state.busy && !state.sheet && performance.now() - state.lastAction > 1500) {
    shakeScore = 0; roll();
  }
}
function enableMotion() {
  const DOE = window.DeviceOrientationEvent, DME = window.DeviceMotionEvent;
  const reqs = [];
  if (DOE && typeof DOE.requestPermission === 'function') reqs.push(DOE.requestPermission());
  if (DME && typeof DME.requestPermission === 'function') reqs.push(DME.requestPermission());
  Promise.all(reqs).then((r) => {
    if (r.some((x) => x !== 'granted')) return;
    addEventListener('deviceorientation', onOrient);
    addEventListener('devicemotion', onMotion);
  }).catch(() => { /* motion is optional */ });
}

$('startBtn').addEventListener('click', () => {
  sfx.unlock();
  sfx.ambient();
  enableMotion();
  closeSheet();
  sfx.knock();
  setButtons();
  setHint('Tap Roll — or shake your phone.');
});

/* =========================================================================
   Render loop — battery aware
   60fps while anything moves, ~30fps idle, fully paused after a minute
   untouched or while a sheet covers the table.
   ========================================================================= */
let lastInput = performance.now();
let rafId = 0, lastFrame = 0, lastRender = 0, pendingRender = true, dormant = false;
function setDormant(d) {
  if (d === dormant) return;
  dormant = d;
  document.body.classList.toggle('dormant', d);
  if (d) sfx.suspend(); else if (document.visibilityState === 'visible') sfx.resume();
}
const clock = { t: 0 };

function wake(isInput = true) {
  if (isInput) { lastInput = performance.now(); setDormant(false); }
  if (!rafId && document.visibilityState === 'visible') { lastFrame = performance.now(); rafId = requestAnimationFrame(frame); }
}
function requestRender() { pendingRender = true; wake(false); }
['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, () => wake(), { passive: true }));

let emberAcc = 0;
function frame(now) {
  rafId = 0;
  const dtRaw = Math.min(0.05, (now - lastFrame) / 1000);
  const idleFor = now - lastInput;
  const active = tweens.length > 0 || rig.trauma > 0.01 || embers.alive > 60 || dust.alive > 0 || now - state.lastAction < 1500;
  const sheetOpen = !!state.sheet && state.sheet !== 'start';

  // Dormant: stop the loop entirely. Any touch/tilt wakes it.
  if (!active && !pendingRender && (sheetOpen || idleFor > 60000)) { if (idleFor > 60000) setDormant(true); return; }

  const minInterval = active ? 0 : 1000 / 30 - 2;
  if (now - lastRender < minInterval && !pendingRender) {
    // sleep until the next idle frame is due instead of waking every vsync
    rafId = setTimeout(() => { rafId = requestAnimationFrame(frame); }, minInterval - (now - lastRender));
    return;
  }

  const dt = Math.min(0.05, (now - lastRender) / 1000) || dtRaw;
  lastRender = now; lastFrame = now; pendingRender = false;
  clock.t += dt;
  const t = clock.t;

  const shadowsBefore = tweens.length > 0;
  updateTweens(dt);

  // fire
  const f = 0.8 + 0.09 * Math.sin(t * 9.1) + 0.05 * Math.sin(t * 15.3 + 1.2) + 0.12 * (vnoise(t * 9) - 0.5) + 0.06 * (vnoise(t * 2.1 + 7) - 0.5);
  fire.intensity = FIRE_BASE * f * rig.surge;
  fireFill.intensity = FILL_BASE * f * rig.surge;
  ui.glow.style.opacity = (0.55 + (f - 0.8) * 2.2 + (rig.surge - 1) * 0.5).toFixed(3);

  if (!reduceMotion && !sheetOpen) {
    emberAcc += dt * 12;
    while (emberAcc > 1) { emitAmbientEmber(); emberAcc--; }
  }
  embers.update(dt, t, true);
  dust.update(dt, t, false);
  updateCamera(dt, t);

  if (shadowsBefore || tweens.length) renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);

  if (sheetOpen && !active) return; // one clean frame under the sheet, then sleep
  rafId = requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { sfx.resume(); requestRender(); }
  else { sfx.suspend(); if (rafId) { cancelAnimationFrame(rafId); clearTimeout(rafId); rafId = 0; } }
});
addEventListener('resize', layout);

/* =========================================================================
   Boot
   ========================================================================= */
async function boot() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('62px Rye'), document.fonts.load('italic 25px "IM Fell English"')]),
      wait(2500),
    ]);
  } catch (e) { /* fonts optional */ }
  buildCup();
  layout();
  renderer.shadowMap.needsUpdate = true;
  for (let i = 0; i < 40; i++) { emitAmbientEmber(); embers.update(0.1, i * 0.1, true); }
  setButtons();
  requestRender();
  document.body.classList.add('ready');
  $('startBtn').disabled = false;
  $('startBtn').querySelector('span').textContent = 'Light the fire';
}
boot();
