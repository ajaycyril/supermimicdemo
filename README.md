# SuperMimic × MuJoCo

A visual explanation of SuperMimic’s training loop, with an independent experiment measuring prediction drift against MuJoCo Warp and native MuJoCo.

**[Explore the comparison](https://ajaycyril.github.io/supermimicdemo/)** · **[Read the article](https://ajaycyril.github.io/supermimicdemo/article.html)**

## The prediction experiment

The demo compares the community learned model with MuJoCo Warp and native MuJoCo. It measures five forecast horizons across 20 windows at each of two foot-friction settings. The median learned-to-Warp gap reaches 6.37 cm at one second with standard friction and 8.76 cm with lower friction. The two physics backends differ by 0.00022 cm and 0.0020 cm at that horizon. The site includes per-seed median ranges and an example replay for each setting.

![Measured forecast horizons](article/gifs/forecast-horizon.gif)

## Explore

The browser comparison runs MuJoCo and the released neural dynamics model locally. Adjust motion, frequency, friction, command noise and state refresh while it runs. Pause, advance one step, slow the view to 0.1×, or replay a recorded trajectory. Recordings retain the applied control changes.

The [article](article/article.md), “One GPU, three hours. How SuperMimic makes robots learn faster,” explains the architecture, the gradient path and the evidence behind the training claims. It includes original diagrams, an animation, and links to the research and experiment methodology.

[Study data](article/warp-horizons.json.gz) · [Methodology](docs/METHOD.md) · [Study implementation](tools/warp-study.mjs)

## Sources

The pretrained dynamics checkpoint comes from [CuboiLeo's independent reproduction](https://github.com/CuboiLeo/SuperMimic-Reproduced). The original research is [SuperMimic](https://supermimic.github.io/); the earlier controller comparison is [SONIC](https://nvlabs.github.io/GEAR-SONIC/).

The project uses [mjlab](https://github.com/mujocolab/mjlab) robot parameters, [MuJoCo](https://github.com/google-deepmind/mujoco), [ONNX Runtime](https://github.com/microsoft/onnxruntime), and [gifenc](https://github.com/mattdesl/gifenc). Source notices and model provenance are retained with the project.

## Continue reading

Read the companion [SuperMimic analysis on DigDeep Tech](https://digdeeptech.com/supermimic-a-better-way-to-train-robots-than-a-physics-simulator/) for the motivation, limitations and further experiments. Follow new essays on [Substack](https://digdeeptech.substack.com/) and shorter robotics notes on [X](https://x.com/ajcyril).

By Ajay Cyril · [DigDeepTech](https://digdeeptech.com/)
