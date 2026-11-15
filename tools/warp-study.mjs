import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { actionAt, seededRandom, errors, DT } from '../src/math.mjs';

globalThis.fetch = async url => new Response(await readFile('dist/' + url));
const { LabEngine } = await import('../dist/src/engine.mjs');
const engine = new LabEngine();
await engine.load();
const pairs = (native, warp, learned) => [
  errors(warp, learned).root * 100,
  errors(native, learned).root * 100,
  errors(warp, native).root * 100,
];
const pack = (state) => Array.from(engine.bodies(Float64Array.from(state)), v => +v.toFixed(3));
const seeds = [17, 42, 73, 101];
const frictions = [1, .35];
const anchors = [0, 25, 50, 75, 100];
const horizons = [1, 5, 10, 25, 50];
const median = values => {
  const sorted = [...values].sort((a,b) => a-b);
  return (sorted[Math.floor((sorted.length-1)/2)] + sorted[Math.ceil((sorted.length-1)/2)]) / 2;
};
const conditions = [];
let versions, device;
for (const friction of frictions) {
  const windows = [];
  let example;
  for (const seed of seeds) {
    const initial = Array.from(engine.reset({friction, push: 0}));
    const rng = seededRandom(seed);
    const actions = Array.from({length: 150}, (_, k) =>
      Array.from(actionAt(k, engine.robot.joints, .2, .05, rng, .5)));
    const capture = spawnSync(process.env.WARP_PYTHON || 'python3',
      ['tools/warp_capture.py', process.argv[2] || 'cpu'],
      {input: JSON.stringify({friction, initial, actions}), stdio: ['pipe', 'inherit', 'inherit']});
    if (capture.status !== 0) throw capture.error || new Error('Warp capture failed');
    const trace = JSON.parse(await readFile('dist/warp-states.json', 'utf8'));
    ({versions, device} = trace);
    for (const anchor of anchors) {
      let learned = Float64Array.from(trace.warp[anchor]);
      engine.reset({friction, push: 0});
      engine.write(engine.data, learned);
      const samples = [], frames = [];
      const record = seed === 42 && anchor === 25;
      for (let k = 0; k <= 50; k++) {
        const warp = trace.warp[anchor + k];
        const native = k ? engine.step(actions[anchor + k - 1]) : learned;
        if (k) learned = await engine.predict(learned, actions[anchor + k - 1], friction);
        const gaps = pairs(native, warp, learned);
        if (![...learned, ...native, ...warp, ...gaps].every(Number.isFinite)) throw new Error('Non-finite replay');
        if (horizons.includes(k)) samples.push(gaps);
        if (record && k % 2 === 0) frames.push({t: k * DT, gaps, bodies: [pack(warp), pack(native), pack(learned)]});
      }
      if (record) example = {anchor, seed, frames};
      windows.push({seed, anchor, samples});
    }
  }
  const summary = horizons.map((steps, h) => ({
    seconds: steps * DT,
    medianCm: [0, 1, 2].map(pair => median(windows.map(w => w.samples[h][pair]))),
    perSeedCm: seeds.map(seed => [0, 1, 2].map(pair =>
      median(windows.filter(w => w.seed === seed).map(w => w.samples[h][pair])))),
  }));
  conditions.push({friction, windows, summary, example});
  console.log(friction, JSON.stringify(summary));
}
const report = {schema: 2, device, versions, onnxSha256: engine.manifest.onnx_sha256,
  timestep: DT, seeds, anchors, parents: engine.parents, conditions, amplitude: .2, frequencyHz: .5, noiseStd: .05};
await writeFile('article/warp-horizons.json.gz', gzipSync(JSON.stringify(report)));
engine.data.delete();
engine.visual.delete();
engine.model.delete();
await engine.session.release();
