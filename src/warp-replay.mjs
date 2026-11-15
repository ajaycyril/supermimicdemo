const colors = ['#5947a4', '#116d79', '#b84d23'];
const formatGap = cm => cm > 0 && cm < .001 ? cm.toExponential(2) : cm.toFixed(cm < 1 ? 3 : 2);
const labelTime = seconds => seconds === 1 ? '1 s' : `${Math.round(seconds * 1000)} ms`;
const labels = ['MuJoCo Warp', 'Native MuJoCo WASM', 'Community world model'];
const panel = document.getElementById('warp-replay');
if (panel) loadReplay().catch(() => {
  panel.querySelector('[role=status]').textContent = 'The recorded Warp experiment could not be loaded.';
});

async function loadReplay() {
  const response = await fetch('article/warp-horizons.json.gz');
  if (!response.ok) throw new Error('Missing Warp replay');
  const raw = response.body.pipeThrough(new DecompressionStream('gzip'));
  const data = await new Response(raw).json();
  const select = panel.querySelector('select');
  const chart = panel.querySelector('#forecast-chart');
  const tbody = panel.querySelector('tbody');
  const outcome = panel.querySelector('#forecast-outcome');
  const scrub = panel.querySelector('input');
  const canvas = panel.querySelector('canvas');
  const button = panel.querySelector('button');
  const c = canvas.getContext('2d');
  const time = panel.querySelector('output');
  const maxGap = Math.max(...data.conditions.flatMap(condition =>
    condition.summary.flatMap(row => row.medianCm)));
  let timer = null;
  const condition = () => data.conditions[Number(select.value)];

  function summarize() {
    const rows = condition().summary;
    chart.replaceChildren();
    tbody.replaceChildren();
    for (const row of rows) {
      const key = labelTime(row.seconds);
      const group = document.createElement('div');
      group.className = 'forecast-row';
      const title = document.createElement('strong');
      title.textContent = key;
      group.append(title);
      for (const pair of [0, 2]) {
        const lane = document.createElement('span');
        lane.className = pair === 0 ? 'forecast-lane learned' : 'forecast-lane native';
        const bar = document.createElement('i');
        bar.style.setProperty('--bar-ratio', String(row.medianCm[pair] / maxGap));
        const value = document.createElement('b');
        value.textContent = `${formatGap(row.medianCm[pair])} cm`;
        lane.setAttribute('aria-label', `${pair === 0 ? 'Learned model' : 'Native MuJoCo'} vs. Warp: ${value.textContent}`);
        value.setAttribute('aria-hidden', 'true');
        lane.append(bar, value);
        group.append(lane);
      }
      chart.append(group);
      const tr = tbody.insertRow();
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = key;
      tr.append(th);
      for (let pair = 0; pair < row.medianCm.length; pair++) {
        const values = row.perSeedCm.map(seed => seed[pair]);
        const cell = tr.insertCell();
        cell.textContent = `${formatGap(row.medianCm[pair])} (${formatGap(Math.min(...values))} to ${formatGap(Math.max(...values))})`;
      }
    }
    const first = rows[0].medianCm, last = rows.at(-1).medianCm;
    outcome.textContent = `The learned model’s median gap to Warp rose from ${formatGap(first[0])} cm at 20 ms to ${formatGap(last[0])} cm at 1 s. Native MuJoCo differed from Warp by ${formatGap(last[2])} cm at 1 s.`;
  }

  function draw() {
    const run = condition().example;
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

  }

  function stop() {
    clearInterval(timer);
    timer = null;
    button.textContent = 'Play replay';
  }

  scrub.max = condition().example.frames.length - 1;
  select.onchange = () => { stop(); scrub.value = 0; summarize(); draw(); };
  scrub.oninput = () => { stop(); draw(); };
  canvas.closest('details').ontoggle = event => { if (!event.currentTarget.open) stop(); };
  button.onclick = () => {
    if (timer !== null) { stop(); return; }
    if (scrub.value === scrub.max) scrub.value = 0;
    button.textContent = 'Pause replay';
    timer = setInterval(() => {
      scrub.stepUp();
      draw();
      if (scrub.value === scrub.max) stop();
    }, 110);
  };
  select.disabled = false;
  panel.querySelector('fieldset').disabled = false;
  summarize();
  panel.querySelector('[role=status]').textContent =
    `Four seeded trajectories per friction setting, five overlapping windows per trajectory. Warp ${data.versions['mujoco-warp']} ran on ${data.device.toUpperCase()}.`;
  draw();
}
