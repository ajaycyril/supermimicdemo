"""Collect MuJoCo Warp rollouts from identical commands."""
import importlib.metadata
import json
import sys
from pathlib import Path

import mujoco
import mujoco_warp as mjw
import numpy as np
import warp as wp

spec = json.load(sys.stdin)
xml = Path("dist/assets/g1.xml").read_text()
model = mujoco.MjModel.from_xml_string(xml)
joints = json.loads(Path("dist/assets/robot.json").read_text())["joints"]
home = np.array([joint["home"] for joint in joints])
scale = np.array([joint["scale"] for joint in joints])
model.geom_friction[model.geom_priority == 1, 0] = spec["friction"]
device = sys.argv[1] if len(sys.argv) > 1 else "cpu"
wp.config.quiet = True
wp.init()
with wp.ScopedDevice(device):
    data = mujoco.MjData(model)
    data.qpos[:], data.qvel[:] = spec["initial"][:36], spec["initial"][36:]
    data.ctrl[:] = home
    mujoco.mj_forward(model, data)
    warp_model = mjw.put_model(model)
    warp_data = mjw.put_data(model, data, nconmax=35, njmax=250)
    warp_states = [spec["initial"]]
    for action in spec["actions"]:
        targets = home + scale * action

        warp_data.ctrl.assign(targets.astype(np.float32)[None, :])
        for _ in range(4):
            mjw.step(warp_model, warp_data)
        warp_states.append(np.concatenate((warp_data.qpos.numpy()[0], warp_data.qvel.numpy()[0])).tolist())
report = {**spec, "warp": warp_states, "device": device,
          "versions": {name: importlib.metadata.version(name) for name in ("mujoco", "mujoco-warp", "warp-lang")}}
Path("dist/warp-states.json").write_text(json.dumps(report, allow_nan=False))
