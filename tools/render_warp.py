"""Animate measured Warp, native MuJoCo and learned-model body positions."""
import gzip
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

article = Path("article")
with gzip.open(article / "warp-study.json.gz", "rt") as source:
    data = json.load(source)
colors = ("#5947a4", "#116d79", "#b84d23")
engines = ("MuJoCo Warp", "Native MuJoCo", "Learned dynamics")
pairs = ("Learned / Warp", "Learned / native", "Native / Warp")
font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def label(draw, position, value, size=22, fill="#142d32", anchor=None):
    draw.text(position, value, font=ImageFont.truetype(font_path, size), fill=fill, anchor=anchor)


def render(case, i):
    image = Image.new("P", (900, 556))
    palette = ["#f8f7f3", "#142d32", "#526668", "#dbe3df", *colors, "#ffffff"]
    image.putpalette([int(c[j:j+2], 16) for c in palette for j in (1, 3, 5)])
    draw = ImageDraw.Draw(image)
    frame = case["frames"][i]
    label(draw, (25, 19), "Same commands. Three predictions.", 33, 1)
    label(draw, (25, 66), f"Recorded G1 models   |   Warp starting state at {case['anchor'] * data['timestep']:.2f} s", 17, 2)
    label(draw, (875, 68), f"{frame['t']:.2f} s", 19, 1, "ra")
    origin_x, origin_y = case["frames"][0]["bodies"][0][3:5]
    for side, bodies in enumerate(frame["bodies"]):
        center = 150 + 300 * side
        color = 4 + side
        label(draw, (center, 118), engines[side], 23, color, "ma")
        draw.line((center-120, 330, center+120, 330), fill=3, width=2)
        def point(j):
            x, y, z = bodies[j*3:j*3+3]
            return center + 150 * (y-origin_y + .65*(x-origin_x)), 330 - 180*z
        for j, parent in enumerate(data["parents"]):
            if j and parent:
                a, b = point(parent), point(j)
                draw.line((*a, *b), fill=color, width=5)
                draw.ellipse((b[0]-3, b[1]-3, b[0]+3, b[1]+3), fill=color)
    draw.line((25, 357, 875, 357), fill=3, width=2)
    top, bottom = 408, 508
    max_gap = max(gap for sample in case["frames"] for gap in sample["gaps"])
    scale = max(1, math.ceil(max_gap / 5) * 5)
    for value in (0, scale/2, scale):
        y = bottom - (bottom-top) * value / scale
        draw.line((86, y, 507, y), fill=3, width=1)
        label(draw, (76, y), f"{value:g}", 14, 2, "rm")
    label(draw, (25, 375), "Root-position gap (cm)", 19, 1)
    for j, (pair, color) in enumerate(zip(pairs, (6, 5, 4))):
        points = [(86 + 421*k/50, bottom-(bottom-top)*f["gaps"][j]/scale) for k, f in enumerate(case["frames"][:i+1])]
        if j == 1:
            for k in range(0, len(points)-1, 4):
                draw.line(points[k:k+3], fill=color, width=2)
        elif len(points) > 1:
            draw.line(points, fill=color, width=3)
        label(draw, (543, 408+j*35), pair, 17, color)
        label(draw, (875, 408+j*35), f"{frame['gaps'][j]:.{4 if frame['gaps'][j] < .01 else 2}f} cm", 17, color, "ra")
    label(draw, (25, 531), "Numerical comparison. Physical G1 measurements would provide a real-world reference.", 15, 2)
    return image


for name, case in (("warp-start", data["cases"][0]), ("warp-contact", min(data["cases"], key=lambda x:x["height"]))):
    frames = [render(case, i) for i in range(0, len(case["frames"]), 2)]
    frames[0].save(article / "gifs" / (name + ".gif"), save_all=True, append_images=frames[1:],
                   duration=[550]+[85]*(len(frames)-2)+[1250], loop=0, optimize=True)
