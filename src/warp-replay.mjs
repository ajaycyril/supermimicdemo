const colors = ['#5947a4', '#116d79', '#b84d23'];
const formatGap = cm => cm > 0 && cm < .001 ? cm.toExponential(2) : cm.toFixed(3);
const labels = ['MuJoCo Warp', 'Native MuJoCo WASM', 'Community world model'];
const panel = document.getElementById('warp-replay');
if (panel) loadReplay().catch(() => {
  panel.querySelector('[role=status]').textContent = 'The recorded Warp experiment could not be loaded.';
});

async function loadReplay() {
  const response = await fetch('article/warp-study.json.gz');
  if (!response.ok) throw new Error('Missing Warp replay');
  const raw = response.body.pipeThrough(new DecompressionStream('gzip'));
  const data = await new Response(raw).json();
  const select = panel.querySelector('select');
  const scrub = panel.querySelector('input');
  const canvas = panel.querySelector('canvas');
  const button = panel.querySelector('button');
  const c = canvas.getContext('2d');
  const values = panel.querySelectorAll('[data-gap]');
  const median = panel.querySelectorAll('[data-summary]');
  const time = panel.querySelector('output');
  let timer = null;

  for (const [i, run] of data.cases.entries()) {
    select.add(new Option(`Warp at ${(run.anchor * data.timestep).toFixed(2)} s · base ${run.height.toFixed(2)} m`, i));
  }
  for (const [i, value] of median.entries()) {
    const numbers = i % 2 === 0 ? data.medianOneStep : data.medianOneSecond;
    value.textContent = formatGap(numbers[Math.floor(i / 2)]);
  }

  function draw() {
    const run = data.cases[Number(select.value)];
    const frame = run.frames[Number(scrub.value)];
    c.fillStyle = '#f8f7f3';
    c.fillRect(0, 0, canvas.width, canvas.height);
    const [originX, originY] = run.frames[0].bodies[0].slice(3, 5);
    for (const [side, positions] of frame.bodies.entries()) {
      const center = 180 + side * 360;
      c.strokeStyle = '#dbe3df';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(center - 140, 298);
      c.lineTo(center + 140, 298);
      c.stroke();
      c.strokeStyle = colors[side];
      c.fillStyle = colors[side];
      c.textAlign = 'center';
      c.font = '600 25px system-ui';
      c.fillText(labels[side], center, 43);
      c.lineWidth = 5;
      c.lineCap = 'round';
      const point = i => {
        const [x,y,z] = positions.slice(i * 3, i * 3 + 3);
        return [center + 180 * (y - originY + .65 * (x - originX)), 298 - 220 * z];
      };
      for (const [i, parent] of data.parents.entries()) {
        if (!i || !parent) continue;
        c.beginPath();
        c.moveTo(...point(parent));
        c.lineTo(...point(i));
        c.stroke();
      }
    }
    time.value = `${frame.t.toFixed(2)} s`;
    for (const [i, value] of values.entries()) value.textContent = formatGap(frame.gaps[i]);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    button.textContent = 'Play replay';
  }

  scrub.max = data.cases[0].frames.length - 1;
  select.onchange = () => { stop(); scrub.value = 0; draw(); };
  scrub.oninput = () => { stop(); draw(); };
  button.onclick = () => {
    if (timer !== null) { stop(); return; }
    if (scrub.value === scrub.max) scrub.value = 0;
    button.textContent = 'Pause replay';
    timer = setInterval(() => {
      scrub.stepUp();
      draw();
      if (scrub.value === scrub.max) stop();
    }, 55);
  };
  panel.querySelector('fieldset').disabled = false;
  panel.querySelector('[role=status]').textContent =
    `Recorded with MuJoCo Warp ${data.versions['mujoco-warp']} on ${data.device.toUpperCase()}. Playback is slowed for inspection.`;
  draw();
}
