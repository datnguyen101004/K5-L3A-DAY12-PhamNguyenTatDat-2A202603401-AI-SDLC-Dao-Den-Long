// Standard maps (Ticket-02, Part 2). Pure data + terrain queries; no state.
// Angles are measured from +X toward +Z in the XZ plane: point = (cx + r*cos(a), y, cz + r*sin(a)).
const D = Math.PI / 180;
const ring = (r, startDeg, stepDeg, count, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: count }, (_, i) => {
    const a = (startDeg + i * stepDeg) * D;
    return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
  });
const L = (...ps) => ps.map((pos, i) => ({ id: `L${i + 1}`, pos }));

// ---- Night 1: Đảo Bến ----
const night1 = {
  name: 'Đảo Bến',
  start: [0, 0, 0],
  lanterns: L([0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]),
  motePts: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
  shadePts: ring(37, 15, 30, 12),
  shade: { first: 300, interval: 480, max: 6 },
  charms: [],
  pads: [],
  drifters: false,
  wind: false,
  bounds: [-41, 41, -41, 41],
  topsAt: (x, z) => (Math.hypot(x, z) <= 40 ? [0] : []),
};

// ---- Night 2: Đảo Cau ----
const B = [70, 0, 0];
const night2 = {
  name: 'Đảo Cau',
  start: [0, 0, 0],
  lanterns: L([0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]),
  motePts: [...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8), ...ring(10, 0, 90, 4, 0, 70, 0), ...ring(22, 0, 45, 8, 0, 70, 0)],
  shadePts: [...ring(26, 22.5, 45, 8), ...ring(26, 22.5, 45, 8, 0, 70, 0)],
  shade: { first: 300, interval: 420, max: 8 },
  charms: [{ id: 'C1', pos: [35, 0, 0] }],
  pads: [
    { pos: [20, 0, 18], vy: 14, h: 24, to: [70, 0] },
    { pos: [50, 0, -18], vy: 14, h: 24, to: [0, 0] },
  ],
  drifters: true,
  wind: false,
  bounds: [-29, 99, -29, 29],
  topsAt: (x, z) =>
    Math.hypot(x, z) <= 28 || Math.hypot(x - B[0], z) <= 28 || (x >= 26 && x <= 44 && Math.abs(z) <= 2) ? [0] : [],
};

// ---- Night 3: Đảo Chuông ----
const RAMPS = [30 * D, 150 * D];
const TOWER_R = 2;
const TOWER_TOP = 14; // tier 2 (Y=6) + 8 m
const night3 = {
  name: 'Đảo Chuông',
  start: [0, 0, 30], // assumption A22: (0,0,0) is inside the tower
  lanterns: L([0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]),
  motePts: [...ring(34, 0, 20, 18), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
  shadePts: ring(43, 0, 22.5, 16),
  shade: { first: 300, interval: 360, max: 10 },
  charms: [
    { id: 'C1', pos: [30, 0, 25] },
    { id: 'C2', pos: [-30, 0, 25] },
  ],
  pads: [{ pos: [0, 3, 13], vy: 12, h: 8, dir: [0, -1] }],
  drifters: true,
  wind: true,
  bounds: [-46, 46, -46, 46],
  topsAt: (x, z) => {
    const r = Math.hypot(x, z);
    if (r > 45) return [];
    const t = [0];
    if (z > 0 && r >= 12 && r <= 24) t.push(3);
    if (r < 8) t.push(6);
    if (r < TOWER_R) t.push(TOWER_TOP);
    for (const a of RAMPS) {
      const s = x * Math.cos(a) + z * Math.sin(a);
      const lat = Math.abs(-x * Math.sin(a) + z * Math.cos(a));
      if (lat <= 1.5 && s >= 24 && s <= 30) t.push((3 * (30 - s)) / 6);
    }
    return t;
  },
};

export const MAPS = { 1: night1, 2: night2, 3: night3 };
export const NIGHT_NAMES = { 1: night1.name, 2: night2.name, 3: night3.name };
