// Electron main process for scripts/bench.mjs. Serves the game, opens the bench scene, samples memory, writes JSON.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// vsync off / uncapped frame rate, as requested by the ticket
app.commandLine.appendSwitch('disable-gpu-vsync');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

function parseArgs(argv) {
  const a = { seed: 42, duration: 30, out: 'bench.json' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--seed') a.seed = Number(argv[++i]);
    else if (k === '--duration') a.duration = Number(argv[++i]);
    else if (k === '--out') a.out = argv[++i];
  }
  if (!Number.isInteger(a.seed) || !(a.duration > 0)) throw new Error('--seed must be an integer and --duration > 0');
  return a;
}

const fail = (msg) => {
  process.stderr.write(`error: ${msg}\n`);
  app.exit(1);
};

app.whenReady().then(async () => {
  let o;
  try {
    o = parseArgs(process.argv.slice(2));
  } catch (e) {
    return fail(e.message);
  }
  const t0 = Number(process.env.BENCH_T0) || Date.now();
  const { createServer } = await import(pathToFileURL(path.join(__dirname, '..', 'server.js')).href);
  const server = createServer().listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    useContentSize: true, // the drawable area is exactly 1280x720
    resizable: false,
    fullscreen: false,
    show: true,
    title: 'Đảo Đèn Lồng - benchmark',
    autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false },
  });
  win.setMenuBarVisibility(false);
  const tReady = Date.now() - t0;
  await win.loadURL(`http://localhost:${port}/?bench=1&seed=${o.seed}&duration=${o.duration}&t0=${t0}`);

  // RSS = working set of every Electron process (browser, GPU, renderer, utility), sampled while measuring.
  const rssMb = () => app.getAppMetrics().reduce((s, m) => s + (m.memory?.workingSetSize || 0), 0) / 1024;
  let peak = 0;
  const deadline = Date.now() + (o.duration + 90) * 1000;
  for (;;) {
    let state;
    try {
      state = await win.webContents.executeJavaScript('window.__benchState || "loading"');
    } catch (e) {
      return fail(`renderer: ${e.message}`);
    }
    if (state === 'measuring') peak = Math.max(peak, rssMb());
    if (state === 'done') break;
    if (Date.now() > deadline) return fail('benchmark did not finish in time');
    await new Promise((r) => setTimeout(r, 250));
  }
  const r = await win.webContents.executeJavaScript('window.__benchResult');
  if (process.env.BENCH_DEBUG) console.error('timings', JSON.stringify({ electronReady: tReady, ...r.marks, firstFrame: r.load_ms }));
  const three = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'three', 'package.json'), 'utf8')).version;
  const out = {
    contract_version: '1.3',
    avg_fps: r.avg_fps,
    p1_low_fps: r.p1_low_fps,
    frame_ms_p95: r.frame_ms_p95,
    frames: r.frames,
    load_ms: r.load_ms,
    peak_mem_mb: Math.round(peak),
    vsync_off: true,
    renderer: `three.js r${three.split('.')[1]} WebGL2 + bloom in Electron ${process.versions.electron} (Chromium ${process.versions.chrome}); GPU: ${r.gl.renderer}; pixel ratio ${r.gl.pixel_ratio}`,
    os: `${os.type()} ${os.release()} ${os.arch()}, ${os.cpus()[0]?.model?.trim()}, ${Math.round(os.totalmem() / 1073741824)} GB RAM`,
    seed: o.seed,
    duration_s: o.duration,
  };
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  fs.writeFileSync(o.out, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out));
  server.close();
  app.exit(0);
});
