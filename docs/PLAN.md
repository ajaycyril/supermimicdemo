# SuperMimic vs Physics

## The project

A small, honest browser experiment by Ajay Cyril: place a learned robot dynamics model next to MuJoCo, give both the same starting state and commands, and measure where their predictions disagree. A polished portfolio demo is the primary product. A personal Substack story follows the evidence.

## Build sequence

1. **Real comparison.** Use the community e8 checkpoint, export only its dynamics network, match robot states, actuators and control timing, and run real MuJoCo WASM beside real ONNX inference. Verify dimensions, math invariance, model-export parity and finite simulation behavior.
2. **Interactive demo.** Show the two robot trajectories, root-position gap, joint error and replay. Let visitors change friction, command amplitude, prediction refresh, seeded noise and initial momentum. Clearly label the scripted controller.
3. **Evidence.** Export looping GIFs, full JSON and CSV from the same run. Generate six captures with settings and metrics. State gaps and surprising failures are part of the result, not something to hide.
4. **Publish.** Keep source, method, export tools, test results and article together in GitHub. Use GitHub Actions to prepare assets and GitHub Pages to host the static frontend. No Vercel, paid server or API secret.

## Article angle

**I put a robot world model next to physics. Here’s what I learned.**

Start with curiosity about SuperMimic. Explain a policy and a world model in two plain sentences. Use the demo to explore short predictions, long rollouts and the effect of fresh state. Explain Warp and mjlab only when needed. Close with what the experiment establishes and what it cannot.

## First release boundary

- Inference and comparison, not training.
- Community reproduction, not the authors’ official checkpoint.
- Scripted shoulder motion and optional seeded command noise, not a learned tracking policy.
- Native MuJoCo WASM, not MuJoCo Warp CUDA.
- Robot link frames rendered on Canvas2D; no Three.js dependency.
- Simulator agreement is not real-robot validation.

## A useful next version

Add the released trained policy with a properly licensed reference motion and matched observation history. Keep fixed-action prediction tests separate from closed-loop policy tests. Add an optional WebGPU path only after output parity and a measured latency comparison. Do not fold either feature into the current claims before it works.
