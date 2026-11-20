// Render thế giới 3D bằng three.js, dựng theo dữ liệu MAPS (sim là nguồn sự thật duy nhất về luật).
// Tối ưu: geometry/material dùng chung, pool theo id cho thực thể động, tối đa 6 đèn point động
// (1 đèn của Mây + 5 đèn cho các đèn lồng đã thắp gần nhất).
import * as THREE from 'three';

export const PAL = {
  sky: 0x0E1430, fog: 0x1B2350, grass: 0x2F5D50, sand: 0xC9B48A, wood: 0x6B4A2F,
  cloud: 0x12384A, lit: 0xFFB347, litCore: 0xFFE9B0, unlit: 0x5B5F6E,
  mote: 0xFFF6C2, moteHalo: 0xFFE58A, shade: 0x120A1A, rim: 0x7A3CFF, stunned: 0x3A3450,
  tunic: 0xE8E2D0, scarf: 0xC8102E, gold: 0xF2C14E, drifter: 0x8FA3B8,
};

const D = Math.PI / 180;
const tmpV = new THREE.Vector3();

function radialTex(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.4, outer);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const idNum = (id) => Number(String(id).replace(/\D/g, '')) || 0;

export class World {
  constructor(container, tuning) {
    this.tuning = tuning;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PAL.sky);
    this.scene.fog = new THREE.Fog(PAL.fog, 55, 190);
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 700);
    this.camera.position.set(0, 6, -12);

    this.ambient = new THREE.AmbientLight(0x9a90cc, 0.3);
    this.scene.add(this.ambient);
    this.moon = new THREE.DirectionalLight(0xa89adf, 0.6);
    this.moon.position.set(-40, 60, 25);
    this.scene.add(this.moon);

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.sharedGeos = new Set();
    this.sharedMats = new Set();

    // --- tài nguyên dùng chung ---
    this.haloTex = radialTex('rgba(255,229,138,0.95)', 'rgba(255,229,138,0.3)');
    this.moteGeo = this.sg(new THREE.SphereGeometry(0.14, 8, 8));
    this.moteMat = this.sm(new THREE.MeshBasicMaterial({ color: PAL.mote }));
    this.haloMat = this.sm(new THREE.SpriteMaterial({ map: this.haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.shadeGeo = this.sg(new THREE.IcosahedronGeometry(0.75, 1));
    this.rimGeo = this.sg(new THREE.IcosahedronGeometry(0.88, 1));
    this.eyeGeo = this.sg(new THREE.SphereGeometry(0.09, 6, 6));
    this.eyeMat = this.sm(new THREE.MeshBasicMaterial({ color: PAL.rim }));
    this.ribbonGeo = this.sg(new THREE.PlaneGeometry(1.3, 0.45, 6, 1));
    this.charmGeo = this.sg(new THREE.BoxGeometry(0.34, 0.5, 0.07));
    this.trimGeo = this.sg(new THREE.BoxGeometry(0.44, 0.6, 0.05));
    this.padGeo = this.sg(new THREE.CylinderGeometry(1, 1.15, 0.16, 20));
    this.padMat = this.sm(new THREE.MeshStandardMaterial({ color: 0x30405a, emissive: PAL.moteHalo, emissiveIntensity: 1.5, roughness: 0.6 }));

    // --- người chơi: Mây (váy #E8E2D0, khăn #C8102E, nón lá, đèn treo có đèn point) ---
    this.player = this._buildPlayer();
    this.scene.add(this.player);

    // pool đèn point cho đèn lồng đã thắp (tối đa 5) + đèn của Mây = 6 đèn động
    this.lightPool = [];
    for (let i = 0; i < 5; i++) {
      const L = new THREE.PointLight(PAL.lit, 0, 22, 1.8);
      L.visible = false;
      this.scene.add(L);
      this.lightPool.push(L);
    }

    // vòng Tỏa Sáng
    this.pulseRing = new THREE.Mesh(
      this.sg(new THREE.RingGeometry(0.85, 1, 48)),
      new THREE.MeshBasicMaterial({ color: PAL.lit, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.pulseRing.visible = false;
    this.scene.add(this.pulseRing);
    this.pulseFxSeen = -1e9;

    // vệt lướt (dash trail) — buffer cố định, không cấp phát mỗi frame
    this.trailN = 26;
    this.trailPts = Array.from({ length: this.trailN }, () => new THREE.Vector3());
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.trailN * 3), 3));
    this.trailGeo = tg;
    this.trailMat = new THREE.LineBasicMaterial({ color: PAL.litCore, transparent: true, opacity: 0 });
    this.trail = new THREE.Line(tg, this.trailMat);
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);

    // lá bay theo gió (đêm 3)
    this.leafN = 90;
    this.leafGeo = new THREE.BufferGeometry();
    this.leafGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.leafN * 3), 3));
    this.leaves = new THREE.Points(this.leafGeo, new THREE.PointsMaterial({ color: 0x9fbf6f, size: 0.42, transparent: true, opacity: 0.9 }));
    this.leaves.visible = false;
    this.leaves.frustumCulled = false;
    this.scene.add(this.leaves);

    this.moteViews = new Map();
    this.shadeViews = new Map();
    this.drifterViews = new Map();
    this.charmViews = new Map();
    this.lanternViews = [];
    this.seen = new Set();
    this.clouds = [];
    this.padMeshes = [];
    this.night = 0;
    this.hasWind = false;
    this.lastT = 0;

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  sg(g) { this.sharedGeos.add(g); return g; }
  sm(m) { this.sharedMats.add(m); return m; }

  _buildPlayer() {
    const g = new THREE.Group();
    const tunic = new THREE.MeshStandardMaterial({ color: PAL.tunic, roughness: 0.8 });
    const scarfM = new THREE.MeshStandardMaterial({ color: PAL.scarf, roughness: 0.7 });
    const hatM = new THREE.MeshStandardMaterial({ color: PAL.sand, roughness: 0.95 });
    const woodM = new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.65, 4, 12), tunic);
    body.position.y = 0.72;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), tunic);
    head.position.y = 1.38;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.08, 8, 18), scarfM);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.13;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.32, 20), hatM); // nón lá
    hat.position.y = 1.63;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 6), woodM);
    stick.position.set(0.4, 1.14, 0.12);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), new THREE.MeshBasicMaterial({ color: PAL.lit }));
    lamp.position.set(0.4, 0.98, 0.12);
    const light = new THREE.PointLight(0xffc070, 22, 15, 1.7);
    light.position.set(0.4, 1.05, 0.12);
    g.add(body, head, scarf, hat, stick, lamp, light);
    g.userData.light = light;
    return g;
  }

  /** Dựng lại toàn bộ thế giới cho một đêm (gọi khi bắt đầu màn). */
  buildNight(night, map) {
    this.focus = null; // snap the camera to the player on the next frame
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry && !this.sharedGeos.has(o.geometry)) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (!this.sharedMats.has(m)) m.dispose(); });
    });
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.moteViews.clear(); this.shadeViews.clear(); this.drifterViews.clear(); this.charmViews.clear();
    this.lanternViews = []; this.clouds = []; this.padMeshes = [];
    this.night = night;
    this.hasWind = !!map.wind;
    this.pulseFxSeen = -1e9;
    this.pulseRing.visible = false;
    this.trailMat.opacity = 0;
    for (let i = 0; i < this.trailN; i++) this.trailPts[i].set(0, -100, 0);

    const g = this.group;
    const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o });
    const add = (m) => { g.add(m); return m; };

    // sao
    {
      const n = 350;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const e = Math.random() * Math.PI * 0.45 + 0.05;
        const r = 430;
        pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
        pos[i * 3 + 1] = Math.sin(e) * r;
        pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xcfd6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
      stars.frustumCulled = false;
      add(stars);
    }

    // biển mây
    {
      const sea = add(new THREE.Mesh(new THREE.CircleGeometry(330, 48), std(PAL.cloud, { roughness: 1 })));
      sea.rotation.x = -Math.PI / 2;
      sea.position.y = -3.2;
      for (let i = 0; i < 12; i++) {
        const c = add(new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x16455c, roughness: 1, transparent: true, opacity: 0.85 })));
        const a = Math.random() * Math.PI * 2;
        const r = 60 + Math.random() * 170;
        c.position.set(Math.cos(a) * r, -3.4 + Math.random() * 0.9, Math.sin(a) * r);
        c.scale.set(6 + Math.random() * 8, 1.6 + Math.random(), 4 + Math.random() * 5);
        this.clouds.push(c);
      }
    }

    // địa hình theo từng đêm (số liệu lấy từ MAPS)
    if (night === 1) {
      const isl = add(new THREE.Mesh(new THREE.CylinderGeometry(40, 33, 5, 64), std(PAL.grass)));
      isl.position.y = -2.5;
      const rim = add(new THREE.Mesh(new THREE.RingGeometry(36, 40, 64), std(PAL.sand)));
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.02;
    } else if (night === 2) {
      for (const cx of [0, 70]) {
        const isl = add(new THREE.Mesh(new THREE.CylinderGeometry(28, 23, 5, 48), std(PAL.grass)));
        isl.position.set(cx, -2.5, 0);
        const rim = add(new THREE.Mesh(new THREE.RingGeometry(25, 28, 48), std(PAL.sand)));
        rim.rotation.x = -Math.PI / 2;
        rim.position.set(cx, 0.02, 0);
      }
      const deck = add(new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 4), std(PAL.wood))); // cầu tre x∈[26,44], z∈[-2,2]
      deck.position.set(35, -0.25, 0);
      for (let i = 0; i < 9; i++) {
        const pl = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 3.6), std(0x7d5836)));
        pl.position.set(27 + i * 2, 0.03, 0);
      }
    } else {
      const isl = add(new THREE.Mesh(new THREE.CylinderGeometry(45, 38, 5, 72), std(PAL.grass)));
      isl.position.y = -2.5;
      const rim = add(new THREE.Mesh(new THREE.RingGeometry(41, 45, 72), std(PAL.sand)));
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.02;
      // bậc 1: vành khuyên nửa z>0, r 12..24, mặt trên Y=3
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 24, 0, Math.PI, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, 12, 0, Math.PI, true);
      shape.holes.push(hole);
      const t1 = add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false }), std(PAL.grass)));
      t1.geometry.rotateX(Math.PI / 2); // shape (x,y) -> (x, z=y); extrude z∈[0,3] -> y∈[-3,0]
      t1.position.y = 3;
      // bậc 2: đĩa r=8, mặt trên Y=6
      const t2 = add(new THREE.Mesh(new THREE.CylinderGeometry(8, 9.5, 6, 32), std(PAL.grass)));
      t2.position.y = 3;
      const rim2 = add(new THREE.Mesh(new THREE.RingGeometry(6.8, 8, 32), std(PAL.sand)));
      rim2.rotation.x = -Math.PI / 2;
      rim2.position.y = 6.02;
      // 2 dốc lên bậc 1: góc 30° và 150°, s từ 30 (Y=0) tới 24 (Y=3), rộng 3 m
      for (const a of [30 * D, 150 * D]) {
        const grp = new THREE.Group();
        grp.position.set(Math.cos(a) * 27, 0, Math.sin(a) * 27);
        grp.rotation.y = -a;
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(6, 3), 0.35, 3), std(PAL.wood));
        ramp.rotation.z = -Math.atan2(3, 6);
        ramp.position.y = 1.5;
        grp.add(ramp);
        g.add(grp);
      }
      // tháp chuông trên bậc 2 (r=2, cao 8, đỉnh Y=14) + chuông vàng
      const tower = add(new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 8, 12), std(PAL.wood)));
      tower.position.y = 10;
      const roof = add(new THREE.Mesh(new THREE.ConeGeometry(2.9, 2.2, 12), std(0x54371f)));
      roof.position.y = 15.1;
      const beam = add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.18), std(PAL.wood)));
      beam.position.y = 13.85;
      const bell = add(new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.8, 10), std(PAL.gold, { metalness: 0.6, roughness: 0.35, emissive: PAL.gold, emissiveIntensity: 0.3 })));
      bell.position.y = 13.4;
    }

    // bệ nhảy (glow disc)
    for (const pad of map.pads) {
      const m = add(new THREE.Mesh(this.padGeo, this.padMat));
      m.position.set(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2]);
      this.padMeshes.push(m);
      const ring = add(new THREE.Mesh(new THREE.RingGeometry(1.05, 1.3, 24), new THREE.MeshBasicMaterial({ color: PAL.moteHalo, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pad.pos[0], pad.pos[1] + 0.05, pad.pos[2]);
    }

    // cột đèn lồng (vị trí lấy từ MAPS)
    const safeR = this.tuning.safe_radius;
    for (const l of map.lanterns) {
      const grp = new THREE.Group();
      grp.position.set(l.pos[0], l.pos[1], l.pos[2]);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 3.1, 8), std(PAL.wood));
      pole.position.y = 1.55;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.32, 12), std(PAL.wood));
      roof.position.y = 3.95;
      const cageMat = new THREE.MeshStandardMaterial({ color: PAL.unlit, roughness: 0.5 });
      const cage = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), cageMat);
      cage.position.y = 3.35;
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshBasicMaterial({ color: PAL.litCore }));
      core.position.y = 3.35;
      core.visible = false;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(safeR - 0.4, safeR, 40),
        new THREE.MeshBasicMaterial({ color: PAL.lit, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      ring.visible = false;
      grp.add(pole, roof, cage, core, ring);
      g.add(grp);
      this.lanternViews.push({ cageMat, cage, core, ring });
    }

    if (this.hasWind) {
      const pos = this.leafGeo.attributes.position;
      for (let i = 0; i < this.leafN; i++) pos.setXYZ(i, (Math.random() - 0.5) * 110, 0.5 + Math.random() * 9, (Math.random() - 0.5) * 110);
      pos.needsUpdate = true;
    }
  }

  _moteView(id) {
    let v = this.moteViews.get(id);
    if (!v) {
      const grp = new THREE.Group();
      const mesh = new THREE.Mesh(this.moteGeo, this.moteMat);
      const halo = new THREE.Sprite(this.haloMat);
      halo.scale.setScalar(1.5);
      grp.add(mesh, halo);
      this.group.add(grp);
      v = { grp, mesh, halo };
      this.moteViews.set(id, v);
    }
    return v;
  }

  _shadeView(id) {
    let v = this.shadeViews.get(id);
    if (!v) {
      const grp = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: PAL.shade, roughness: 0.55 });
      const body = new THREE.Mesh(this.shadeGeo, bodyMat);
      const rim = new THREE.Mesh(this.rimGeo, new THREE.MeshBasicMaterial({ color: PAL.rim, transparent: true, opacity: 0.55, side: THREE.BackSide, depthWrite: false }));
      const e1 = new THREE.Mesh(this.eyeGeo, this.eyeMat);
      e1.position.set(-0.22, 0.12, 0.62);
      const e2 = new THREE.Mesh(this.eyeGeo, this.eyeMat);
      e2.position.set(0.22, 0.12, 0.62);
      grp.add(body, rim, e1, e2);
      this.group.add(grp);
      v = { grp, bodyMat, rim, startTicks: 0 };
      this.shadeViews.set(id, v);
    }
    return v;
  }

  _drifterView(id) {
    let v = this.drifterViews.get(id);
    if (!v) {
      const mat = new THREE.MeshStandardMaterial({ color: PAL.drifter, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
      const mesh = new THREE.Mesh(this.ribbonGeo, mat);
      this.group.add(mesh);
      v = { mesh, mat };
      this.drifterViews.set(id, v);
    }
    return v;
  }

  _charmView(id) {
    let v = this.charmViews.get(id);
    if (!v) {
      const grp = new THREE.Group();
      const trim = new THREE.Mesh(this.trimGeo, new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.5, roughness: 0.4 }));
      const tag = new THREE.Mesh(this.charmGeo, new THREE.MeshStandardMaterial({ color: PAL.scarf, roughness: 0.6, emissive: PAL.scarf, emissiveIntensity: 0.25 }));
      grp.add(trim, tag);
      this.group.add(grp);
      v = { grp };
      this.charmViews.set(id, v);
    }
    return v;
  }

  /** Đồng bộ toàn bộ thực thể với sim. dt=0 khi tạm dừng (đứng hình). */
  sync(game, dt, t) {
    this.lastT = t;
    const p = game.p;

    // người chơi
    this.player.position.set(p.pos[0], p.pos[1], p.pos[2]);
    this.player.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
    this.player.visible = !(p.invuln > 0 && (game.simTick >> 2) % 2 === 0); // nhấp nháy khi bất tử
    if (p.grounded && Math.abs(p.vel[0]) + Math.abs(p.vel[2]) > 0.5 && !p.dead) {
      this.player.position.y += Math.abs(Math.sin(game.simTick * 0.3)) * 0.05;
    }

    // đèn lồng + ánh sáng
    let lit = 0;
    const litList = [];
    const n = Math.min(game.lanterns.length, this.lanternViews.length);
    for (let i = 0; i < n; i++) {
      const l = game.lanterns[i];
      const v = this.lanternViews[i];
      if (l.lit) { lit++; litList.push([Math.hypot(p.pos[0] - l.pos[0], p.pos[2] - l.pos[2]), v, l]); }
      v.cageMat.color.setHex(l.lit ? PAL.lit : PAL.unlit);
      v.cageMat.emissive.setHex(l.lit ? PAL.lit : 0x000000);
      v.cageMat.emissiveIntensity = l.lit ? 1.5 : 0;
      v.core.visible = l.lit;
      v.ring.visible = l.lit;
      v.cage.scale.setScalar(l.lit ? 1.18 : 1 + 0.25 * (l.deposited / this.tuning.lantern_cost));
    }
    litList.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < this.lightPool.length; i++) {
      const L = this.lightPool[i];
      if (i < litList.length) {
        const l = litList[i][2];
        L.visible = true;
        L.position.set(l.pos[0], l.pos[1] + 3.35, l.pos[2]);
        L.intensity = 30;
      } else { L.visible = false; L.intensity = 0; }
    }
    this.ambient.intensity = 0.15 + 0.55 * (n ? lit / n : 0);

    // đốm sáng (mote)
    this.seen.clear();
    for (const m of game.motes) {
      const v = this._moteView(m.id);
      this.seen.add(m.id);
      const bob = Math.sin((game.simTick + idNum(m.id) * 7) * 0.09) * 0.12;
      v.grp.position.set(m.pos[0], m.pos[1] + 0.25 + bob, m.pos[2]);
      const low = m.ttl !== null && m.ttl < 120;
      v.grp.visible = !low || (game.simTick >> 2) % 2 === 0; // đốm rơi nhấp nháy khi sắp hết hạn
      const s = low ? 0.75 : 1;
      v.mesh.scale.setScalar(s);
      v.halo.scale.setScalar(1.5 * s);
    }
    for (const [id, v] of this.moteViews) if (!this.seen.has(id)) { this.group.remove(v.grp); this.moteViews.delete(id); }

    // bóng ma
    this.seen.clear();
    for (const s of game.shades) {
      const v = this._shadeView(s.id);
      this.seen.add(s.id);
      v.grp.position.set(s.pos[0], s.pos[1], s.pos[2]);
      let scale = 1;
      let color = PAL.shade;
      let rimOp = 0.55;
      if (s.state === 'spawning') {
        if (!v.startTicks) v.startTicks = s.ticks || 1;
        scale = 0.2 + 0.8 * Math.max(0, 1 - s.ticks / v.startTicks);
        rimOp = 0.9;
      } else if (s.state === 'stunned') {
        scale = 0.62;
        color = PAL.stunned;
        rimOp = 0.15;
      } else if (s.state === 'recoil') {
        color = s.ticks > 45 ? PAL.rim : PAL.shade;
        rimOp = 0.95;
      }
      v.bodyMat.color.setHex(color);
      v.rim.material.opacity = rimOp;
      if (s.state === 'chase') v.grp.position.y += Math.abs(Math.sin(game.simTick * 0.2)) * 0.08;
      v.grp.scale.setScalar(scale);
      v.grp.rotation.y = game.simTick * 0.02 * (s.state === 'chase' ? 2.2 : 1);
    }
    for (const [id, v] of this.shadeViews) if (!this.seen.has(id)) { this.group.remove(v.grp); this.shadeViews.delete(id); }

    // Gió Lạc (drifter)
    this.seen.clear();
    for (const d of game.drifters) {
      const v = this._drifterView(d.id);
      this.seen.add(d.id);
      v.mesh.position.set(d.pos[0], d.pos[1] + Math.sin(t * 4 + idNum(d.id)) * 0.12, d.pos[2]);
      v.mesh.rotation.y = Math.sin(t * 2.2 + idNum(d.id)) * 0.6;
      v.mesh.rotation.z = Math.sin(t * 7 + idNum(d.id)) * 0.22;
      v.mesh.scale.x = 1 + 0.15 * Math.sin(t * 9 + idNum(d.id));
      v.mat.color.setHex(d.stolen > 0 ? PAL.scarf : PAL.drifter);
    }
    for (const [id, v] of this.drifterViews) if (!this.seen.has(id)) { this.group.remove(v.mesh); this.drifterViews.delete(id); }

    // bùa đỏ
    this.seen.clear();
    for (const c of game.charms) {
      const v = this._charmView(c.id);
      this.seen.add(c.id);
      v.grp.visible = c.available;
      if (c.available) {
        v.grp.position.set(c.pos[0], c.pos[1] + 0.6 + Math.sin(game.simTick * 0.05) * 0.15, c.pos[2]);
        v.grp.rotation.y = game.simTick * 0.04;
      }
    }
    for (const [id, v] of this.charmViews) if (!this.seen.has(id)) { this.group.remove(v.grp); this.charmViews.delete(id); }

    // vòng Tỏa Sáng
    if (game.pulseFx !== this.pulseFxSeen) {
      this.pulseFxSeen = game.pulseFx;
      this.pulseRing.visible = true;
    }
    const age = game.simTick - this.pulseFxSeen;
    if (this.pulseRing.visible) {
      if (age > 26) this.pulseRing.visible = false;
      else {
        const k = age / 26;
        this.pulseRing.scale.setScalar(0.3 + (this.tuning.pulse_radius + 0.2) * k);
        this.pulseRing.material.opacity = 0.8 * (1 - k);
        this.pulseRing.position.set(p.pos[0], p.pos[1] + 0.9, p.pos[2]);
      }
    }

    // vệt lướt
    if (p.dashT > 0) {
      for (let i = this.trailN - 1; i > 0; i--) this.trailPts[i].copy(this.trailPts[i - 1]);
      this.trailPts[0].set(p.pos[0], p.pos[1] + 0.9, p.pos[2]);
      this.trailMat.opacity = 0.75;
    } else if (this.trailMat.opacity > 0) {
      this.trailMat.opacity = Math.max(0, this.trailMat.opacity - dt * 2.2);
    }
    if (this.trailMat.opacity > 0) {
      const pos = this.trailGeo.attributes.position;
      for (let i = 0; i < this.trailN; i++) pos.setXYZ(i, this.trailPts[i].x, this.trailPts[i].y, this.trailPts[i].z);
      pos.needsUpdate = true;
      this.trail.visible = true;
    } else this.trail.visible = false;

    // lá bay theo gió (đêm 3)
    const w = game.wind;
    const windOn = this.hasWind && (w.warning || w.active);
    this.leaves.visible = windOn;
    if (windOn && dt > 0) {
      const dir = (w.dir_deg * Math.PI) / 180;
      const dx = Math.cos(dir);
      const dz = Math.sin(dir);
      const pos = this.leafGeo.attributes.position;
      for (let i = 0; i < this.leafN; i++) {
        let x = pos.getX(i) + (dx * 7 + Math.sin(t * 3 + i) * 1.5) * dt;
        let y = pos.getY(i) - dt * (1.2 + (i % 5) * 0.3);
        let z = pos.getZ(i) + (dz * 7 + Math.cos(t * 2.6 + i * 1.3) * 1.5) * dt;
        if (y < -2 || Math.hypot(x, z) > 60) {
          x = -dx * 55 + (Math.random() - 0.5) * 14;
          z = -dz * 55 + (Math.random() - 0.5) * 14;
          y = 4 + Math.random() * 7;
        }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }

    this._idle(t, dt);
  }

  /** Hoạt ảnh nền rẻ tiền: mây trôi, bệ nhảy phát sáng. */
  _idle(t, dt = 0.016) {
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.position.x += dt * 0.35 * (i % 2 ? 1 : -1);
      if (c.position.x > 240) c.position.x = -240;
      if (c.position.x < -240) c.position.x = 240;
    }
    for (const m of this.padMeshes) m.material.emissiveIntensity = 1.3 + Math.sin(t * 4 + m.position.x) * 0.6;
  }

  /** Camera orbit sau lưng người chơi. yaw=0 -> camera nhìn theo +Z (phải màn hình là -X). */
  updateCamera(pPos, yawDeg, dt) {
    const th = (yawDeg * Math.PI) / 180;
    const fx = Math.sin(th);
    const fz = Math.cos(th);
    // Only the follow point is smoothed. The orbit (yaw) is applied instantly: smoothing the camera position
    // made the view trail behind the mouse and swing back, which felt like input lag.
    if (!this.focus) this.focus = new THREE.Vector3(pPos[0], pPos[1], pPos[2]);
    const k = 1 - Math.exp(-dt * 18);
    this.focus.x += (pPos[0] - this.focus.x) * k;
    this.focus.z += (pPos[2] - this.focus.z) * k;
    this.focus.y += (pPos[1] - this.focus.y) * (1 - Math.exp(-dt * 8)); // gentler vertically (jumps, pads)
    this.camera.position.set(this.focus.x - fx * 7.5, this.focus.y + 3.4, this.focus.z - fz * 7.5);
    this.camera.lookAt(this.focus.x + fx * 2, this.focus.y + 1.3, this.focus.z + fz * 2);
  }

  /** Camera quay chậm cho menu / màn hình chờ (nền 3D phía sau). */
  menuCam(t) {
    this.camera.position.set(Math.sin(t * 0.06) * 26, 10 + Math.sin(t * 0.1) * 2, Math.cos(t * 0.06) * 26);
    this.camera.lookAt(0, 2, 0);
    this._idle(t);
  }

  /** Chiếu điểm thế giới ra pixel màn hình. Trả về {x, y, on, behind} (đã lật hướng khi nằm sau camera). */
  project(x, y, z) {
    tmpV.set(x, y, z).project(this.camera);
    const behind = tmpV.z > 1;
    let nx = tmpV.x;
    let ny = tmpV.y;
    if (behind) { nx = -nx; ny = -ny; }
    return {
      x: (nx * 0.5 + 0.5) * window.innerWidth,
      y: (-ny * 0.5 + 0.5) * window.innerHeight,
      on: !behind && Math.abs(tmpV.x) <= 0.98 && Math.abs(tmpV.y) <= 0.98,
      behind,
    };
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
