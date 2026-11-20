import * as THREE from 'three';
import { Game, ISLAND_R, TICK_RATE } from '/src/sim.js';

const contract = await (await fetch('/game.contract.json')).json();
const tuning = contract.tuning;

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0714);
scene.fog = new THREE.FogExp2(0x1c1230, 0.016);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const ambient = new THREE.AmbientLight(0x7a6aaa, 1.4);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xaa99ee, 0.9);
moon.position.set(-20, 40, 10);
scene.add(moon);

const mat = (c, e = 0, ei = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: ei, roughness: 0.8 });
const island = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R, ISLAND_R - 3, 3, 48), mat(0x56744f));
island.position.y = -1.5;
scene.add(island);
const cloud = new THREE.Mesh(new THREE.TorusGeometry(ISLAND_R + 1, 3, 8, 48), mat(0xd9d4f0, 0x1a1530));
cloud.rotation.x = Math.PI / 2;
cloud.position.y = -2.5;
scene.add(cloud);

// player: body + straw hat + hanging lantern with a light
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 4, 10), mat(0x6b8fd4, 0x101830, 1));
body.position.y = 0.8;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.5, 16), mat(0xd9b96a, 0x3a2a10, 1));
hat.position.y = 1.7;
const pLantern = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), mat(0xffb347, 0xffa030, 2));
pLantern.position.set(0.55, 1.0, 0);
const pLight = new THREE.PointLight(0xffb060, 18, 14, 1.6);
pLight.position.set(0.55, 1.1, 0);
player.add(body, hat, pLantern, pLight);
scene.add(player);

const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffc66b, transparent: true, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2;
pulseRing.position.y = 0.1;
pulseRing.visible = false;
scene.add(pulseRing);

const lanternGeo = new THREE.SphereGeometry(0.7, 16, 16);
const moteGeo = new THREE.SphereGeometry(0.15, 8, 8);
const moteMat = mat(0xffe27a, 0xffd34d, 2.5);
const shadeGeo = new THREE.IcosahedronGeometry(0.8, 1);
const eyeGeo = new THREE.SphereGeometry(0.1, 6, 6);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8 });

let game, lanternViews, moteViews, shadeViews;

function reset() {
  for (const v of [...(lanternViews || []), ...(moteViews || new Map()).values(), ...(shadeViews || new Map()).values()]) scene.remove(v.obj ?? v);
  game = new Game({ seed: (Math.random() * 2 ** 31) | 0, tuning });
  moteViews = new Map();
  shadeViews = new Map();
  lanternViews = game.lanterns.map((l) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.4, 8), mat(0x4a3a2a));
    pole.position.y = 1.2;
    const orb = new THREE.Mesh(lanternGeo, mat(0x3a3050, 0x2a1a10, 1));
    orb.position.y = 2.9;
    const light = new THREE.PointLight(0xffa640, 0, 30, 1.4);
    light.position.y = 3;
    g.add(pole, orb, light);
    g.position.set(l.pos[0], 0, l.pos[2]);
    scene.add(g);
    return { id: l.id, obj: g, orb, light };
  });
  yaw = 0;
  hideMsg();
}

// ---------- input ----------
const keys = new Set();
let yaw = 0;
const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyR' && game.state !== 'playing') reset();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
const k = (...c) => c.some((x) => keys.has(x));

function readInput(dt) {
  // Camera looks along +Z at yaw 0, so screen-right is world -X.
  input.move = [(k('KeyA', 'ArrowLeft') ? 1 : 0) - (k('KeyD', 'ArrowRight') ? 1 : 0), (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0)];
  yaw += ((k('KeyQ') ? 1 : 0) - (k('KeyZ') ? 1 : 0)) * 100 * dt;
  input.cam_yaw_deg = yaw;
  input.jump = k('Space');
  input.interact = k('KeyE');
  input.pulse = k('KeyF');
}

// ---------- HUD ----------
const hud = document.getElementById('hud');
const msg = document.getElementById('msg');
const hideMsg = () => (msg.style.display = 'none');
function showEnd() {
  const won = game.state === 'won';
  const why = { all_lit: 'Mọi Đèn Lồng đã sáng!', dawn: 'Trời sáng, đèn chưa kịp thắp hết.', no_flames: 'Mây đã hết ngọn lửa.' };
  const reason = won ? 'all_lit' : game.timeLeft <= 0 ? 'dawn' : 'no_flames';
  msg.innerHTML = `<h1>${won ? 'Đảo đã sáng trở lại' : 'Đêm dài hơn dự tính'}</h1><p>${why[reason]}</p><p>Điểm: <b>${game.score}</b></p><p>Nhấn R để chơi lại</p>`;
  msg.style.display = 'flex';
}
function updateHud() {
  const lit = game.lanterns.filter((l) => l.lit).length;
  const p = game.player;
  hud.innerHTML =
    `Ngọn lửa: <b>${'🔥'.repeat(Math.max(0, p.flames))}</b><br>` +
    `Đom đóm mang theo: <b>${p.carried}/${tuning.carry_capacity}</b><br>` +
    `Đèn đã thắp: <b>${lit}/${game.lanterns.length}</b><br>` +
    `Thời gian: <b>${Math.max(0, game.timeLeft).toFixed(0)}s</b><br>` +
    `Điểm: <b>${game.score}</b><br>` +
    `Tỏa sáng: <b>${p.pulseCd > 0 ? 'hồi ' + (p.pulseCd / TICK_RATE).toFixed(1) + 's' : p.carried >= tuning.pulse_cost ? 'sẵn sàng (F)' : 'cần đom đóm'}</b>`;
}

// ---------- render sync ----------
function sync(time) {
  const p = game.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.rotation.y = -yaw * (Math.PI / 180);
  body.visible = p.invuln % 10 < 5;
  const th = (yaw * Math.PI) / 180;
  camera.position.set(p.pos[0] - Math.sin(th) * 9, 7 + p.pos[1] * 0.5, p.pos[2] - Math.cos(th) * 9);
  camera.lookAt(p.pos[0], 1.2, p.pos[2]);

  const lit = game.lanterns.filter((l) => l.lit).length;
  ambient.intensity = 1.4 + lit * 0.35;
  scene.fog.density = 0.016 - lit * 0.002;
  lanternViews.forEach((v, i) => {
    const l = game.lanterns[i];
    const f = l.lit ? 1 : l.deposited / tuning.lantern_cost;
    v.orb.material.emissive.set(l.lit ? 0xffa030 : 0xff8a1f);
    v.orb.material.emissiveIntensity = l.lit ? 2.2 + Math.sin(time * 3 + i) * 0.3 : 0.4 + f * 1.2;
    v.light.intensity = l.lit ? 60 : f * 12;
  });

  const alive = new Set();
  for (const m of game.motes) {
    alive.add(m.id);
    let v = moteViews.get(m.id);
    if (!v) moteViews.set(m.id, (v = new THREE.Mesh(moteGeo, moteMat))), scene.add(v);
    v.position.set(m.pos[0], 0.9 + Math.sin(time * 2 + m.pos[0]) * 0.25, m.pos[2]);
  }
  for (const [id, v] of moteViews) if (!alive.has(id)) (scene.remove(v), moteViews.delete(id));

  const sAlive = new Set();
  for (const s of game.shades) {
    sAlive.add(s.id);
    let v = shadeViews.get(s.id);
    if (!v) {
      v = new THREE.Mesh(shadeGeo, mat(0x1a0d2e, 0x3a1060, 0.8));
      for (const x of [-0.25, 0.25]) {
        const e = new THREE.Mesh(eyeGeo, eyeMat);
        e.position.set(x, 0.15, 0.7);
        v.add(e);
      }
      shadeViews.set(s.id, v);
      scene.add(v);
    }
    v.position.set(s.pos[0], 1 + Math.sin(time * 4) * 0.1, s.pos[2]);
    v.scale.setScalar(s.state === 'stunned' ? 0.6 : 1);
    v.lookAt(p.pos[0], 1, p.pos[2]);
  }
  for (const [id, v] of shadeViews) if (!sAlive.has(id)) (scene.remove(v), shadeViews.delete(id));

  const age = (game.tick - game.pulseFx) / TICK_RATE;
  pulseRing.visible = game.pulseFx > 0 && age < 0.5;
  if (pulseRing.visible) {
    pulseRing.position.set(p.pos[0], 0.1, p.pos[2]);
    pulseRing.scale.setScalar(tuning.pulse_radius * (age / 0.5));
    pulseRing.material.opacity = 1 - age / 0.5;
  }
  pLight.intensity = 18 + Math.sin(time * 6) * 2;
}

// ---------- loop (fixed 60 Hz logic, variable-rate render) ----------
reset();
let last = performance.now();
let acc = 0;
let shownEnd = false;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  readInput(dt);
  if (game.state === 'playing') {
    shownEnd = false;
    acc += dt;
    while (acc >= 1 / TICK_RATE && game.state === 'playing') {
      game.step(input);
      acc -= 1 / TICK_RATE;
    }
    game.drainEvents();
  } else if (!shownEnd) {
    shownEnd = true;
    showEnd();
  }
  sync(now / 1000);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
