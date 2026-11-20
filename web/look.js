// Visual assets built in code: canvas textures and detailed models. No external files (no licensing to track).
import * as THREE from 'three';

let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

/** Speckled ground: base colour plus soft blobs and fine grain in nearby shades. */
function speckle(base, blobs, grains) {
  return (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      const x = rand() * s;
      const y = rand() * s;
      const r = 8 + rand() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, blobs[i % blobs.length]);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) { g.save(); g.translate(dx, dy); g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore(); }
    }
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = grains[i % grains.length];
      g.fillRect(rand() * s, rand() * s, 1 + rand() * 1.5, 1 + rand() * 2.5);
    }
  };
}

export function makeTextures() {
  seed = 7;
  return {
    grass: canvasTex(256, speckle('#2F5D50', ['rgba(70,130,100,0.35)', 'rgba(20,50,40,0.35)', 'rgba(90,120,70,0.25)'], ['rgba(110,170,130,0.35)', 'rgba(15,40,32,0.4)', 'rgba(160,190,120,0.25)']), 14),
    sand: canvasTex(128, speckle('#C9B48A', ['rgba(230,210,170,0.18)', 'rgba(150,125,85,0.14)'], ['rgba(255,240,210,0.4)', 'rgba(120,95,60,0.35)']), 10),
    wood: canvasTex(128, (g, s) => {
      g.fillStyle = '#6B4A2F';
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 46; i++) {
        g.strokeStyle = rand() < 0.5 ? 'rgba(40,24,12,0.45)' : 'rgba(150,110,70,0.3)';
        g.lineWidth = 0.6 + rand() * 1.8;
        const x = rand() * s;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + rand() * 6 - 3, s * 0.33, x + rand() * 6 - 3, s * 0.66, x + rand() * 4 - 2, s);
        g.stroke();
      }
    }, 1),
    // silk lantern: warm cloth with vertical ribs and a soft horizontal band pattern
    paper: canvasTex(256, (g, s) => {
      const gr = g.createLinearGradient(0, 0, 0, s);
      gr.addColorStop(0, '#d8862e');
      gr.addColorStop(0.5, '#ffd28a');
      gr.addColorStop(1, '#d8862e');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
      g.fillStyle = 'rgba(160,40,20,0.55)';
      g.fillRect(0, s * 0.12, s, s * 0.05);
      g.fillRect(0, s * 0.83, s, s * 0.05);
      g.strokeStyle = 'rgba(110,60,20,0.55)';
      g.lineWidth = 2;
      for (let i = 0; i < 12; i++) { const x = (i + 0.5) * (s / 12); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke(); }
      g.fillStyle = 'rgba(255,240,200,0.35)';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((i + 0.5) * (s / 6), s / 2, s * 0.05, 0, Math.PI * 2); g.fill(); }
    }, 1),
    // nón lá: concentric straw rings
    straw: canvasTex(128, (g, s) => {
      g.fillStyle = '#d9c28d';
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 ? 'rgba(150,120,70,0.45)' : 'rgba(255,240,200,0.25)';
        g.fillRect(0, (i / 16) * s, s, s / 40);
      }
      for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(120,95,55,0.25)'; g.fillRect(rand() * s, rand() * s, 3 + rand() * 6, 1); }
    }, 1),
  };
}

/** Night sky dome: vertical gradient sky -> fog colour at the horizon, plus a faint violet band. */
export function makeSky(top = 0x0E1430, horizon = 0x1B2350) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, band: { value: new THREE.Color(0x3a2f6e) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 band; varying vec3 vP;
      void main(){ float h = clamp(vP.y, -0.2, 1.0);
        vec3 c = mix(horizon, top, smoothstep(0.0, 0.55, h));
        c += band * 0.35 * exp(-pow((h - 0.08) / 0.07, 2.0));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 16), mat);
  m.frustumCulled = false;
  return m;
}

/** Hội An silk lantern body (lathe), centred on its origin, ~0.9 m tall, ~1 m wide. */
export function lanternGeometry() {
  const pts = [[0.06, -0.46], [0.22, -0.42], [0.38, -0.3], [0.47, -0.12], [0.49, 0.05], [0.44, 0.22], [0.32, 0.36], [0.16, 0.44], [0.06, 0.46]].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 24);
}

/** Mây: robe, head, red scarf with a tail, nón lá, small lantern held forward on a stick. Faces +Z. */
export function buildPlayer(tex, PAL) {
  const g = new THREE.Group();
  const robe = new THREE.MeshStandardMaterial({ color: PAL.tunic, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0cfae, roughness: 0.7 });
  const scarfM = new THREE.MeshStandardMaterial({ color: PAL.scarf, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.6 });
  const hatM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.straw, roughness: 0.95, side: THREE.DoubleSide });
  const woodM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.wood, roughness: 0.9 });
  // robe flares towards the hem
  const body = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.05], [0.38, 0.05], [0.33, 0.45], [0.26, 0.85], [0.22, 1.08], [0, 1.12]].map(([r, y]) => new THREE.Vector2(r, y)), 20), robe);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 6, 20), scarfM);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.62;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), skin);
  head.position.y = 1.32;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.225, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), dark);
  hair.position.y = 1.33;
  hair.rotation.x = -0.35;
  const eyes = [-0.075, 0.075].map((x) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), dark);
    e.position.set(x, 1.34, 0.2);
    return e;
  });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 18), scarfM);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.1;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.04), scarfM);
  tail.position.set(-0.1, 0.92, -0.22);
  tail.rotation.set(0.35, 0, 0.15);
  // nón lá: shallow cone with straw rings, slight brim lip
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.36, 28, 1, true), hatM);
  hat.position.y = 1.62;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.015, 4, 28), hatM);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 1.44;
  // stick and hand lantern held forward-right
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.75, 6), woodM);
  stick.position.set(0.5, 1.02, 0.12);
  stick.rotation.z = -0.9; // held out to the side so the lantern is visible from behind
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.paper, emissive: 0xffa040, emissiveMap: tex.paper, emissiveIntensity: 1.4 });
  const lamp = new THREE.Mesh(lanternGeometry(), lampMat);
  lamp.scale.setScalar(0.26);
  lamp.position.set(0.74, 1.08, 0.12);
  const light = new THREE.PointLight(0xffc070, 14, 15, 1.7);
  light.position.set(0.3, 2.3, 0.3); // above the hat: lights the ground evenly without burning out the robe
  g.add(body, belt, head, hair, ...eyes, scarf, tail, hat, lip, stick, lamp, light);
  g.userData.light = light;
  g.userData.lamp = lamp;
  return g;
}

/** Inky shade body: an icosphere with lumpy displacement and a dripping tail. */
export function shadeGeometry() {
  const geo = new THREE.IcosahedronGeometry(0.75, 3);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 5.1) * Math.cos(v.y * 4.3) * Math.sin(v.z * 6.7);
    const drip = v.y < -0.2 ? (-v.y - 0.2) * 0.9 : 0; // longer and narrower at the bottom
    v.multiplyScalar(1 + 0.07 * n);
    v.y -= drip * 0.45;
    v.x *= 1 - drip * 0.35;
    v.z *= 1 - drip * 0.35;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
