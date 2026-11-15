import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { actionAt, seededRandom, errors, DT } from '../src/math.mjs';

globalThis.fetch = async url => new Response(await readFile('dist/' + url));
const { LabEngine } = await import('../dist/src/engine.mjs');
const engine = new LabEngine();
await engine.load();
const friction = 1;
const initial = Array.from(engine.reset({friction, push: 0}));
const rng = seededRandom(42);
const actions = Array.from({length: 150}, (_, k) =>
  Array.from(actionAt(k, engine.robot.joints, .2, .05, rng, .5)));
const capture = spawnSync(process.env.WARP_PYTHON || 'python3',
  ['tools/warp_capture.py', process.argv[2] || 'cpu'],
  {input: JSON.stringify({friction, initial, actions}), stdio: ['pipe', 'inherit', 'inherit']});
if (capture.status !== 0) throw capture.error || new Error('Warp capture failed');

const trace = JSON.parse(await readFile('dist/warp-states.json', 'utf8'));
const pairs = (native, warp, learned) => [
  errors(warp, learned).root * 100,
  errors(native, learned).root * 100,
  errors(warp, native).root * 100,
];
const pack = (state) => Array.from(engine.bodies(Float64Array.from(state)), v => +v.toFixed(5));
const cases = [];
for (const anchor of [0, 25, 50, 75, 100]) {
  let learned = Float64Array.from(trace.warp[anchor]);
  // An identical starting state for all engines requires re-running native MuJoCo from this anchor.
  engine.reset({friction, push: 0});
  engine.write(engine.data, learned);
  const frames = [];
  for (let k = 0; k <= 50; k++) {
    const warp = trace.warp[anchor + k];
    const native = k ? engine.step(actions[anchor + k - 1]) : learned;
    if (k) learned = await engine.predict(learned, actions[anchor + k - 1], friction);
    const gaps = pairs(native, warp, learned);
    if (![...learned, ...native, ...warp, ...gaps].every(Number.isFinite)) throw new Error('Non-finite replay');
    frames.push({t: k * DT, gaps, bodies: [pack(warp), pack(native), pack(learned)]});
  }
  cases.push({anchor, height: trace.warp[anchor][2], frames});
}
const oneStep = [];
for (let k = 0; k < actions.length; k++) {
  const state = Float64Array.from(trace.warp[k]);
  engine.reset({friction, push: 0});
  engine.write(engine.data, state);
  oneStep.push(pairs(engine.step(actions[k]), trace.warp[k + 1], await engine.predict(state, actions[k], friction)));
}
const median = xs => {
  const sorted = [...xs].sort((a,b) => a-b);
  return (sorted[Math.floor((xs.length-1)/2)] + sorted[Math.ceil((xs.length-1)/2)]) / 2;
};
const report = {
  schema: 1, device: trace.device, versions: trace.versions, onnxSha256: engine.manifest.onnx_sha256,
  seed: 42, friction, amplitude: .2, frequencyHz: .5, noiseStd: .05, timestep: DT,
  parents: engine.parents, initial, actions, cases, oneStep,
  medianOneStep: [0,1,2].map(i => median(oneStep.map(gaps => gaps[i]))),
  medianOneSecond: [0,1,2].map(i => median(cases.map(c => c.frames.at(-1).gaps[i]))),
};
await writeFile('article/warp-study.json.gz', gzipSync(JSON.stringify(report)));
console.log(JSON.stringify({medianOneStep: report.medianOneStep, medianOneSecond: report.medianOneSecond}));
engine.data.delete();
engine.visual.delete();
engine.model.delete();
await engine.session.release();
